from datetime import datetime, date, time, timedelta
from calendar import monthrange

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from shared_model.models import *

#==============PIE CHART DISPLAY HELPERS============================

def _expected_workday_dates_for_month(shift, date_from, date_to):
    """
    Returns list[date] of expected workdays for the month range based on Shift_Workday.
    If shift is missing, returns [].
    """
    if not shift:
        return []


    expected = []
    d = date_from
    while d <= date_to:
        # isoweekday: Mon=1 ... Sun=7 (matches your Shift_Workday DayOfWeek choices)
        if _is_workday_for_shift(shift, d):
            expected.append(d)
        d += timedelta(days=1)

    return expected


def get_monthly_attendance_stats(user, year: int, month: int) -> dict:
    """
    Option A: backend computes stats.
    Rules:
    - Count only APPROVED events
    - Leave is based on Leave_Day with Leave_Request status Approved
    - Leave overrides expected workdays and attendance/events on that date
    - Absent is computed from expected workdays - (attendance dates + leave dates)

    FINAL FIX (date clamping):
    - Future month: return zeros
    - Current month: compute start_of_month -> today only
    - Past month: compute full month normally
    """
    employee = _get_employee_or_400(user)
    date_from, date_to = _month_date_range(year, month)

    # -------------------------
    # Date clamp (FINAL RULES)
    # -------------------------
    today = timezone.localdate()

    # Future month -> return zeros
    if date_from > today:
        return {
            "year": year,
            "month": month,
            "present": 0,
            "late": 0,
            "absent": 0,
            "leave": 0,
            "undertime": 0,
            "overtime": 0,
        }

    # Current month -> clamp end to today
    if date_from <= today <= date_to:
        date_to = today
    # Past month -> no change

    # -------------------------
    # Leave dates (Approved only)
    # -------------------------
    leave_qs = Leave_Day.objects.filter(
        employee=employee,
        date__range=[date_from, date_to],
        leave_request__status="Approved",
    )
    leave_dates = set(leave_qs.values_list("date", flat=True))
    leave_count = leave_qs.count()

    # -------------------------
    # Attendance rows (exclude leave override dates)
    # -------------------------
    att_qs = Attendance.objects.filter(
        employee=employee,
        date__range=[date_from, date_to],
    )

    att_non_leave = att_qs.exclude(date__in=leave_dates)

    # Present: treat PRESENT + HALF_DAY as "present" for dashboard
    present_count = att_non_leave.filter(status__in=["PRESENT", "HALF_DAY"]).count()

    # Any attendance row counts as "covered" (so not absent) unless it's leave override date
    attendance_dates = set(att_non_leave.values_list("date", flat=True))

    # -------------------------
    # Approved events (count distinct attendance dates)
    # -------------------------
    approved_events = Attendance_Event.objects.filter(
        attendance__employee=employee,
        attendance__date__range=[date_from, date_to],
        approval_status="Approved",
    ).exclude(attendance__date__in=leave_dates)

    late_count = (
        approved_events.filter(type="Late")
        .values("attendance__date").distinct().count()
    )
    undertime_count = (
        approved_events.filter(type="Undertime")
        .values("attendance__date").distinct().count()
    )
    overtime_count = (
        approved_events.filter(type="Overtime")
        .values("attendance__date").distinct().count()
    )

    # -------------------------
    # Absent (computed from expected workdays)
    # -------------------------
    shift = getattr(employee, "shift", None)
    expected_dates = _expected_workday_dates_for_month(shift, date_from, date_to)

    covered_dates = attendance_dates.union(leave_dates)
    absent_count = sum(1 for d in expected_dates if d not in covered_dates)

    return {
        "year": year,
        "month": month,
        "present": present_count,
        "late": late_count,
        "absent": absent_count,
        "leave": leave_count,
        "undertime": undertime_count,
        "overtime": overtime_count,
    }


