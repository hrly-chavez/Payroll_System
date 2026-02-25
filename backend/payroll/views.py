from rest_framework import generics, status
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView
from shared_model.models import *
from .serializers import *
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.utils.timezone import now
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from datetime import date, timedelta
from .services import PayrollGenerationService,get_latest_active_payroll
from rest_framework.exceptions import PermissionDenied
from django.db.models.fields import DateField, DateTimeField
from io import BytesIO
from django.http import FileResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

# helpers
def _overlaps_period(eff_from, eff_to, period_start, period_end):
    """
    Returns True if [eff_from, eff_to] overlaps with [period_start, period_end].
    eff_to=None means ongoing.
    """
    eff_to = eff_to or date.max
    return eff_from <= period_end and eff_to >= period_start


def _require_approver(user):
    role = (getattr(user, "role", "") or "").strip().upper()
    if role == "SUPER_ADMIN" or getattr(user, "is_superuser", False):
        return

    emp = getattr(user, "employee", None)
    if emp and (getattr(emp, "position", "") or "").strip().upper() == "CEO":
        return

    raise PermissionDenied("You are not allowed to approve/decline payroll.")



def _recompute_period_status(period: Payroll_Period):
    """
    Single source of truth for Payroll_Period.status.
    - If any PPE is Processing -> period Processing
    - Else if all PPE are Approved/Declined (and at least 1 exists) -> period Closed
    - Else -> period Processing (because there are Pending/Verified remaining)
    """
    qs = PayrollPeriodEmployee.objects.filter(period=period)

    if qs.filter(status="Processing").exists():
        if period.status != "Processing":
            period.status = "Processing"
            period.save(update_fields=["status"])
        return

    if qs.exists() and not qs.exclude(status__in=["Approved", "Declined"]).exists():
        if period.status != "Closed":
            period.status = "Closed"
            period.save(update_fields=["status"])
        return

    # If there are still Pending/Verified (or anything else), it should remain Processing for approvals to continue.
    if period.status != "Processing":
        period.status = "Processing"
        period.save(update_fields=["status"])


def _set_payroll_approved_at(payroll: Payroll, now_dt):
    """
    Avoid mismatches: if Payroll.approved_at is DateTimeField -> save datetime
    if DateField -> save date
    """
    try:
        f = payroll._meta.get_field("approved_at")
        if isinstance(f, DateTimeField):
            payroll.approved_at = now_dt
        elif isinstance(f, DateField):
            payroll.approved_at = now_dt.date()
        else:
            # fallback
            payroll.approved_at = now_dt
    except Exception:
        # fallback (keeps current behavior safe)
        payroll.approved_at = now_dt.date()
#==========================================DEDUCTIONS========================================
# List and Create
#done logs
class DeductionListCreateView(generics.ListCreateAPIView):
    queryset = Deduction_Type.objects.all().order_by('-create_at')
    serializer_class = DeductionTypeSerializer
    permission_classes = [IsAuthenticated]

# Retrieve, Update, Delete
#done logs
class DeductionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Deduction_Type.objects.all()
    serializer_class = DeductionTypeSerializer

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        # Save updated Deduction_Type
        updated_instance = serializer.save()

        # Only recompute AFTER transaction commits
        if any(field in request.data for field in [
            "salary_range_from",
            "salary_range_to",
            "is_active",
            "amount",
            "calculation_type"
        ]):
            print(f"[DEBUG] Scheduling recompute for Deduction_Type id={updated_instance.id}")

            transaction.on_commit(
                lambda: self._recompute_employee_deductions(updated_instance)
            )

        return Response(serializer.data, status=status.HTTP_200_OK)

    # -----------------------------
    # Helper: compute deduction amount
    # -----------------------------
    def _compute_deduction_amount(self, employee_salary, deduction_type):
        if deduction_type.calculation_type == "Fixed":
            return deduction_type.amount
        elif deduction_type.calculation_type == "Percent":
            amount = round(employee_salary * (deduction_type.amount / Decimal("100")), 2)
            print(f"[DEBUG] Computing {deduction_type.code} for salary {employee_salary}: {amount}")
            return amount
        return Decimal("0.00")

    # -----------------------------
    # Helper: recompute Employee_Deductions
    # -----------------------------
    def _recompute_employee_deductions(self, deduction_type):
        from shared_model.models import Employee, Employee_Deduction

        today = now().date()
        employees = Employee.objects.filter(is_active=True)

        for employee in employees:
            # Get latest salary
            latest_salary = employee.salaries.filter(
                effective_from__lte=today
            ).order_by("-effective_from").first()

            if not latest_salary:
                continue

            salary = latest_salary.base_rate

            # Check if salary is within the updated range
            in_range = (
                Decimal(deduction_type.salary_range_from)
                <= salary
                <= Decimal(deduction_type.salary_range_to)
            )

            # Look for existing deduction for today
            deduction, created = Employee_Deduction.objects.get_or_create(
                employee=employee,
                deduction_type=deduction_type,
                effective_from=today,
                defaults={
                    'amount': Decimal(deduction_type.amount) if deduction_type.calculation_type == "Fixed" else round(salary * Decimal(deduction_type.amount) / Decimal("100"), 2),
                    'frequency': "Per Period",
                    'status': "Active"
                }
            )

            if in_range:
                # If it exists but is inactive, reactivate and update amount
                if not created and deduction.status != "Active":
                    deduction.status = "Active"
                    if deduction_type.calculation_type == "Percent":
                        deduction.amount = round(salary * Decimal(deduction_type.amount) / Decimal("100"), 2)
                    else:
                        deduction.amount = Decimal(deduction_type.amount)
                    deduction.save(update_fields=['status', 'amount'])
                    print(f"[DEBUG] Reactivated deduction for {employee.fname}")
                elif created:
                    print(f"[DEBUG] Created deduction for {employee.fname}")
                else:
                    # Already active and correct → optionally update amount if Percent
                    if deduction_type.calculation_type == "Percent":
                        deduction.amount = round(salary * Decimal(deduction_type.amount) / Decimal("100"), 2)
                        deduction.save(update_fields=['amount'])
            else:
                # Out of range → deactivate
                if deduction.status == "Active":
                    deduction.status = "Inactive"
                    deduction.save(update_fields=['status'])
                    print(f"[DEBUG] Deactivated deduction for {employee.fname}")

