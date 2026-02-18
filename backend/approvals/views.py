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
from shared_model.models import User
from notifications.models import Notification

class HolidayListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Holiday.objects.filter(status="Approved",is_active=True).order_by("-date")
    serializer_class = HolidaySerializer
    # public access → no permission_classes

class HolidayCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer

    def perform_create(self, serializer):
        # backend controls status
        serializer.save(status="Pending", is_active=True)

class HolidayUpdateStatusView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Update status of a single holiday
    """
    def post(self, request, pk):
        try:
            holiday = Holiday.objects.get(pk=pk)
        except Holiday.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        if new_status not in ['Approved', 'Declined']:
            return Response({'detail': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        holiday.status = new_status
        holiday.save()
        # If SUPER_ADMIN updated holiday → notify ADMIN
        if request.user.role == "SUPER_ADMIN":
                    admins = User.objects.filter(role="ADMIN")

                    for admin in admins:
                        Notification.objects.create(
                            user=admin,
                            title="Holiday Status Updated",
                            description=f"Holiday '{holiday.name}' was {new_status}.",
                            category="holiday",
                            redirect_url="/admin/holiday-requests"
                        )

        serializer = HolidaySerializer(holiday)

        return Response({
                'detail': 'Status updated',
                'holiday': serializer.data
            }, status=status.HTTP_200_OK)
    
class LeaveTypeListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Leave_Type.objects.all().order_by('-created_at')
    serializer_class = LeaveTypeSerializer

class LeaveTypeCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Leave_Type.objects.all()
    serializer_class = LeaveTypeSerializer

    def perform_create(self, serializer):
        serializer.save(is_active=True)

class LeaveTypeUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Leave_Type.objects.all()
    serializer_class = LeaveTypeSerializer

class LeaveRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["EMPLOYEE", "ADMIN"]

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

        date_range = request.data.get("date_range")
        if not date_range or len(date_range) != 2:
            raise ValidationError({"date_range": "Start and end date are required."})

        data = request.data.copy()
        data["date_from"] = date_range[0]
        data["date_to"] = date_range[1]
        data["employee"] = employee.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(employee=employee)

        admins = User.objects.filter(role="ADMIN")


    
# Notify Admins
        for admin in admins:
            Notification.objects.create(
                user=admin,
                title="New Leave Request",
                description=f"{employee.fname} {employee.lname} submitted a leave request.",
                category="leave",
                redirect_url="/admin/leave-requests"
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

    leave_request.status = new_status
    leave_request.approved_by = user
    leave_request.approved_at = timezone.now()
    leave_request.save()

    # Notify Employee about leave status update
    Notification.objects.create(
        user=leave_request.employee.user,
        title="Leave Request Updated",
        description=f"Your leave request was {new_status}.",
        category="leave",
        redirect_url="/employee/leave-history"
    )

    serializer = LeaveRequestSerializer(leave_request)
    return Response(serializer.data, status=status.HTTP_200_OK)
    
    def create(self, request, *args, **kwargs):
        try:
            employee = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist:
            raise ValidationError({"detail": "Employee profile not found."})

        date_range = request.data.get("date_range")
        if not date_range or len(date_range) != 2:
            raise ValidationError({"date_range": "Start and end date are required."})

        date_from = datetime.strptime(date_range[0], "%Y-%m-%d").date()
        date_to = datetime.strptime(date_range[1], "%Y-%m-%d").date()

        today = timezone.now().date()

        # ✅ Prevent past dates
        if date_from < today or date_to < today:
            raise ValidationError({
                "date_range": "You cannot request leave for past dates."
            })

        data = request.data.copy()
        data["date_from"] = date_from
        data["date_to"] = date_to
        data["employee"] = employee.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(employee=employee)

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
class LeaveRequestUpdateView(generics.UpdateAPIView):
    queryset = Leave_Request.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "HR"]

    def perform_update(self, serializer):
        status_value = self.request.data.get("status")

        if status_value in ["Approved", "Declined"]:
            serializer.save(
                approved_by=self.request.user,
                approved_at=timezone.now()
            )
        else:
            serializer.save()

    
class AllRequestsListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveRequestSerializer

    def get_queryset(self):
        # Not used directly, but required by DRF
        return Leave_Request.objects.none()

    def list(self, request, *args, **kwargs):
        data = []

        #  Leave Requests
        leaves = Leave_Request.objects.all()
        for leave in leaves:
            data.append({
                "id": leave.id,
                "type": "Leave",
                "employee": f"{leave.employee.fname} {leave.employee.lname}",
                "details": f"{leave.date_from} - {leave.date_to}",
                "reason": leave.reason,
                "status": leave.status,
                "model": "leave",
            })

        #  Holidays
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
            })

        #  Attendance Request
        
        return Response(data)

# ----------------------------
# LIST
# /superadmin/commission-types/
# ----------------------------
class CommissionTypeListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    queryset = Commission_Type.objects.all().order_by("-created_at")
    serializer_class = CommissionTypeSerializer

# ----------------------------
# CREATE
# /superadmin/commission-types/create/
# ----------------------------
class CommissionTypeCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    queryset = Commission_Type.objects.all()
    serializer_class = CommissionTypeSerializer

# ----------------------------
# UPDATE
# /superadmin/commission-types/<id>/
# ----------------------------
class CommissionTypeUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    queryset = Commission_Type.objects.all()
    serializer_class = CommissionTypeSerializer