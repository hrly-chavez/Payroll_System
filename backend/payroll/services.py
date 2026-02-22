#backend/payroll/services.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, date, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from shared_model.models import *


DEC_0 = Decimal("0.00")

#Helpers
def _overlaps_period(eff_from, eff_to, period_start, period_end):
    if eff_from and eff_from > period_end:
        return False
    if eff_to and eff_to < period_start:
        return False
    return True


def get_latest_active_payroll(period_id: int, employee_id: int) -> Payroll | None:
    """
    Latest active payroll = highest run_no where status != 'Void'.
    Used for result viewing + CEO approval actions + regeneration.
    """
    return (
        Payroll.objects
        .filter(payroll_period_id=period_id, employee_id=employee_id)
        .exclude(status="Void")
        .order_by("-run_no", "-id")
        .first()
    )

def _d2(x, places="0.01"):
    return (Decimal(x).quantize(Decimal(places), rounding=ROUND_HALF_UP))


def _safe_decimal(x, field_name="value"):
    try:
        return Decimal(str(x))
    except Exception:
        raise ValidationError({field_name: f"Invalid decimal value: {x}"})


@dataclass
class Rates:
    daily_rate: Decimal
    hourly_rate: Decimal
    per_minute_rate: Decimal
    shift_work_minutes: int