def get_admin_attendance_analytics_for_range(date_from: date, date_to: date) -> dict:
    """
    Computes attendance analytics for ALL employees within [date_from, date_to],
    using the same rules as the admin monthly pie chart:
    - Future range -> zeros
    - Clamp end to today
    - Expected workdays based on Shift_Workday (missing config => workday)
    - Leave overrides everything (Approved only)
    - Only APPROVED Attendance_Event counts
    - Absent is computed from expected workdays per employee:
        absent if no Attendance row OR status == ABSENT
    - Present if attendance exists and no higher-priority approved events
    - Priority: Overtime > Undertime > Late > Present
    """

    today = timezone.localdate()

    if date_from > today:
        return {
            "start_date": date_from,
            "end_date": date_to,
            "present": 0,
            "late": 0,
            "absent": 0,
            "leave": 0,
            "undertime": 0,
            "overtime": 0,
        }

    if date_from <= today <= date_to:
        date_to = today

    # employee population (same filter as your admin stats)
    employees_qs = (
        Employee.objects
        .select_related("shift")
        .filter(is_active=True)
        .exclude(Q(position__iexact="CEO") | Q(user__role__iexact="SUPER_ADMIN"))
        .exclude(Q(user__isnull=False) & Q(user__is_active=False))
    )
    employees = list(employees_qs)
    employee_ids = [e.id for e in employees]

    # build date list
    dates = []
    d = date_from
    while d <= date_to:
        dates.append(d)
        d += timedelta(days=1)

    # workday config map: (shift_id, day_of_week) -> is_workday
    shift_ids = list({getattr(e.shift, "id", None) for e in employees if getattr(e, "shift", None)})
    workday_rows = Shift_Workday.objects.filter(shift_id__in=shift_ids).values_list(
        "shift_id", "day_of_week", "is_workday"
    )
    workday_map = {(sid, dow): is_work for sid, dow, is_work in workday_rows}

    # expected dates per shift
    expected_by_shift = {}
    for sid in shift_ids:
        expected = set()
        for dt in dates:
            dow = dt.weekday() + 1  # 1..7
            is_workday = workday_map.get((sid, dow), True)
            if is_workday:
                expected.add(dt)
        expected_by_shift[sid] = expected

    # leave set: (emp_id, date)
    leave_set = set(
        Leave_Day.objects.filter(
            employee_id__in=employee_ids,
            date__gte=date_from,
            date__lte=date_to,
            leave_request__status="Approved",
        ).values_list("employee_id", "date")
    )

    # attendance rows: (emp_id, date) -> status
    att_rows = list(
        Attendance.objects.filter(
            employee_id__in=employee_ids,
            date__gte=date_from,
            date__lte=date_to,
        ).values("id", "employee_id", "date", "status")
    )

    att_map = {}
    att_ids = []
    for r in att_rows:
        key = (r["employee_id"], r["date"])
        att_map[key] = r["status"]
        att_ids.append(r["id"])

    # approved events: (emp_id, date) -> set(types)
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

    for emp in employees:
        shift = getattr(emp, "shift", None)
        if not shift:
            continue

        expected_dates = expected_by_shift.get(shift.id, set())
        for dt in expected_dates:
            key = (emp.id, dt)

            # Leave overrides
            if key in leave_set:
                counts["leave"] += 1
                continue

            status = att_map.get(key)

            # Absent if missing row OR explicit ABSENT
            if status is None or status == "ABSENT":
                counts["absent"] += 1
                continue

            # At this point: not leave, not absent, attendance exists
            counts["present"] += 1

            types = event_map.get(key, set())
            if "Late" in types:
                counts["late"] += 1
            if "Undertime" in types:
                counts["undertime"] += 1
            if "Overtime" in types:
                counts["overtime"] += 1

    return {"start_date": date_from, "end_date": date_to, **counts}

# ====================== HELPERS ======================
EARLY_PUNCH_IN_MINUTES = 60

OT_APPROVAL_THRESHOLD_MINUTES = 60  # only OT >= 60 mins requires approval

def _get_employee_or_400(user):
    employee = getattr(user, "employee", None)
    if not employee:
        raise ValidationError({"detail": "No employee is linked to this account."})
    return employee

