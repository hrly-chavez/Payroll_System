from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from accounts.permissions import IsRole
from shared_model.models import Attendance, Shift
from .serializers import *
from .services import (punch_in,punch_out,get_today_status,_get_employee_or_400,_month_date_range,punch_in_eligibility)


class PunchInView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PunchInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        attendance = punch_in(request.user)
        return Response({
            "message": "Punch in successful.",
            "attendance": AttendanceSerializer(attendance).data,
        })

class PunchInEligibilityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        result = punch_in_eligibility(request.user)
        return Response(PunchInEligibilitySerializer(result).data)

class PunchOutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PunchOutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        attendance = punch_out(request.user)
        return Response({
            "message": "Punch out successful.",
            "attendance": AttendanceSerializer(attendance).data,
        })
#Overtime
class SuperAdminPendingOvertimeView(APIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    def get(self, request):
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
            Attendance_Event.objects
            .filter(
                type="Overtime",
                approval_status="Pending",
                attendance__date__range=[date_from, date_to],
            )
            .select_related(
                "attendance",
                "attendance__employee",
                "attendance__employee__department",
                "attendance__employee__shift",
            )
            .order_by("-attendance__date", "-created_at")
        )

        if search:
            qs = qs.filter(
                Q(attendance__employee__fname__icontains=search) |
                Q(attendance__employee__lname__icontains=search) |
                Q(attendance__employee__department__name__icontains=search)
            )

        return Response({
            "year": year,
            "month": month,
            "count": qs.count(),
            "results": PendingOvertimeQueueSerializer(qs, many=True).data,
        })

class SuperAdminOvertimeStatusView(APIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    def post(self, request, pk):
        status = request.data.get("status")
        reason = (request.data.get("reason") or "").strip()

        if status not in ["Approved", "Declined"]:
            raise ValidationError({"detail": "Invalid status."})

        try:
            event = Attendance_Event.objects.select_related(
                "attendance__employee"
            ).get(pk=pk, type="Overtime")
        except Attendance_Event.DoesNotExist:
            raise ValidationError({"detail": "Overtime event not found."})

        if event.approval_status != "Pending":
            raise ValidationError({"detail": "This request is already processed."})

        if status == "Declined" and not reason:
            raise ValidationError({"detail": "Decline reason is required."})

        event.approval_status = status
        event.approved_by = request.user

        #  Use event_remarks as decline reason
        if status == "Declined":
            event.event_remarks = reason
        else:
            event.event_remarks = event.event_remarks or "Approved by SuperAdmin."

        event.save(update_fields=["approval_status", "approved_by", "event_remarks"])

        return Response({"detail": f"Overtime {status} successfully."})

#Attendance Status
class TodayAttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        attendance = get_today_status(request.user)

        if not attendance:
            return Response({"has_attendance": False, "attendance": None})

        return Response({
            "has_attendance": True,
            "attendance": AttendanceSerializer(attendance).data,
        })

class AttendanceLogsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _get_employee_or_400(request.user)

        year = request.query_params.get("year")
        month = request.query_params.get("month")

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
            "results": AttendanceLogSerializer(qs, many=True).data,
        })

class CEOandHRAttendanceLogsView(APIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def get(self, request):
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

        total_present = qs.filter(status="PRESENT").count()
        total_lates = qs.filter(events__type="Late").distinct().count()

        # OPTION 1: absences are computed, not stored as Attendance rows
        total_absent = 0

        return Response({
            "year": year,
            "month": month,
            "stats": {
                "present": total_present,
                "lates": total_lates,
                "absent": total_absent,
            },
            "count": qs.count(),
            "results": CEOandHRAttendanceLogSerializer(qs, many=True).data,
        })

#done logs
class ShiftListCreateView(generics.ListCreateAPIView):
    queryset = Shift.objects.all().order_by("start_time")
    serializer_class = ShiftSerializer
    permission_classes = [IsAuthenticated]

#done logs
class ShiftRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [IsAuthenticated]


