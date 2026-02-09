from rest_framework import generics, status
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from shared_model.models import *
from .serializers import *
from accounts.permissions import IsRole;

class HolidayListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Holiday.objects.all().order_by('-date')
    serializer_class = HolidaySerializer
    # public access → no permission_classes

# views.py

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

class LeaveRequestListCreateView(ListCreateAPIView):
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Leave_Request.objects.filter(
            employee__user=self.request.user
        ).order_by("-requested_at")

    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.get(user=user)

        date_from, date_to = serializer.validated_data.pop("date_range")

        serializer.save(
            employee=employee,
            date_from=date_from,
            date_to=date_to,
            status="Pending"
        )

