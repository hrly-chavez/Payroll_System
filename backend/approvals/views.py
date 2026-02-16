from rest_framework import generics, status
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from shared_model.models import *
from .serializers import *
from accounts.permissions import IsRole
from django.utils import timezone

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

        # Use serializer only for returning data
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
    allowed_roles = ["EMPLOYEE"]

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