from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.db.models import Q
from rest_framework.exceptions import ValidationError
from accounts.permissions import IsRole;
from .serializers import *
from .services import punch_in, punch_out, get_today_status, _get_employee_or_400, _month_date_range



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

#Attendance Status
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

#Each Employee Attendance Logs
class AttendanceLogsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _get_employee_or_400(request.user)

        # Query params: ?year=2026&month=2
        year = request.query_params.get("year")
        month = request.query_params.get("month")

        # default: current month/year
        today = timezone.localdate()
        year = int(year) if year else today.year
        month = int(month) if month else today.month

        if month < 1 or month > 12:
            raise ValidationError({"detail": "Invalid month. Must be 1-12."})

        date_from, date_to = _month_date_range(year, month)

        qs = (
            Attendance.objects
            .filter(employee=employee, date__range=[date_from, date_to])
            .select_related("employee", "employee__shift")
            .prefetch_related("events")
            .order_by("-date")
        )

        return Response({
            "year": year,
            "month": month,
            "count": qs.count(),
            "results": AttendanceLogSerializer(qs, many=True).data
        })

#Admin & SuperAdmin Can see All attendance Logs
class CEOandHRAttendanceLogsView(APIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def get(self, request):
        # Query params:
        # ?year=2026&month=2
        # optional: ?search=jeremy
        year = request.query_params.get("year")
        month = request.query_params.get("month")
        search = request.query_params.get("search", "").strip()

        today = timezone.localdate()
        year = int(year) if year else today.year
        month = int(month) if month else today.month

        if month < 1 or month > 12:
            raise ValidationError({"detail": "Invalid month. Must be 1-12."})

        date_from, date_to = _month_date_range(year, month)

        qs = (
            Attendance.objects
            .filter(date__range=[date_from, date_to])
            .select_related("employee", "employee__shift", "employee__department")
            .prefetch_related("events")
        )

        if search:
            qs = qs.filter(
                Q(employee__fname__icontains=search) |
                Q(employee__lname__icontains=search) |
                Q(employee__department__name__icontains=search)
            )

        qs = qs.order_by("-date", "employee__lname", "employee__fname")

        # Stats for cards
        total_present = qs.filter(status="PRESENT").count()
        total_absent = qs.filter(status="ABSENT").count()
        total_lates = qs.filter(events__type="Late").distinct().count()

        return Response({
            "year": year,
            "month": month,
            "stats": {
                "present": total_present,
                "lates": total_lates,
                "absent": total_absent,
            },
            "count": qs.count(),
            "results": CEOandHRAttendanceLogSerializer(qs, many=True).data
        })  