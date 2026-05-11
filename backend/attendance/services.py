from datetime import datetime, date, time, timedelta
from calendar import monthrange

from django.db import transaction
from django.utils import timezone
from django.utils.timezone import make_aware
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from shared_model.models import *
from django.contrib.auth import get_user_model
import re
import pandas as pd

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

EXCESS_TIME_APPROVAL_THRESHOLD_MINUTES = 60  # only OT >= 60 mins requires approval

def _get_employee_or_400(user):
    employee = getattr(user, "employee", None)
    if not employee:
        raise ValidationError({"detail": "No employee is linked to this account."})
    return employee

def _get_today_local_date():
    return timezone.localdate()

def _get_now_local_dt():
    # local timezone-aware datetime
    return timezone.localtime(timezone.now())

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

def _get_active_offset_credit(employee, work_date: date):
    """
    Returns the earliest active offset credit for the employee on the target work date.
    For now, only one next-shift offset is expected, but order defensively.
    """
    return (
        Offset_Credit.objects
        .filter(
            employee=employee,
            target_date=work_date,
            status="Active",
            remaining_minutes__gt=0,
        )
        .order_by("created_at")
        .first()
    )

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

    # -------------------------------------------------
    # Late computation with offset consumption
    # -------------------------------------------------
    raw_late_minutes = _compute_minutes_late_dt(shift, shift_start_dt, now_dt)

    # default: no offset used
    offset_used_minutes = 0
    remaining_late_minutes = raw_late_minutes

    active_offset = None
    if raw_late_minutes > 0:
        active_offset = _get_active_offset_credit(employee, work_date)

    if raw_late_minutes > 0 and active_offset:
        offset_used_minutes = min(raw_late_minutes, active_offset.remaining_minutes)
        remaining_late_minutes = raw_late_minutes - offset_used_minutes

        active_offset.used_minutes += offset_used_minutes
        active_offset.remaining_minutes -= offset_used_minutes

        if active_offset.remaining_minutes <= 0:
            active_offset.remaining_minutes = 0
            active_offset.status = "Used"
            active_offset.consumed_at = now_dt
        else:
            active_offset.status = "Active"

        active_offset.save(update_fields=[
            "used_minutes",
            "remaining_minutes",
            "status",
            "consumed_at",
        ])

    # -------------------------------------------------
    # Final Late event creation
    # -------------------------------------------------
    if remaining_late_minutes > 0:
        if offset_used_minutes > 0:
            remarks = (
                f"System detected {raw_late_minutes} minute(s) late. "
                f"Offset applied: {offset_used_minutes} minute(s). "
                f"Remaining late: {remaining_late_minutes} minute(s)."
            )
        else:
            remarks = f"System detected {remaining_late_minutes} minute(s) late."

        Attendance_Event.objects.update_or_create(
            attendance=attendance,
            type="Late",
            defaults={
                "minutes": remaining_late_minutes,
                "approval_status": "Approved",
                "event_remarks": remarks,
                "start_time": shift.start_time,
                "end_time": None,
                "approved_by": None,
            },
        )
    else:
        # Fully covered by offset OR not late at all
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
    # Excess Time (after shift end)
    # Rule:
    # - below threshold: ignore
    # - threshold reached/exceeded: create/update Pending Excess_Time_Request
    # - do NOT create Attendance_Event(type="Overtime") yet
    # -------------------------
    excess_minutes = int((now_dt - shift_end_dt).total_seconds() // 60)
    excess_minutes = max(0, excess_minutes)

    if excess_minutes >= EXCESS_TIME_APPROVAL_THRESHOLD_MINUTES:
        Excess_Time_Request.objects.update_or_create(
            attendance=attendance,
            defaults={
                "employee": employee,
                "date": attendance.date,
                "minutes": excess_minutes,
                "start_time": shift.end_time,
                "end_time": timezone.localtime(now_dt).time(),
                "status": "Pending",
                "resolution_type": None,
                "remarks": f"System detected {excess_minutes} minute(s) excess time. Needs approval.",
                "approved_by": None,
                "approved_at": None,
                "declined_reason": None,
            },
        )

        # Safety: if an overtime event somehow exists for this attendance, remove it.
        Attendance_Event.objects.filter(attendance=attendance, type="Overtime").delete()
    else:
        # Below threshold = ignore entirely
        Excess_Time_Request.objects.filter(attendance=attendance).delete()
        Attendance_Event.objects.filter(attendance=attendance, type="Overtime").delete()
    
    return attendance

def get_today_status(user):
    """
    Returns the attendance record that is currently relevant for the dashboard.

    Goals:
    - Normal same-day shift:
        show today's attendance
    - True overnight shift after midnight:
        show yesterday's attendance so punch-out still works
    - Midnight-start next-day shift (e.g. 00:00-09:00 at 11:30 PM today):
        if the early-in window for tomorrow is already open,
        do NOT let today's completed attendance block the next shift.
        In that case:
          - return tomorrow's attendance if it already exists
          - otherwise return None
    """
    employee = _get_employee_or_400(user)
    shift = getattr(employee, "shift", None)
    today = _get_today_local_date()
    now_dt = _get_now_local_dt()

    # No shift assigned -> plain today lookup
    if not shift:
        return Attendance.objects.filter(employee=employee, date=today).first()

    # Resolve the punch-in target work date using the same shared logic
    target_work_date = _resolve_work_date_for_punch_in(shift, now_dt, today)
    shift_start_dt, _shift_end_dt = _get_shift_start_end_dt(shift, target_work_date)
    earliest_allowed_dt = shift_start_dt - timedelta(minutes=EARLY_PUNCH_IN_MINUTES)

    # If we are already inside the target shift's early-in window,
    # prioritize that target work date.
    #
    # This is the key fix for midnight-start shifts:
    # March 17 11:30 PM should target March 18, not return March 17's old row.
    if now_dt >= earliest_allowed_dt:
        target_att = Attendance.objects.filter(
            employee=employee,
            date=target_work_date
        ).first()

        if target_att:
            return target_att

        # Important:
        # If target work date is NOT today and we are already in that shift window,
        # return None so today's completed row does not block punch-in.
        if target_work_date != today:
            return None

    # Fallback 1: today's row
    att_today = Attendance.objects.filter(employee=employee, date=today).first()
    if att_today:
        return att_today

    # Fallback 2: true overnight yesterday row for after-midnight punch-out
    if _is_true_overnight(shift):
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


# import biometrics .xlxs file
User = get_user_model()


def import_biometrics_file(file):
    df = pd.read_excel(file, engine="openpyxl", header=None)

    shift = Shift.objects.get(id=1)
    department = Department.objects.get(id=2)

    i = 0

    header_raw = str(df.iloc[0, 0])
    year_match = re.search(r"(\d{4})", header_raw)
    IMPORT_YEAR = int(year_match.group(1)) if year_match else 2026

    start_match = re.search(r"(\d{1,2})/(\d{1,2})", header_raw)
    start_month = int(start_match.group(1)) if start_match else 1

    created_count = 0

    while i < len(df):
        raw = str(df.iloc[i, 0])
        if "ID:" not in raw:
            i += 1
            continue

        match = re.search(r"ID:(\S+)\s+Name:(.*?)\s+Dept:(\S+)\s+Shift:(\S+)", raw)
        if not match:
            i += 1
            continue

        id_no, full_name, dept_name, shift_name = match.groups()

        name_parts = full_name.strip().split()
        if not name_parts:
            i += 3
            continue

        fname = name_parts[0]
        lname = name_parts[-1] if len(name_parts) > 1 else ""

        employee, _ = Employee.objects.get_or_create(
            id_no=id_no,
            defaults={
                "fname": fname,
                "lname": lname,
                "contact_no": "09123456789",
                "hired_date": date.today(),
                "position": "Agent",
                "email": f"{id_no}@payroll.local",
                "shift": shift,
                "department": department,
                "is_active": True,
            },
        )

        # USER CREATION
        if not hasattr(employee, "user"):
            base_username = fname.lower()
            username = base_username
            counter = 1
            while User.objects.filter(user_name=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            User.objects.create_user(
                user_name=username,
                password=f"{fname.lower()}123",
                role="EMPLOYEE",
                employee=employee,
                is_active=True,
            )

        # Prevent out-of-bounds error
        if i + 2 >= len(df):
            i += 1
            continue

        dates_row = df.iloc[i + 1]
        times_row = df.iloc[i + 2]

        current_year = IMPORT_YEAR
        current_month = None
        previous_day = None

        all_punches = []

        for col in range(1, len(dates_row)):
            day_cell = dates_row[col]
            if pd.isna(day_cell):
                continue

            try:
                day = int(float(day_cell))
            except:
                continue

            if current_month is None:
                current_month = start_month

            if previous_day is not None and day < previous_day:
                current_month = 1 if current_month == 12 else current_month + 1

            max_days = monthrange(current_year, current_month)[1]
            if day > max_days:
                current_month += 1
                day = 1

            attendance_date = date(current_year, current_month, day)
            previous_day = day

            raw_times = str(times_row[col]).strip()
            if raw_times == "0":
                continue

            times = re.findall(r"\d{2}:\d{2}", raw_times)
            parsed = sorted([datetime.strptime(t, "%H:%M").time() for t in times])

            for t in parsed:
                dt = make_aware(datetime.combine(attendance_date, t))
                all_punches.append(dt)

        all_punches = sorted(all_punches)

        idx = 0
        while idx < len(all_punches):
            time_in = all_punches[idx]
            time_out = None

            if idx + 1 < len(all_punches):
                next_punch = all_punches[idx + 1]
                if (next_punch - time_in).total_seconds() <= 16 * 3600:
                    time_out = next_punch
                    idx += 2
                else:
                    idx += 1
            else:
                idx += 1

            attendance_date = time_in.date()

            attendance, _ = Attendance.objects.update_or_create(
                employee=employee,
                date=attendance_date,
                defaults={"status": "PRESENT"},
            )

            if not attendance.time_in:
                attendance.time_in = time_in

            if time_out and not attendance.time_out:
                attendance.time_out = time_out

            attendance.save()
            created_count += 1

        i += 3

    return created_count