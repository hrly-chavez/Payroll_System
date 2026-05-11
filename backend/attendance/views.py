from django.db.models import Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework import generics, status
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
from io import BytesIO
from .serializers import *
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from datetime import datetime
from .services import (punch_in,
    punch_out,
    get_today_status,
    _get_employee_or_400,
    _month_date_range,
    punch_in_eligibility,
    get_monthly_attendance_stats,
    get_admin_attendance_analytics_for_range,
    _is_workday_for_shift,
    import_biometrics_file,
)

#Helpers
def _get_next_offset_target_date(employee: Employee, source_date: date) -> date:
    """
    Finds the next scheduled workday after the source attendance date.
    This will be the target_date for Offset_Credit.

    Rule:
    - next shift only = next workday after source_date
    """
    shift = getattr(employee, "shift", None)
    if not shift:
        raise ValidationError({"detail": "Employee has no assigned shift."})

    # scan up to 14 days ahead for the next workday
    for i in range(1, 15):
        candidate = source_date + timedelta(days=i)
        if _is_workday_for_shift(shift, candidate):
            return candidate

    raise ValidationError({
        "detail": "No next scheduled workday found for this employee."
    })




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

# Excess Time
class SuperAdminPendingExcessTimeView(APIView):
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
            Excess_Time_Request.objects
            .filter(
                status="Pending",
                date__range=[date_from, date_to],
            )
            .select_related(
                "attendance",
                "employee",
                "employee__department",
                "employee__shift",
            )
            .order_by("-date", "-created_at")
        )

        if search:
            qs = qs.filter(
                Q(employee__fname__icontains=search) |
                Q(employee__lname__icontains=search) |
                Q(employee__department__name__icontains=search)
            )

        return Response({
            "year": year,
            "month": month,
            "count": qs.count(),
            "results": PendingExcessTimeQueueSerializer(qs, many=True).data,
        })
    
