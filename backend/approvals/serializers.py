from rest_framework import serializers
from shared_model.models import Holiday
# views.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

class HolidayUpdateStatusView(APIView):
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
        return Response({'detail': 'Status updated', 'status': holiday.status})


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = (
            'id',
            'name',
            'date',
            'type',
            'base',
            'is_active',
            'created_at',
            'status',
        )
