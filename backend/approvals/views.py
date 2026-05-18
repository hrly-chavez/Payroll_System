from rest_framework import generics, status
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from shared_model.models import *
from .serializers import *
from accounts.permissions import IsRole;
from django.utils import timezone
from rest_framework.decorators import api_view
from django.shortcuts import get_object_or_404
from datetime import datetime
from shared_model.models import *
from django.db import transaction
from datetime import timedelta
from decimal import Decimal
from rest_framework import status as http_status
from django.db.models import Q
from rest_framework.parsers import MultiPartParser, FormParser


#===========================Holiday =====================
class HolidayListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Holiday.objects.filter(is_active=True).order_by("-date")
    serializer_class = HolidaySerializer
    # public access → no permission_classes

class HolidayCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer

    def perform_create(self, serializer):
        # Save holiday with backend-controlled fields
        holiday = serializer.save(status="Pending", is_active=True)

        # Attach current user for audit
        holiday._current_user = self.request.user

        # Manually create custom audit log
        AuditLog.objects.create(
            user=self.request.user,
            action="Pending Holiday Request",
            model_name="Holiday",
            object_id=str(holiday.pk),
            old_data="",
            new_data="Pending"
        )

        # Create notification for the relevant approvers
        # Example: notify all SUPER_ADMINs
        from django.contrib.auth import get_user_model
        User = get_user_model()
        approvers = User.objects.filter(role__in=["SUPER_ADMIN"])  # adjust roles as needed

        notifications = []
        for approver in approvers:
            notifications.append(
                Notification(
                    user=approver,
                    title="New Holiday Request",
                    description=f"{self.request.user.user_name} submitted a holiday request.",
                    category="holiday",
                    redirect_url=f"/super-admin/requests"
                )
            )
        Notification.objects.bulk_create(notifications)

