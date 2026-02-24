from datetime import datetime, date, time, timedelta
from calendar import monthrange

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from shared_model.models import Attendance, Attendance_Event, Shift_Workday


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