def _get_today_local_date():
    return timezone.localdate()

def _get_now_local_dt():
    # local timezone-aware datetime
    return timezone.localtime()

def _month_date_range(year: int, month: int):
    last_day = monthrange(year, month)[1]
    start = date(year, month, 1)
    end = date(year, month, last_day)
    return start, end

def _is_workday_for_shift(shift, target_date: date) -> bool:
    """
    Checks Shift_Workday for the given shift and day of week.
    Django: Monday=1 ... Sunday=7 (your Shift_Workday)
    Python: weekday() -> Monday=0 ... Sunday=6
    """
    day_of_week = target_date.weekday() + 1  # convert to 1..7
    workday = Shift_Workday.objects.filter(shift=shift, day_of_week=day_of_week).first()
    if not workday:
        return True  # if not configured, assume workday
    return workday.is_workday

def _is_true_overnight(shift) -> bool:
    """
    True overnight means the shift crosses midnight:
    e.g. 22:00 -> 06:00  (end_time <= start_time)
    A shift like 00:00 -> 09:00 is NOT true overnight.
    """
    if not shift:
        return False
    return bool(getattr(shift, "crosses_midnight", False))


def _combine_local(d: date, t: time) -> datetime:
    """
    Build a timezone-aware local datetime for a given local date + time.
    """
    naive = datetime.combine(d, t)
    return timezone.make_aware(naive, timezone.get_current_timezone())

def _get_shift_start_end_dt(shift, base_date: date) -> tuple[datetime, datetime]:
    """
    Returns (shift_start_dt, shift_end_dt) for a given shift start date.
    - Non-cross-midnight: start and end are same day
    - Cross-midnight: end is next day
    """
    start_dt = _combine_local(base_date, shift.start_time)
    end_dt = _combine_local(base_date, shift.end_time)
    if getattr(shift, "crosses_midnight", False):
        end_dt = end_dt + timedelta(days=1)
    return start_dt, end_dt
    
def _resolve_work_date_for_punch_in(shift, now_dt: datetime, today: date) -> date:
    """
    Resolve which work_date (shift start date) we are targeting for punch-in gating.

    Rules:
    - Cross-midnight shifts: if after-midnight portion (now.time <= end_time), work_date is yesterday.
    - Non-cross-midnight shifts:
        If the shift already ended earlier today (now >= today_shift_end),
        then the "next" shift is tomorrow => work_date = tomorrow.
        This fixes midnight-start shifts (00:00–09:00) so 22:00 targets tomorrow 00:00.
    """
    if getattr(shift, "crosses_midnight", False):
        if now_dt.time() <= shift.end_time:
            return today - timedelta(days=1)
        return today

    # Non-cross-midnight
    _start_today, end_today = _get_shift_start_end_dt(shift, today)
    if now_dt >= end_today:
        return today + timedelta(days=1)

    return today

