from rest_framework import generics, status
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView
from shared_model.models import *
from .serializers import *
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from datetime import date
from .services import PayrollGenerationService,get_latest_active_payroll
from rest_framework.exceptions import PermissionDenied

#helpers    
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
#==========================================DEDUCTIONS========================================
# List and Create
class DeductionListCreateView(generics.ListCreateAPIView):
    queryset = Deduction_Type.objects.all().order_by('-create_at')
    serializer_class = DeductionTypeSerializer

# Retrieve, Update, Delete
class DeductionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Deduction_Type.objects.all()
    serializer_class = DeductionTypeSerializer

# Optional: Update only 'is_active' status
class DeductionUpdateStatusView(APIView):
    def patch(self, request, pk):
        try:
            deduction = Deduction_Type.objects.get(pk=pk)
        except Deduction_Type.DoesNotExist:
            return Response({"error": "Deduction not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Update only is_active
        deduction.is_active = request.data.get('is_active', deduction.is_active)
        deduction.save()
        serializer = DeductionTypeSerializer(deduction)
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

# #for clicking the payroll period (shows modal with employees) fetch
# class PayrollPeriodEligibleEmployeesView(APIView):
#     permission_classes = [IsAuthenticated]

#     def get(self, request, period_id):
#         period = get_object_or_404(Payroll_Period, id=period_id)

#         # 1) employees who already have payroll in this period
#         payroll_employee_ids = Payroll.objects.filter(
#             payroll_period=period
#         ).values_list("employee_id", flat=True)

#         # attendance must exist within the payroll period date range
#         attendance_in_period = Attendance.objects.filter(
#             employee_id=OuterRef("pk"),
#             date__gte=period.start_date,
#             date__lte=period.end_date,
#         )

#         eligible_employees = (
#             Employee.objects
#             # exclude inactive employees
#             .filter(is_active=True)

#             # exclude employees that already have payroll in this period
#             .exclude(id__in=payroll_employee_ids)

#             # exclude CEO (position) and Super Admin users (role)
#             .exclude(
#                 Q(position__iexact="CEO") |
#                 Q(user__role__iexact="SUPER_ADMIN")
#             )

#             # OPTIONAL (but matches your ask): exclude employees whose linked user is inactive
#             # (keeps employees with no linked user)
#             .exclude(Q(user__isnull=False) & Q(user__is_active=False))

#             # must have at least 1 attendance within the period
#             .annotate(has_attendance=Exists(attendance_in_period))
#             .filter(has_attendance=True)

#             .select_related("department", "user")
#         )

#         # 3) lazy-create PayrollPeriodEmployee rows for eligible employees
#         existing_employee_ids = set(
#             PayrollPeriodEmployee.objects.filter(period=period)
#             .values_list("employee_id", flat=True)
#         )

#         to_create = [
#             PayrollPeriodEmployee(period=period, employee=e)
#             for e in eligible_employees
#             if e.id not in existing_employee_ids
#         ]

#         if to_create:
#             PayrollPeriodEmployee.objects.bulk_create(
#                 to_create,
#                 ignore_conflicts=True
#             )

#         # 4) return PayrollPeriodEmployee rows (so we can include status)
#         ppe_qs = (
#             PayrollPeriodEmployee.objects
#             .filter(period=period, employee__in=eligible_employees)
#             .exclude(employee_id__in=payroll_employee_ids)
#             .select_related("employee", "employee__department")
#             .order_by("employee__lname", "employee__fname")
#         )

#         return Response({
#             "period": PayrollPeriodCreateSerializer(period).data,
#             "eligible_employees": EligibleEmployeeSerializer(ppe_qs, many=True).data
#         })
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
        if Payroll.objects.filter(payroll_period=period, employee=employee).exists():
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

class GeneratePayrollForPeriodView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, period_id: int):
        svc = PayrollGenerationService()
        result = svc.generate_for_period(
            period_id=period_id,
            generated_by_user=request.user
        )

        serializer = GeneratePayrollPeriodResponseSerializer(result)
        return Response(serializer.data, status=status.HTTP_200_OK)

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
        payroll.approved_at = now.date()
        payroll.save(update_fields=["status", "approved_by", "approved_at"])

        # Update PPE (approve only)
        ppe.status = "Approved"
        ppe.approved_by = request.user
        ppe.approved_at = now
        ppe.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

        self._recompute_period_status(period)

        return Response({"detail": "Payroll approved."}, status=http_status.HTTP_200_OK)

    def _recompute_period_status(self, period: Payroll_Period):
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
        ppe.save(update_fields=["status", "declined_reason", "updated_at"])
        # Period recompute (temporary copy; will centralize in Step 4)
        self._recompute_period_status(period)

        return Response({"detail": "Payroll declined."}, status=http_status.HTTP_200_OK)

    def _recompute_period_status(self, period: Payroll_Period):
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