class PayrollGenerationService:
    """
    All-or-nothing payroll generation.
    If any employee fails, raise ValidationError and rollback everything.
    """
    # -------------------------
    #  HELPERS
    # -------------------------
    def _month_ends_within(self, start_date: date, end_date: date) -> list[tuple[date, date]]:
        """
        Returns [(month_start, month_end)] for each month whose month_end is within the period.
        Example: Jan22-Feb4 returns [(Jan1, Jan31)] because Jan31 is inside the range.
        """
        out: list[tuple[date, date]] = []

        cur = date(start_date.year, start_date.month, 1)
        while cur <= end_date:
            month_start = cur
            # next month start
            if cur.month == 12:
                nxt = date(cur.year + 1, 1, 1)
            else:
                nxt = date(cur.year, cur.month + 1, 1)
            month_end = nxt - timedelta(days=1)

            if start_date <= month_end <= end_date:
                out.append((month_start, month_end))

            cur = nxt

        return out

    def _is_late_beyond_grace(self, att: Attendance, shift: Shift) -> bool:
        """
        Late if time_in > shift.start_time + grace_minutes.
        Correctly handles true overnight shifts where Attendance.date is the shift start date.
        """
        if att.time_in is None:
            return False

        grace = int(getattr(shift, "grace_minutes", 0) or 0)

        shift_start_dt = datetime.combine(att.date, shift.start_time)
        grace_deadline = shift_start_dt + timedelta(minutes=grace)

        time_in_dt = datetime.combine(att.date, att.time_in)

        # True overnight case (22:00 -> 06:00): after-midnight punch-in belongs to next day
        if getattr(shift, "crosses_midnight", False) and att.time_in < shift.start_time:
            time_in_dt = time_in_dt + timedelta(days=1)

        return time_in_dt > grace_deadline

    # -------------------------
    # 1) Public Entry Points
    # -------------------------
    @transaction.atomic
    def generate_for_period(self, period_id: int, generated_by_user):
        period = (
            Payroll_Period.objects.select_for_update()
            .filter(id=period_id)
            .first()
        )
        if not period:
            raise ValidationError({"detail": "Payroll period not found."})

        self._validate_period_for_period_generation(period)

        all_ppes = (
            PayrollPeriodEmployee.objects.select_for_update()
            .filter(period_id=period_id)
            .select_related("employee", "employee__department", "employee__shift")
            .order_by("employee__lname", "employee__fname")
        )

        if not all_ppes.exists():
            raise ValidationError({"detail": "No employees found for this payroll period."})

        not_verified = all_ppes.exclude(status="Verified")
        if not_verified.exists():
            sample = not_verified.select_related("employee").first()
            emp_name = f"{sample.employee.fname} {sample.employee.lname}".strip()
            raise ValidationError({
                "detail": f"All employees must be Verified before generating payroll. Example not verified: {emp_name} ({sample.status})."
            })

        ppes = all_ppes  # now safe: everyone is Verified

        # Optional: lock the period status early (still rolls back on error)
        period.status = "Processing"
        period.save(update_fields=["status"])

        generated = 0
        for ppe in ppes:
            try:
                self._generate_single_locked(period, ppe, generated_by_user)
                generated += 1
            except ValidationError as e:
                # Stop everything, rollback.
                emp_name = getattr(ppe.employee, "full_name", None) or f"{ppe.employee.fname} {ppe.employee.lname}".strip()
                raise ValidationError({"detail": f"Payroll generation failed for {emp_name}: {self._stringify_error(e)}"})

        return {"detail": f"Payroll generated for {generated} employee(s).", "generated": generated}

    @transaction.atomic
    def generate_for_employee(self, period_id: int, employee_id: int, generated_by_user):
        period = (
            Payroll_Period.objects.select_for_update()
            .filter(id=period_id)
            .first()
        )
        if not period:
            raise ValidationError({"detail": "Payroll period not found."})

        # Allow per-employee generation when period is already Processing (needed for reset/regenerate flows)
        self._validate_period_for_employee_generation(period)

        # Ensure the period reflects reality once any payroll is generated
        if period.status == "Open":
            period.status = "Processing"
            period.save(update_fields=["status"])

        ppe = (
            PayrollPeriodEmployee.objects.select_for_update()
            .filter(period_id=period_id, employee_id=employee_id)
            .select_related("employee", "employee__department", "employee__shift")
            .first()
        )
        if not ppe:
            raise ValidationError({"detail": "Employee is not included in this payroll period."})

        self._validate_ppe(ppe,period)
        self._generate_single_locked(period, ppe, generated_by_user)

        return {"detail": "Payroll generated for employee.", "employee_id": employee_id}

    # -------------------------
    # 2) Validation Guards
    # -------------------------
    def _validate_period_for_period_generation(self, period: Payroll_Period):
        if period.status != "Open":
            raise ValidationError({"detail": f"Payroll period must be Open. Current status: {period.status}."})
        if period.end_date < period.start_date:
            raise ValidationError({"detail": "Invalid payroll period date range."})

    def _validate_period_for_employee_generation(self, period: Payroll_Period):
        # Allow per-employee generation while Processing (needed for regeneration)
        if period.status not in {"Open", "Processing"}:
            raise ValidationError({"detail": f"Payroll period must be Open or Processing. Current status: {period.status}."})
        if period.end_date < period.start_date:
            raise ValidationError({"detail": "Invalid payroll period date range."})

    def _validate_ppe(self, ppe: PayrollPeriodEmployee, period: Payroll_Period):
        employee = ppe.employee

        # must be verified
        if ppe.status != "Verified":
            raise ValidationError({"detail": f"Employee must be Verified. Current status: {ppe.status}."})

        # block inactive employee
        if not getattr(employee, "is_active", True):
            raise ValidationError({"detail": "Employee is inactive."})

        # block CEO by position
        if (getattr(employee, "position", "") or "").strip().lower() == "ceo":
            raise ValidationError({"detail": "CEO is not eligible for payroll generation."})

        # block SUPER_ADMIN and inactive linked user (if exists)
        u = getattr(employee, "user", None)
        if u is not None:
            if (getattr(u, "role", "") or "").strip().upper() == "SUPER_ADMIN":
                raise ValidationError({"detail": "SUPER_ADMIN is not eligible for payroll generation."})
            if getattr(u, "is_active", True) is False:
                raise ValidationError({"detail": "Employee's user account is inactive."})

        # block if payroll already exists
        if (Payroll.objects.filter(payroll_period_id=ppe.period_id, employee_id=ppe.employee_id).exclude(status="Void").exists()):
            raise ValidationError({"detail": "Payroll already exists for this employee in this period."})

        # block if no attendance within the period
        has_attendance = Attendance.objects.filter(
            employee_id=ppe.employee_id,
            date__gte=period.start_date,
            date__lte=period.end_date,
        ).exists()
        if not has_attendance:
            raise ValidationError({"detail": "Employee has no attendance within this payroll period."})


    # -------------------------
    # internal runner
    # -------------------------
    def _generate_single_locked(self, period: Payroll_Period, ppe: PayrollPeriodEmployee, generated_by_user):
        self._validate_ppe(ppe,period)

        ctx = self._build_context(period, ppe)

        rates = self._compute_rates(ctx["salary"], ctx["shift"], ctx["payroll_setting"])

        expected_days = self._expected_workdays(ctx["shift"], period.start_date, period.end_date)

        payroll = self._create_payroll(ppe.employee, period)

        # 7.1 basic pay (based on pay_type)
        basic_pay_amount = self._apply_basic_pay(payroll, ctx, rates)

        # 7.2 leave placeholder (ready for later)
        self._apply_paid_leaves(payroll, ctx["leave_map"], rates)

        # 7.3 attendance events (approved)
        self._apply_attendance_events(payroll, ctx["approved_events"], ctx["rule_map"], rates)
        
        late_dates = self._get_late_dates(ctx["approved_events"])

        # Compute absences once (shared business rule)
        absent_days, absent_dates = self._compute_absences(
            expected_days=expected_days,
            attendance_map=ctx["attendance_map"],
            leave_map=ctx["leave_map"],
            holiday_map=ctx["holiday_map"],
            holiday_policy_map=ctx["holiday_policy_map"],
        )
        

        # Night differential (VOID if late-days already; also VOID per-day if has_absent)
        self._apply_night_differential(payroll, ctx["attendance_map"], ctx["rule_map"], rates, late_dates)

        # Holiday earnings (auto if worked on approved holiday)
        self._apply_worked_holidays(payroll, ctx, rates)    

        
        # 7.4 absent deduction
        absent_rule = ctx["rule_map"].get(("Absent", "Deduction"))
        self._apply_absent_deduction(
            payroll=payroll,
            absent_days=absent_days,
            absent_dates=absent_dates,
            absent_rule=absent_rule,
            rates=rates,
        )

        # 8 allowances / deductions / commissions
        self._apply_allowances(payroll=payroll,allowances=ctx["allowances"],period=period,employee=ctx["employee"],shift=ctx["shift"],leave_map=ctx["leave_map"],)
        self._apply_commissions(payroll, ctx["commissions"])
        self._apply_deductions(payroll, ctx["deductions"], period)

        # 9 totals
        self._finalize_totals(payroll)

        # 10 lifecycle
        self._update_ppe_status(ppe, generated_by_user)

    # -------------------------
    # 3) Build Context
    # -------------------------
    def _build_context(self, period: Payroll_Period, ppe: PayrollPeriodEmployee):
        employee = ppe.employee
        department = employee.department
        shift = self._get_employee_shift(employee)

        salary = self._get_effective_salary(employee, period.end_date)
        payroll_setting = self._get_payroll_setting()

        attendance_map = self._get_attendance_map(employee, period)
        approved_events = self._get_approved_events(attendance_map)

        # Leave placeholder for now (ready when other team finishes)
        leave_map = self._get_leave_map(employee, period)

        holiday_map = self._get_holiday_map(period, department)
        holiday_policy_map = self._get_holiday_policy_map(department)

        allowances = self._get_allowances(employee, period)
        deductions = self._get_deductions(employee, period)
        commissions = self._get_commissions(employee, period)

        rule_map = self._get_pay_rules(employee, department, period)

        warnings = []
        # Hard stop if salary missing
        if not salary:
            raise ValidationError({"detail": "Employee has no salary effective for this payroll period."})
        if not shift:
            raise ValidationError({"detail": "Employee has no shift (direct or department shift)."})

        # Hard stop if any PRESENT attendance has missing time_in/out (prevents wrong payroll)
        for d, att in attendance_map.items():
            if att.status == "PRESENT" and (att.time_in is None or att.time_out is None):
                raise ValidationError({"detail": f"Attendance on {d} is PRESENT but missing time_in/time_out."})

        return {
            "period": period,
            "ppe": ppe,
            "employee": employee,
            "department": department,
            "shift": shift,
            "salary": salary,
            "payroll_setting": payroll_setting,
            "attendance_map": attendance_map,
            "approved_events": approved_events,
            "leave_map": leave_map,
            "holiday_map": holiday_map,
            "holiday_policy_map": holiday_policy_map,
            "allowances": allowances,
            "deductions": deductions,
            "commissions": commissions,
            "rule_map": rule_map,
            "warnings": warnings,
        }

    def _get_employee_shift(self, employee: Employee) -> Shift | None:
        if employee.shift:
            return employee.shift
        if employee.department and employee.department.shift_id:
            return employee.department.shift_id
        return None

    def _get_effective_salary(self, employee: Employee, period_end_date: date) -> Employee_Salary | None:
        return (
            Employee_Salary.objects
            .filter(employee=employee, effective_from__lte=period_end_date)
            .order_by("-effective_from")
            .first()
        )

    def _get_payroll_setting(self) -> Payroll_Setting:
        obj = Payroll_Setting.objects.order_by("id").first()
        if not obj:
            obj = Payroll_Setting.objects.create(daily_rate_divisor=22, is_semi_monthly=True)
        return obj

    def _get_attendance_map(self, employee: Employee, period: Payroll_Period):
        rows = Attendance.objects.filter(
            employee=employee,
            date__gte=period.start_date,
            date__lte=period.end_date
        ).prefetch_related("events")
        return {r.date: r for r in rows}

    def _get_approved_events(self, attendance_map):
        approved = []
        for att in attendance_map.values():
            for ev in att.events.all():
                if ev.approval_status == "Approved":
                    approved.append(ev)
        return approved

    def _get_late_dates(self, approved_events) -> set[date]:
        late_dates: set[date] = set()
        for ev in approved_events:
            normalized = self._normalize_event_type(ev.type)
            if normalized == "Late" and int(ev.minutes or 0) > 0:
                # ev.attendance.date is reliable since event belongs to attendance
                if ev.attendance_id:
                    late_dates.add(ev.attendance.date)
        return late_dates

    def _get_leave_map(self, employee: Employee, period: Payroll_Period) -> dict[date, Leave_Day]:
        """
        Map of leave days within this payroll period.
        Only leave days created from Approved requests should exist,
        because we create Leave_Day only when Approved.
        """
        rows = Leave_Day.objects.filter(
        employee=employee,
        date__gte=period.start_date,
        date__lte=period.end_date,
        leave_request__status="Approved",
    ).select_related("leave_request", "leave_request__leave_type")

        # If somehow duplicates exist (shouldn't due to constraint), last one wins
        return {r.date: r for r in rows}

    def _get_holiday_map(self, period: Payroll_Period, department: Department):
        rows = Holiday.objects.filter(
            date__gte=period.start_date,
            date__lte=period.end_date,
            status="Approved",
            is_active=True,
            base=department.holiday_base,   # <-- IMPORTANT
        )
        return {h.date: h for h in rows}

    def _get_holiday_policy_map(self, department):
        rows = HolidayPolicy.objects.filter(department=department)
        return {r.holiday_type: bool(r.requires_work) for r in rows}

    def _get_allowances(self, employee: Employee, period: Payroll_Period):
        qs = (
            Employee_Allowance.objects
            .filter(employee=employee, status="Active")
            .select_related("allowance_type")
        )

        rows = []
        for a in qs:
            if _overlaps_period(a.effective_from, a.effective_to, period.start_date, period.end_date):
                rows.append(a)
        return rows

    def _get_deductions(self, employee: Employee, period: Payroll_Period):
        qs = (
            Employee_Deduction.objects
            .filter(employee=employee, status="Active")
            .select_related("deduction_type")
        )

        rows = []
        for d in qs:
            if _overlaps_period(d.effective_from, d.effective_to, period.start_date, period.end_date):
                rows.append(d)
        return rows
    
    def _get_commissions(self, employee: Employee, period: Payroll_Period):
        return list(
            PayrollPeriodEmployeeCommission.objects.filter(period=period, employee=employee).select_related("commission_type")
        )

    def _get_pay_rules(self, employee: Employee, department, period: Payroll_Period):
        """
        Priority:
        1) employee-specific
        2) department-specific
        3) global (no applies_to and no employee)
        Pick latest effective_from if multiple overlap.
        """
        rules = Pay_Rule.objects.filter(is_active=True)

        # only rules that overlap this period (effective_from <= period_end and (effective_to is null or >= period_start))
        rules = rules.filter(
            effective_from__lte=period.end_date
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=period.start_date)
        )

        # fetch all candidates, then choose by priority per (event_type, category)
        candidates = list(rules)

        def priority(rule: Pay_Rule):
            if rule.employee_id == employee.id:
                return 3
            if rule.applies_to_id == department.id:
                return 2
            if rule.employee_id is None and rule.applies_to_id is None:
                return 1
            return 0

        rule_map = {}
        for r in candidates:
            key = (r.event_type, r.category)
            prev = rule_map.get(key)
            if not prev:
                rule_map[key] = r
                continue

            # compare priority first, then effective_from
            if priority(r) > priority(prev):
                rule_map[key] = r
            elif priority(r) == priority(prev) and r.effective_from >= prev.effective_from:
                rule_map[key] = r

        return rule_map

    # -------------------------
    # 4) Rate Computation
    # -------------------------
    def _compute_rates(self, salary: Employee_Salary, shift: Shift, payroll_setting: Payroll_Setting) -> Rates:
        divisor = Decimal(str(payroll_setting.daily_rate_divisor or 22))
        base = _safe_decimal(salary.base_rate, "base_rate")

        shift_work_minutes = self._shift_work_minutes(shift)
        if shift_work_minutes <= 0:
            raise ValidationError({"detail": "Shift work minutes computed as 0. Check shift times and break minutes."})

        # Daily rate only truly matters for monthly/per-period deductions and leave computations
        daily_rate = (base / divisor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        hourly_rate = (daily_rate / Decimal(shift_work_minutes / 60)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        per_minute_rate = (daily_rate / Decimal(shift_work_minutes)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        return Rates(
            daily_rate=daily_rate,
            hourly_rate=hourly_rate,
            per_minute_rate=per_minute_rate,
            shift_work_minutes=shift_work_minutes,
        )
    
    def _compute_absences(self,expected_days,attendance_map,leave_map,holiday_map,holiday_policy_map,) -> tuple[int, set[date]]:
        absent_dates: set[date] = set()

        for d in expected_days:
            # A) Leave override (placeholder)
            if d in leave_map:
                continue

            # B) Holiday check
            h = holiday_map.get(d)
            if h:
                requires_work = bool(holiday_policy_map.get(h.type, False))
                if not requires_work:
                    continue  # not absent

                # requires work: if no attendance -> absent
                if d not in attendance_map:
                    absent_dates.add(d)
                continue

            # C) Normal day
            if d not in attendance_map:
                absent_dates.add(d)

        return len(absent_dates), absent_dates
    
    def _shift_work_minutes(self, shift: Shift) -> int:
        start = shift.start_time
        end = shift.end_time

        # If crosses_midnight = True, end is next day (end <= start)
        if shift.crosses_midnight:
            # e.g. 22:00 -> 06:00
            start_dt = datetime.combine(date(2000, 1, 1), start)
            end_dt = datetime.combine(date(2000, 1, 2), end)
        else:
            start_dt = datetime.combine(date(2000, 1, 1), start)
            end_dt = datetime.combine(date(2000, 1, 1), end)

        minutes = int((end_dt - start_dt).total_seconds() // 60)
        minutes = max(0, minutes - int(shift.break_minutes or 0))
        return minutes

    # -------------------------
    # 5) Expected Workdays
    # -------------------------
    def _expected_workdays(self, shift: Shift, start_date: date, end_date: date):
        # Shift_Workday uses Monday=1 ... Sunday=7, Python weekday: Mon=0 ... Sun=6
        workdays = Shift_Workday.objects.filter(shift=shift, is_workday=True).values_list("day_of_week", flat=True)
        workdays = set(workdays)

        out = []
        d = start_date
        while d <= end_date:
            dow = d.weekday() + 1
            if dow in workdays:
                out.append(d)
            d += timedelta(days=1)
        return out

    # -------------------------
    # 6) Create Payroll Header
    # -------------------------
    def _create_payroll(self, employee: Employee, period: Payroll_Period, regenerated_from: Payroll | None = None) -> Payroll:
        # next run_no = max(existing run_no) + 1 (including Void runs)
        last = (
            Payroll.objects
            .filter(payroll_period=period, employee=employee)
            .order_by("-run_no", "-id")
            .first()
        )
        next_run_no = (int(last.run_no) + 1) if last else 1

        return Payroll.objects.create(
            payroll_period=period,
            employee=employee,
            run_no=next_run_no,
            status="Generated",
            regenerated_from=regenerated_from,
            basic_pay=DEC_0,
            total_earnings=DEC_0,
            total_deductions=DEC_0,
            net_pay=DEC_0,
        )

    # -------------------------
    # 7.1 Basic Pay
    # -------------------------
    def _apply_basic_pay(self, payroll: Payroll, ctx, rates: Rates) -> Decimal:
        salary = ctx["salary"]
        pay_type = salary.pay_type
        base_rate = _safe_decimal(salary.base_rate, "base_rate")

        period = ctx["period"]
        attendance_map = ctx["attendance_map"]
        leave_map = ctx["leave_map"]

        if pay_type == "Monthly":
            amount = _d2(base_rate / Decimal("2"))
            self._create_line(payroll, "EARNING", "Basic Pay (Semi-monthly)", amount, source_type="MANUAL")
            return amount

        if pay_type == "Per Period":
            amount = _d2(base_rate)
            self._create_line(payroll, "EARNING", "Basic Pay (Per Period)", amount, source_type="MANUAL")
            return amount

        # Daily / Hourly should be attendance-based (as you decided)
        if pay_type == "Daily":
            # PRESENT days
            worked_days = sum(1 for a in attendance_map.values() if a.status == "PRESENT")

            # Paid leave days (units-based)
            paid_leave_units = DEC_0
            for ld in leave_map.values():
                if ld.is_paid:
                    units = _safe_decimal(ld.units, "units")
                    pay_rate = _safe_decimal(ld.pay_rate, "pay_rate")  # usually 1.00
                    paid_leave_units += (units * pay_rate)

            total_units = Decimal(worked_days) + paid_leave_units

            amount = _d2(rates.daily_rate * total_units)
            self._create_line(
                payroll,
                "EARNING",
                f"Daily Pay ({total_units.quantize(Decimal('0.00'))} day units)",
                amount,
                source_type="ATTENDANCE",
            )
            return amount

        if pay_type == "Hourly":
            total_minutes = 0
            for a in attendance_map.values():
                if a.status != "PRESENT":
                    continue
                total_minutes += self._attendance_work_minutes(a, ctx["shift"])

            hours = Decimal(total_minutes) / Decimal("60")
            worked_amount = _d2(rates.hourly_rate * hours)

            # Paid leave is paid using daily_rate * units * pay_rate (same as Daily logic)
            paid_leave_units = DEC_0
            for ld in leave_map.values():
                if ld.is_paid:
                    units = _safe_decimal(ld.units, "units")
                    pay_rate = _safe_decimal(ld.pay_rate, "pay_rate")
                    paid_leave_units += (units * pay_rate)

            leave_amount = _d2(rates.daily_rate * paid_leave_units) if paid_leave_units > 0 else DEC_0

            amount = _d2(worked_amount + leave_amount)

            desc = f"Hourly Pay ({hours.quantize(Decimal('0.01'))} hrs"
            if paid_leave_units > 0:
                desc += f" + {paid_leave_units.quantize(Decimal('0.00'))} leave day units"
            desc += ")"

            self._create_line(
                payroll,
                "EARNING",
                desc,
                amount,
                source_type="ATTENDANCE",
            )
            return amount

        raise ValidationError({"detail": f"Unsupported salary pay_type: {pay_type}"})

    # -------------------------
    # 7.2 Paid Leaves 
    # -------------------------
    def _apply_paid_leaves(self, payroll: Payroll, leave_map: dict[date, Leave_Day], rates: Rates):
        """
        - Paid leave money is integrated into Basic Pay computation
        - Payslip lines here are INFORMATION only (audit trail)
        """
        if not leave_map:
            return

        for d in sorted(leave_map.keys()):
            ld = leave_map[d]

            # show both paid/unpaid as info (useful for auditing)
            units = _safe_decimal(ld.units, "units")
            pay_rate = _safe_decimal(ld.pay_rate, "pay_rate")
            is_paid = bool(ld.is_paid)

            # compute the "would-be" amount for reference (NOT included in totals)
            ref_amount = _d2(rates.daily_rate * units * pay_rate) if is_paid else DEC_0

            label = "Paid" if is_paid else "Unpaid"
            desc = f"{label} Leave ({d}) ({units} day) (rate {pay_rate})"

            self._create_line(
                payroll,
                "INFORMATION",
                desc,
                ref_amount,                 # safe to store for display/reference
                source_type="LEAVE_DAY",
                source_id=ld.id,
                quantity_min=None,
                rate_applied=pay_rate,
            )
        


    # -------------------------
    # 7.3 Attendance Events
    # -------------------------
    def _apply_attendance_events(self, payroll, approved_events, rule_map, rates: Rates):
        for ev in approved_events:
            # Normalize event naming mismatch (your Attendance_Event choices differ)
            normalized = self._normalize_event_type(ev.type)

            # Determine category from Pay_Rule expectation:
            # Late/Undertime -> Deduction, Overtime -> Earning
            if normalized in ("Late", "Undertime"):
                category = "Deduction"
            else:
                category = "Earning"

            rule = rule_map.get((normalized, category))
            if not rule:
                # If no rule exists, skip OR hard-stop. I recommend hard-stop for audit correctness.
                raise ValidationError({"detail": f"Missing Pay Rule for {normalized} ({category})."})

            minutes = int(ev.minutes or 0)
            amount, rate_applied = self._compute_rule_amount(rule, minutes, rates)

            if amount <= 0:
                continue

            line_type = "DEDUCTION" if category == "Deduction" else "EARNING"
            desc = f"{normalized} ({minutes} min)"
            self._create_line(
                payroll,
                line_type=line_type,
                description=desc,
                amount=amount,
                rule=rule,
                source_type="ATTENDANCE_EVENT",
                source_id=ev.id,
                quantity_min=minutes,
                rate_applied=rate_applied,
            )

    def _normalize_event_type(self, s: str) -> str:
        # Attendance_Event: "OverTime", "UnderTime" but Pay_Rule: "Overtime", "Undertime"
        m = {
            "OverTime": "Overtime",
            "UnderTime": "Undertime",
            "Worked Holiday": "Worked Holiday",
            "Late": "Late",
        }
        return m.get(s, s)

    def _compute_rule_amount(self, rule: Pay_Rule, minutes: int, rates: Rates):
        rv = _safe_decimal(rule.rate_value, "rate_value")

        if rule.rate_type == "MULTIPLIER":
            # minutes * per_minute_rate * multiplier
            amount = _d2(Decimal(minutes) * rates.per_minute_rate * rv)
            return amount, rv

        if rule.rate_type == "PER_MINUTE":
            amount = _d2(Decimal(minutes) * rv)
            return amount, rv

        if rule.rate_type == "PER_DAY":
            # PER_DAY usually not used for minute events, but keep safe:
            amount = _d2(rv)
            return amount, rv

        if rule.rate_type == "FIXED":
            amount = _d2(rv)
            return amount, rv

        raise ValidationError({"detail": f"Unknown rate_type: {rule.rate_type}"})

    # -------------------------
    # Night differential (time overlap 22:00–06:00)
    # -------------------------
    def _apply_night_differential(self, payroll, attendance_map, rule_map, rates: Rates, late_dates: set[date]):
        rule = rule_map.get(("Night Differential", "Earning"))
        if not rule:
            return

        for d, att in attendance_map.items():
            if att.status != "PRESENT":
                continue

            minutes = self._night_diff_minutes(att)
            if minutes <= 0:
                continue

            # VOID per-day night diff if late on that day
            if rule.rate_type in ("PER_DAY", "FIXED"):
                if d in late_dates:
                    continue

                amount = _d2(rule.rate_value)
                self._create_line(
                    payroll,
                    "EARNING",
                    f"Night Differential ({d})",
                    amount,
                    rule=rule,
                    source_type="ATTENDANCE",
                    source_id=att.id,
                    quantity_min=minutes,
                    rate_applied=_safe_decimal(rule.rate_value),
                )
                continue

            amount, rate_applied = self._compute_rule_amount(rule, minutes, rates)
            if amount > 0:
                self._create_line(
                    payroll,
                    "EARNING",
                    f"Night Differential ({minutes} min)",
                    amount,
                    rule=rule,
                    source_type="ATTENDANCE",
                    source_id=att.id,
                    quantity_min=minutes,
                    rate_applied=rate_applied,
                )

    def _night_diff_minutes(self, att: Attendance) -> int:

        """
        Compute overlap of the employee's actual worked interval with the night window 22:00–06:00.

        We check TWO windows because a shift can start after midnight:
        - Window A: (prev day 22:00) -> (today 06:00)
        - Window B: (today 22:00) -> (next day 06:00)
        """
        if att.time_in is None or att.time_out is None:
            return 0

        start_dt, end_dt = self._attendance_interval(att)

        # Two possible night windows around the work interval
        # Window A: prev day 22:00 -> work day 06:00
        a_start = datetime.combine(start_dt.date() - timedelta(days=1), time(22, 0))
        a_end   = datetime.combine(start_dt.date(), time(6, 0))

        # Window B: work day 22:00 -> next day 06:00
        b_start = datetime.combine(start_dt.date(), time(22, 0))
        b_end   = datetime.combine(start_dt.date() + timedelta(days=1), time(6, 0))

        def overlap_minutes(win_start: datetime, win_end: datetime) -> int:
            overlap = max(timedelta(0), min(end_dt, win_end) - max(start_dt, win_start))
            return int(overlap.total_seconds() // 60)

        minutes = overlap_minutes(a_start, a_end) + overlap_minutes(b_start, b_end)
        return max(0, minutes)

    # -------------------------
    # Holiday earnings (worked on approved holiday)
    # -------------------------
    def _apply_worked_holidays(self, payroll, ctx, rates: Rates):
        holiday_map = ctx["holiday_map"]
        policy_map = ctx["holiday_policy_map"]
        rule_map = ctx["rule_map"]
        attendance_map = ctx["attendance_map"]
        dept = ctx["department"]

        for d, att in attendance_map.items():
            if att.status != "PRESENT":
                continue

            h = holiday_map.get(d)
            if not h:
                continue

            requires_work = bool(policy_map.get(h.type, False))
            # If they worked anyway, pay holiday earning based on holiday type (reg/special/company)
            event_type = self._holiday_type_to_rule_event(h.type)
            rule = rule_map.get((event_type, "Earning"))
            if not rule:
                raise ValidationError({"detail": f"Missing Pay Rule for {event_type} (Earning)."})
            # Multiplier usually: daily_rate * multiplier (we convert to minutes for consistency)
            # simplest: compute using full shift minutes
            minutes = self._attendance_work_minutes(att, ctx["shift"])
            if minutes <= 0:
                continue
            amount, rate_applied = self._compute_rule_amount(rule, minutes, rates)
            if amount > 0:
                self._create_line(
                    payroll,
                    "EARNING",
                    f"{event_type} ({d})",
                    amount,
                    rule=rule,
                    source_type="ATTENDANCE",
                    source_id=att.id,
                    quantity_min=minutes,
                    rate_applied=rate_applied,
                )

    def _holiday_type_to_rule_event(self, holiday_type: str) -> str:
        # your Pay_Rule event_type choices include "Regular Holiday", "Special Holiday", "Special Non Working Holiday", "Company Holiday"
        if holiday_type == "Regular":
            return "Regular Holiday"
        if holiday_type == "Special Working":
            return "Special Holiday"
        if holiday_type == "Special Non-Working":
            return "Special Non Working Holiday"
        if holiday_type == "Company Holiday":
            return "Company Holiday"
        return "Company Holiday"

    # -------------------------
    # 7.4 Absent auto-detection
    # -------------------------
    def _apply_absent_deduction(self,payroll: Payroll,absent_days: int,absent_dates: set[date],absent_rule: Pay_Rule | None,rates: Rates,):
        if not absent_rule:
            raise ValidationError({"detail": "Missing Pay Rule for Absent (Deduction)."})

        # Prefer dates (more accurate + shows the date), fallback to absent_days
        dates = sorted(absent_dates) if absent_dates else []
        if dates:
            days_count = len(dates)
        else:
            days_count = int(absent_days or 0)

        if days_count <= 0:
            return

        multiplier = _safe_decimal(absent_rule.rate_value, "rate_value")  # expected 1.0000
        per_day_amount = _d2(rates.daily_rate * multiplier)

        # Create one line per absent date
        if dates:
            for d in dates:
                self._create_line(
                    payroll,
                    "DEDUCTION",
                    f"Absent ({d})",
                    per_day_amount,
                    rule=absent_rule,
                    source_type="ATTENDANCE",
                    source_id=None,
                    quantity_min=None,
                    rate_applied=multiplier,
                )
            return

        # Fallback (if no dates were passed for some reason)
        total_amount = _d2(Decimal(days_count) * per_day_amount)
        self._create_line(
            payroll,
            "DEDUCTION",
            f"Absent ({days_count} day(s))",
            total_amount,
            rule=absent_rule,
            source_type="ATTENDANCE",
            source_id=None,
            quantity_min=None,
            rate_applied=multiplier,
        )

    # -------------------------
    # 8) Allowances, Commissions, Deductions
    # -------------------------
    def _compute_allowance_eligible_days_for_month(self,employee: Employee,shift: Shift,month_start: date,month_end: date,leave_map: dict[date, Leave_Day],) -> int:

        expected_days = self._expected_workdays(shift, month_start, month_end)

        rows = Attendance.objects.filter(
            employee=employee,
            date__gte=month_start,
            date__lte=month_end,
        )
        attendance_map = {r.date: r for r in rows}

        eligible = 0
        for d in expected_days:
            #  If leave day (paid or unpaid) -> no allowance
            if d in leave_map:
                continue

            att = attendance_map.get(d)

            # ABSENT => void
            if not att or att.status != "PRESENT":
                continue

            # late beyond grace => void
            if att.time_in is None:
                continue
            if self._is_late_beyond_grace(att, shift):
                continue

            eligible += 1


        return eligible

    def _apply_allowances(self,payroll: Payroll,allowances,period: Payroll_Period,employee: Employee,shift: Shift,leave_map: dict[date, Leave_Day],):
        for a in allowances:
            at = a.allowance_type
            name = at.name if at else "Allowance"

            # ------------------------------------------------------
            # ALL Per Day allowances -> compute per MONTH,
            # pay ONLY on payroll period that contains month-end
            # ------------------------------------------------------
            if a.frequency == "Per Day":
                per_day_amt = _d2(a.amount)
                if per_day_amt <= 0:
                    continue

                for month_start, month_end in self._month_ends_within(period.start_date, period.end_date):
                    eligible_days = self._compute_allowance_eligible_days_for_month(
                        employee=employee,
                        shift=shift,
                        month_start=month_start,
                        month_end=month_end,
                        leave_map=leave_map,
                    )
                    if eligible_days <= 0:
                        continue

                    amount = _d2(Decimal(eligible_days) * per_day_amt)

                    self._create_line(
                        payroll,
                        "EARNING",
                        f"Allowance: {name} ({month_start.strftime('%b %Y')}) ({eligible_days} day(s))",
                        amount,
                        source_type="MANUAL",
                        source_id=a.id,
                    )
                continue

            # ------------------------------------------------------
            # Non-Per-Day allowances remain your current behavior
            # ------------------------------------------------------
            amt = self._resolve_frequency_amount(a.amount, a.frequency, a.effective_from, a.effective_to, period)
            if amt <= 0:
                continue

            self._create_line(
                payroll,
                "EARNING",
                f"Allowance: {name}",
                amt,
                source_type="MANUAL",
                source_id=a.id
            )

    def _apply_commissions(self, payroll: Payroll, commissions):
        for c in commissions:
            amt = _d2(c.amount)
            if amt <= 0:
                continue
            desc = f"Commission: {c.commission_type.code}"
            self._create_line(payroll, "EARNING", desc, amt, source_type="MANUAL", source_id=c.id)

    def _apply_deductions(self, payroll: Payroll, deductions, period: Payroll_Period):
        for d in deductions:
            # If this deduction is a loan row, prefer amortization_per_period (per payroll period)
            base_amount = d.amortization_per_period if d.amortization_per_period is not None else d.amount

            amt = self._resolve_frequency_amount(base_amount, d.frequency, d.effective_from, d.effective_to, period)
            if amt <= 0:
                continue

            code = d.deduction_type.code if d.deduction_type else "Deduction"
            desc = f"Deduction: {code}"
            self._create_line(
                payroll,
                "DEDUCTION",
                desc,
                amt,
                source_type="MANUAL",
                source_id=d.id
            )

    def _resolve_frequency_amount(self, amount, frequency, eff_from, eff_to, period: Payroll_Period) -> Decimal:
        amt = _d2(amount)

        if frequency == "Per Day":
            # handled per-attendance day in _apply_allowances
            return DEC_0

        if frequency == "Per Period":
            return amt

        if frequency == "Monthly":
            return _d2(amt / Decimal("2"))

        if frequency == "One Time":
            if eff_from and period.start_date <= eff_from <= period.end_date:
                return amt
            return DEC_0

        return amt


    # -------------------------
    # 9) Totals
    # -------------------------
    def _finalize_totals(self, payroll: Payroll):
        lines = payroll.payslip_lines.all()

        earnings = DEC_0
        deductions = DEC_0

        for ln in lines:
            if ln.line_type == "EARNING":
                earnings += ln.amount
            elif ln.line_type == "DEDUCTION":
                deductions += ln.amount
            else:
                # INFORMATION -> does not affect totals
                continue

        payroll.total_earnings = _d2(earnings)
        payroll.total_deductions = _d2(deductions)
        payroll.net_pay = _d2(earnings - deductions)
        payroll.basic_pay = _d2(
            sum((ln.amount for ln in lines if ln.line_type == "EARNING" and "Basic Pay" in (ln.description or "")), DEC_0)
        )
        payroll.save(update_fields=["total_earnings", "total_deductions", "net_pay", "basic_pay"])

    # -------------------------
    # 10) Lifecycle Updates
    # -------------------------
    def _update_ppe_status(self, ppe: PayrollPeriodEmployee, user):
        ppe.status = "Processing"
        ppe.save(update_fields=["status", "updated_at"])

    # -------------------------
    # helpers: attendance interval & worked minutes
    # -------------------------
    def _attendance_interval(self, att: Attendance):
        start_dt = datetime.combine(att.date, att.time_in)
        end_dt = datetime.combine(att.date, att.time_out)

        # If end < start, assume it crossed to next day
        if end_dt <= start_dt:
            end_dt = end_dt + timedelta(days=1)

        return start_dt, end_dt

    def _attendance_work_minutes(self, att: Attendance, shift: Shift) -> int:
        if att.time_in is None or att.time_out is None:
            return 0
        start_dt, end_dt = self._attendance_interval(att)
        minutes = int((end_dt - start_dt).total_seconds() // 60)
        minutes = max(0, minutes - int(shift.break_minutes or 0))
        return minutes

    # -------------------------
    # payslip line creator
    # -------------------------
    def _create_line(
        self,
        payroll: Payroll,
        line_type: str,
        description: str,
        amount: Decimal,
        rule: Pay_Rule | None = None,
        source_type: str | None = None,
        source_id: int | None = None,
        quantity_min: int | None = None,
        rate_applied: Decimal | None = None,
    ):
        Payslip.objects.create(
            payroll=payroll,
            rule=rule,
            line_type=line_type,
            description=description,
            amount=_d2(amount),
            source_type=source_type,
            source_id=source_id,
            quantity_min=quantity_min,
            rate_applied=rate_applied,
        )

    def _stringify_error(self, e: ValidationError) -> str:
        detail = getattr(e, "detail", None)
        if isinstance(detail, dict):
            # pick something readable
            if "detail" in detail:
                return str(detail["detail"])
            return str(detail)
        return str(detail or e)