def _compute_minutes_late_dt(shift, shift_start_dt: datetime, punched_in_dt: datetime) -> int:
    """
    Late if punched_in_dt is after (shift_start_dt + grace_minutes)
    """
    grace = int(getattr(shift, "grace_minutes", 0) or 0)
    deadline = shift_start_dt + timedelta(minutes=grace)
    diff = punched_in_dt - deadline
    minutes = int(diff.total_seconds() // 60)
    return max(0, minutes)

def _compute_minutes_undertime_dt(shift, shift_end_dt: datetime, punched_out_dt: datetime) -> int:
    """
    Undertime if punched_out_dt is before shift_end_dt
    """
    diff = shift_end_dt - punched_out_dt
    minutes = int(diff.total_seconds() // 60)
    return max(0, minutes)

def _resolve_attendance_for_punch_out(employee, shift):
    """
    Finds correct Attendance row for punch-out.
    - Normal shifts: today's record
    - True overnight shifts: try today, else yesterday
    """
    today = _get_today_local_date()

    att = Attendance.objects.filter(employee=employee, date=today).first()
    if att:
        return att

    if shift and _is_true_overnight(shift):
        yesterday = today - timedelta(days=1)
        return Attendance.objects.filter(employee=employee, date=yesterday).first()

    return None


# ====================== ATTENDANCE ======================
@transaction.atomic
def punch_in(user):
    employee = _get_employee_or_400(user)
    shift = employee.shift

    if not shift:
        raise ValidationError({"detail": "No shift is assigned to your employee record."})

    today = _get_today_local_date()
    now_dt = _get_now_local_dt()

    # Determine work_date using a shared resolver (handles midnight-start shifts correctly)
    work_date = _resolve_work_date_for_punch_in(shift, now_dt, today)

    # Validate workday based on shift start date
    if not _is_workday_for_shift(shift, work_date):
        raise ValidationError({"detail": "Today is not a workday for your shift."})

    shift_start_dt, shift_end_dt = _get_shift_start_end_dt(shift, work_date)

    # Early punch-in guard (60 minutes default)
    earliest_allowed = shift_start_dt - timedelta(minutes=EARLY_PUNCH_IN_MINUTES)
    if now_dt < earliest_allowed:
        raise ValidationError({
            "detail": f"You can punch in only within {EARLY_PUNCH_IN_MINUTES} minutes before your shift starts."
        })

    # prevent double punch-in
    attendance = Attendance.objects.filter(employee=employee, date=work_date).first()
    if attendance and attendance.time_in:
        raise ValidationError({"detail": "You already punched in for this shift/day."})

    # Create if not exist, otherwise update time_in (DateTimeField)
    if not attendance:
        attendance = Attendance.objects.create(
            employee=employee,
            date=work_date,
            status="PRESENT",
            time_in=now_dt,
            time_out=None,
        )
    else:
        attendance.time_in = now_dt
        attendance.status = attendance.status or "PRESENT"
        attendance.save(update_fields=["time_in", "status"])

    # Late event (system approved) — based on shift start + grace (early punch-in will never be late)
    late_minutes = _compute_minutes_late_dt(shift, shift_start_dt, now_dt)
    if late_minutes > 0:
        Attendance_Event.objects.update_or_create(
            attendance=attendance,
            type="Late",
            defaults={
                "minutes": late_minutes,
                "approval_status": "Approved",
                "event_remarks": f"System detected {late_minutes} minute(s) late.",
                "start_time": shift.start_time,
                "end_time": None,
                "approved_by": None,
            },
        )
    else:
        Attendance_Event.objects.filter(attendance=attendance, type="Late").delete()

    return attendance

@transaction.atomic
def punch_out(user):
    employee = _get_employee_or_400(user)
    shift = employee.shift

    if not shift:
        raise ValidationError({"detail": "No shift is assigned to your employee record."})

    now_dt = _get_now_local_dt()

    attendance = _resolve_attendance_for_punch_out(employee, shift)
    if not attendance or not attendance.time_in:
        raise ValidationError({"detail": "You cannot punch out because you have not punched in."})

    if attendance.time_out:
        raise ValidationError({"detail": "You already punched out."})

    # Save DateTimeField
    attendance.time_out = now_dt
    attendance.save(update_fields=["time_out"])

    # Compute undertime / overtime based on shift end datetime using attendance.date as shift start date
    shift_start_dt, shift_end_dt = _get_shift_start_end_dt(shift, attendance.date)

    # -------------------------
    # Undertime
    # -------------------------
    undertime_minutes = _compute_minutes_undertime_dt(shift, shift_end_dt, now_dt)
    if undertime_minutes > 0:
        Attendance_Event.objects.update_or_create(
            attendance=attendance,
            type="Undertime",
            defaults={
                "minutes": undertime_minutes,
                "approval_status": "Approved",
                "event_remarks": f"System detected {undertime_minutes} minute(s) undertime.",
                "start_time": None,
                "end_time": shift.end_time,
                "approved_by": None,
            },
        )
    else:
        Attendance_Event.objects.filter(attendance=attendance, type="Undertime").delete()

    # -------------------------
    # Overtime (after shift end)
    # - Only requires approval if >= 60 minutes
    # - Store start_time/end_time:
    #     start_time = shift.end_time
    #     end_time   = actual punch-out time (local time)
    # -------------------------
    overtime_minutes = int((now_dt - shift_end_dt).total_seconds() // 60)
    overtime_minutes = max(0, overtime_minutes)

    if overtime_minutes > 0:
        needs_approval = overtime_minutes >= OT_APPROVAL_THRESHOLD_MINUTES

        Attendance_Event.objects.update_or_create(
            attendance=attendance,
            type="Overtime",
            defaults={
                "minutes": overtime_minutes,
                "approval_status": "Pending" if needs_approval else "Approved",
                "event_remarks": (
                    f"System detected {overtime_minutes} minute(s) overtime."
                    + (" Needs approval." if needs_approval else " Auto-approved (below 60 minutes).")
                ),
                "start_time": shift.end_time,     # OT starts at shift end (your requirement)
                "end_time": timezone.localtime(now_dt).time(),
                "approved_by": None,
            },
        )
    else:
        Attendance_Event.objects.filter(attendance=attendance, type="Overtime").delete()

    return attendance

def get_today_status(user):
    """
    For frontend: show today's attendance.
    Note: for true overnight shifts, if the record is on yesterday, we return it
    (so the user can still punch out after midnight).
    """
    employee = _get_employee_or_400(user)
    shift = employee.shift
    today = _get_today_local_date()

    att_today = Attendance.objects.filter(employee=employee, date=today).first()
    if att_today:
        return att_today

    if shift and _is_true_overnight(shift):
        yesterday = today - timedelta(days=1)
        return Attendance.objects.filter(employee=employee, date=yesterday).first()

    return None



# ====================== PUNCH-IN ELIGIBILITY ======================
def punch_in_eligibility(user):
    """
    Server-truth punch-in gating for frontend button enable/disable.
    Does NOT modify data. punch_in() still enforces the real rules.

    Returns dict:
      can_punch_in: bool
      reason: str
      shift_start_dt, shift_end_dt, earliest_allowed_dt, now_dt: ISO strings (or None if cannot compute)
      work_date: ISO date string
    """
    employee = _get_employee_or_400(user)
    shift = getattr(employee, "shift", None)

    now_dt = _get_now_local_dt()  # tz-aware local time
    today = _get_today_local_date()

    # Default response (safe)
    resp = {
        "can_punch_in": False,
        "reason": "Punch in is not allowed.",
        "shift_start_dt": None,
        "shift_end_dt": None,
        "earliest_allowed_dt": None,
        "now_dt": now_dt.isoformat(),
        "work_date": today.isoformat(),
    }

    if not shift:
        resp["reason"] = "No shift is assigned to your employee record."
        return resp

    # Determine work_date using the same resolver as punch_in()
    work_date = _resolve_work_date_for_punch_in(shift, now_dt, today)

    # Compute shift datetimes
    shift_start_dt, shift_end_dt = _get_shift_start_end_dt(shift, work_date)
    earliest_allowed_dt = shift_start_dt - timedelta(minutes=EARLY_PUNCH_IN_MINUTES)

    # Fill computed fields
    resp.update({
        "shift_start_dt": shift_start_dt.isoformat(),
        "shift_end_dt": shift_end_dt.isoformat(),
        "earliest_allowed_dt": earliest_allowed_dt.isoformat(),
        "work_date": work_date.isoformat(),
    })

    # Workday check
    if not _is_workday_for_shift(shift, work_date):
        resp["reason"] = "Today is not a workday for your shift."
        return resp

    # Already punched in?
    attendance = Attendance.objects.filter(employee=employee, date=work_date).first()
    if attendance and attendance.time_in:
        resp["reason"] = "You already punched in for this shift/day."
        return resp

    # Early punch-in gate
    if now_dt < earliest_allowed_dt:
        resp["reason"] = (
            f"You can punch in only within {EARLY_PUNCH_IN_MINUTES} minutes before your shift starts."
        )
        return resp

    # Eligible
    resp["can_punch_in"] = True
    resp["reason"] = "You can punch in now."
    return resp


