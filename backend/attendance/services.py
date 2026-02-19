from datetime import datetime, date, timedelta
from calendar import monthrange

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from shared_model.models import Attendance, Attendance_Event, Shift_Workday


# ====================== HELPERS ======================
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

def _combine_date_time(d: date, t) -> datetime:
    return datetime.combine(d, t)

def _is_true_overnight(shift) -> bool:
    """
    True overnight means the shift crosses midnight:
    e.g. 22:00 -> 06:00  (end_time <= start_time)
    A shift like 00:00 -> 09:00 is NOT true overnight.
    """
    if not shift:
        return False
    return bool(getattr(shift, "crosses_midnight", False))

def _compute_minutes_late(shift, target_date: date, time_in) -> int:
    """
    Late if time_in is after (shift.start_time + grace_minutes)
    Correctly handles true overnight shifts.
    """
    grace = shift.grace_minutes or 0
    start_dt = _combine_date_time(target_date, shift.start_time) + timedelta(minutes=grace)
    in_dt = _combine_date_time(target_date, time_in)
    
    # If true overnight (22:00–06:00) and punch-in time is after midnight (e.g., 00:30),
    # then in_dt must be next day relative to target_date (shift start date).
    if _is_true_overnight(shift) and time_in < shift.start_time:
        in_dt = in_dt + timedelta(days=1)

    diff = in_dt - start_dt
    minutes = int(diff.total_seconds() // 60)
    return max(0, minutes)

def _compute_minutes_undertime(shift, target_date: date, time_out) -> int:
    """
    Undertime if time_out is before shift end time.
    Correctly handles true overnight shifts.
    """
    end_dt = _combine_date_time(target_date, shift.end_time)
    out_dt = _combine_date_time(target_date, time_out)

    if _is_true_overnight(shift):
        end_dt = end_dt + timedelta(days=1)

        # If punch-out happened after midnight, shift it to next day.
        # This applies when shift started before midnight (e.g. 22:00)
        # and time_out is a small time (e.g. 02:00).
        if time_out < shift.start_time:
            out_dt = out_dt + timedelta(days=1)

    diff = end_dt - out_dt
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
    now_time = now_dt.time()

    # Determine which date the attendance record should belong to
    # - Normal shifts: today
    # - Cross-midnight shifts: if current time is after midnight but before end_time,
    #   the shift started yesterday, so attendance date should be yesterday.
    work_date = today

    if getattr(shift, "crosses_midnight", False):
        # If we're in the after-midnight portion, prefer yesterday IF a record exists or if shift is ongoing
        if now_time <= shift.end_time:
            work_date = today - timedelta(days=1)


    # Validate workday based on the shift "start day"
    if not _is_workday_for_shift(shift, work_date):
        raise ValidationError({"detail": "Today is not a workday for your shift."})

    # prevent double punch-in (unique constraint also helps)
    attendance = Attendance.objects.filter(employee=employee, date=work_date).first()
    if attendance and attendance.time_in:
        raise ValidationError({"detail": "You already punched in for this shift/day."})

    # Create if not exist, otherwise update time_in
    if not attendance:
        attendance = Attendance.objects.create(
            employee=employee,
            date=work_date,
            status="PRESENT",
            time_in=now_time,
            time_out=None,
        )
    else:
        attendance.time_in = now_time
        attendance.status = attendance.status or "PRESENT"
        attendance.save(update_fields=["time_in", "status"])

    # Late event (system approved)
    late_minutes = _compute_minutes_late(shift, work_date, now_time)
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

    return attendance


@transaction.atomic
def punch_out(user):
    employee = _get_employee_or_400(user)
    shift = employee.shift

    if not shift:
        raise ValidationError({"detail": "No shift is assigned to your employee record."})

    now_dt = _get_now_local_dt()
    now_time = now_dt.time()

    attendance = _resolve_attendance_for_punch_out(employee, shift)
    if not attendance or not attendance.time_in:
        raise ValidationError({"detail": "You cannot punch out because you have not punched in."})

    if attendance.time_out:
        raise ValidationError({"detail": "You already punched out."})

    attendance.time_out = now_time
    attendance.save(update_fields=["time_out"])

    # undertime uses the attendance.date (important for overnight)
    undertime_minutes = _compute_minutes_undertime(shift, attendance.date, now_time)
    if undertime_minutes > 0:
        Attendance_Event.objects.update_or_create(
            attendance=attendance,
            type="UnderTime",
            defaults={
                "minutes": undertime_minutes,
                "approval_status": "Approved",
                "event_remarks": f"System detected {undertime_minutes} minute(s) undertime.",
                "start_time": None,
                "end_time": shift.end_time,
                "approved_by": None,
            },
        )

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