# Optional: Update only 'is_active' status
#done logs
class DeductionUpdateStatusView(APIView):
    def patch(self, request, pk):
        try:
            deduction = Deduction_Type.objects.get(pk=pk)
        except Deduction_Type.DoesNotExist:
            return Response(
                {"error": "Deduction not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Update only is_active
        deduction.is_active = request.data.get(
            "is_active",
            deduction.is_active
        )

        # Attach user BEFORE save
        deduction._current_user = request.user

        deduction.save()

        serializer = DeductionTypeSerializer(
            deduction,
            context={"request": request}  # good practice
        )
        return Response(serializer.data, status=status.HTTP_200_OK)



#==========================================PAYROLL PERIOD========================================
#Making Payroll Period
class PayrollPeriodListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PayrollPeriodCreateSerializer
    queryset = Payroll_Period.objects.all().order_by("-start_date")

    def perform_create(self, serializer):
        start_date = serializer.validated_data["start_date"]
        end_date = serializer.validated_data["end_date"]

        # Example code format: PP-20260201-20260215
        code = f"PP-{start_date.strftime('%Y%m%d')}-{end_date.strftime('%Y%m%d')}"

        serializer.save(
            code=code,
            status="Open",
        )


# for clicking the payroll period (shows modal with employees) fetch
class PayrollPeriodEligibleEmployeesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, period_id):
        period = get_object_or_404(Payroll_Period, id=period_id)

        # attendance must exist within the payroll period date range
        attendance_in_period = Attendance.objects.filter(
            employee_id=OuterRef("pk"),
            date__gte=period.start_date,
            date__lte=period.end_date,
        )

        # 1) define the employee population for this period (same rules as before)
        period_employees = (
            Employee.objects
            .filter(is_active=True)
            .exclude(
                Q(position__iexact="CEO") |
                Q(user__role__iexact="SUPER_ADMIN")
            )
            .exclude(Q(user__isnull=False) & Q(user__is_active=False))
            .annotate(has_attendance=Exists(attendance_in_period))
            .filter(has_attendance=True)
            .select_related("department", "user")
        )

        # 2) lazy-create PayrollPeriodEmployee rows for these employees
        existing_employee_ids = set(
            PayrollPeriodEmployee.objects.filter(period=period)
            .values_list("employee_id", flat=True)
        )

        to_create = [
            PayrollPeriodEmployee(period=period, employee=e)
            for e in period_employees
            if e.id not in existing_employee_ids
        ]

        if to_create:
            PayrollPeriodEmployee.objects.bulk_create(to_create, ignore_conflicts=True)

        # 3) return ALL PayrollPeriodEmployee rows for this period (including Processing/Approved/etc)
        ppe_qs = (
            PayrollPeriodEmployee.objects
            .filter(period=period, employee__in=period_employees)
            .select_related("employee", "employee__department")
            .order_by("employee__lname", "employee__fname")
        )

        return Response({
            "period": PayrollPeriodCreateSerializer(period).data,
            "eligible_employees": EligibleEmployeeSerializer(ppe_qs, many=True).data,
        })


#=========================VERIFY EMPLOYEE==========================

# Returns salary, shift, taxes, loans, and allowances for employee verification preview
class PayrollVerifyEmployeeSnapshotView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, period_id, employee_id):
        period = get_object_or_404(Payroll_Period, id=period_id)
        employee = get_object_or_404(
            Employee.objects.select_related("department", "shift", "department__shift_id"),
            id=employee_id
        )
        ppe = get_object_or_404(PayrollPeriodEmployee, period=period, employee=employee)

        warnings = []

        shift = employee.shift or getattr(employee.department, "shift_id", None)
        if not shift:
            warnings.append("No shift assigned (employee.shift and department.shift_id are empty).")

        salary = (
            Employee_Salary.objects
            .filter(employee=employee, effective_from__lte=period.end_date)
            .order_by("-effective_from")
            .first()
        )
        if not salary:
            warnings.append("No salary found with effective_from <= payroll period end date.")

        deductions_qs = (
            Employee_Deduction.objects
            .select_related("deduction_type")
            .filter(employee=employee, status="Active")
        )

        in_period_deductions = [
            d for d in deductions_qs
            if _overlaps_period(d.effective_from, d.effective_to, period.start_date, period.end_date)
        ]

        # Loans first (so we can exclude them from taxes)
        loans = [
            d for d in in_period_deductions
            if (d.amortization_per_period is not None) or (d.total_loan_amount is not None)
        ]

        # Taxes: category=TAX and not a loan row
        taxes = [
            d for d in in_period_deductions
            if d.deduction_type
            and d.deduction_type.category == "TAX"
            and d not in loans
        ]

        if not taxes:
            warnings.append("No mandatory tax deductions found for this period (category=TAX).")

        # Allowances active during the payroll period
        allowances_qs = (
            Employee_Allowance.objects
            .select_related("allowance_type")
            .filter(employee=employee, status="Active")
        )

        in_period_allowances = [
            a for a in allowances_qs
            if _overlaps_period(a.effective_from, a.effective_to, period.start_date, period.end_date)
        ]

        attendances = (
            Attendance.objects
            .filter(
                employee=employee,
                date__gte=period.start_date,
                date__lte=period.end_date
            )
            .prefetch_related("events")
            .order_by("date")
        )

        if not attendances.exists():
            warnings.append("No attendance records found within this payroll period.")

        payload = {
            "period_id": period.id,
            "employee_id": employee.id,
            "full_name": f"{employee.fname} {employee.lname}".strip(),
            "department_name": employee.department.name if employee.department else None,
            "status": ppe.status,
            "shift": shift,
            "salary": salary,
            "taxes": taxes,
            "loans": loans,
            "allowances": in_period_allowances,
            "attendances": attendances,  # NEW
            "warnings": warnings,
        }

        return Response(
            PayrollVerifySnapshotSerializer(payload).data,
            status=http_status.HTTP_200_OK
        )

