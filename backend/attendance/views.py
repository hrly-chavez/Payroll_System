from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework import status as http_status
from accounts.permissions import IsRole
from django.db import transaction
from calendar import monthrange
from datetime import date
from rest_framework.parsers import MultiPartParser, FormParser,JSONParser
from shared_model.models import *
from rest_framework.exceptions import PermissionDenied, NotFound,ValidationError
from datetime import timedelta
from .serializers import *
from .services import (punch_in,punch_out,get_today_status,_get_employee_or_400,_month_date_range,punch_in_eligibility,get_monthly_attendance_stats)


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
#Attendance Logs
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
#Attendance Logs for admin & superadmin
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

#=========================================SHIFTS
class ShiftListCreateView(generics.ListCreateAPIView):
    queryset = Shift.objects.all().order_by("start_time")
    serializer_class = ShiftSerializer
    permission_classes = [IsAuthenticated]

class ShiftRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [IsAuthenticated]

#==========================================ATTENDANCE REQUEST==============================

  
class EmployeeAttendanceCorrectionCreateView(APIView):
    """
    Employee creates a correction request (multipart for attachment).
    POST /api/attendance/corrections/
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = AttendanceCorrectionCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()

        return Response(
            {
                "detail": "Attendance correction request submitted.",
                "correction": AttendanceCorrectionListSerializer(obj).data,
            },
            status=http_status.HTTP_201_CREATED,
        )


class EmployeeAttendanceCorrectionListView(APIView):
    """
    Employee lists their own correction requests.
    GET /api/attendance/corrections/my/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        emp = getattr(request.user, "employee", None)
        if not emp:
            raise ValidationError({"detail": "No employee profile found for this user."})

        qs = Attendance_Correction.objects.filter(requested_by=emp).order_by("-requested_at")
        return Response(
            {
                "count": qs.count(),
                "results": AttendanceCorrectionListSerializer(qs, many=True).data,
            }
        )


class AdminPendingAttendanceCorrectionsView(APIView):
    """
    HR/Admin or SuperAdmin sees pending queue.
    GET /api/attendance/admin/corrections/pending/
    """
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def get(self, request):
        qs = (
            Attendance_Correction.objects
            .filter(status="Pending")
            .select_related("attendance", "requested_by", "reviewed_by")
            .order_by("-requested_at")
        )
        return Response(
            {
                "count": qs.count(),
                "results": AttendanceCorrectionListSerializer(qs, many=True).data,
            }
        )


class AdminReviewAttendanceCorrectionView(APIView):
    """
    HR/Admin or SuperAdmin verifies/declines a request.
    POST /api/attendance/admin/corrections/<id>/review/
    Body: { "status": "Verified" | "Declined", "decline_reason": "..." }
    """
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def post(self, request, pk: int):
        data_ser = AttendanceCorrectionReviewSerializer(data=request.data)
        data_ser.is_valid(raise_exception=True)

        try:
            obj = Attendance_Correction.objects.select_related("attendance").get(pk=pk)
        except Attendance_Correction.DoesNotExist:
            raise NotFound("Attendance correction request not found.")

        if obj.status != "Pending":
            raise ValidationError({"detail": "This request is already processed."})

        new_status = data_ser.validated_data["status"]
        decline_reason = data_ser.validated_data.get("decline_reason", "")

        obj.status = new_status
        obj.reviewed_by = request.user
        obj.reviewed_at = timezone.now()

        if new_status == "Declined":
            obj.decline_reason = decline_reason
        else:
            obj.decline_reason = None

        obj.save(update_fields=["status", "reviewed_by", "reviewed_at", "decline_reason"])

        return Response({"detail": f"Request {new_status} successfully."})

