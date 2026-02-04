from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsSuperAdmin
from shared_model.models import Holiday
from .serializers import HolidaySerializer

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
    permission_classes = [IsAuthenticated, IsSuperAdmin]
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
