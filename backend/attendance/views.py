from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .serializers import AttendanceSerializer, PunchInSerializer, PunchOutSerializer
from .services import *


class PunchInView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PunchInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        attendance = punch_in(request.user)
        return Response({
            "message": "Punch in successful.",
            "attendance": AttendanceSerializer(attendance).data
        })


class PunchOutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PunchOutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        attendance = punch_out(request.user)
        return Response({
            "message": "Punch out successful.",
            "attendance": AttendanceSerializer(attendance).data
        })


class TodayAttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        attendance = get_today_status(request.user)

        if not attendance:
            return Response({
                "has_attendance": False,
                "attendance": None
            })

        return Response({
            "has_attendance": True,
            "attendance": AttendanceSerializer(attendance).data
        })