class AttendanceCorrectionMetaView(APIView):
    """
    Returns dropdown choices for Attendance_Correction.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        issue_types = [
            {"value": value, "label": label}
            for value, label in Attendance_Correction.issue_choices
        ]

        statuses = [
            {"value": value, "label": label}
            for value, label in Attendance_Correction.status_choices
        ]

        return Response({
            "issue_types": issue_types,
            "statuses": statuses,
        })

class AdminAttendanceCorrectionDetailView(APIView):
    """
    HR/Admin or SuperAdmin fetches a single correction + attendance details.
    GET /api/attendance/admin/corrections/<id>/
    """
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def get(self, request, pk: int):
        try:
            obj = (
                Attendance_Correction.objects
                .select_related(
                    "attendance",
                    "requested_by",
                    "requested_by__department",
                )
                .get(pk=pk)
            )
        except Attendance_Correction.DoesNotExist:
            raise NotFound("Attendance correction request not found.")

        return Response(AttendanceCorrectionDetailSerializer(obj).data)

class AdminApplyAttendanceCorrectionView(APIView):
    """
    HR/Admin applies the correction by editing the Attendance record,
    and can optionally create Attendance_Event rows in the same request.

    POST /api/attendance/admin/corrections/<id>/apply/
    Body: { status?, time_in?, time_out?, replace_events?, events?: [] }
    """
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def post(self, request, pk: int):
        try:
            obj = Attendance_Correction.objects.select_related(
                "attendance", "requested_by"
            ).get(pk=pk)
        except Attendance_Correction.DoesNotExist:
            raise NotFound("Attendance correction request not found.")

        if obj.status != "Pending":
            raise ValidationError({"detail": "This request is already processed."})

        # IMPORTANT: pass correction in serializer context for issue_type-aware validation
        data_ser = AttendanceCorrectionApplySerializer(
            data=request.data,
            context={"request": request, "correction": obj},
        )
        data_ser.is_valid(raise_exception=True)

        attendance = obj.attendance
        changes = data_ser.validated_data

        created_events = []

        with transaction.atomic():
            # Apply Attendance edits
            attendance_update_fields = []

            if "status" in changes:
                attendance.status = changes["status"]
                attendance_update_fields.append("status")

            if "time_in" in changes:
                attendance.time_in = changes["time_in"]
                attendance_update_fields.append("time_in")

            if "time_out" in changes:
                attendance.time_out = changes["time_out"]
                attendance_update_fields.append("time_out")

            if attendance_update_fields:
                attendance.save(update_fields=attendance_update_fields)

            # Optional: replace existing events
            replace_events = bool(changes.get("replace_events", False))
            events_payload = changes.get("events") or []

            if replace_events:
                Attendance_Event.objects.filter(attendance=attendance).delete()

            if events_payload:
                for e in events_payload:
                    holiday_obj = None
                    holiday_id = e.get("holiday_id")
                    if holiday_id:
                        holiday_obj = Holiday.objects.filter(id=holiday_id).first()

                    remarks = (e.get("event_remarks") or "").strip()
                    if not remarks:
                        remarks = f"Added via correction #{obj.id}"

                    ev = Attendance_Event.objects.create(
                        attendance=attendance,
                        type=e["type"],  # force required
                        minutes=e.get("minutes") or 0,
                        start_time=e.get("start_time"),
                        end_time=e.get("end_time"),
                        approval_status=e.get("approval_status") or "Approved",
                        event_remarks=remarks,
                        approved_by=request.user,
                        holiday=holiday_obj,
                    )
                    created_events.append(ev)

            # Mark correction verified (applied)
            obj.status = "Verified"
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            obj.decline_reason = None
            obj.save(update_fields=["status", "reviewed_by", "reviewed_at", "decline_reason"])

        return Response(
            {
                "detail": "Attendance correction applied and verified.",
                "correction": AttendanceCorrectionListSerializer(obj).data,
                "attendance": AttendanceMiniSerializer(attendance).data,
                "created_event_count": len(created_events),
            }
        )  




#==============PIE CHART DISPLAY============================
#Each Employee
class AttendanceStatsView(APIView):
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

        stats = get_monthly_attendance_stats(request.user, year, month)
        return Response(AttendanceStatsSerializer(stats).data)
    
#Admin dashboard
class AttendanceAdminMonthlyStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = (getattr(request.user, "role", "") or "").strip().upper()
        if role not in {"ADMIN", "SUPER_ADMIN"} and not getattr(request.user, "is_superuser", False):
            raise PermissionDenied("You are not allowed to view admin attendance stats.")

        try:
            year = int(request.query_params.get("year"))
            month = int(request.query_params.get("month"))
        except (TypeError, ValueError):
            return Response({"detail": "year and month are required integers."}, status=400)

        if month < 1 or month > 12:
            return Response({"detail": "month must be between 1 and 12."}, status=400)

        last_day = monthrange(year, month)[1]
        start = date(year, month, 1)
        end = date(year, month, last_day)

        # -------------------------
        # Date clamp (FINAL RULES)
        # -------------------------
        today = timezone.localdate()

        # Future month -> return zeros
        if start > today:
            payload = {
                "year": year,
                "month": month,
                "present": 0,
                "late": 0,
                "absent": 0,
                "leave": 0,
                "undertime": 0,
                "overtime": 0,
            }
            return Response(AttendanceAdminMonthlyStatsSerializer(payload).data, status=200)

        # Current month -> clamp end to today
        if start <= today <= end:
            end = today

        # employee population
        employees_qs = (
            Employee.objects
            .select_related("shift")
            .filter(is_active=True)
            .exclude(Q(position__iexact="CEO") | Q(user__role__iexact="SUPER_ADMIN"))
            .exclude(Q(user__isnull=False) & Q(user__is_active=False))
        )
        employees = list(employees_qs)
        employee_ids = [e.id for e in employees]

        # -------------------------
        # Month dates list (for expected day generation)
        # -------------------------
        month_dates = []
        d = start
        while d <= end:
            month_dates.append(d)
            d += timedelta(days=1)

        # -------------------------
        # Build workday config map in bulk:
        # (shift_id, day_of_week) -> is_workday
        # If missing config, treat as workday
        # -------------------------
        shift_ids = list({getattr(e.shift, "id", None) for e in employees if getattr(e, "shift", None)})
        workday_rows = Shift_Workday.objects.filter(shift_id__in=shift_ids).values_list(
            "shift_id", "day_of_week", "is_workday"
        )
        workday_map = {(sid, dow): is_work for sid, dow, is_work in workday_rows}

        # Precompute expected dates per shift_id
        expected_by_shift = {}
        for sid in shift_ids:
            expected = set()
            for dt in month_dates:
                dow = dt.weekday() + 1  # 1..7
                is_workday = workday_map.get((sid, dow), True)
                if is_workday:
                    expected.add(dt)
            expected_by_shift[sid] = expected

        # -------------------------
        # Leave set: (emp_id, date)
        # -------------------------
        leave_set = set(
            Leave_Day.objects.filter(
                employee_id__in=employee_ids,
                date__gte=start,
                date__lte=end,
                leave_request__status="Approved",
            ).values_list("employee_id", "date")
        )

        # -------------------------
        # Attendance map: (emp_id, date) -> status
        # and collect attendance_ids for events query
        # -------------------------
        att_rows = list(
            Attendance.objects.filter(
                employee_id__in=employee_ids,
                date__gte=start,
                date__lte=end,
            ).values("id", "employee_id", "date", "status")
        )

        att_map = {}
        att_ids = []
        for r in att_rows:
            key = (r["employee_id"], r["date"])
            att_map[key] = r["status"]
            att_ids.append(r["id"])

        # -------------------------
        # Approved events: (emp_id, date) -> set(types)
        # -------------------------
        event_map = {}
        if att_ids:
            event_rows = Attendance_Event.objects.filter(
                attendance_id__in=att_ids,
                approval_status="Approved",
            ).values_list("attendance__employee_id", "attendance__date", "type")

            for emp_id, dt, t in event_rows:
                event_map.setdefault((emp_id, dt), set()).add(t)

        counts = {
            "present": 0,
            "late": 0,
            "absent": 0,
            "leave": 0,
            "undertime": 0,
            "overtime": 0,
        }

        # -------------------------
        # Classify per expected workday (employee-day)
        # -------------------------
        for emp in employees:
            shift = getattr(emp, "shift", None)
            if not shift:
                continue

            expected_dates = expected_by_shift.get(shift.id, set())
            for dt in expected_dates:
                key = (emp.id, dt)

                # Leave overrides everything
                if key in leave_set:
                    counts["leave"] += 1
                    continue

                status = att_map.get(key)

                # Absent if no attendance row OR explicitly ABSENT
                if status is None or status == "ABSENT":
                    counts["absent"] += 1
                    continue

                # Otherwise attendance exists => classify by approved events priority
                types = event_map.get(key, set())
                if "Overtime" in types:
                    counts["overtime"] += 1
                elif "Undertime" in types:
                    counts["undertime"] += 1
                elif "Late" in types:
                    counts["late"] += 1
                else:
                    counts["present"] += 1

        payload = {"year": year, "month": month, **counts}
        return Response(AttendanceAdminMonthlyStatsSerializer(payload).data, status=200)