class HolidayUpdateStatusView(APIView):
    permission_classes = [IsAuthenticated]

    """
    Update the status of a single holiday,
    create manual audit log for Approved/Declined,
    and notify admins (without extra audit logs from notifications)
    """
    def post(self, request, pk):
        try:
            holiday = Holiday.objects.get(pk=pk)
        except Holiday.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        if new_status not in ['Approved', 'Declined']:
            return Response({'detail': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        old_status = holiday.status

        # Skip automatic signals to prevent duplicate logs
        holiday._skip_audit_log = True

        # Update the holiday status
        holiday.status = new_status
        holiday.save()

        # Manual audit log for human-readable action
        action_name = "Approved Holiday Request" if new_status == "Approved" else "Declined Holiday Request"

        AuditLog.objects.create(
            user=request.user,
            action=action_name,
            model_name="Holiday",
            object_id=str(holiday.pk),
            old_data={"status": old_status},
            new_data={"status": new_status}
        )

        # Notify admins if SUPER_ADMIN updated the holiday
        if request.user.role == "SUPER_ADMIN":
            admins = User.objects.filter(role="ADMIN")
            for admin in admins:
                # Determine redirect_url based on status
                redirect_url = "/admin/calendar" if new_status == "Approved" else None
                description = f"Holiday '{holiday.name}' was {new_status}."

                Notification.objects.create(
                    user=admin,
                    title="Holiday Status Updated",
                    description=description,
                    category="holiday",
                    redirect_url=redirect_url
                )
                # Notifications do NOT touch _current_user, so no audit log triggered

        serializer = HolidaySerializer(holiday)
        return Response({
            'detail': 'Status updated',
            'holiday': serializer.data
        }, status=status.HTTP_200_OK)

#holiday policy
class HolidayPolicyListCreateView(generics.ListCreateAPIView):
    queryset = HolidayPolicy.objects.all().order_by("-created_at")  # adjust ordering
    serializer_class = HolidayPolicySerializer
    permission_classes = [IsAuthenticated]

class HolidayPolicyRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = HolidayPolicy.objects.all()
    serializer_class = HolidayPolicySerializer
    permission_classes = [IsAuthenticated]

class HolidayPolicyListCreateView(generics.ListCreateAPIView):
    serializer_class = HolidayPolicySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = HolidayPolicy.objects.select_related("department").order_by("-created_at")

        # optional filters for admin UI
        department = self.request.query_params.get("department")
        base = self.request.query_params.get("base")
        holiday_type = self.request.query_params.get("holiday_type")

        if department:
            qs = qs.filter(department_id=department)
        if base:
            qs = qs.filter(base=base)
        if holiday_type:
            qs = qs.filter(holiday_type=holiday_type)

        return qs

class HolidayPolicyRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = HolidayPolicy.objects.select_related("department")
    serializer_class = HolidayPolicySerializer
    permission_classes = [IsAuthenticated]

class DepartmentActiveHolidayBasesView(APIView):
    """
    Returns active holiday bases for a department (PH/US/COMPANY).
    Frontend will use this later for the Base dropdown.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, department_id: int):
        rows = DepartmentHolidayCalendar.objects.filter(
            department_id=department_id,
            is_active=True,
        ).order_by("base")

        return Response([
            {"base": r.base, "base_display": r.get_base_display()}
            for r in rows
        ])

class HolidayPolicyEnsureView(APIView):
    """
    Auto-create missing HolidayPolicy rows for all ACTIVE bases of a department.
    Creates 1 policy per (department, base, holiday_type).

    Default requires_work=True is the safest default for payroll (won’t accidentally “forgive” absences).
    You can override with payload { "default_requires_work": false } if you want.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        department_id = request.data.get("department_id")
        if not department_id:
            return Response(
                {"detail": "department_id is required."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        default_requires_work = request.data.get("default_requires_work", True)
        dept = Department.objects.filter(id=department_id).first()
        if not dept:
            return Response(
                {"detail": "Department not found."},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        active_bases = DepartmentHolidayCalendar.objects.filter(
            department_id=department_id,
            is_active=True,
        ).values_list("base", flat=True)

        # take the canonical choices directly from the model
        holiday_types = [c[0] for c in HolidayPolicy.HOLIDAY_TYPES]

        created = 0
        for base in active_bases:
            for htype in holiday_types:
                obj, was_created = HolidayPolicy.objects.get_or_create(
                    department_id=department_id,
                    base=base,
                    holiday_type=htype,
                    defaults={"requires_work": default_requires_work},
                )
                if was_created:
                    # attach audit user if your signals rely on _current_user
                    obj._current_user = request.user
                    obj.save()
                    created += 1

        return Response(
            {"detail": "Ensure complete.", "created": created},
            status=http_status.HTTP_200_OK,
        )
 
#===========================Leave Type & Request=====================

class LeaveTypeListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Leave_Type.objects.all().order_by('-created_at')
    serializer_class = LeaveTypeSerializer

class LeaveTypeCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Leave_Type.objects.all()
    serializer_class = LeaveTypeSerializer

class LeaveTypeUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Leave_Type.objects.all()
    serializer_class = LeaveTypeSerializer

    def perform_update(self, serializer):
        # Get the instance before update for signals
        instance = serializer.instance

        # Attach the current user so signals.py can pick it up
        instance._current_user = self.request.user

        # Perform the update (post_save will handle audit logs)
        serializer.save()

class LeaveRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["EMPLOYEE", "ADMIN"]

    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        try:
            employee = Employee.objects.get(user=self.request.user)
            return Leave_Request.objects.filter(
                employee=employee
            ).order_by("-requested_at")
        except Employee.DoesNotExist:
            return Leave_Request.objects.none()

    def create(self, request, *args, **kwargs):
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            raise ValidationError({"detail": "Employee profile not found."})

        date_range = request.data.getlist("date_range")

        if not date_range or len(date_range) != 2:
            raise ValidationError({
                "date_range": "Start and end date are required."
            })

        data = request.data.copy()
        data["date_from"] = date_range[0]
        data["date_to"] = date_range[1]
        data["employee"] = employee.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        leave_request = serializer.save(
            employee=employee,
            attachment_proof=request.FILES.get("attachment_proof")
        )

        # --- Manual AuditLog for "Pending Leave Request" ---
        AuditLog.objects.create(
            user=request.user,
            action="Pending Leave Request",
            model_name="Leave_Request",
            object_id=str(leave_request.id),
            old_data=None,
            new_data={
                "id": leave_request.id,
                "employee": f"{employee.fname} {employee.lname}",
                "date_from": leave_request.date_from.isoformat(),
                "date_to": leave_request.date_to.isoformat(),
                "reason": leave_request.reason,
                "status": leave_request.status,
                "requested_at": leave_request.requested_at.isoformat(),
                "attachment_proof": (
                    leave_request.attachment_proof.url
                    if leave_request.attachment_proof else None
                ),
            },
        )

        # Notify Admins
        admins = User.objects.filter(role="ADMIN")

        for admin in admins:
            Notification.objects.create(
                user=admin,
                title="New Leave Request",
                description=f"{employee.fname} {employee.lname} submitted a leave request.",
                category="leave",
                redirect_url="/admin/requests"
            )

        return Response(serializer.data, status=status.HTTP_201_CREATED)

class AdminLeaveRequestListView(generics.ListAPIView):
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def get_queryset(self):
        # Admin sees all leave requests, ordered by latest
        queryset = Leave_Request.objects.all().order_by("-requested_at")

        # Optional filters via query params
        status_filter = self.request.query_params.get("status")
        employee_id = self.request.query_params.get("employee")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)

        return queryset


# -----------------------------
# Admin action to approve or decline leave
# -----------------------------
@api_view(["POST"])
@transaction.atomic
def admin_update_leave_status(request, pk):
    """
    Admin can approve or decline a leave request.
    Payload example:
    {
        "status": "Approved"  # or "Declined"
    }
    """
    user = request.user
    if user.role not in ["ADMIN", "SUPER_ADMIN"]:
        return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

    leave_request = get_object_or_404(Leave_Request, pk=pk)
    new_status = request.data.get("status")

    if new_status not in ["Approved", "Declined"]:
        return Response({"detail": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)

    # Save previous status for audit logging
    old_status = leave_request.status

    # Update request status
    leave_request.status = new_status
    leave_request.approved_by = user
    leave_request.approved_at = timezone.now()

    if new_status == "Declined":
        decline_reason = request.data.get("reason", "")
        leave_request.decline_reason = decline_reason
    else:
        leave_request.decline_reason = None

    leave_request._skip_audit_log = True
    leave_request.save(
        update_fields=[
            "status",
            "approved_by",
            "approved_at",
            "decline_reason",
        ]
    )

    # --- Manual AuditLog ---
    action_label = (
        "Approved Leave Request" if new_status == "Approved" else "Declined Leave Request"
    )
    AuditLog.objects.create(
        user=user,
        action=action_label,
        model_name="Leave_Request",
        object_id=str(leave_request.id),
        old_data={"status": old_status},
        new_data={
            "status": leave_request.status,
            "approved_by": f"{user.fname} {user.lname}" if hasattr(user, "fname") else str(user),
            "approved_at": leave_request.approved_at.isoformat(),
        },
    )

    employee = leave_request.employee
    leave_type = leave_request.leave_type

    # Build inclusive date list
    start = leave_request.date_from
    end = leave_request.date_to
    if end < start:
        return Response(
            {"detail": "Invalid leave date range."},
            status=status.HTTP_400_BAD_REQUEST
        )

    dates = []
    d = start
    while d <= end:
        dates.append(d)
        d += timedelta(days=1)

    if new_status == "Approved":
        # 1) Prevent overlap with other approved leaves
        conflict = (
            Leave_Day.objects
            .filter(employee=employee, date__in=dates)
            .exclude(leave_request=leave_request)
            .exists()
        )
        if conflict:
            return Response(
                {
                    "detail": "Cannot approve. One or more dates already have a leave day for this employee."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2) Idempotent approve: remove old days for this request then recreate
        Leave_Day.objects.filter(leave_request=leave_request).delete()

        # 3) Create Leave_Day rows
        is_half = bool(leave_request.is_half_day)
        units = Decimal("0.50") if is_half else Decimal("1.00")

        is_paid = bool(leave_type.is_paid)
        pay_rate = Decimal("1.00") if is_paid else Decimal("0.00")

        bulk = []
        for day in dates:
            bulk.append(
                Leave_Day(
                    employee=employee,
                    leave_request=leave_request,
                    date=day,
                    units=units,
                    is_paid=is_paid,
                    pay_rate=pay_rate,
                )
            )
        Leave_Day.objects.bulk_create(bulk)

    elif new_status == "Declined":
        # Remove leave days if declined
        Leave_Day.objects.filter(leave_request=leave_request).delete()

    # Notify Employee about leave status update
    Notification.objects.create(
        user=leave_request.employee.user,
        title="Leave Request Updated",
        description=f"Your leave request was {new_status}.",
        category="leave",
        redirect_url="/employee/attendance"
    )

    serializer = LeaveRequestSerializer(leave_request)
    return Response(serializer.data, status=status.HTTP_200_OK)

# -----------------------------
# Supad Action setting leave credit max for a leave type
# -----------------------------

class LeaveCreditMaxListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN", "ADMIN"]

    queryset = Leave_Credit_Max.objects.select_related("leave_type").all().order_by("-created_at")
    serializer_class = LeaveCreditMaxSerializer


class LeaveCreditMaxCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN", "ADMIN"]

    queryset = Leave_Credit_Max.objects.all()
    serializer_class = LeaveCreditMaxSerializer


class LeaveCreditMaxDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN", "ADMIN"]

    queryset = Leave_Credit_Max.objects.all()
    serializer_class = LeaveCreditMaxSerializer

class EmployeeLeaveTypeCreditListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EmployeeLeaveCreditSerializer

    def get_queryset(self):
        return Leave_Type.objects.filter(is_active=True).order_by("name")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

#=====================All Request====================
class AllRequestsListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveRequestSerializer

    def get_queryset(self):
        # Not used directly, but required by DRF
        return Leave_Request.objects.none()

    def list(self, request, *args, **kwargs):
        data = []

        # Leave Requests
        leaves = Leave_Request.objects.select_related("employee").all()
        for leave in leaves:
            data.append({
                "id": leave.id,
                "type": "Leave",
                "employee": f"{leave.employee.fname} {leave.employee.lname}",
                "details": f"{leave.date_from} - {leave.date_to}",
                "reason": leave.reason,
                "status": leave.status,
                "model": "leave",
                "created_at": leave.requested_at.isoformat() if leave.requested_at else None,
            })

        # Holidays
        holidays = Holiday.objects.all()
        for holiday in holidays:
            data.append({
                "id": holiday.id,
                "type": "Holiday",
                "employee": "System",
                "details": f"{holiday.date} - {holiday.name}",
                "reason": holiday.remarks,
                "status": holiday.status,
                "model": "holiday",
                "created_at": holiday.created_at.isoformat() if holiday.created_at else None,
            })

        # Loan Requests
        loans = Loan.objects.select_related("employee", "rule").all()
        for loan in loans:
            data.append({
                "id": loan.id,
                "type": "Loan",
                "employee": f"{loan.employee.fname} {loan.employee.lname}",
                "details": f"{loan.name} - ₱{loan.principal_amount} - {loan.effective_from}",
                "reason": loan.remarks,
                "status": loan.status,
                "model": "loan",
                "created_at": loan.created_at.isoformat() if loan.created_at else None,

                # extra fields for future modal/details/actions
                "loan_name": loan.name,
                "principal_amount": str(loan.principal_amount),
                "remaining_balance": str(loan.remaining_balance),
                "effective_from": loan.effective_from.isoformat() if loan.effective_from else None,
                "effective_to": loan.effective_to.isoformat() if loan.effective_to else None,
                "declined_reason": loan.declined_reason,
                "rule_name": loan.rule.name if loan.rule else None,
                "deduction_mode": loan.deduction_mode,
                "deduction_value": str(loan.deduction_value) if loan.deduction_value is not None else None,
                "apply_to_cutoff": loan.apply_to_cutoff,
            })

        def status_priority(status):
            s = (status or "").lower()
            if s == "pending":
                return 1
            if s == "approved":
                return 2
            if s == "active":
                return 3
            if s in ["declined", "cancelled"]:
                return 4
            return 5

        data.sort(
            key=lambda x: (
                status_priority(x.get("status")),
                x.get("created_at") or "",
            )
        )
        data.reverse()

        return Response(data)

#=====================Commissions ====================
class CommissionTypeListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    queryset = Commission_Type.objects.all().order_by("-created_at")
    serializer_class = CommissionTypeSerializer

#Create
class CommissionTypeCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    queryset = Commission_Type.objects.all()
    serializer_class = CommissionTypeSerializer

#Update
class CommissionTypeUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    queryset = Commission_Type.objects.all()
    serializer_class = CommissionTypeSerializer

#=====================Allowance ====================
class AllowanceTypeCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Allowance_Type.objects.all()
    serializer_class = AllowanceTypeSerializer

    def perform_create(self, serializer):
        # Attach _current_user BEFORE saving so signals can pick it up
        instance = serializer.Meta.model(**serializer.validated_data)
        instance._current_user = self.request.user

        # Now save the instance (post_save signal will handle CREATE audit log)
        instance.save()

class AllowanceTypeListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Allowance_Type.objects.all()
    serializer_class = AllowanceTypeSerializer

class AllowanceTypeUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Allowance_Type.objects.all()
    serializer_class = AllowanceTypeSerializer

    def perform_update(self, serializer):
        # Attach _current_user to the serializer's instance
        serializer.instance._current_user = self.request.user

        # Perform the update normally; signals will pick up _current_user
        serializer.save()

#=====================Loan Request ====================
#Helper
def resolve_applicable_loan_rule(employee, effective_from):
    """
    Priority:
    1) employee-specific
    2) department-specific
    3) all (both null)
    """
    qs = (
        LoanRule.objects
        .filter(is_active=True, effective_from__lte=effective_from)
        .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=effective_from))
        .filter(
            Q(employee=employee) |
            Q(employee__isnull=True, department=employee.department) |
            Q(employee__isnull=True, department__isnull=True)
        )
        .select_related("department", "employee")
        .order_by("-effective_from", "-id")
    )

    best = None
    best_priority = -1

    for rule in qs:
        if rule.employee_id == employee.id:
            priority = 3
        elif rule.employee_id is None and rule.department_id == employee.department_id:
            priority = 2
        elif rule.employee_id is None and rule.department_id is None:
            priority = 1
        else:
            priority = 0

        if priority > best_priority:
            best = rule
            best_priority = priority

    return best

#Employee Request
class EmployeeLoanRequestListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["EMPLOYEE"]
    
    def get_serializer_class(self):
        if self.request.method == "POST":
            return LoanRequestCreateSerializer
        return LoanRequestSerializer

    def get_queryset(self):
        try:
            employee = Employee.objects.get(user=self.request.user)
            return (
                Loan.objects
                .filter(employee=employee)
                .select_related("employee", "employee__department", "rule", "created_by", "approved_by")
                .order_by("-created_at")
            )
        except Employee.DoesNotExist:
            return Loan.objects.none()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            raise ValidationError({"detail": "Employee profile not found."})

        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        loan = serializer.save()

        # Manual audit log
        AuditLog.objects.create(
            user=request.user,
            action="Pending Loan Request",
            model_name="Loan",
            object_id=str(loan.id),
            old_data=None,
            new_data={
                "id": loan.id,
                "employee": f"{employee.fname} {employee.lname}",
                "name": loan.name,
                "principal_amount": str(loan.principal_amount),
                "remaining_balance": str(loan.remaining_balance),
                "deduction_mode": loan.deduction_mode,
                "deduction_value": str(loan.deduction_value) if loan.deduction_value is not None else None,
                "apply_to_cutoff": loan.apply_to_cutoff,
                "effective_from": loan.effective_from.isoformat(),
                "effective_to": loan.effective_to.isoformat() if loan.effective_to else None,
                "status": loan.status,
                "created_at": loan.created_at.isoformat(),
            },
        )

        # Notify Super Admins
        super_admins = User.objects.filter(role="SUPER_ADMIN")
        notifications = []
        for admin in super_admins:
            notifications.append(
                Notification(
                    user=admin,
                    title="New Loan Request",
                    description=f"{employee.fname} {employee.lname} submitted a loan request.",
                    category="loan",
                    redirect_url="/super-admin/loan-requests",
                )
            )
        Notification.objects.bulk_create(notifications)

        return Response(
            LoanRequestSerializer(loan).data,
            status=status.HTTP_201_CREATED
        )

#SuperAdmin Approve & Decline
class SuperAdminLoanRequestListView(generics.ListAPIView):
    serializer_class = LoanRequestSerializer
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    def get_queryset(self):
        queryset = (
            Loan.objects
            .select_related("employee", "employee__department", "rule", "created_by", "approved_by")
            .order_by("-created_at")
        )

        status_filter = self.request.query_params.get("status")
        employee_id = self.request.query_params.get("employee")

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)

        return queryset

class SuperAdminLoanApproveView(APIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    @transaction.atomic
    def post(self, request, pk):
        loan = get_object_or_404(
            Loan.objects.select_for_update().select_related("employee", "employee__user", "rule"),
            pk=pk
        )

        if loan.status != "Pending":
            return Response(
                {"detail": f"Only Pending loan requests can be approved. Current: {loan.status}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = loan.status
        now_dt = timezone.now()
        today = timezone.localdate()

        resolved_rule = resolve_applicable_loan_rule(
            employee=loan.employee,
            effective_from=loan.effective_from,
        )

        if not resolved_rule:
            return Response(
                {
                    "detail": "No active applicable loan rule found for this employee.",
                    "debug": {
                        "employee_id": loan.employee_id,
                        "employee_department_id": loan.employee.department_id if loan.employee else None,
                        "loan_effective_from": loan.effective_from,
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        loan.rule = resolved_rule
        loan.deduction_mode = resolved_rule.deduction_mode
        loan.deduction_value = resolved_rule.deduction_value
        loan.apply_to_cutoff = resolved_rule.apply_to_cutoff

        loan.status = "Active" if loan.effective_from <= today else "Approved"
        loan.approved_by = request.user
        loan.approved_at = now_dt
        loan.declined_reason = None
        loan._skip_audit_log = True
        loan.save(
            update_fields=[
                "rule",
                "deduction_mode",
                "deduction_value",
                "apply_to_cutoff",
                "status",
                "approved_by",
                "approved_at",
                "declined_reason",
                "updated_at",
            ]
        )

        AuditLog.objects.create(
            user=request.user,
            action="Approved Loan Request",
            model_name="Loan",
            object_id=str(loan.id),
            old_data={"status": old_status},
            new_data={
                "status": loan.status,
                "rule_id": loan.rule.id if loan.rule else None,
                "rule_name": loan.rule.name if loan.rule else None,
                "deduction_mode": loan.deduction_mode,
                "deduction_value": str(loan.deduction_value) if loan.deduction_value is not None else None,
                "apply_to_cutoff": loan.apply_to_cutoff,
                "approved_by": str(request.user),
                "approved_at": loan.approved_at.isoformat(),
            },
        )

        if getattr(loan.employee, "user", None):
            Notification.objects.create(
                user=loan.employee.user,
                title="Loan Request Updated",
                description=f"Your loan request was approved and is now {loan.status}.",
                category="loan",
                redirect_url="/employee/loans",
            )

        return Response(LoanRequestSerializer(loan).data, status=status.HTTP_200_OK)

class SuperAdminLoanDeclineView(APIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    @transaction.atomic
    def post(self, request, pk):
        loan = get_object_or_404(
            Loan.objects.select_for_update().select_related("employee", "employee__user"),
            pk=pk
        )

        if loan.status != "Pending":
            return Response(
                {"detail": f"Only Pending loan requests can be declined. Current: {loan.status}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = LoanDeclineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decline_reason = serializer.validated_data["decline_reason"]

        old_status = loan.status

        loan.status = "Cancelled"
        loan.approved_by = request.user
        loan.approved_at = timezone.now()
        loan.rule = None
        loan.deduction_mode = None
        loan.deduction_value = None
        loan.apply_to_cutoff = None
        loan.declined_reason = decline_reason
        loan._skip_audit_log = True
        loan.save(
            update_fields=[
                "status",
                "approved_by",
                "approved_at",
                "rule",
                "deduction_mode",
                "deduction_value",
                "apply_to_cutoff",
                "declined_reason",
                "updated_at",
            ]
        )

        AuditLog.objects.create(
            user=request.user,
            action="Declined Loan Request",
            model_name="Loan",
            object_id=str(loan.id),
            old_data={"status": old_status},
            new_data={
                "status": loan.status,
                "decline_reason": decline_reason,
                "approved_by": str(request.user),
                "approved_at": loan.approved_at.isoformat(),
            },
        )

        if getattr(loan.employee, "user", None):
            Notification.objects.create(
                user=loan.employee.user,
                title="Loan Request Updated",
                description="Your loan request was declined.",
                category="loan",
                redirect_url="/employee/loans",
            )

        return Response(LoanRequestSerializer(loan).data, status=status.HTTP_200_OK)

class SuperAdminLoanActivateView(APIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    @transaction.atomic
    def post(self, request, pk):
        loan = get_object_or_404(
            Loan.objects.select_for_update().select_related("employee", "employee__user"),
            pk=pk
        )
        
        if loan.status != "Approved":
            return Response(
                {"detail": f"Only Approved loans can be activated. Current: {loan.status}."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not loan.rule or not loan.deduction_mode or loan.deduction_value is None or not loan.apply_to_cutoff:
            return Response(
                {"detail": "Loan cannot be activated because deduction settings are incomplete."},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = loan.status

        loan.status = "Active"
        loan.declined_reason = None
        loan._skip_audit_log = True
        loan.save(update_fields=["status", "declined_reason", "updated_at"])

        AuditLog.objects.create(
            user=request.user,
            action="Activated Loan",
            model_name="Loan",
            object_id=str(loan.id),
            old_data={"status": old_status},
            new_data={"status": loan.status},
        )

        if getattr(loan.employee, "user", None):
            Notification.objects.create(
                user=loan.employee.user,
                title="Loan Activated",
                description="Your approved loan is now active.",
                category="loan",
                redirect_url="/employee/loans",
            )

        return Response(LoanRequestSerializer(loan).data, status=status.HTTP_200_OK)
    