# Marks an employee as verified for a payroll period
class PayrollVerifyEmployeeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, period_id, employee_id):
        period = get_object_or_404(Payroll_Period, id=period_id)
        employee = get_object_or_404(Employee, id=employee_id)

        ppe = get_object_or_404(PayrollPeriodEmployee, period=period, employee=employee)

        # Already verified (or beyond) — do not re-verify
        if ppe.status != "Pending":
            return Response(
                {"detail": f"Employee is already {ppe.status}."},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        # Optional: enforce prerequisites before verification
        salary = (
            Employee_Salary.objects
            .filter(employee=employee, effective_from__lte=period.end_date)
            .order_by("-effective_from")
            .first()
        )
        if not salary:
            return Response(
                {"detail": "Cannot verify: employee has no active salary for this payroll period."},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        # Shift is optional; if  want to enforce it, uncomment:
        shift = employee.shift or getattr(employee.department, "shift_id", None)
        if not shift:
            return Response({"detail": "Cannot verify: employee has no shift assigned."}, status=http_status.HTTP_400_BAD_REQUEST)

        ppe.status = "Verified"
        ppe.verified_by = request.user
        ppe.verified_at = timezone.now()
        ppe.save(update_fields=["status", "verified_by", "verified_at", "updated_at"])

        return Response(
            {"detail": "Employee verified successfully.", "status": ppe.status},
            status=http_status.HTTP_200_OK
        )

#===========================ADD COMMISSION========================
class CommissionTypeListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CommissionTypeSerializer

    def get_queryset(self):
        # only active types
        return Commission_Type.objects.filter(is_active=True).order_by("name")


class PayrollPeriodEmployeeCommissionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def _guard_locked(self, period, employee):
        # block when payroll already exists
        if (Payroll.objects.filter(payroll_period=period, employee=employee).exclude(status="Void").exists()):
            return Response(
                {"detail": "Payroll already generated. Commissions are locked for this employee in this period."},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        ppe = get_object_or_404(PayrollPeriodEmployee, period=period, employee=employee)

        if ppe.status != "Pending":
            return Response(
                {"detail": f"Cannot modify commissions when status is {ppe.status}. Commissions are only allowed while Pending."},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        return None  # OK

    def get(self, request, period_id, employee_id):
        period = get_object_or_404(Payroll_Period, id=period_id)
        employee = get_object_or_404(Employee, id=employee_id)

        qs = PayrollPeriodEmployeeCommission.objects.filter(
            period=period,
            employee=employee
        ).select_related("commission_type").order_by("-created_at")

        return Response(
            PayrollPeriodEmployeeCommissionListSerializer(qs, many=True).data,
            status=http_status.HTTP_200_OK
        )

    @transaction.atomic
    def post(self, request, period_id, employee_id):
        period = get_object_or_404(Payroll_Period, id=period_id)
        employee = get_object_or_404(Employee, id=employee_id)

        locked = self._guard_locked(period, employee)
        if locked:
            return locked

        serializer = PayrollPeriodEmployeeCommissionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        commission_type = serializer.validated_data["commission_type"]

        # enforce unique per type per period per employee
        obj, created = PayrollPeriodEmployeeCommission.objects.update_or_create(
            period=period,
            employee=employee,
            commission_type=commission_type,
            defaults={
                "amount": serializer.validated_data["amount"],
                "remarks": serializer.validated_data.get("remarks", ""),
                "created_by": request.user,
            },
        )

        return Response(
            {
                "detail": "Commission saved successfully.",
                "commission": PayrollPeriodEmployeeCommissionListSerializer(obj).data,
            },
            status=http_status.HTTP_201_CREATED if created else http_status.HTTP_200_OK
        )


#==========================================PAYRULE========================================
#done logs
class SuperAdminPayRuleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PayRuleSerializer

    def get_queryset(self):
        # If you want only active rules by default, uncomment:
        # return Pay_Rule.objects.filter(is_active=True).order_by("-id")
        return Pay_Rule.objects.all().order_by("-id")

    def perform_create(self, serializer):
        # Optional: enforce effective_from <= effective_to
        effective_from = serializer.validated_data.get("effective_from")
        effective_to = serializer.validated_data.get("effective_to")
        if effective_to and effective_from and effective_to < effective_from:
            raise ValidationError({"detail": "effective_to cannot be earlier than effective_from."})

        serializer.save()

#done logs
class SuperAdminPayRuleRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PayRuleSerializer
    queryset = Pay_Rule.objects.all()

    def perform_update(self, serializer):
        effective_from = serializer.validated_data.get("effective_from", serializer.instance.effective_from)
        effective_to = serializer.validated_data.get("effective_to", serializer.instance.effective_to)

        if effective_to and effective_from and effective_to < effective_from:
            raise ValidationError({"detail": "effective_to cannot be earlier than effective_from."})

        serializer.save()
    
class PayRuleChoicesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        event_type_choices = [
            {"value": value, "label": label}
            for value, label in Pay_Rule.event_type_choices
        ]

        category_choices = [
            {"value": value, "label": label}
            for value, label in Pay_Rule.categories
        ]

        rate_type_choices = [
            {"value": value, "label": label}
            for value, label in Pay_Rule.RATE_TYPE_CHOICES
        ]

        return Response({
            "event_type_choices": event_type_choices,
            "category_choices": category_choices,
            "rate_type_choices": rate_type_choices,
        })


#======================================PAYROLL GENERATION========================================
#Ari nlaang butang notif para sa CEO kay after ma generate need na dayon approval
class GeneratePayrollForPeriodView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, period_id: int):
        svc = PayrollGenerationService()
        result = svc.generate_for_period(
            period_id=period_id,
            generated_by_user=request.user
        )

        # Get the period (for title/description context)
        period = Payroll_Period.objects.filter(id=period_id).first()

        # Notify all SUPER_ADMIN users
        super_admins = User.objects.filter(role="SUPER_ADMIN")

        notifications = []
        for admin in super_admins:
            notifications.append(
                Notification(
                    user=admin,
                    title="Payroll Period Generated",
                    description=f"Payroll for period {period} has been successfully generated.",
                    category="payroll",
                    redirect_url="/super-admin/calendar",
                )
            )

        Notification.objects.bulk_create(notifications)

        serializer = GeneratePayrollPeriodResponseSerializer(result)
        return Response(serializer.data, status=status.HTTP_200_OK)

#per employee butang notif para sa mga na decline
class GeneratePayrollForEmployeeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, period_id: int, employee_id: int):
        svc = PayrollGenerationService()
        result = svc.generate_for_employee(
            period_id=period_id,
            employee_id=employee_id,
            generated_by_user=request.user
        )

        serializer = GeneratePayrollEmployeeResponseSerializer(result)
        return Response(serializer.data, status=status.HTTP_200_OK)

#==========================================PAYROLL PAYSLIP OUTPUT===========================

class PayrollEmployeeResultView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, period_id: int, employee_id: int):
        # EMPLOYEE users can only view their own payroll
        role = (getattr(request.user, "role", "") or "").strip().upper()
        if role == "EMPLOYEE":
            emp = getattr(request.user, "employee", None)
            if not emp or emp.id != employee_id:
                raise PermissionDenied("You are not allowed to view other employees' payroll results.")

        ppe = get_object_or_404(
            PayrollPeriodEmployee.objects.select_related("employee", "employee__department"),
            period_id=period_id,
            employee_id=employee_id,
        )
        payroll = (
            get_latest_active_payroll(period_id=period_id, employee_id=employee_id)
        )

        if payroll:
            # Re-fetch with related/prefetch (so serializer payload stays the same, but correct payroll selected)
            payroll = (
                Payroll.objects
                .filter(id=payroll.id)
                .select_related("payroll_period", "employee", "employee__department")
                .prefetch_related("payslip_lines", "payslip_lines__rule")
                .first()
            )

        if not payroll:
            return Response(
                {"detail": "Payroll has not been generated for this employee in this period."},
                status=http_status.HTTP_404_NOT_FOUND
            )

        period = payroll.payroll_period  # use select_related result (no extra DB hit)
        emp = payroll.employee
        lines_qs = payroll.payslip_lines.all().order_by("id")

        payload = {
            "payroll_id": payroll.id,
            "payroll_status": payroll.status,

            "period_id": period.id,
            "period_code": period.code,
            "period_start_date": period.start_date,
            "period_end_date": period.end_date,

            "employee_id": emp.id,
            "employee_full_name": f"{emp.fname} {emp.lname}".strip(),
            "department_name": emp.department.name if emp.department else None,

            "ppe_status": ppe.status,
            "declined_reason": ppe.declined_reason,

            "basic_pay": payroll.basic_pay,
            "total_earnings": payroll.total_earnings,
            "total_deductions": payroll.total_deductions,
            "net_pay": payroll.net_pay,

            "lines": lines_qs,
        }

        return Response(PayrollResultSerializer(payload).data, status=http_status.HTTP_200_OK)

#For employee dashboard payroll(rows & columns)
class EmployeePayrollListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Employee-only endpoint (HR/Admin can be allowed too if you want)
        emp = getattr(request.user, "employee", None)
        if not emp:
            return Response({"detail": "No employee profile found for this user."}, status=http_status.HTTP_400_BAD_REQUEST)

        # All PPE rows for this employee
        ppe_qs = (
            PayrollPeriodEmployee.objects
            .filter(employee=emp)
            .select_related("period")
            .order_by("-period__start_date")
        )

        period_ids = list(ppe_qs.values_list("period_id", flat=True))

        # Latest active payroll per period (exclude Void, pick highest run_no)
        payroll_rows = (
            Payroll.objects
            .filter(employee=emp, payroll_period_id__in=period_ids)
            .exclude(status="Void")
            .select_related("payroll_period")
            .order_by("payroll_period_id", "-run_no", "-id")
        )

        latest_by_period = {}
        for pr in payroll_rows:
            if pr.payroll_period_id not in latest_by_period:
                latest_by_period[pr.payroll_period_id] = pr

        data = []
        for ppe in ppe_qs:
            period = ppe.period
            pr = latest_by_period.get(period.id)

            data.append({
                # employee identity for frontend display + modal
                "employee_id": emp.id,
                "employee_full_name": f"{emp.fname} {emp.lname}".strip(),
                "department_name": emp.department.name if emp.department else None,

                # period info
                "period_id": period.id,
                "period_code": period.code,
                "period_start_date": period.start_date,
                "period_end_date": period.end_date,
                "pay_date": period.pay_date,
                "period_status": period.status,

                # ppe status
                "ppe_status": ppe.status,
                "declined_reason": ppe.declined_reason,

                # latest active payroll summary
                "payroll_id": pr.id if pr else None,
                "payroll_status": pr.status if pr else None,
                "run_no": pr.run_no if pr else None,
                "net_pay": pr.net_pay if pr else None,
            })

        return Response(EmployeePayrollRowSerializer(data, many=True).data, status=http_status.HTTP_200_OK)

#this is for admin and superadmin viewing the result of Payslips
class AdminEmployeePayrollListView(APIView):
    """
    Admin/SuperAdmin endpoint to fetch payrolls for any employee by ID.
    """
    permission_classes = [AllowAny]  # Adjust to IsAdminUser or custom role permission

    def get(self, request):
        employee_id = request.query_params.get("employee_id")
        if not employee_id:
            return Response({"detail": "employee_id is required."}, status=http_status.HTTP_400_BAD_REQUEST)

        emp = get_object_or_404(Employee, pk=employee_id)

        # Fetch all PPE rows for this employee
        ppe_qs = (
            PayrollPeriodEmployee.objects
            .filter(employee=emp)
            .select_related("period")
            .order_by("-period__start_date")
        )

        period_ids = list(ppe_qs.values_list("period_id", flat=True))

        payroll_rows = (
            Payroll.objects
            .filter(employee=emp, payroll_period_id__in=period_ids)
            .exclude(status="Void")
            .select_related("payroll_period")
            .order_by("payroll_period_id", "-run_no", "-id")
        )

        latest_by_period = {}
        for pr in payroll_rows:
            if pr.payroll_period_id not in latest_by_period:
                latest_by_period[pr.payroll_period_id] = pr

        data = []
        for ppe in ppe_qs:
            period = ppe.period
            pr = latest_by_period.get(period.id)

            data.append({
                "employee_id": emp.id,
                "employee_full_name": f"{emp.fname} {emp.lname}".strip(),
                "department_name": emp.department.name if emp.department else None,
                "period_id": period.id,
                "period_code": period.code,
                "period_start_date": period.start_date,
                "period_end_date": period.end_date,
                "pay_date": period.pay_date,
                "period_status": period.status,
                "ppe_status": ppe.status,
                "declined_reason": ppe.declined_reason,
                "payroll_id": pr.id if pr else None,
                "payroll_status": pr.status if pr else None,
                "run_no": pr.run_no if pr else None,
                "net_pay": pr.net_pay if pr else None,
            })

        return Response(EmployeePayrollRowSerializer(data, many=True).data, status=http_status.HTTP_200_OK)
    
#==========================================CEO / SUPERADMIN APPROVAL===========================

class PayrollPeriodApprovalQueueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, period_id: int):
        _require_approver(request.user)

        period = get_object_or_404(Payroll_Period, id=period_id)

        # filter: Processing (default), Approved, Declined, All
        status_filter = (request.query_params.get("status") or "Processing").strip()
        allowed = {"Processing", "Approved", "Declined", "All"}
        if status_filter not in allowed:
            return Response(
                {"detail": f"Invalid status filter. Allowed: {sorted(list(allowed))}"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        ppe_qs = PayrollPeriodEmployee.objects.filter(period=period).select_related(
            "employee", "employee__department"
        )

        if status_filter != "All":
            ppe_qs = ppe_qs.filter(status=status_filter)

        ppe_qs = ppe_qs.order_by("employee__lname", "employee__fname")

        # Collect latest active payroll per employee (non-Void)
        # Efficient approach: fetch all payrolls for the period (non-Void), order by run_no desc, pick first per employee
        payroll_rows = (
            Payroll.objects
            .filter(payroll_period=period)
            .exclude(status="Void")
            .select_related("employee")
            .order_by("employee_id", "-run_no", "-id")
        )

        latest_by_employee = {}
        for pr in payroll_rows:
            if pr.employee_id not in latest_by_employee:
                latest_by_employee[pr.employee_id] = pr

        data = []
        for ppe in ppe_qs:
            emp = ppe.employee
            pr = latest_by_employee.get(emp.id)

            full_name = f"{emp.fname} {emp.lname}".strip()

            data.append({
                "employee_id": emp.id,
                "full_name": full_name,
                "department_name": emp.department.name if emp.department else None,
                "ppe_status": ppe.status,
                "declined_reason": ppe.declined_reason,
                "payroll_id": pr.id if pr else None,
                "payroll_status": pr.status if pr else None,
                "run_no": pr.run_no if pr else None,
                "net_pay": pr.net_pay if pr else None,
            })

        return Response({
            "period": PayrollPeriodCreateSerializer(period).data,
            "employees": PayrollApprovalEmployeeSerializer(data, many=True).data,
        })
    
class PayrollApproveEmployeeView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, period_id: int, employee_id: int):
        _require_approver(request.user)

        period = get_object_or_404(Payroll_Period, id=period_id)

        ppe = get_object_or_404(
            PayrollPeriodEmployee.objects.select_for_update(),
            period=period,
            employee_id=employee_id,
        )

        if ppe.status != "Processing":
            return Response(
                {"detail": f"Cannot approve. Employee status must be Processing. Current: {ppe.status}."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        payroll = get_latest_active_payroll(period_id=period_id, employee_id=employee_id)
        if not payroll:
            return Response(
                {"detail": "No generated payroll found to approve."},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        if payroll.status != "Generated":
            return Response(
                {"detail": f"Cannot approve. Payroll status must be Generated. Current: {payroll.status}."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()

        # Update payroll record
        payroll.status = "Approved"
        payroll.approved_by = request.user
        _set_payroll_approved_at(payroll, now)
        payroll.save(update_fields=["status", "approved_by", "approved_at"])

        # Update PPE (approve only)
        ppe.status = "Approved"
        ppe.approved_by = request.user
        ppe.approved_at = now
        ppe.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

        _recompute_period_status(period)

        # ----------------------------
        # ✅ Create notifications
        # ----------------------------

        notifications = []

        # 1️⃣ Notify SUPER_ADMIN
        super_admins = User.objects.filter(role="ADMIN")
        for admin in super_admins:
            notifications.append(
                Notification(
                    user=admin,
                    title="Payroll Approved",
                    description=f"{ppe.employee} payroll for period {period} has been approved.",
                    category="payroll",
                    redirect_url="/admin/calendar",
                )
            )

        # 2️⃣ Notify Employee without URL
        if hasattr(ppe.employee, "user") and ppe.employee.user:
            notifications.append(
                Notification(
                    user=ppe.employee.user,
                    title="Payroll Approved",
                    description=f"Your payroll for period {period} has been approved.",
                    category="payroll",
                    redirect_url="",  # No URL, just visible in their notifications
                )
            )

        Notification.objects.bulk_create(notifications)

        return Response({"detail": "Payroll approved."}, status=http_status.HTTP_200_OK)

#Ari nalang sad butang ang notif kung sa payroll period kay naay gi declined na employee para mo notif ditso sa HR
class PayrollDeclineEmployeeView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, period_id: int, employee_id: int):
        _require_approver(request.user)

        period = get_object_or_404(Payroll_Period, id=period_id)

        ppe = get_object_or_404(
            PayrollPeriodEmployee.objects.select_for_update(),
            period=period,
            employee_id=employee_id,
        )

        if ppe.status != "Processing":
            return Response(
                {"detail": f"Cannot decline. Employee status must be Processing. Current: {ppe.status}."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        ser = PayrollDeclineInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        reason = ser.validated_data["declined_reason"]

        payroll = get_latest_active_payroll(period_id=period_id, employee_id=employee_id)
        if not payroll:
            return Response(
                {"detail": "No generated payroll found to decline."},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        if payroll.status != "Generated":
            return Response(
                {"detail": f"Cannot decline. Payroll status must be Generated. Current: {payroll.status}."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()

        # Update payroll
        payroll.status = "Disapproved"
        payroll.save(update_fields=["status"])

        # Update PPE with reason
        ppe.status = "Declined"
        ppe.declined_reason = reason

        # Optional: set audit fields if your model already has them (won't crash if missing)
        if hasattr(ppe, "declined_by"):
            ppe.declined_by = request.user
        if hasattr(ppe, "declined_at"):
            ppe.declined_at = timezone.now()

        update_fields = ["status", "declined_reason", "updated_at"]
        if hasattr(ppe, "declined_by"):
            update_fields.append("declined_by")
        if hasattr(ppe, "declined_at"):
            update_fields.append("declined_at")

        ppe.save(update_fields=update_fields)

        _recompute_period_status(period)

        # Notify HR about declined payroll
        hr_users = User.objects.filter(role="HR")
        notifications = [
            Notification(
                user=hr,
                title="Payroll Declined",
                description=f"{ppe.employee} payroll for period {period} has been declined. Reason: {reason}",
                category="payroll",
                redirect_url="/hr/payrolls",
            )
            for hr in hr_users
        ]
        Notification.objects.bulk_create(notifications)

        return Response({"detail": "Payroll declined."}, status=http_status.HTTP_200_OK)

#============================RESETING PAYROLL===========================
class PayrollResetAfterDeclineView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, period_id: int, employee_id: int):
        
        period = get_object_or_404(Payroll_Period.objects.select_for_update(), id=period_id)

        ppe = get_object_or_404(
            PayrollPeriodEmployee.objects.select_for_update(),
            period_id=period_id,
            employee_id=employee_id,
        )

        if ppe.status != "Declined":
            return Response(
                {"detail": f"Reset allowed only when status is Declined. Current: {ppe.status}."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        ser = PayrollResetAfterDeclineSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        void_reason = (ser.validated_data.get("void_reason") or "").strip()

        # find latest active payroll (non-Void)
        payroll = get_latest_active_payroll(period_id=period_id, employee_id=employee_id)
        if not payroll:
            return Response(
                {"detail": "No active payroll found to void for this employee in this period."},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        # void it
        payroll.status = "Void"
        payroll.voided_by = request.user
        payroll.voided_at = timezone.now()
        payroll.void_reason = void_reason or "Reset after decline"
        payroll.save(update_fields=["status", "voided_by", "voided_at", "void_reason"])

         # reset PPE back to Pending 
        ppe.status = "Pending"
        ppe.declined_reason = None
        ppe.approved_by = None
        ppe.approved_at = None

        # Optional: clear decline audit fields if present
        if hasattr(ppe, "declined_by"):
            ppe.declined_by = None
        if hasattr(ppe, "declined_at"):
            ppe.declined_at = None

        update_fields = ["status", "declined_reason", "approved_by", "approved_at", "updated_at"]
        if hasattr(ppe, "declined_by"):
            update_fields.append("declined_by")
        if hasattr(ppe, "declined_at"):
            update_fields.append("declined_at")

        ppe.save(update_fields=update_fields)

        # After reset, period should reflect reality (often back to Processing)
        _recompute_period_status(period)

        return Response({"detail": "Employee reset to Pending. Previous payroll voided."}, status=http_status.HTTP_200_OK)

#========================UPDATE STATUS OF PAYROLL PERIOD TO PAID=====================
class PayrollPeriodMarkPaidView(APIView):
    permission_classes = [IsAuthenticated]

    def _require_hr_or_admin(self, user):
        # Adjust this if you have a better role policy.
        # Current User model roles: EMPLOYEE / ADMIN / SUPER_ADMIN :contentReference[oaicite:3]{index=3}
        role = (getattr(user, "role", "") or "").strip().upper()
        if getattr(user, "is_superuser", False):
            return
        if role in {"ADMIN", "SUPER_ADMIN"}:
            return
        raise PermissionDenied("You are not allowed to mark payroll periods as Paid.")

    @transaction.atomic
    def patch(self, request, period_id: int):
        self._require_hr_or_admin(request.user)

        period = get_object_or_404(Payroll_Period.objects.select_for_update(), id=period_id)

        # Only allow Closed -> Paid
        if period.status != "Closed":
            return Response(
                {"detail": f"Only Closed payroll periods can be marked as Paid. Current: {period.status}."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # Safety rule: "Paid" means all employees are paid.
        # If any employee is Declined, block marking the period as Paid.
        # (Your recompute can still set period Closed even with Declined.) :contentReference[oaicite:4]{index=4}
        ppe_qs = PayrollPeriodEmployee.objects.filter(period=period)
        if ppe_qs.filter(status="Declined").exists():
            return Response(
                {"detail": "Cannot mark as Paid because there are Declined employees in this period."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # Also block if some are not yet Approved (extra guard)
        if ppe_qs.exists() and ppe_qs.exclude(status="Approved").exists():
            return Response(
                {"detail": "Cannot mark as Paid unless all employees are Approved."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # Mark period as Paid + set pay_date automatically (actual payment date)
        today = timezone.localdate()

        period.status = "Paid"
        if not period.pay_date:
            period.pay_date = today

        period.save(update_fields=["status", "pay_date"])

        # Optional but recommended: mark payroll rows as Paid too
        # Only touch Approved payrolls in this period.
        Payroll.objects.filter(payroll_period=period, status="Approved").update(status="Paid")

        return Response({"detail": "Payroll period marked as Paid."}, status=http_status.HTTP_200_OK)


#========================DOWNLOAD PAYROLL EACH EMPLOYEE=====================

class EmployeePayrollDownloadPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, period_id: int):
        # employee ownership: do NOT accept employee_id from client
        emp = getattr(request.user, "employee", None)
        if not emp:
            return Response(
                {"detail": "No employee profile found for this user."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # latest active payroll (exclude Void)
        payroll = get_latest_active_payroll(period_id=period_id, employee_id=emp.id)
        if payroll:
            payroll = (
                Payroll.objects
                .filter(id=payroll.id)
                .select_related("payroll_period", "employee", "employee__department")
                .prefetch_related("payslip_lines", "payslip_lines__rule")
                .first()
            )

        if not payroll:
            return Response(
                {"detail": "Payroll has not been generated for this employee in this period."},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        period = payroll.payroll_period

        # working days: count PRESENT attendance inside the period
        working_days = Attendance.objects.filter(
            employee=emp,
            date__gte=period.start_date,
            date__lte=period.end_date,
            status="PRESENT",
        ).count()

        # ---- formatting helpers ----
        def _money(v):
            try:
                x = Decimal(str(v or "0"))
            except Exception:
                x = Decimal("0")
            return f"{x:,.2f}"

        def _php(v):
            return f"PHP {_money(v)}"

        def _fmt_date(d):
            if not d:
                return "-"
            return d.strftime("%b-%d-%Y")  # like your sample (Feb-15-2026)

        def _fmt_period_range(s, e):
            if not s or not e:
                return "-"
            # sample style: "Jan 22 - Feb 4"
            return f"{s.strftime('%b %d')} - {e.strftime('%b %d')}"

        # ---- line filtering (no statuses, no Night Differential INFO dates line) ----
        lines = list(payroll.payslip_lines.all().order_by("id"))
        filtered_lines = []
        for ln in lines:
            if ln.line_type == "INFORMATION":
                desc = (ln.description or "").lower()
                if desc.startswith("night differential days:"):
                    continue
            filtered_lines.append(ln)

        earnings = [l for l in filtered_lines if l.line_type == "EARNING"]
        deductions = [l for l in filtered_lines if l.line_type == "DEDUCTION"]

        # ---- bucket mapping to resemble the Excel sheet ----
        def _sum_amount(rows):
            total = Decimal("0.00")
            for r in rows:
                try:
                    total += Decimal(str(r.amount or "0"))
                except Exception:
                    continue
            return total

        def _desc_contains(row, needle: str) -> bool:
            return needle in ((row.description or "").lower())

        # EARNINGS buckets
        pay_period_pay = _sum_amount([l for l in earnings if _desc_contains(l, "basic pay")])  # divide-2 salary
        commission_amt = _sum_amount([l for l in earnings if _desc_contains(l, "commission:")])
        night_diff_amt = _sum_amount([l for l in earnings if _desc_contains(l, "night differential")])

        allowance_rows = [l for l in earnings if _desc_contains(l, "allowance:")]
        parking_transpo_amt = _sum_amount([l for l in allowance_rows if ("parking" in (l.description or "").lower()) or ("transpo" in (l.description or "").lower())])
        other_allowances_amt = _sum_amount([l for l in allowance_rows if l not in [x for x in allowance_rows if ("parking" in (x.description or "").lower()) or ("transpo" in (x.description or "").lower())]])

        # "Adjustments" = everything not captured above (keeps the Excel-like fixed rows)
        captured_earn_ids = set()
        for l in earnings:
            d = (l.description or "").lower()
            if "basic pay" in d or "commission:" in d or "night differential" in d or "allowance:" in d:
                captured_earn_ids.add(l.id)
        adjustments_amt = _sum_amount([l for l in earnings if l.id not in captured_earn_ids]) + other_allowances_amt

        # DEDUCTIONS buckets
        def _ded_code(desc: str) -> str:
            # your deduction lines are like "Deduction: SSS"
            s = (desc or "").strip()
            if s.lower().startswith("deduction:"):
                return s.split(":", 1)[1].strip()
            return s

        cash_adv_amt = Decimal("0.00")
        lates_absences_amt = Decimal("0.00")
        sss_amt = Decimal("0.00")
        philhealth_amt = Decimal("0.00")
        pagibig_amt = Decimal("0.00")
        income_tax_amt = Decimal("0.00")
        other_ded_amt = Decimal("0.00")

        for d in deductions:
            desc_low = (d.description or "").lower()

            # lates/undertimes/absent
            if desc_low.startswith("late") or desc_low.startswith("undertime") or desc_low.startswith("absent"):
                lates_absences_amt += Decimal(str(d.amount or "0"))
                continue

            # cash advance detection
            code = _ded_code(d.description or "")
            code_low = code.lower()

            if "cash" in code_low and "advance" in code_low:
                cash_adv_amt += Decimal(str(d.amount or "0"))
            elif code_low == "sss":
                sss_amt += Decimal(str(d.amount or "0"))
            elif code_low == "philhealth":
                philhealth_amt += Decimal(str(d.amount or "0"))
            elif code_low in {"pag-ibig", "pagibig", "hdmf"}:
                pagibig_amt += Decimal(str(d.amount or "0"))
            elif code_low in {"income tax", "withholding tax", "tax"}:
                income_tax_amt += Decimal(str(d.amount or "0"))
            else:
                other_ded_amt += Decimal(str(d.amount or "0"))

        # If there are other deductions, add them into Income Tax line to keep the sheet compact
        income_tax_amt = income_tax_amt + other_ded_amt

        # ---- build PDF (Excel-like) ----
        buffer = BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(letter),
            leftMargin=0.5 * inch,
            rightMargin=0.5 * inch,
            topMargin=0.35 * inch,
            bottomMargin=0.35 * inch,
            title="Payslip",
        )

        usable_w = doc.width

        styles = getSampleStyleSheet()
        base = styles["Normal"]
        base.fontSize = 9
        base.leading = 11

        blue = colors.HexColor("#1F4E79")   # close to your Excel header blue
        light_blue = colors.HexColor("#9DC3E6")
        yellow = colors.HexColor("#FFF2CC")
        black = colors.black
        white = colors.white

        title_style = ParagraphStyle(
            "title_style",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=14,
            alignment=1,
            textColor=black,
        )
        header_style = ParagraphStyle(
            "header_style",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=11,
            alignment=1,
            textColor=white,
        )
        small_center_white = ParagraphStyle(
            "small_center_white",
            parent=base,
            fontName="Helvetica-Oblique",
            fontSize=9,
            alignment=1,
            textColor=white,
        )

        # --- MISSING STYLES (FIX) ---
        section_style = ParagraphStyle(
            "section_style",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=10,
            alignment=1,          # center
            textColor=black,
        )

        label_style = ParagraphStyle(
            "label_style",
            parent=base,
            fontName="Helvetica",
            fontSize=9,
            alignment=0,          # left
            textColor=black,
        )

        amount_style = ParagraphStyle(
            "amount_style",
            parent=base,
            fontName="Helvetica",
            fontSize=9,
            alignment=2,          # right
            textColor=black,
        )
        # --- END FIX ---

        elements = []

        # Header band
        header_tbl = Table(
            [
                [Paragraph("PAYSLIP", header_style)],
                [Paragraph("ATTI_TECH", ParagraphStyle("h2", parent=header_style, fontSize=16))],
                [Paragraph("EMPLOYEE PAYSLIP", header_style)],
            ],
            colWidths=[usable_w],
        )
        header_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), blue),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(header_tbl)
        elements.append(Spacer(1, 8))

        # Employee info block (left) + pay date block (right)
        emp_name = f"{emp.fname} {emp.lname}".strip()
        dept_name = emp.department.name if emp.department else "-"
        role_name = (getattr(emp, "position", "") or "-")
        ssn_like = getattr(emp, "id_no", None) or "-"  # you don't have SSN field; use id_no

        pay_date = period.pay_date or None

        col1 = 1.8 * inch
        col3 = 2.0 * inch
        col4 = 2.7 * inch
        col2 = usable_w - (col1 + col3 + col4)

        info_tbl = Table(
            [
                ["Employee Name", emp_name, "", Paragraph(_fmt_date(pay_date), base)],
                ["SSN:", ssn_like, "Pay Period", _fmt_period_range(period.start_date, period.end_date)],
                ["Department", dept_name, "Basic Gross Pay", f"PHP {_money(payroll.total_earnings)}"],
                ["Role", role_name, "# of working days", str(working_days)],
            ],
            colWidths=[col1, col2, col3, col4],
        )
        info_tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 1, black),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),

            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 1), (2, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, 0), "Helvetica-Bold"),
            ("FONTNAME", (3, 0), (3, 0), "Helvetica-Bold"),

            # yellow pay date cell (top-right)
            ("BACKGROUND", (3, 0), (3, 0), yellow),
            ("ALIGN", (3, 0), (3, 0), "CENTER"),
        ]))
        elements.append(info_tbl)
        elements.append(Spacer(1, 10))

        # Earnings vs Deductions main grid
        def _to_dec(v):
            try:
                return Decimal(str(v or "0"))
            except Exception:
                return Decimal("0")

        def _clean_label(s: str) -> str:
            return (s or "").strip()

        def _is_basic_pay(desc: str) -> bool:
            d = (desc or "").lower()
            return "basic pay" in d

        def _is_commission(desc: str) -> bool:
            d = (desc or "").lower()
            return d.startswith("commission:") or "commission" in d

        def _is_allowance(desc: str) -> bool:
            d = (desc or "").lower()
            return d.startswith("allowance:") or "allowance" in d

        def _is_night_diff(desc: str) -> bool:
            d = (desc or "").lower()
            return "night differential" in d

        def _ded_label(desc: str) -> str:
            # You use formats like "Deduction: SSS" or sometimes "SSS"
            s = _clean_label(desc)
            low = s.lower()
            if low.startswith("deduction:"):
                return _clean_label(s.split(":", 1)[1])
            return s

        def _is_lates_absences(desc: str) -> bool:
            d = (desc or "").lower()
            return d.startswith("late") or d.startswith("undertime") or d.startswith("absent")

        # -------------------------
        # Build dynamic EARNINGS rows
        # -------------------------
        pay_period_pay = _sum_amount([l for l in earnings if _is_basic_pay(l.description)])

        earn_rows = []
        earn_rows.append(["Pay Period Pay", _php(pay_period_pay)])

        # Group commissions by label
        commission_map = {}
        for l in earnings:
            if _is_commission(l.description):
                label = _clean_label(l.description)  # keep "Commission: Sales" etc.
                commission_map[label] = commission_map.get(label, Decimal("0.00")) + _to_dec(l.amount)

        for label, amt in sorted(commission_map.items(), key=lambda x: x[0].lower()):
            if amt != Decimal("0.00"):
                earn_rows.append([label, _php(amt)])

        # Group allowances by label
        allow_map = {}
        for l in earnings:
            if _is_allowance(l.description):
                label = _clean_label(l.description)  # keep "Allowance: Meal" etc.
                allow_map[label] = allow_map.get(label, Decimal("0.00")) + _to_dec(l.amount)

        for label, amt in sorted(allow_map.items(), key=lambda x: x[0].lower()):
            if amt != Decimal("0.00"):
                earn_rows.append([label, _php(amt)])

        # Night differential (keep as its own row if present)
        night_diff_amt = _sum_amount([l for l in earnings if _is_night_diff(l.description)])
        if night_diff_amt != Decimal("0.00"):
            earn_rows.append(["Night Differential", _php(night_diff_amt)])

        # Adjustments = any other earning lines not captured above
        captured_ids = set()

        for l in earnings:
            if _is_basic_pay(l.description) or _is_commission(l.description) or _is_allowance(l.description) or _is_night_diff(l.description):
                captured_ids.add(l.id)

        adjustments_amt = _sum_amount([l for l in earnings if l.id not in captured_ids])
        if adjustments_amt != Decimal("0.00"):
            earn_rows.append(["Adjustments", _php(adjustments_amt)])

        # -------------------------
        # Build dynamic DEDUCTIONS rows
        # -------------------------
        ded_rows = []
        ded_rows.append(["Deductions", ""])

        # Lates & Absences (group)
        lates_absences_amt = _sum_amount([d for d in deductions if _is_lates_absences(d.description)])
        if lates_absences_amt != Decimal("0.00"):
            ded_rows.append(["Lates & Absences", _php(lates_absences_amt)])

        # Group the rest by label (SSS, Philhealth, Pag-ibig, Income Tax, Cash Advance, etc.)
        ded_map = {}
        for d in deductions:
            if _is_lates_absences(d.description):
                continue
            label = _ded_label(d.description)
            ded_map[label] = ded_map.get(label, Decimal("0.00")) + _to_dec(d.amount)

        # Optional: normalize common labels (so you get consistent names)
        def _normalize_ded_label(label: str) -> str:
            low = (label or "").lower().strip()
            if "cash" in low and "advance" in low:
                return "Cash Advance"
            if low == "sss":
                return "SSS"
            if low in {"philhealth", "phil health"}:
                return "Philhealth"
            if low in {"pag-ibig", "pagibig", "hdmf"}:
                return "Pag-ibig"
            if low in {"income tax", "withholding tax", "tax"}:
                return "Income Tax"
            return label

        normalized_map = {}
        for label, amt in ded_map.items():
            new_label = _normalize_ded_label(label)
            normalized_map[new_label] = normalized_map.get(new_label, Decimal("0.00")) + amt

        # Add rows sorted
        for label, amt in sorted(normalized_map.items(), key=lambda x: x[0].lower()):
            if amt != Decimal("0.00"):
                ded_rows.append([label, _php(amt)])

        # Build combined table with 4 columns: earn_label, earn_val, ded_label, ded_val
        # Make both sides start AFTER their section header row
        # earn_rows currently starts with ["Pay Period Pay", ...]
        # ded_rows currently starts with ["Deductions", ""] then real rows
        earn_items = earn_rows[:]  # keep as-is
        ded_items = ded_rows[1:]   # skip the "Deductions" placeholder row (we will create a nicer header)

        max_len = max(len(earn_items), len(ded_items))

        grid_data = []

        # SECTION HEADER ROW (spans 2 columns each)
        grid_data.append([
            Paragraph("EARNINGS", section_style), "",
            Paragraph("DEDUCTIONS", section_style), ""
        ])

        # DATA ROWS
        for i in range(max_len):
            e = earn_items[i] if i < len(earn_items) else ["", ""]
            d = ded_items[i] if i < len(ded_items) else ["", ""]

            e_label = Paragraph(e[0] if e[0] else "", label_style)
            e_amt   = Paragraph(e[1] if e[1] else "", amount_style)

            d_label = Paragraph(d[0] if d[0] else "", label_style)
            d_amt   = Paragraph(d[1] if d[1] else "", amount_style)

            grid_data.append([e_label, e_amt, d_label, d_amt])

        col_amt = 1.6 * inch
        col_label = (usable_w - (2 * col_amt)) / 2  # split remaining equally

        grid_tbl = Table(
            grid_data,
            colWidths=[col_label, col_amt, col_label, col_amt],
            repeatRows=1,
        )

        grid_tbl.setStyle(TableStyle([
            # Grid lines
            ("GRID", (0, 0), (-1, -1), 1, black),

            # Section header styling
            ("SPAN", (0, 0), (1, 0)),
            ("SPAN", (2, 0), (3, 0)),
            ("BACKGROUND", (0, 0), (1, 0), colors.lightgrey),
            ("BACKGROUND", (2, 0), (3, 0), colors.lightgrey),
            ("ALIGN", (0, 0), (3, 0), "CENTER"),
            ("VALIGN", (0, 0), (3, 0), "MIDDLE"),

            # Alignment for amounts
            ("ALIGN", (1, 1), (1, -1), "RIGHT"),
            ("ALIGN", (3, 1), (3, -1), "RIGHT"),

            # Vertical alignment (top looks better for wrapped lines)
            ("VALIGN", (0, 1), (-1, -1), "TOP"),

            # Padding (this is what makes it look like a payslip)
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(grid_tbl)
        elements.append(Spacer(1, 10))

        # Totals rows
        totals_tbl = Table(
            [
                ["Total Earnings", _php(payroll.total_earnings), "Total Deductions", _php(payroll.total_deductions)],
                ["Net Pay =", _php(payroll.net_pay), "", ""],
            ],
            colWidths=[col_label, col_amt, col_label, col_amt],  # SAME as grid
        )
        totals_tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 1, black),
            ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (1, 1), "Helvetica-Bold"),
            ("ALIGN", (1, 0), (1, 1), "RIGHT"),
            ("ALIGN", (3, 0), (3, 0), "RIGHT"),

            # Net pay row highlight (blue like sample)
            ("BACKGROUND", (0, 1), (3, 1), light_blue),
            ("SPAN", (2, 1), (3, 1)),
            ("ALIGN", (0, 1), (0, 1), "RIGHT"),
        ]))
        elements.append(totals_tbl)
        elements.append(Spacer(1, 12))

        # Footer band
        footer_tbl = Table(
            [[Paragraph("If you have any questions about your payslip, please contact: Human Resource", small_center_white)]],
            colWidths=[usable_w],
        )
        footer_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), blue),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]))
        elements.append(footer_tbl)

        doc.build(elements)
        buffer.seek(0)

        filename = f"Payslip_{period.code}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename, content_type="application/pdf")
    