#Approve as Overtime or Offset
class SuperAdminResolveExcessTimeView(APIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["SUPER_ADMIN"]

    @transaction.atomic
    def post(self, request, pk):
        serializer = ExcessTimeResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data["action"]
        reason = serializer.validated_data.get("reason", "")

        try:
            excess = Excess_Time_Request.objects.select_related(
                "attendance",
                "employee",
                "employee__shift",
            ).get(pk=pk)
        except Excess_Time_Request.DoesNotExist:
            raise ValidationError({"detail": "Excess time request not found."})

        if excess.status != "Pending":
            raise ValidationError({"detail": "This request is already processed."})

        # Safety: remove any existing overtime event tied to this same attendance
        Attendance_Event.objects.filter(
            attendance=excess.attendance,
            type="Overtime",
        ).delete()

        if action == "Approve as Overtime":
            Attendance_Event.objects.create(
                attendance=excess.attendance,
                type="Overtime",
                minutes=excess.minutes,
                start_time=excess.start_time,
                end_time=excess.end_time,
                approval_status="Approved",
                event_remarks=(
                    excess.remarks
                    or f"Approved as Overtime from excess time request #{excess.id}."
                ),
                approved_by=request.user,
            )

            excess.status = "Approved"
            excess.resolution_type = "Overtime"
            excess.approved_by = request.user
            excess.approved_at = timezone.now()
            excess.declined_reason = None
            excess.save(update_fields=[
                "status",
                "resolution_type",
                "approved_by",
                "approved_at",
                "declined_reason",
            ])

            return Response({"detail": "Excess time approved as Overtime successfully."})

        if action == "Approve as Offset":
            target_date = _get_next_offset_target_date(
                employee=excess.employee,
                source_date=excess.date,
            )

            Offset_Credit.objects.update_or_create(
                source_request=excess,
                defaults={
                    "employee": excess.employee,
                    "attendance": excess.attendance,
                    "approved_minutes": excess.minutes,
                    "used_minutes": 0,
                    "remaining_minutes": excess.minutes,
                    "target_date": target_date,
                    "status": "Active",
                    "approved_by": request.user,
                    "approved_at": timezone.now(),
                    "consumed_at": None,
                    "expired_at": None,
                    "remarks": (
                        excess.remarks
                        or f"Approved as Offset from excess time request #{excess.id}."
                    ),
                },
            )

            excess.status = "Approved"
            excess.resolution_type = "Offset"
            excess.approved_by = request.user
            excess.approved_at = timezone.now()
            excess.declined_reason = None
            excess.save(update_fields=[
                "status",
                "resolution_type",
                "approved_by",
                "approved_at",
                "declined_reason",
            ])

            return Response({"detail": "Excess time approved as Offset successfully."})

        # Decline
        excess.status = "Declined"
        excess.resolution_type = None
        excess.approved_by = request.user
        excess.approved_at = timezone.now()
        excess.declined_reason = reason
        excess.save(update_fields=[
            "status",
            "resolution_type",
            "approved_by",
            "approved_at",
            "declined_reason",
        ])

        # Safety: remove offset credit if somehow one exists
        Offset_Credit.objects.filter(source_request=excess).delete()

        return Response({"detail": "Excess time declined successfully."})
    
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

        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        if start_date and end_date:
            try:
                date_from = datetime.strptime(start_date, "%Y-%m-%d").date()
                date_to = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError({"detail": "Invalid date format. Use YYYY-MM-DD"})
        else:
            # fallback (old behavior)
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
            "start_date": date_from,
            "end_date": date_to,
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

#==========================================ATTENDANCE CORRECTION REQUEST==============================

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

        # Get employee name safely
        if hasattr(request.user, "employee") and request.user.employee:
            employee_name = f"{request.user.employee.fname} {request.user.employee.lname}"
        else:
            employee_name = request.user.user_name  # fallback

        # ----------------- AUDIT LOG -----------------
        AuditLog.objects.create(
            user=request.user,
            action="Pending Attendance Correction Request",
            model_name="EmployeeAttendanceCorrection",
            object_id=str(obj.id),
            old_data=None,
            new_data={
                "id": obj.id,
                "employee": employee_name,
                "date": obj.date.isoformat() if obj.date else None,
                "issue_type": obj.issue_type,
                "reason": obj.reason,
                "status": obj.status,
                "requested_at": obj.requested_at.isoformat() if obj.requested_at else None,  # fixed field name
                "file_attached": obj.file_attached.url if obj.file_attached else None,
                "attendance_id": obj.attendance.id if obj.attendance else None,
            }
        )
        # ------------------------------------------------

        # Create a notification for ADMIN users
        admins = User.objects.filter(role='ADMIN')

        employee_name = ""
        if request.user.employee:
            employee_name = f"{request.user.employee.fname} {request.user.employee.lname}"
        else:
            employee_name = request.user.user_name  # fallback

        for admin in admins:
            Notification.objects.create(
                user=admin,
                title="New Attendance Correction Request",
                description=f"{employee_name} submitted an attendance correction request.",
                category="attendance",
                redirect_url="/admin/requests"
            )


        return Response(
            {
                "detail": "Attendance correction request submitted.",
                "correction": AttendanceCorrectionListSerializer(
                    obj,
                    context={"request": request},
                ).data,
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
                "results": AttendanceCorrectionListSerializer(
                    qs,
                    many=True,
                    context={"request": request},
                ).data,
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
                "results": AttendanceCorrectionListSerializer(
                    qs,
                    many=True,
                    context={"request": request},
                ).data,
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

        old_status = obj.status
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

        # ----------------- AUDIT LOG -----------------
        if new_status == "Verified":
            AuditLog.objects.create(
                user=request.user,
                action="Approved Attendance Correction Request",
                model_name="EmployeeAttendanceCorrection",
                object_id=str(obj.id),
                old_data={"status": old_status},
                new_data={"status": "Approved"}
            )
        else:  # Declined
            AuditLog.objects.create(
                user=request.user,
                action="Declined Attendance Correction Request",
                model_name="EmployeeAttendanceCorrection",
                object_id=str(obj.id),
                old_data={"status": old_status},
                new_data={"status": "Declined"}
            )
        # ------------------------------------------------

        if obj.requested_by and hasattr(obj.requested_by, "user"):
            user = obj.requested_by.user
            if new_status == "Verified":
                Notification.objects.create(
                    user=user,
                    title="Attendance Correction Approved",
                    description=f"Your attendance correction request for {obj.attendance.date} has been approved.",
                    category="attendance"
                )
            else:  # Declined
                Notification.objects.create(
                    user=user,
                    title="Attendance Correction Declined",
                    description=f"Your attendance correction request for {obj.attendance.date} was declined. Reason: {decline_reason}",
                    category="attendance"
                )

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
                .prefetch_related("attendance__events")
                .get(pk=pk)
            )
        except Attendance_Correction.DoesNotExist:
            raise NotFound("Attendance correction request not found.")

        return Response(
            AttendanceCorrectionDetailSerializer(
                obj,
                context={"request": request},
            ).data
        )


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
            old_status = obj.status
            obj.status = "Verified"
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            obj.decline_reason = None
            obj.save(update_fields=["status", "reviewed_by", "reviewed_at", "decline_reason"])

            # --- AUDIT LOG ---
            AuditLog.objects.create(
                user=request.user,
                action="Correction Edit For Attendance Request",
                model_name="Attendance",
                object_id=str(attendance.id),
                old_data={
                    "status": old_status,
                    "time_in": attendance.time_in.isoformat() if attendance.time_in else None,
                    "time_out": attendance.time_out.isoformat() if attendance.time_out else None,
                },
                new_data={
                    "status": obj.status,
                    "time_in": attendance.time_in.isoformat() if attendance.time_in else None,
                    "time_out": attendance.time_out.isoformat() if attendance.time_out else None,
                }
            )

            # --- Notification for the employee ---
            if obj.requested_by and hasattr(obj.requested_by, "user"):
                Notification.objects.create(
                    user=obj.requested_by.user,
                    title="Attendance Correction Approved",
                    description=f"Your attendance correction request for {obj.attendance.date} has been applied and verified.",
                    category="attendance"
                )

        return Response(
            {
                "detail": "Attendance correction applied and verified.",
                "correction": AttendanceCorrectionListSerializer(
                    obj,
                    context={"request": request},
                ).data,
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


class AttendanceAdminAnalyticsView(APIView):
    """
    Admin/SuperAdmin attendance analytics for bar chart.

    GET /api/attendance/admin/analytics/?mode=Day|Week|Month|Year&date=YYYY-MM-DD(optional)

    Uses the SAME rules as admin monthly pie stats:
    - expected workdays
    - leave override
    - approved events only
    - absent computed (missing attendance row OR ABSENT)
    - clamp to today, future => zeros
    """
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def get(self, request):
        ser = AttendanceAnalyticsQuerySerializer(data=request.query_params)
        ser.is_valid(raise_exception=True)

        mode = ser.validated_data["mode"]
        anchor = ser.validated_data.get("date") or timezone.localdate()

        if mode == "Day":
            start = anchor
            end = anchor

        elif mode == "Week":
            # Monday start
            start = anchor - timedelta(days=anchor.weekday())
            end = start + timedelta(days=6)

        elif mode == "Month":
            last_day = monthrange(anchor.year, anchor.month)[1]
            start = date(anchor.year, anchor.month, 1)
            end = date(anchor.year, anchor.month, last_day)

        elif mode == "Year":
            start = date(anchor.year, 1, 1)
            end = date(anchor.year, 12, 31)

        else:
            raise ValidationError({"mode": "Invalid mode."})

        counts = get_admin_attendance_analytics_for_range(start, end)

        payload = {
            "mode": mode,
            "date": anchor,
            "start_date": counts["start_date"],
            "end_date": counts["end_date"],
            "present": counts["present"],
            "late": counts["late"],
            "absent": counts["absent"],
            "leave": counts["leave"],
            "undertime": counts["undertime"],
            "overtime": counts["overtime"],
        }
        return Response(AttendanceAnalyticsRangeSerializer(payload).data, status=200)
    

class AttendanceAdminAnalyticsView(APIView):
    """
    Admin/SuperAdmin attendance analytics for bar chart.

    GET /api/attendance/admin/analytics/?mode=Day|Week|Month|Year&date=YYYY-MM-DD(optional)

    Uses the SAME rules as admin monthly pie stats:
    - expected workdays
    - leave override
    - approved events only
    - absent computed (missing attendance row OR ABSENT)
    - clamp to today, future => zeros
    """
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def get(self, request):
        ser = AttendanceAnalyticsQuerySerializer(data=request.query_params)
        ser.is_valid(raise_exception=True)

        mode = ser.validated_data["mode"]
        anchor = ser.validated_data.get("date") or timezone.localdate()

        if mode == "Day":
            start = anchor
            end = anchor

        elif mode == "Week":
            # Monday start
            start = anchor - timedelta(days=anchor.weekday())
            end = start + timedelta(days=6)

        elif mode == "Month":
            last_day = monthrange(anchor.year, anchor.month)[1]
            start = date(anchor.year, anchor.month, 1)
            end = date(anchor.year, anchor.month, last_day)

        elif mode == "Year":
            start = date(anchor.year, 1, 1)
            end = date(anchor.year, 12, 31)

        else:
            raise ValidationError({"mode": "Invalid mode."})

        counts = get_admin_attendance_analytics_for_range(start, end)

        payload = {
            "mode": mode,
            "date": anchor,
            "start_date": counts["start_date"],
            "end_date": counts["end_date"],
            "present": counts["present"],
            "late": counts["late"],
            "absent": counts["absent"],
            "leave": counts["leave"],
            "undertime": counts["undertime"],
            "overtime": counts["overtime"],
        }
        return Response(AttendanceAnalyticsRangeSerializer(payload).data, status=200)
    
#==============PDF NI(?) butang comment Please============================
class AttendanceEmployeesDropdownView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EmployeeDropdownSerializer

    def get_queryset(self):
        return Employee.objects.filter(is_active=True).order_by("lname", "fname")

class AttendanceLogsPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Export Attendance Logs (PDF)

        Query params:
        - scope=all | user
        - employee_id=<int> (required when scope=user)
        - date=YYYY-MM-DD (optional)
        - month=YYYY-MM (optional)
        - year=YYYY (optional)

        Priority: date > month > year > none
        """

        scope = (request.query_params.get("scope") or "all").strip().lower()
        employee_id = request.query_params.get("employee_id")

        date_str = request.query_params.get("date")
        month_str = request.query_params.get("month")
        year_str = request.query_params.get("year")

        # Build queryset
        qs = (
            Attendance.objects
            .select_related("employee", "employee__department", "employee__shift")
            .prefetch_related("events")
            .order_by("-date", "-id")
        )

        # Scope filter
        employee_obj = None
        if scope == "user":
            if not employee_id:
                return Response(
                    {"detail": "employee_id is required when scope=user."},
                    status=http_status.HTTP_400_BAD_REQUEST
                )
            employee_obj = get_object_or_404(Employee, id=employee_id)
            qs = qs.filter(employee_id=employee_id)

        # Date filter (priority: date > month > year)
        try:
            if date_str:
                qs = qs.filter(date=date.fromisoformat(date_str))
            elif month_str:
                y, m = month_str.split("-")
                qs = qs.filter(date__year=int(y), date__month=int(m))
            elif year_str:
                qs = qs.filter(date__year=int(year_str))
        except Exception:
            return Response(
                {"detail": "Invalid date/month/year format."},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        # Helpers
        def fmt_dt(dt):
            if not dt:
                return "-"
            local = timezone.localtime(dt) if timezone.is_aware(dt) else dt
            return local.strftime("%b %d, %Y %I:%M %p")

        def fmt_date(d):
            return d.strftime("%Y-%m-%d") if d else "-"

        def fmt_time(value):
            """
            Accepts datetime/time/string and returns readable time like '09:10 PM'
            """
            if not value:
                return "-"

            # If it's a datetime (Attendance.time_in / time_out are DateTimeField)
            if hasattr(value, "strftime") and hasattr(value, "tzinfo"):
                dt = timezone.localtime(value) if timezone.is_aware(value) else value
                return dt.strftime("%I:%M %p")  # e.g. 09:10 PM

            # If it's a time object (Attendance_Event.start_time/end_time are TimeField)
            if hasattr(value, "hour") and hasattr(value, "minute") and not hasattr(value, "date"):
                return value.strftime("%I:%M %p")

            # fallback (string)
            return str(value)

        def status_color(s):
            s = (s or "").upper()
            if s == "PRESENT":
                return colors.HexColor("#16a34a")
            if s == "ABSENT":
                return colors.HexColor("#dc2626")
            if s in {"HALF_DAY", "HALF DAY"}:
                return colors.HexColor("#f59e0b")
            return colors.HexColor("#2563eb")

        def employee_label(emp: Employee | None):
            if not emp:
                return "-"
            fname = (getattr(emp, "fname", "") or "").strip()
            lname = (getattr(emp, "lname", "") or "").strip()
            full = f"{fname} {lname}".strip()
            return full or f"Employee #{emp.id}"

        # Header labels
        scope_label = "All Users"
        if scope == "user" and employee_obj:
            dept = getattr(getattr(employee_obj, "department", None), "name", None) or "-"
            scope_label = f"{employee_label(employee_obj)} ({dept})"

        date_filter_label = (
            f"Date: {date_str}" if date_str else
            f"Month: {month_str}" if month_str else
            f"Year: {year_str}" if year_str else
            "No date filter"
        )

        # Build PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(letter),
            leftMargin=0.45 * inch,
            rightMargin=0.45 * inch,
            topMargin=0.45 * inch,
            bottomMargin=0.45 * inch,
            title="Attendance Logs",
        )
        usable_w = doc.width

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "title_style",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=18,
            alignment=1,
            spaceAfter=10,
        )

        normal = styles["Normal"]
        normal.fontSize = 9
        normal.leading = 11

        small = ParagraphStyle(
            "small",
            parent=normal,
            fontSize=8.5,
            leading=10.5,
            wordWrap="CJK",
        )

        header_cell = ParagraphStyle(
            "header_cell",
            parent=small,
            fontName="Helvetica-Bold",
            textColor=colors.white,
            alignment=1,
        )

        elements = []
        elements.append(Paragraph("ATTENDANCE LOGS", title_style))
        elements.append(Spacer(1, 6))

        meta_tbl = Table(
            [
                ["Scope:", scope_label, "Filter:", date_filter_label],
                ["Generated At:", fmt_dt(timezone.now()), "", ""],
            ],
            colWidths=[0.12 * usable_w, 0.38 * usable_w, 0.12 * usable_w, 0.38 * usable_w],
            hAlign="CENTER",
        )
        meta_tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.7, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("SPAN", (2, 1), (3, 1)),
        ]))
        elements.append(meta_tbl)
        elements.append(Spacer(1, 12))

        # Table header
        data = [[
            Paragraph("Date", header_cell),
            Paragraph("Employee", header_cell),
            Paragraph("Department", header_cell),
            Paragraph("Workshift", header_cell),
            Paragraph("Time In", header_cell),
            Paragraph("Time Out", header_cell),
            Paragraph("Status", header_cell),
            Paragraph("Event Types", header_cell),
        ]]

        # Rows
        for a in qs:
            emp = getattr(a, "employee", None)
            dept_name = getattr(getattr(emp, "department", None), "name", None)
            shift_name = getattr(getattr(emp, "shift", None), "name", None)

            events = []

            for e in a.events.all():
                label = str(e.type)

                # include minutes only for minute-based events
                if e.type in ["Late", "Undertime"]:
                    label = f"{e.type} ({e.minutes} mins)"

                events.append(label)

            event_types = ", ".join(events) if events else "-"

            data.append([
                Paragraph(fmt_date(getattr(a, "date", None)), small),
                Paragraph(employee_label(emp), small),
                Paragraph(dept_name or "-", small),
                Paragraph(shift_name or "-", small),
                Paragraph(fmt_time(getattr(a, "time_in", None)), small),
                Paragraph(fmt_time(getattr(a, "time_out", None)), small),
                Paragraph(str(getattr(a, "status", "") or "-"), small),
                Paragraph(event_types, small),
            ])
        # Column widths (fit to page)
        col_widths = [
            0.10 * usable_w,  # date
            0.16 * usable_w,  # employee
            0.14 * usable_w,  # department
            0.14 * usable_w,  # workshift
            0.10 * usable_w,  # time in
            0.10 * usable_w,  # time out
            0.10 * usable_w,  # status
            0.16 * usable_w,  # event types
        ]

        tbl = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
        tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F4E79")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("ALIGN", (4, 1), (6, -1), "CENTER"),
        ]))

        # Color status text
        for i in range(1, len(data)):
            status_val = str(getattr(qs[i - 1], "status", "") or "")
            tbl.setStyle(TableStyle([
                ("TEXTCOLOR", (6, i), (6, i), status_color(status_val)),
                ("FONTNAME", (6, i), (6, i), "Helvetica-Bold"),
            ]))

        elements.append(tbl)

        doc.build(elements)
        buffer.seek(0)

        filename = "Attendance_Logs.pdf"
        from django.http import FileResponse
        return FileResponse(buffer, as_attachment=True, filename=filename, content_type="application/pdf")
    
class AttendanceLogsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        GET /attendance/attendance-logs/

        Query params:
        - year=YYYY (required)
        - month=MM (required)
        - search=keyword (optional)
        """

        year = request.query_params.get("year")
        month = request.query_params.get("month")
        keyword = (request.query_params.get("search") or "").strip()

        if not year or not month:
            return Response({"detail": "year and month are required."}, status=400)

        try:
            y = int(year)
            m = int(month)
        except ValueError:
            return Response({"detail": "Invalid year/month."}, status=400)

        qs = (
            Attendance.objects
            .select_related("employee", "employee__department", "employee__shift")
            .prefetch_related("events")
            .filter(date__year=y, date__month=m)
            .order_by("-date", "-id")
        )

        if keyword:
            qs = qs.filter(
                Q(employee__fname__icontains=keyword) |
                Q(employee__lname__icontains=keyword) |
                Q(employee__department__name__icontains=keyword)
            )

        results = []
        for a in qs:
            emp = a.employee

            events = []

            for e in a.events.all():
                label = e.type

                if e.type in ["Late", "Undertime"]:
                    label = f"{e.type} ({e.minutes} mins)"

                events.append(label)

            event_types = ", ".join(events) if events else "-"

            results.append({
                "id": a.id,
                "date": a.date.isoformat() if a.date else None,
                "status": a.status,
                "time_in": timezone.localtime(a.time_in).isoformat() if a.time_in else None,
                "time_out": timezone.localtime(a.time_out).isoformat() if a.time_out else None,
                "employee_id": emp.id,
                "full_name": f"{(emp.fname or '').strip()} {(emp.lname or '').strip()}".strip(),
                "department_name": getattr(emp.department, "name", None),
                "shift_name": getattr(emp.shift, "name", None),
                "event_types": event_types,
            })

        stats = {
            "present": sum(1 for r in results if r["status"] == "PRESENT"),
            "absent": sum(1 for r in results if r["status"] == "ABSENT"),
            "lates": sum(1 for r in results if "Late" in (r["event_types"] or "")),
        }

        return Response({
            "year": y,
            "month": m,
            "stats": stats,
            "count": len(results),
            "results": results
        })

#==============Import .xlxs file for bio ============================
class ImportBiometricsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = BiometricsUploadSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file = serializer.validated_data["file"]

        try:
            count = import_biometrics_file(file)

            return Response(
                {
                    "message": "Biometrics imported successfully.",
                    "records_processed": count,
                }
            )

        except Exception as e:
            return Response(
                {"message": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )