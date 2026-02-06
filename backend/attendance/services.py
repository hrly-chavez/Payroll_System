from datetime import datetime, date, timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from calendar import monthrange
from datetime import date
from shared_model.models import *

#======================================HELPERS====================================
def _get_employee_or_400(user):
    #Your custom User model has: user.employee (OneToOne)
    
    employee = getattr(user, "employee", None)
    if not employee:
        raise ValidationError({"detail": "No employee is linked to this account."})
    return employee

def _get_today_local_date():
    return timezone.localdate()

def _get_now_local_time():
    return timezone.localtime().time()

def _month_date_range(year: int, month: int):
    last_day = monthrange(year, month)[1]
    start = date(year, month, 1)
    end = date(year, month, last_day)
    return start, end

def _is_workday_for_shift(shift, target_date: date) -> bool:
    """
    Checks Shift_Workday for the given shift and day of week.
    Django: Monday=1 ... Sunday=7 in your Shift_Workday model.
    Python: weekday() -> Monday=0 ... Sunday=6
    """
    day_of_week = target_date.weekday() + 1  # convert to 1..7

    workday = Shift_Workday.objects.filter(
        shift=shift,
        day_of_week=day_of_week,
    ).first()

    # If you haven't configured workdays, we assume it's a workday
    if not workday:
        return True

    return workday.is_workday

def _combine_date_time(d: date, t) -> datetime:
    return datetime.combine(d, t)

def _compute_minutes_late(shift, target_date: date, time_in) -> int:
    """
    Late if time_in is after (shift.start_time + grace_minutes).
    """
    grace = shift.grace_minutes or 0
    start_dt = _combine_date_time(target_date, shift.start_time) + timedelta(minutes=grace)
    in_dt = _combine_date_time(target_date, time_in)

    diff = in_dt - start_dt
    minutes = int(diff.total_seconds() // 60)
    return max(0, minutes)

def _compute_minutes_undertime(shift, target_date: date, time_out) -> int:
    """
    Undertime if time_out is before shift end time.
    Handles overnight shifts.
    """
    end_dt = _combine_date_time(target_date, shift.end_time)

    out_dt = _combine_date_time(target_date, time_out)

    # Overnight: end time is on the next day (commonly)
    if shift.is_overnight:
        # If end_time logically belongs to next day, push end_dt by +1 day.
        # Example: start 22:00, end 06:00
        # end_dt becomes next day 06:00.
        end_dt = end_dt + timedelta(days=1)

        # Punch out after midnight -> out_dt should also be next day.
        # If employee punches out at 02:00, out_dt is target_date 02:00 by default,
        # so we need to push it to next day for correct comparison.
        if time_out < shift.start_time:
            out_dt = out_dt + timedelta(days=1)

    diff = end_dt - out_dt
    minutes = int(diff.total_seconds() // 60)
    return max(0, minutes)

#======================================ATTENDANCE===================================
@transaction.atomic
def punch_in(user):
    employee = _get_employee_or_400(user)
    shift = employee.shift

    if not shift:
        raise ValidationError({"detail": "No shift is assigned to your employee record."})

    today = _get_today_local_date()

    if not _is_workday_for_shift(shift, today):
        raise ValidationError({"detail": "Today is not a workday for your shift."})

    # prevent double punch-in (unique constraint also helps)
    attendance = Attendance.objects.filter(employee=employee, date=today).first()
    if attendance and attendance.time_in:
        raise ValidationError({"detail": "You already punched in today."})

    now_time = _get_now_local_time()

    # Create if not exist, otherwise update time_in
    if not attendance:
        attendance = Attendance.objects.create(
            employee=employee,
            date=today,
            status="PRESENT",
            time_in=now_time,
            time_out=None,
        )
    else:
        attendance.time_in = now_time
        if not attendance.status:
            attendance.status = "PRESENT"
        attendance.save(update_fields=["time_in", "status"])

    # LATE event
    late_minutes = _compute_minutes_late(shift, today, now_time)
    if late_minutes > 0:
        # one Late event per attendance (optional rule)
        Attendance_Event.objects.update_or_create(
            attendance=attendance,
            type="Late",
            defaults={
                "minutes": late_minutes,
                "approval_status": "Approved",  # system-generated; you can set Pending if you prefer
                "event_remarks": f"System detected {late_minutes} minute(s) late.",
                "start_time": shift.start_time,
                "end_time": None,
                "approved_by": None,
            }
        )

    return attendance

@transaction.atomic
def punch_out(user):
    employee = _get_employee_or_400(user)
    shift = employee.shift

    if not shift:
        raise ValidationError({"detail": "No shift is assigned to your employee record."})

    today = _get_today_local_date()
    now_time = _get_now_local_time()

    attendance = Attendance.objects.filter(employee=employee, date=today).first()
    if not attendance or not attendance.time_in:
        raise ValidationError({"detail": "You cannot punch out because you have not punched in today."})

    if attendance.time_out:
        raise ValidationError({"detail": "You already punched out today."})

    attendance.time_out = now_time
    attendance.save(update_fields=["time_out"])

    # UNDERTIME event
    undertime_minutes = _compute_minutes_undertime(shift, today, now_time)
    if undertime_minutes > 0:
        Attendance_Event.objects.update_or_create(
            attendance=attendance,
            type="UnderTime",
            defaults={
                "minutes": undertime_minutes,
                "approval_status": "Approved",  # system-generated; you can set Pending if you prefer
                "event_remarks": f"System detected {undertime_minutes} minute(s) undertime.",
                "start_time": None,
                "end_time": shift.end_time,
                "approved_by": None,
            }
        )

    return attendance

def get_today_status(user):
    """
    Optional helper for frontend:
    returns today's attendance record (or None)
    """
    employee = _get_employee_or_400(user)
    today = _get_today_local_date()
    return Attendance.objects.filter(employee=employee, date=today).first()
