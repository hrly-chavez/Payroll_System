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


# -------------------------------------------------------------------
# Constants
# -------------------------------------------------------------------
DEC_0 = Decimal("0.00")

# -------------------------------------------------------------------
# Helpers Outside class
# -------------------------------------------------------------------
def _overlaps_period(eff_from, eff_to, period_start, period_end):
    """
    Returns True if an effective range overlaps a payroll period range.

    Used by allowance/deduction filters that have effective_from/effective_to.
    - eff_from can be None (treated as "no lower bound")
    - eff_to can be None (treated as "no upper bound")

    Overlap logic:
    - If eff_from starts AFTER period_end -> no overlap
    - If eff_to ends BEFORE period_start -> no overlap
    - Otherwise -> overlap
    """
    if eff_from and eff_from > period_end:
        return False
    if eff_to and eff_to < period_start:
        return False
    return True


def get_latest_active_payroll(period_id: int, employee_id: int) -> Payroll | None:
    """
    Return the latest *non-void* payroll record for one employee in one payroll period.

    Definition of "latest active payroll":
    - Highest run_no (and then highest id) where status != 'Void'

    Where used:
    - Payslip/result viewing (always show current active run)
    - CEO approval flow (approve the active one)
    - Regeneration/reset flows (void old runs; create new run_no)
    """
    return (
        Payroll.objects
        .filter(payroll_period_id=period_id, employee_id=employee_id)
        .exclude(status="Void")
        .order_by("-run_no", "-id")
        .first()
    )

def get_next_payroll_run_no(period_id: int, employee_id: int) -> int:
    """
    Return the next payroll run number for one employee in one payroll period.

    Example:
    - no payroll yet -> 1
    - latest existing run is 1 -> next is 2
    - latest existing run is 2 (even if run 1 is Void) -> next is 3

    Used by:
    - Verify Employee snapshot to know which upcoming run HR is editing
    - run-specific exclusion logic before generation
    """
    last = (
        Payroll.objects
        .filter(payroll_period_id=period_id, employee_id=employee_id)
        .order_by("-run_no", "-id")
        .first()
    )
    return (int(last.run_no) + 1) if last else 1

def _d2(x, places="0.01"):
    """
    Quantize/round decimals consistently across payroll computations.

    Default places="0.01" -> 2 decimal places (money).
    Uses ROUND_HALF_UP for standard financial rounding.
    """
    return (Decimal(x).quantize(Decimal(places), rounding=ROUND_HALF_UP))


def _safe_decimal(x, field_name="value"):
    """
    Convert a value into Decimal safely.
    """
    try:
        return Decimal(str(x))
    except Exception:
        raise ValidationError({field_name: f"Invalid decimal value: {x}"})



# -------------------------------------------------------------------
# Data containers
# -------------------------------------------------------------------
@dataclass
class Rates:
    """
    Computed pay rates used throughout the generation.
    - daily_rate: base daily pay
    - hourly_rate: daily_rate converted based on shift_work_minutes
    - per_minute_rate: daily_rate / shift_work_minutes (high precision)
    - shift_work_minutes: how many payable minutes exist in a normal shift (minus breaks)
    """
    daily_rate: Decimal
    hourly_rate: Decimal
    per_minute_rate: Decimal
    shift_work_minutes: int


class PayrollGenerationService:
    """
    All-or-nothing payroll generation service.

    Important behavior:
    - Uses database transactions (atomic). If any employee fails, ALL changes rollback.
    - Generates Payroll + Payslip lines per employee.
    - Moves PayrollPeriodEmployee status to "Processing" at the end.
    """
    # -------------------------
    #  HELPERS
    # -------------------------
    def _get_commission_tax_rules(self, employee: Employee, department: Department, period: Payroll_Period):
        """
        Load ACTIVE commission tax rules overlapping the payroll period.

        We'll select the best match per commission during computation:
        - priority: employee-specific > department-specific > global
        - effective_from latest wins within same priority
        """
        qs = Commission_Tax_Rule.objects.filter(is_active=True)

        # overlap period
        qs = qs.filter(
            effective_from__lte=period.end_date
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=period.start_date)
        )

        return list(
            qs.select_related("commission_type", "applies_to", "employee")
            .order_by("-effective_from", "-id")
        )
    
    def _pick_commission_tax_rule(
        self,
        rules: list[Commission_Tax_Rule],
        commission_type: Commission_Type,
        commission_amount: Decimal,
        employee: Employee,
        department: Department,
    ) -> Commission_Tax_Rule | None:
        """
        Find the single best matching tax rule for a commission amount.

        Matching constraints:
        - same commission_type
        - bracket match (min_amount <= amount <= max_amount, max null means infinity)
        - scope match priority:
            3) employee rule
            2) department rule
            1) global rule
        Tie-break:
        - latest effective_from (rules already ordered by -effective_from, -id)
        """
        INF = Decimal("999999999999")

        amt = _safe_decimal(commission_amount, "commission_amount")
        best = None
        best_pr = -1

        for r in rules:
            if r.commission_type_id != commission_type.id:
                continue

            r_min = _safe_decimal(r.min_amount or 0, "min_amount")
            r_max = _safe_decimal(r.max_amount, "max_amount") if r.max_amount is not None else INF

            # bracket match
            if amt < r_min or amt > r_max:
                continue

            # scope priority
            if r.employee_id == employee.id:
                pr = 3
            elif r.employee_id is None and r.applies_to_id == department.id:
                pr = 2
            elif r.employee_id is None and r.applies_to_id is None:
                pr = 1
            else:
                pr = 0

            if pr <= 0:
                continue

            # choose highest priority; within same pr, first wins because ordering is newest first
            if pr > best_pr:
                best = r
                best_pr = pr

        return best

    def _get_payroll_tax_brackets(self, employee: Employee, department: Department, period: Payroll_Period) -> list[Payroll_Tax_Bracket]:
        """
        Load ACTIVE payroll tax brackets overlapping the payroll period.

        We will select the best match during computation:
        - priority: employee-specific > department-specific > global
        - within same priority: newest effective_from wins (via ordering)
        """
        qs = Payroll_Tax_Bracket.objects.filter(is_active=True)

        # overlaps payroll period
        qs = qs.filter(effective_from__lte=period.end_date).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=period.start_date)
        )

        # scope candidates only (employee/department/global)
        qs = qs.filter(
            Q(employee=employee) |
            Q(employee__isnull=True, applies_to=department) |
            Q(employee__isnull=True, applies_to__isnull=True)
        )

        return list(qs.select_related("applies_to", "employee").order_by("-effective_from", "-id"))


    def _pick_payroll_tax_bracket(self,brackets: list[Payroll_Tax_Bracket],taxable_amount: Decimal,employee: Employee,department: Department,) -> Payroll_Tax_Bracket | None:
        """
        Pick the single best matching bracket for the taxable_amount.

        Range match:
        - min_amount <= amount <= max_amount (max null = infinity)

        Priority:
        3) employee
        2) department
        1) global

        Tie-break:
        - newest effective_from wins (brackets already ordered by -effective_from, -id)
        """
        INF = Decimal("999999999999")
        amt = _safe_decimal(taxable_amount, "taxable_amount")

        best = None
        best_pr = -1

        for b in brackets:
            b_min = _safe_decimal(b.min_amount or 0, "min_amount")
            b_max = _safe_decimal(b.max_amount, "max_amount") if b.max_amount is not None else INF

            if amt < b_min or amt > b_max:
                continue

            if b.employee_id == employee.id:
                pr = 3
            elif b.employee_id is None and b.applies_to_id == department.id:
                pr = 2
            elif b.employee_id is None and b.applies_to_id is None:
                pr = 1
            else:
                pr = 0

            if pr <= 0:
                continue

            if pr > best_pr:
                best = b
                best_pr = pr

        return best


    def _compute_payroll_tax_amount(self, bracket: Payroll_Tax_Bracket, taxable_amount: Decimal) -> tuple[Decimal, Decimal, Decimal, Decimal]:
        """
        Compute payroll tax from a chosen bracket.

        Returns:
            (tax_amount, rate_applied, base_used, excess_amount)

        Where:
        - base_used: the amount the tax was computed on
        - EXCESS_ONLY: taxable - min_amount (clamped to 0)
        - ALWAYS: taxable
        - excess_amount: (taxable - min_amount) clamped to 0 (useful for display)
        - For ALWAYS mode, still returns the clamped excess for transparency.
        """
        amt = _safe_decimal(taxable_amount, "taxable_amount")
        rv = _safe_decimal(bracket.rate_value, "rate_value")
        min_amt = _safe_decimal(bracket.min_amount or 0, "min_amount")

        excess = amt - min_amt
        if excess < 0:
            excess = DEC_0

        if bracket.apply_mode == "EXCESS_ONLY":
            base = excess
        elif bracket.apply_mode == "ALWAYS":
            base = amt
        else:
            raise ValidationError({"detail": f"Unsupported apply_mode: {bracket.apply_mode}"})

        if bracket.rate_type == "PERCENT":
            tax = _d2(base * rv)  # rv already fraction (0.15)
            return tax, rv, _d2(base), _d2(excess)

        if bracket.rate_type == "FIXED":
            tax = _d2(rv)
            return tax, rv, _d2(base), _d2(excess)

        raise ValidationError({"detail": f"Unsupported rate_type: {bracket.rate_type}"})


    def _is_mwe_exempt_earning_line(self, line: Payslip) -> bool:
        """
        Return True if an earning line is exempt from payroll tax for a
        Minimum Wage Earner (MWE).

        Current business rule for MWE-exempt earnings:
        - Basic Pay
        - Overtime
        - Night Differential
        - Holiday earnings

        Taxable even for MWE (therefore NOT exempt here):
        - Allowances
        - Commissions
        - other extra taxable earnings
        """
        desc = (line.description or "").strip().lower()

        if "basic pay" in desc:
            return True

        if "night differential" in desc:
            return True

        if desc.startswith("overtime"):
            return True

        holiday_keywords = (
            "regular holiday",
            "special holiday",
            "special non working holiday",
            "company holiday",
        )
        if any(k in desc for k in holiday_keywords):
            return True

        return False

    def _compute_taxable_income(self, payroll: Payroll, ctx) -> Decimal:
        """
        Compute taxable income base BEFORE payroll tax bracket is applied.

        Rules:
        - Exclude PAYROLL_TAX_BRACKET lines defensively
        - For ABOVE_MINIMUM:
            taxable earnings = all earning lines
        - For MINIMUM:
            taxable earnings = only earning lines that are NOT MWE-exempt
        - Deductions are still subtracted the same way as before
          (except payroll-tax-bracket lines, which are excluded)
        """
        salary = ctx["salary"]
        wage_type = (getattr(salary, "wage_type", "") or "").strip().upper()

        lines = payroll.payslip_lines.exclude(source_type="PAYROLL_TAX_BRACKET")

        taxable_earnings = DEC_0
        deductions = DEC_0

        for ln in lines:
            if ln.line_type == "EARNING":
                if wage_type == "MINIMUM":
                    if self._is_mwe_exempt_earning_line(ln):
                        continue
                taxable_earnings += _safe_decimal(ln.amount, "amount")

            elif ln.line_type == "DEDUCTION":
                deductions += _safe_decimal(ln.amount, "amount")

        taxable_income = taxable_earnings - deductions
        if taxable_income < DEC_0:
            taxable_income = DEC_0

        return _d2(taxable_income)


    def _apply_payroll_tax(self, payroll: Payroll, ctx, taxable_amount: Decimal):
        """
        Apply payroll tax bracket as:
        - DEDUCTION line (money effect)
        - INFORMATION line (audit: bracket min, taxable base, excess, base used, rate, tax)
        """
        employee = ctx["employee"]
        department = ctx["department"]
        period = ctx["period"]

        brackets = self._get_payroll_tax_brackets(employee, department, period)
        if not brackets:
            return

        bracket = self._pick_payroll_tax_bracket(brackets, taxable_amount, employee, department)
        if not bracket:
            return

        tax_amount, rate_applied, base_used, excess_amount = self._compute_payroll_tax_amount(bracket, taxable_amount)
        if tax_amount <= 0:
            return

        # 1) Actual deduction line
        self._create_line(
            payroll,
            "DEDUCTION",
            f"Withholding Tax ({bracket.name})",
            tax_amount,
            source_type="PAYROLL_TAX_BRACKET",
            source_id=bracket.id,
            rate_applied=rate_applied,
            payroll_tax_bracket=bracket,
        )

        # 2) Information line for UI/audit
        min_amt = _d2(_safe_decimal(bracket.min_amount or 0, "min_amount"))
        taxable = _d2(_safe_decimal(taxable_amount, "taxable_amount"))

        # Keep  description stable so frontend can parse if  want tags later
        # Example:
        # "Tax Bracket Info (TRAIN 250K+): taxable=260000.00; min=250000.00; excess=10000.00; apply_mode=EXCESS_ONLY; base_used=10000.00; rate_type=PERCENT; rate=0.20; tax=2000.00"
        info_desc = (
            f"Tax Bracket Info ({bracket.name}): "
            f"taxable={taxable}; "
            f"min={min_amt}; "
            f"excess={excess_amount}; "
            f"apply_mode={bracket.apply_mode}; "
            f"base_used={base_used}; "
            f"rate_type={bracket.rate_type}; "
            f"rate={rate_applied}; "
            f"tax={tax_amount}"
        )

        self._create_line(
            payroll,
            "INFORMATION",
            info_desc,
            DEC_0,
            source_type="PAYROLL_TAX_BRACKET",
            source_id=bracket.id,
            rate_applied=rate_applied,
            payroll_tax_bracket=bracket,
        )

    def _compute_commission_tax_amount(self, rule: Commission_Tax_Rule, commission_amount: Decimal) -> tuple[Decimal, Decimal]:
        """
        Compute tax deduction amount for a commission based on the rule.

        Supported:
        - MULTIPLIER: commission_amount * rate_value
        - FIXED: rate_value

        Returns (tax_amount, rate_applied)
        """
        amt = _safe_decimal(commission_amount, "commission_amount")
        rv = _safe_decimal(rule.rate_value, "rate_value")

        if rule.rate_type == "MULTIPLIER":
            tax = _d2(amt * rv)
            return tax, rv

        if rule.rate_type == "FIXED":
            tax = _d2(rv)
            return tax, rv

        raise ValidationError({"detail": f"Unsupported commission tax rate_type: {rule.rate_type}"})


    def _get_active_holiday_bases(self, department: Department) -> list[str]:
        return list(
            DepartmentHolidayCalendar.objects
            .filter(department=department, is_active=True)
            .values_list("base", flat=True)
        )

    def _month_ends_within(self, start_date: date, end_date: date) -> list[tuple[date, date]]:
        """
        Return [(month_start, month_end)] for each month whose *month_end* falls inside [start_date, end_date].

        Why this exists:
        - Your Per Day allowances are paid monthly, but payroll periods are semi-monthly.
        - So you only pay the month's total allowance on the payroll period that contains month-end.

        Example:
        - start_date=Jan22, end_date=Feb04 -> returns [(Jan1, Jan31)]
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
        Returns True if the employee is late beyond the shift grace period.

        Rule:
        - Late if time_in_dt > (shift_start_dt + grace_minutes)

        Notes:
        - Attendance.time_in is a DateTimeField (timezone-aware in your models).
        - We convert shift start into a timezone-aware datetime using attendance date.

        Used by:
        - Allowance eligibility checks (Per Day allowances are voided if late beyond grace)
        """
        if att.time_in is None:
            return False

        grace = int(getattr(shift, "grace_minutes", 0) or 0)

        # Build shift start datetime (local)
        shift_start_dt = timezone.make_aware(
            datetime.combine(att.date, shift.start_time),
            timezone.get_current_timezone(),
        )
        deadline = shift_start_dt + timedelta(minutes=grace)

        time_in_dt = att.time_in
        if timezone.is_naive(time_in_dt):
            time_in_dt = timezone.make_aware(time_in_dt, timezone.get_current_timezone())

        return time_in_dt > deadline
        
    # -------------------------
    # 1) Public Entry Points
    # -------------------------
    @transaction.atomic
    def generate_for_period(self, period_id: int, generated_by_user):
        """
        Generate payroll for ALL employees within a payroll period.

        Guards enforced:
        - period exists
        - period.status must be Open
        - all PayrollPeriodEmployee must be Verified
        - if any single employee fails -> rollback everything (atomic)

        Side effects:
        - Sets Payroll_Period.status = "Processing"
        - Creates Payroll + Payslip lines for each employee
        - Sets each PayrollPeriodEmployee status to "Processing"
        """
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
        """
        Generate payroll for ONE employee in a payroll period.

        Differences from generate_for_period:
        - Allows period.status to be Open OR Processing
          (needed for reset/regenerate/partial generation workflows)
        - Still requires PPE Verified and employee eligible
        - Still atomic (this single employee generation commits/rolls back safely)

        Side effects:
        - May set Payroll_Period.status from Open -> Processing
        - Creates Payroll + Payslip lines
        - Sets PPE status to Processing
        """
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
        """
        Validation for FULL period generation.

        Rules:
        - Period must be Open
        - end_date must be >= start_date
        """
        if period.status != "Open":
            raise ValidationError({"detail": f"Payroll period must be Open. Current status: {period.status}."})
        if period.end_date < period.start_date:
            raise ValidationError({"detail": "Invalid payroll period date range."})

    def _validate_period_for_employee_generation(self, period: Payroll_Period):
        """
        Validation for PER-EMPLOYEE generation.

        Rules:
        - Period may be Open or Processing (supports partial generation and regeneration)
        - end_date must be >= start_date
        """
        if period.status not in {"Open", "Processing"}:
            raise ValidationError({"detail": f"Payroll period must be Open or Processing. Current status: {period.status}."})
        if period.end_date < period.start_date:
            raise ValidationError({"detail": "Invalid payroll period date range."})

    def _validate_ppe(self, ppe: PayrollPeriodEmployee, period: Payroll_Period):
        """
        Validate a PayrollPeriodEmployee is eligible for payroll generation.

        Guards enforced:
        - PPE status must be Verified
        - Employee must be active
        - CEO cannot be generated
        - SUPER_ADMIN cannot be generated
        - Linked user (if exists) must be active
        - No existing non-void payroll already exists for this period/employee
        - Employee must have at least one attendance inside the period

        Raises:
        - ValidationError with a human-readable reason if any rule fails
        """
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
        """
        Core pipeline to generate payroll for a single PPE (employee in a period).

        Steps (high-level):
        1) validate PPE again (safety)
        2) build all needed context (salary/shift/attendance/holiday/rules)
        3) compute rates
        4) compute expected workdays
        5) create Payroll header (run_no increments)
        6) apply earnings/deductions components
        7) finalize totals
        8) update PPE lifecycle status to Processing

        Important:
        - This function assumes you are inside a transaction.atomic scope.
        - If anything raises ValidationError, everything rolls back.
        """
        self._validate_ppe(ppe, period)

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

        # 8 allowances / commissions / loans / deductions
        self._apply_allowances(
            payroll=payroll,
            allowances=ctx["allowances"],
            period=period,
            employee=ctx["employee"],
            shift=ctx["shift"],
            leave_map=ctx["leave_map"],
        )

        self._apply_additional_allowances(
            payroll=payroll,
            additional_allowances=ctx["additional_allowances"],
        )

        self._apply_commissions(
            payroll=payroll,
            commissions=ctx["commissions"],
            employee=ctx["employee"],
            department=ctx["department"],
            commission_tax_rules=ctx["commission_tax_rules"],
        )
        
        self._apply_fines(payroll, ctx["fines"])

        # New loan stage (new Loan model is now the source of truth)
        self._apply_loans(
            payroll=payroll,
            loans=ctx["loans"],
            period=period,
            basic_pay_amount=basic_pay_amount,
        )

        # Regular deductions only (non-loan)
        self._apply_deductions(payroll, ctx["deductions"], period)

        # 8.5 compute TAXABLE income base before payroll tax
        taxable_income = self._compute_taxable_income(payroll, ctx)
        payroll.net_before_excess_tax = taxable_income
        payroll.save(update_fields=["net_before_excess_tax"])

        # 8.6 apply payroll tax bracket deduction
        self._apply_payroll_tax(payroll, ctx, taxable_income)

        # 9 totals (final net_pay includes withholding)
        self._finalize_totals(payroll)

        # 10 lifecycle
        self._update_ppe_status(ppe, generated_by_user)

    def _get_target_run_no(self, employee: Employee, period: Payroll_Period) -> int:
        """
        Compute the run number that is about to be generated.

        This must match _create_payroll() logic so exclusions apply to the correct run.
        """
        return get_next_payroll_run_no(period.id, employee.id)

    def _get_run_input_exclusion_map(
        self,
        employee: Employee,
        period: Payroll_Period,
        target_run_no: int,
        source_type: str,
    ) -> dict[int, PayrollRunInputExclusion]:
        """
        Return exclusions for one employee/period/run/source_type as:
            { source_id: PayrollRunInputExclusion }

        Only active excluded rows are included.
        """
        rows = PayrollRunInputExclusion.objects.filter(
            period=period,
            employee=employee,
            target_run_no=target_run_no,
            source_type=source_type,
            is_excluded=True,
        )

        return {row.source_id: row for row in rows}
    # -------------------------
    # 3) Build Context
    # -------------------------
    def _build_context(self, period: Payroll_Period, ppe: PayrollPeriodEmployee):
        """
        Gather all payroll inputs for a single employee/period into one dict ("ctx").

        Why this exists:
        - Keeps _generate_single_locked clean
        - Central place to enforce "hard stops" before money computation

        Includes:
        - employee, department, shift
        - effective salary as of period end
        - payroll settings (divisor)
        - attendance map (date -> Attendance)
        - approved attendance events
        - leave map (date -> Leave_Day)
        - holiday map + policy map
        - allowances/deductions/commissions/loans
        - pay rules resolved by priority
        - upcoming target_run_no + run-specific exclusions
        """
        employee = ppe.employee
        department = employee.department
        shift = self._get_employee_shift(employee)

        salary = self._get_effective_salary(employee, period.end_date)
        payroll_setting = self._get_payroll_setting()

        active_bases = self._get_active_holiday_bases(department)

        attendance_map = self._get_attendance_map(employee, period)
        approved_events = self._get_approved_events(attendance_map)

        leave_map = self._get_leave_map(employee, period)

        holiday_map = self._get_holiday_map(period, active_bases)
        holiday_policy_map = self._get_holiday_policy_map(department)

        target_run_no = self._get_target_run_no(employee, period)

        deduction_exclusion_map = self._get_run_input_exclusion_map(
            employee=employee,
            period=period,
            target_run_no=target_run_no,
            source_type="DEDUCTION",
        )
        commission_exclusion_map = self._get_run_input_exclusion_map(
            employee=employee,
            period=period,
            target_run_no=target_run_no,
            source_type="COMMISSION",
        )
        allowance_exclusion_map = self._get_run_input_exclusion_map(
            employee=employee,
            period=period,
            target_run_no=target_run_no,
            source_type="ALLOWANCE",
        )

        allowances = self._get_allowances(
            employee,
            period,
            allowance_exclusion_map=allowance_exclusion_map,
        )
        additional_allowances = self._get_additional_allowances(
            employee,
            period,
            allowance_exclusion_map=allowance_exclusion_map,
        )
        deductions = self._get_deductions(
            employee,
            period,
            deduction_exclusion_map=deduction_exclusion_map,
        )
        loans = self._get_loans(employee, period)
        commissions = self._get_commissions(
            employee,
            period,
            commission_exclusion_map=commission_exclusion_map,
        )

        fine_exclusion_map = self._get_run_input_exclusion_map(
            employee=employee,
            period=period,
            target_run_no=target_run_no,
            source_type="FINE",
        )

        fines = self._get_fines(
            employee,
            period,
            fine_exclusion_map=fine_exclusion_map,
        )

        commission_tax_rules = self._get_commission_tax_rules(employee, department, period)

        rule_map = self._get_pay_rules(employee, department, period)

        warnings = []

        if not salary:
            raise ValidationError({"detail": "Employee has no salary effective for this payroll period."})
        if not shift:
            raise ValidationError({"detail": "Employee has no shift (direct or department shift)."})

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
            "target_run_no": target_run_no,

            "attendance_map": attendance_map,
            "approved_events": approved_events,
            "leave_map": leave_map,
            "holiday_map": holiday_map,
            "holiday_policy_map": holiday_policy_map,
            "allowances": allowances,
            "additional_allowances": additional_allowances,
            "deductions": deductions,
            "loans": loans,
            "commissions": commissions,
            "fines": fines,
            "fine_exclusion_map": fine_exclusion_map,
            "commission_tax_rules": commission_tax_rules,
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
        """
        Fetch global payroll settings (e.g., daily rate divisor).

        If no Payroll_Setting exists:
        - Create a default setting (divisor=22, is_semi_monthly=True)
        """
        obj = Payroll_Setting.objects.order_by("id").first()
        if not obj:
            obj = Payroll_Setting.objects.create(daily_rate_divisor=22, is_semi_monthly=True)
        return obj

    def _get_attendance_map(self, employee: Employee, period: Payroll_Period):
        """
        Load attendance rows in [period.start_date, period.end_date] and return a dict:
            { attendance.date: Attendance }

        Prefetches events to avoid N+1 queries later in _get_approved_events.
        """
        rows = Attendance.objects.filter(
            employee=employee,
            date__gte=period.start_date,
            date__lte=period.end_date
        ).prefetch_related("events")
        return {r.date: r for r in rows}

    def _get_approved_events(self, attendance_map):
        """
        Only Approved events affect payroll amounts.

        This ensures:
        - Pending Overtime is NOT paid yet
        - Declined Overtime is NOT paid
        - Only Approved events become payslip lines (earnings/deductions)
        """
        attendance_ids = [att.id for att in attendance_map.values() if att and att.id]
        if not attendance_ids:
            return []

        return list(
            Attendance_Event.objects.filter(
                attendance_id__in=attendance_ids,
                approval_status="Approved",
            ).select_related("attendance")
        )
        
    def _get_late_dates(self, approved_events) -> set[date]:
        """
        Build a set of dates where the employee has an approved "Late" event with minutes > 0.

        Used by:
        - _apply_night_differential: void per-day night diff if late on that day.
        """
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
        Return leave days within the payroll period as:
            { leave_day.date: Leave_Day }

        Filter rules:
        - Only Leave_Day tied to leave_request.status="Approved"

        Note:
        - If duplicates exist (shouldn't with constraints), last record wins.
        """
        rows = Leave_Day.objects.filter(
        employee=employee,
        date__gte=period.start_date,
        date__lte=period.end_date,
        leave_request__status="Approved",
    ).select_related("leave_request", "leave_request__leave_type")

        # If somehow duplicates exist (shouldn't due to constraint), last one wins
        return {r.date: r for r in rows}

    def _get_holiday_map(self, period: Payroll_Period, active_bases: list[str]):
        """
        Return holidays as:
            { date: [Holiday, ...] }

        active_bases is precomputed in _build_context via DepartmentHolidayCalendar.
        Used by:
        - absence computation
        - worked holiday earnings
        """
        if not active_bases:
            return {}  # no bases active => no applicable holidays

        rows = Holiday.objects.filter(
            date__gte=period.start_date,
            date__lte=period.end_date,
            status="Approved",
            is_active=True,
            base__in=active_bases,
        )

        holiday_map: dict[date, list[Holiday]] = {}
        for h in rows:
            holiday_map.setdefault(h.date, []).append(h)

        return holiday_map
    
    def _get_holiday_policy_map(self, department):
        """
        Return holiday policy as:
            { holiday_type: requires_work_boolean }

        Used by:
        - absence computation (if holiday requires work and employee absent -> absent)
        """
        rows = HolidayPolicy.objects.filter(department=department)
        return {(r.base, r.holiday_type): bool(r.requires_work) for r in rows}

    def _get_allowances(self, employee: Employee, period: Payroll_Period, allowance_exclusion_map=None):
        # Return all ACTIVE employee allowances that overlap the payroll period,
        # excluding run-specific allowance exclusions when present.
        allowance_exclusion_map = allowance_exclusion_map or {}

        qs = (
            Employee_Allowance.objects
            .filter(employee=employee, status="Active")
            .select_related("allowance_type")
        )

        rows = []
        for a in qs:
            if a.id in allowance_exclusion_map:
                continue

            if _overlaps_period(a.effective_from, a.effective_to, period.start_date, period.end_date):
                rows.append(a)
        return rows

    def _get_additional_allowances(self, employee: Employee, period: Payroll_Period, allowance_exclusion_map=None):
        """
        Return payroll-period-specific manual/additional allowances for:
        - this employee
        - this payroll period

        Excludes run-specific allowance exclusions when present.
        """
        allowance_exclusion_map = allowance_exclusion_map or {}

        rows = list(
            PayrollPeriodEmployeeAllowance.objects
            .filter(period=period, employee=employee)
            .select_related("allowance_type")
            .order_by("allowance_date", "id")
        )

        return [row for row in rows if row.id not in allowance_exclusion_map]
    
    def _get_deductions(self, employee: Employee, period: Payroll_Period, deduction_exclusion_map=None):
            # Return all ACTIVE employee deductions that overlap the payroll period,
            # excluding run-specific deduction exclusions when present.
            deduction_exclusion_map = deduction_exclusion_map or {}

            qs = (
                Employee_Deduction.objects
                .filter(employee=employee, status="Active")
                .select_related("deduction_type")
            )

            rows = []
            for d in qs:
                if d.id in deduction_exclusion_map:
                    continue

                if _overlaps_period(d.effective_from, d.effective_to, period.start_date, period.end_date):
                    rows.append(d)
            return rows
    
    def _get_loans(self, employee: Employee, period: Payroll_Period):
        """
        Return payroll-eligible loans for this employee and payroll period.

        Rules:
        - only Approved or Active
        - remaining_balance > 0
        - deduction snapshot must be complete
        - effective range must overlap the payroll period
        - actual cutoff filtering is handled later in _loan_applies_to_cutoff()
        - select_for_update() is used because payroll generation may update balances/status
        """
        return list(
            Loan.objects.select_for_update()
            .filter(
                employee=employee,
                status__in=["Approved", "Active"],
                remaining_balance__gt=0,
                rule__isnull=False,
                deduction_mode__isnull=False,
                deduction_value__isnull=False,
                apply_to_cutoff__isnull=False,
                effective_from__lte=period.end_date,
            )
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=period.start_date))
            .select_related("rule")
            .order_by("effective_from", "id")
        )

    def _loan_applies_to_cutoff(self, loan: Loan, period: Payroll_Period) -> bool:
        """
        Check if a loan is applicable to this payroll period cutoff.

        Loan choices:
        - FIRST
        - SECOND
        - BOTH

        Period cutoff_type:
        - FIRST
        - SECOND
        """
        loan_cutoff = (loan.apply_to_cutoff or "").strip().upper()
        period_cutoff = (getattr(period, "cutoff_type", "") or "").strip().upper()

        if loan_cutoff == "BOTH":
            return period_cutoff in {"FIRST", "SECOND"}

        return loan_cutoff == period_cutoff

    def _compute_loan_deduction_breakdown(self, loan: Loan, basic_pay_amount: Decimal) -> dict:
        """
        Compute the scheduled deduction amount for one loan in one payroll run
        and return a full breakdown for audit/UI clarity.

        Assumption:
        - PERCENT is stored fraction-style
        e.g. 0.30 = 30%
        """
        remaining_balance = _d2(_safe_decimal(loan.remaining_balance, "remaining_balance"))
        basic_pay_amount = _d2(_safe_decimal(basic_pay_amount, "basic_pay_amount"))
        mode = (loan.deduction_mode or "").strip().upper()
        deduction_value = _safe_decimal(loan.deduction_value or 0, "deduction_value")

        if remaining_balance <= 0:
            return {
                "mode": mode,
                "deduction_value": deduction_value,
                "basic_pay_amount": basic_pay_amount,
                "scheduled_amount": DEC_0,
                "deducted_amount": DEC_0,
                "remaining_balance": remaining_balance,
                "was_capped": False,
            }

        if mode == "FIXED":
            scheduled_amount = _d2(deduction_value)
        elif mode == "PERCENT":
            scheduled_amount = _d2(basic_pay_amount * deduction_value)
        else:
            raise ValidationError({"detail": f"Unsupported loan deduction_mode: {loan.deduction_mode}"})

        if scheduled_amount <= 0:
            return {
                "mode": mode,
                "deduction_value": deduction_value,
                "basic_pay_amount": basic_pay_amount,
                "scheduled_amount": DEC_0,
                "deducted_amount": DEC_0,
                "remaining_balance": remaining_balance,
                "was_capped": False,
            }

        deducted_amount = _d2(min(scheduled_amount, remaining_balance))

        return {
            "mode": mode,
            "deduction_value": deduction_value,
            "basic_pay_amount": basic_pay_amount,
            "scheduled_amount": scheduled_amount,
            "deducted_amount": deducted_amount,
            "remaining_balance": remaining_balance,
            "was_capped": deducted_amount < scheduled_amount,
        }

    def _apply_loans(self, payroll: Payroll, loans, period: Payroll_Period, basic_pay_amount: Decimal):
        """
        Apply loan deductions into payroll with a clearer audit trail.

        Keeps the same business logic:
        - only deduct if cutoff applies
        - amount is still capped by remaining_balance
        - create LoanPayment
        - update remaining balance and status
        """
        for loan in loans:
            if not self._loan_applies_to_cutoff(loan, period):
                continue

            breakdown = self._compute_loan_deduction_breakdown(loan, basic_pay_amount)
            deducted_amount = breakdown["deducted_amount"]

            if deducted_amount <= 0:
                continue

            previous_balance = _d2(_safe_decimal(loan.remaining_balance, "remaining_balance"))
            new_balance = _d2(previous_balance - deducted_amount)

            if new_balance < 0:
                new_balance = DEC_0

            deduction_desc = f"Loan: {loan.name}"
            if loan.rule_id:
                deduction_desc += f" ({loan.rule.name})"

            self._create_line(
                payroll,
                "DEDUCTION",
                deduction_desc,
                deducted_amount,
                source_type="ADJUSTMENT",
                source_id=loan.id,
                rate_applied=breakdown["deduction_value"],
            )

            self._create_line(
                payroll,
                "INFORMATION",
                (
                    f"Loan Rule Info ({loan.name}): "
                    f"rule={loan.rule.name if loan.rule_id else '-'}; "
                    f"mode={breakdown['mode']}; "
                    f"value={breakdown['deduction_value']}; "
                    f"cutoff={loan.apply_to_cutoff}; "
                    f"basic_pay={breakdown['basic_pay_amount']}; "
                    f"scheduled={breakdown['scheduled_amount']}; "
                    f"capped={'YES' if breakdown['was_capped'] else 'NO'}; "
                    f"deducted={deducted_amount}; "
                    f"previous={previous_balance}; "
                    f"new={new_balance}"
                ),
                DEC_0,
                source_type="ADJUSTMENT",
                source_id=loan.id,
                rate_applied=breakdown["deduction_value"],
            )

            LoanPayment.objects.create(
                loan=loan,
                payroll=payroll,
                payroll_period=period,
                deducted_amount=deducted_amount,
                previous_balance=previous_balance,
                new_balance=new_balance,
            )

            loan.remaining_balance = new_balance

            if new_balance <= 0:
                loan.status = "Completed"
            elif loan.status == "Approved":
                loan.status = "Active"

            loan.save(update_fields=["remaining_balance", "status", "updated_at"])

    def _get_commissions(self, employee: Employee, period: Payroll_Period, commission_exclusion_map=None):
        """
        Return commissions stored specifically for:
        - this employee
        - this payroll period

        Excludes run-specific commission exclusions when present.
        """
        commission_exclusion_map = commission_exclusion_map or {}

        rows = list(
            PayrollPeriodEmployeeCommission.objects
            .filter(period=period, employee=employee)
            .select_related("commission_type")
        )

        return [row for row in rows if row.id not in commission_exclusion_map]

    def _get_fines(self, employee, period, fine_exclusion_map=None):
        fine_exclusion_map = fine_exclusion_map or {}

        rows = list(
            PayrollPeriodEmployeeFine.objects
            .filter(period=period, employee=employee)
            .order_by("created_at", "id")
        )

        return [row for row in rows if row.id not in fine_exclusion_map]

    def _get_pay_rules(self, employee: Employee, department, period: Payroll_Period):
        """
        Resolve the correct Pay_Rule per (event_type, category) using priority rules.

        Priority order:
        1) employee-specific rule (rule.employee_id == employee.id)
        2) department-specific rule (rule.applies_to_id == department.id)
        3) global rule (rule.employee_id is None and rule.applies_to_id is None)

        Extra tie-break:
        - If same priority, choose the rule with the latest effective_from.

        Also filters to only rules that overlap the payroll period:
        - effective_from <= period.end_date
        - effective_to is null OR effective_to >= period.start_date
        """
        rules = Pay_Rule.objects.filter(
            is_active=True
        ).filter(
            Q(employee_id=employee.id) |
            Q(applies_to_id=department.id) |
            Q(employee__isnull=True, applies_to__isnull=True)
        )

        # only rules that overlap this period (effective_from <= period_end and (effective_to is null or >= period_start))
        rules = rules.filter(
            effective_from__lte=period.end_date
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=period.start_date)
        ).order_by("-effective_from", "-id")

        # fetch all candidates, then choose by priority per (event_type, category)
        candidates = list(rules)

        def priority(rule: Pay_Rule):
            # Employee specific rule
            if rule.employee_id == employee.id:
                return 3

            # Department rule (ONLY if not employee rule)
            if rule.employee_id is None and rule.applies_to_id == department.id:
                return 2

            # Global rule
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
        """
        Compute daily/hourly/per-minute rates based on:
        - salary.base_rate (usually monthly base)
        - payroll_setting.daily_rate_divisor (e.g., 22)
        - shift work minutes (shift duration minus breaks)

        Raises:
        - ValidationError if shift work minutes is computed as 0
          (prevents divide-by-zero and wrong payroll)
        """
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
    
    def _compute_absences(
        self,
        expected_days,
        attendance_map,
        leave_map,
        holiday_map,
        holiday_policy_map,
    ) -> tuple[int, set[date]]:
        """
        Compute absences for the payroll period.

        Updated for multi-base holidays:

        Inputs:
        - expected_days: list[date] employee is expected to work (shift workdays)
        - attendance_map: dict[date, Attendance]
        - leave_map: dict[date, Leave_Day] (approved leaves)
        - holiday_map: dict[date, list[Holiday]]  (approved/active holidays for ACTIVE bases)
        - holiday_policy_map: dict[(base, holiday_type), bool]  -> requires_work

        Rules:
        A) If leave exists for the day -> NOT absent
        B) If holiday(s) exist on that date:
        - If ANY holiday on that date is "not requires work" -> NOT absent (day off wins)
        - Else (all require work) -> absent if no attendance
        C) Normal day:
        - absent if no attendance record exists
        """
        absent_dates: set[date] = set()

        for d in expected_days:
            # A) Leave override
            if d in leave_map:
                continue

            # B) Holiday check (now may be multiple holidays per date)
            holidays = holiday_map.get(d)  # list[Holiday] | None
            if holidays:
                # If any holiday on that date does NOT require work => not absent
                any_day_off = False

                for h in holidays:
                    requires_work = bool(holiday_policy_map.get((h.base, h.type), False))
                    if not requires_work:
                        any_day_off = True
                        break

                if any_day_off:
                    continue  # not absent

                # All holidays require work -> absent if no attendance
                if d not in attendance_map:
                    absent_dates.add(d)
                continue

            # C) Normal expected workday
            if d not in attendance_map:
                absent_dates.add(d)

        return len(absent_dates), absent_dates
    
    def _shift_work_minutes(self, shift: Shift) -> int:
        """
        Compute how many payable work minutes exist in a standard shift.

        Handles:
        - Non-overnight shifts (start -> end same day)
        - Cross-midnight shifts (end next day)
        - Deducts shift.break_minutes once

        Output:
        - Non-negative integer minutes
        """
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
        """
        Build a list of dates the employee is expected to work in the range.

        Source of truth:
        - Shift_Workday rows (Monday=1 ... Sunday=7)

        Output:
        - List[date] of expected workdays inside [start_date, end_date]
        """
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
        """
        Create a Payroll header row.

        Important:
        - run_no increments per (period, employee), including Void runs
          (so regeneration creates run_no=2,3,...)

        Initializes totals to 0; payslip lines will be created afterwards.
        """
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
        """
        Create a Payroll header row.

        Important:
        - run_no increments per (period, employee), including Void runs
          (so regeneration creates run_no=2,3,...)

        Initializes totals to 0; payslip lines will be created afterwards.
        """
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
        Create INFORMATION payslip lines for leave days (audit trail only).

        Important:
        - Paid leave MONEY is already included in _apply_basic_pay.
        - This function only logs leave details as INFORMATION lines
          so payroll users can see leave dates/units/rates.
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
        """
        Apply approved attendance events (Late/Undertime/Overtime/etc.) into payslip lines.

        Logic:
        - Normalize event type naming (OverTime -> Overtime, UnderTime -> Undertime)
        - Decide category:
            Late/Undertime => Deduction
            everything else => Earning
        - Find Pay_Rule for (event_type, category)
        - Compute amount based on rule.rate_type and minutes
        - Create a payslip line

        Raises:
        - ValidationError if required Pay_Rule is missing (audit correctness)
        """
        for ev in approved_events:
            normalized = self._normalize_event_type(ev.type)

            # Defensive rule: never pay Overtime unless explicitly approved.
            # (Should already be true because approved_events are filtered,
            # but this protects against future refactors.)
            if normalized == "Overtime" and ev.approval_status != "Approved":
                continue

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
        """
        Normalize event type strings to match Pay_Rule event_type choices.

        Why:
        - Some attendance event strings may not exactly match Pay_Rule names.

        Example mapping:
        - "OverTime" -> "Overtime"
        - "UnderTime" -> "Undertime"
        """
        m = {
            "OverTime": "Overtime",
            "UnderTime": "Undertime",
            "Worked Holiday": "Worked Holiday",
            "Late": "Late",
        }
        return m.get(s, s)

    def _compute_rule_amount(self, rule: Pay_Rule, minutes: int, rates: Rates):
        """
        Compute amount based on Pay_Rule.rate_type.

        Supported rate types:
        - MULTIPLIER: minutes * per_minute_rate * rate_value
        - PER_MINUTE: minutes * rate_value
        - PER_DAY: rate_value (not typical for minute events but supported)
        - FIXED: rate_value

        Returns:
        - (amount_decimal_2dp, rate_applied_decimal)

        Raises:
        - ValidationError if rate_type is unknown
        """
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

    def _apply_night_differential(self, payroll, attendance_map, rule_map, rates: Rates, late_dates: set[date]):
        rule = rule_map.get(("Night Differential", "Earning"))
        if not rule:
            return

        eligible_dates: list[date] = []
        total_minutes = 0
        total_amount = DEC_0
        rate_applied = None

        for d, att in attendance_map.items():
            if att.status != "PRESENT":
                continue

            minutes = self._night_diff_minutes(att)
            if minutes <= 0:
                continue

            # For PER_DAY/FIXED, void if late on that date
            if rule.rate_type in ("PER_DAY", "FIXED") and d in late_dates:
                continue

            eligible_dates.append(d)
            total_minutes += int(minutes)

            if rule.rate_type in ("PER_DAY", "FIXED"):
                # Add per eligible day
                total_amount += _d2(_safe_decimal(rule.rate_value))
                rate_applied = _safe_decimal(rule.rate_value)
            else:
                # MULTIPLIER / PER_MINUTE: compute based on minutes
                amt, ra = self._compute_rule_amount(rule, minutes, rates)
                total_amount += _d2(amt)
                rate_applied = ra

        if not eligible_dates or total_amount <= 0:
            return

        # One earning line
        self._create_line(
            payroll,
            "EARNING",
            f"Night Differential ({len(eligible_dates)} day/s)",
            _d2(total_amount),
            rule=rule,
            source_type="ATTENDANCE",
            source_id=None,                 # multiple attendances, so no single source_id
            quantity_min=total_minutes,
            rate_applied=rate_applied,
        )

        # One info line to show dates (employee-visible, no effect on totals)
        # If you're worried about long text, we can chunk this into multiple INFO lines.
        dates_str = ", ".join([x.isoformat() for x in sorted(eligible_dates)])
        self._create_line(
            payroll,
            "INFORMATION",
            f"Night Differential days: {dates_str}",
            DEC_0,
            rule=rule,
            source_type="ATTENDANCE",
            source_id=None,
            quantity_min=None,
            rate_applied=None,
        )

    def _night_diff_minutes(self, att: Attendance) -> int:
        """
        Compute overlap minutes between actual work interval and night window 22:00–06:00.

        Why two windows:
        - A shift could overlap night hours before midnight OR after midnight.
        - We compute overlap with:
          A) (previous day 22:00) -> (work day 06:00)
          B) (work day 22:00) -> (next day 06:00)

        Returns:
        - Total overlap minutes (non-negative)
        """
        if att.time_in is None or att.time_out is None:
            return 0

        start_dt, end_dt = self._attendance_interval(att)

        # Two possible night windows around the work interval
        tz = timezone.get_current_timezone()

        # Ensure start/end are in the same tz (defensive)
        if timezone.is_naive(start_dt):
            start_dt = timezone.make_aware(start_dt, tz)
        else:
            start_dt = start_dt.astimezone(tz)

        if timezone.is_naive(end_dt):
            end_dt = timezone.make_aware(end_dt, tz)
        else:
            end_dt = end_dt.astimezone(tz)

        # Window A: prev day 22:00 -> work day 06:00
        a_start = timezone.make_aware(
            datetime.combine(start_dt.date() - timedelta(days=1), time(22, 0)),
            tz,
        )
        a_end = timezone.make_aware(
            datetime.combine(start_dt.date(), time(6, 0)),
            tz,
        )

        # Window B: work day 22:00 -> next day 06:00
        b_start = timezone.make_aware(
            datetime.combine(start_dt.date(), time(22, 0)),
            tz,
        )
        b_end = timezone.make_aware(
            datetime.combine(start_dt.date() + timedelta(days=1), time(6, 0)),
            tz,
        )

        def overlap_minutes(win_start: datetime, win_end: datetime) -> int:
            overlap = max(
                timedelta(0),
                min(end_dt, win_end) - max(start_dt, win_start),
            )
            return int(overlap.total_seconds() // 60)

        minutes = overlap_minutes(a_start, a_end) + overlap_minutes(b_start, b_end)
        return max(0, minutes)

    # -------------------------
    # Holiday earnings (worked on approved holiday)
    # -------------------------
    def _apply_worked_holidays(self, payroll, ctx, rates: Rates):
        holiday_map = ctx["holiday_map"]                # date -> list[Holiday]
        policy_map = ctx["holiday_policy_map"]          # (base, type) -> requires_work
        rule_map = ctx["rule_map"]
        attendance_map = ctx["attendance_map"]

        base_priority = {"COMPANY": 3, "PH": 2, "US": 1}  # tie-break only

        for d, att in attendance_map.items():
            if att.status != "PRESENT":
                continue

            holidays = holiday_map.get(d)
            if not holidays:
                continue

            minutes = self._attendance_work_minutes(att, ctx["shift"])
            if minutes <= 0:
                continue

            best = None  # (amount, priority, Holiday, rule, rate_applied)

            for h in holidays:
                event_type = self._holiday_type_to_rule_event(h.type)
                rule = rule_map.get((event_type, "Earning"))
                if not rule:
                    raise ValidationError({"detail": f"Missing Pay Rule for {event_type} (Earning)."})

                amount, rate_applied = self._compute_rule_amount(rule, minutes, rates)
                pr = base_priority.get(h.base, 0)

                if best is None:
                    best = (amount, pr, h, rule, rate_applied, event_type)
                    continue

                if amount > best[0] or (amount == best[0] and pr > best[1]):
                    best = (amount, pr, h, rule, rate_applied, event_type)

            if not best:
                continue

            amount, _, h, rule, rate_applied, event_type = best
            if amount <= 0:
                continue

            self._create_line(
                payroll,
                "EARNING",
                f"{event_type} ({d}) [{h.base}]",
                amount,
                rule=rule,
                source_type="ATTENDANCE",
                source_id=att.id,
                quantity_min=minutes,
                rate_applied=rate_applied,
            )

    def _holiday_type_to_rule_event(self, holiday_type: str) -> str:
        """
        Convert Holiday.type into Pay_Rule.event_type.

        Pay_Rule expects:
        - "Regular Holiday"
        - "Special Holiday"
        - "Special Non Working Holiday"
        - "Company Holiday"
        """
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
        """
        Create deduction lines for absences.

        Preferred behavior:
        - Create one line per absent date for transparency.

        Fallback:
        - If dates are missing, create one aggregated line using absent_days.

        Requires:
        - Pay_Rule("Absent", "Deduction") to exist; otherwise hard-stop.
        """
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
    def _compute_allowance_eligible_days_for_month(self,employee: Employee,shift: Shift,month_start: date,month_end: date,leave_map: dict[date, Leave_Day],) -> list[date]:
        """
        Compute how many days in a month are eligible for a PER-DAY allowance.

        Eligibility rules (per expected workday):
        - If leave exists on that day -> NOT eligible
        - Must have attendance PRESENT
        - Must not be late beyond grace

        Returns:
        - eligible_day_count (int)
        """
        expected_days = self._expected_workdays(shift, month_start, month_end)

        rows = Attendance.objects.filter(
            employee=employee,
            date__gte=month_start,
            date__lte=month_end,
        )
        attendance_map = {r.date: r for r in rows}

        eligible_dates: list[date] = []

        for d in expected_days:
            if d in leave_map:
                continue

            att = attendance_map.get(d)
            if not att or att.status != "PRESENT":
                continue

            if att.time_in is None:
                continue

            if self._is_late_beyond_grace(att, shift):
                continue

            eligible_dates.append(d)

        return eligible_dates

    def _apply_allowances(self, payroll: Payroll, allowances, period: Payroll_Period, employee: Employee, shift: Shift, leave_map: dict[date, Leave_Day]):
        """
        Apply allowances into payslip lines.

        Rules:
        - Per Day:
            compute eligible allowance days within the relevant month-end logic
        - Monthly / Per Period / One Time:
            only apply if this payroll period overlaps the allowance row
            use the stored amount directly (no cutoff-based split)
        """
        for a in allowances:
            at = a.allowance_type
            name = at.name if at else "Allowance"

            # Per Day allowance logic
            if a.frequency == "Per Day":
                per_day_amt = _d2(a.amount)
                if per_day_amt <= 0:
                    continue

                for month_start, month_end in self._month_ends_within(period.start_date, period.end_date):
                    eligible_dates = self._compute_allowance_eligible_days_for_month(
                        employee=employee,
                        shift=shift,
                        month_start=month_start,
                        month_end=month_end,
                        leave_map=leave_map,
                    )

                    eligible_days = len(eligible_dates)
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

                    dates_str = ", ".join([d.isoformat() for d in sorted(eligible_dates)])
                    self._create_line(
                        payroll,
                        "INFORMATION",
                        f"Allowance: {name} days: {dates_str}",
                        DEC_0,
                        source_type="MANUAL",
                        source_id=a.id,
                    )
                continue

            # Non-Per-Day allowances:
            # count only within this payroll period, use stored amount directly
            amt = _d2(a.amount)
            if amt <= 0:
                continue

            if a.frequency == "One Time":
                if not (a.effective_from and period.start_date <= a.effective_from <= period.end_date):
                    continue

            self._create_line(
                payroll,
                "EARNING",
                f"Allowance: {name}",
                amt,
                source_type="MANUAL",
                source_id=a.id
            )
    
    def _apply_additional_allowances(self, payroll: Payroll, additional_allowances):
        """
        Apply payroll-period-specific manual/additional allowances.

        These are separate from Employee_Allowance recurring rules.
        They are direct earning inputs for this specific employee + payroll period.
        """
        for a in additional_allowances:
            amt = _d2(a.amount)
            if amt <= 0:
                continue

            allowance_name = a.allowance_type.name if a.allowance_type else "Additional Allowance"
            allowance_date = a.allowance_date.isoformat() if a.allowance_date else "-"

            desc = f"Additional Allowance: {allowance_name} ({allowance_date})"

            if a.remarks:
                desc += f" - {a.remarks}"

            self._create_line(
                payroll,
                "EARNING",
                desc,
                amt,
                source_type="MANUAL",
                source_id=a.id,
            )
    
    def _apply_commissions(
        self,
        payroll: Payroll,
        commissions,
        employee: Employee,
        department: Department,
        commission_tax_rules: list[Commission_Tax_Rule],
    ):
        """
        Apply per-period commissions into EARNING lines.
        If commission_type.is_taxable => also apply Commission Tax Rule as DEDUCTION line.

        Hard-stop behavior (recommended):
        - If taxable commission has NO matching tax rule => raise ValidationError
        (prevents silent under-withholding).
        """
        for c in commissions:
            amt = _d2(c.amount)
            if amt <= 0:
                continue

            ct = getattr(c, "commission_type", None)
            label = getattr(ct, "name", None) or "Commission"

            # 1) Commission earning line
            self._create_line(
                payroll,
                "EARNING",
                f"Commission: {label}",
                amt,
                source_type="MANUAL",
                source_id=c.id,
            )

            # 2) Tax handling (only if taxable)
            if not ct:
                continue

            if bool(getattr(ct, "is_taxable", False)) is not True:
                continue

            # Find a matching tax rule for this commission
            rule = self._pick_commission_tax_rule(
                rules=commission_tax_rules,
                commission_type=ct,
                commission_amount=amt,
                employee=employee,
                department=department,
            )

            if not rule:
                raise ValidationError({
                    "detail": f"Missing Commission Tax Rule for taxable commission '{label}' amount {amt}. "
                            f"Create a rule bracket that matches this amount (employee/department/global)."
                })

            tax_amount, rate_applied = self._compute_commission_tax_amount(rule, amt)

            if tax_amount <= 0:
                continue

            self._create_line(
                payroll,
                "DEDUCTION",
                f"Commission Tax: {label}",
                tax_amount,
                source_type="COMMISSION_TAX_RULE",
                source_id=rule.id,
                quantity_min=None,
                rate_applied=rate_applied,
                commission_tax_rule=rule,
            )
    
    def _apply_fines(self, payroll: Payroll, fines):
        """
        Apply manual fines as DEDUCTION lines.

        Behavior:
        - Direct deduction
        - No tax logic (unless you explicitly add later)
        - Fully auditable per entry
        """
        fines = fines or []

        for f in fines:
            amt = _d2(f.amount)
            if amt <= 0:
                continue

            desc = f"Fine: {f.name}" if f.name else "Fine"

            self._create_line(
                payroll,
                "DEDUCTION",
                desc,
                amt,
                source_type="FINE",
                source_id=f.id,
            )

    def _apply_deductions(self, payroll: Payroll, deductions, period: Payroll_Period):
        """
        Apply regular employee deductions into DEDUCTION payslip lines.

        Important:
        - New Loan model is now the source of truth for payroll loan deductions.
        - Old loan-style Employee_Deduction rows (amortization_per_period-based)
        are skipped here to avoid double deduction.

        Rules:
        - normal deductions resolve amount using frequency + cutoff type
        """
        for d in deductions:
            # Skip old loan-style deduction rows now that Loan is handled separately.
            if getattr(d, "amortization_per_period", None) is not None:
                continue

            amt = self._resolve_deduction_frequency_amount(
                d.amount,
                d.frequency,
                d.effective_from,
                d.effective_to,
                period,
            )

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

    def _resolve_deduction_frequency_amount(self, amount, frequency, eff_from, eff_to, period: Payroll_Period) -> Decimal:
        """
        Resolve how much of the base amount should be applied in THIS payroll period.

        Business rules:
        - Monthly:
            full amount on FIRST cutoff only
        - Per Period:
            split amount across FIRST and SECOND
            FIRST gets rounded half
            SECOND gets the remainder
        - One Time:
            apply once only if effective_from falls inside this payroll period
        - Per Day:
            handled elsewhere
        """
        amt = _d2(amount)
        cutoff_type = (getattr(period, "cutoff_type", "") or "").strip().upper()

        if frequency == "Per Day":
            return DEC_0

        if frequency == "Monthly":
            if cutoff_type == "FIRST":
                return amt
            return DEC_0

        if frequency == "Per Period":
            first_half = _d2(amt / Decimal("2"))
            second_half = _d2(amt - first_half)

            if cutoff_type == "FIRST":
                return first_half
            if cutoff_type == "SECOND":
                return second_half
            return DEC_0

        if frequency == "One Time":
            if eff_from and period.start_date <= eff_from <= period.end_date:
                return amt
            return DEC_0

        return amt

    # -------------------------
    # 9) Totals
    # -------------------------
    def _finalize_totals(self, payroll: Payroll):
        """
        Compute payroll totals from payslip lines and save them on the Payroll header.

        Totals:
        - total_earnings = sum(line.amount where line_type == EARNING)
        - total_deductions = sum(line.amount where line_type == DEDUCTION)
        - net_pay = earnings - deductions
        - basic_pay = sum(EARNING lines containing "Basic Pay" in description)

        INFORMATION lines are ignored for totals.
        """
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
        """
        Move PayrollPeriodEmployee status forward after successful generation.

        Current behavior:
        - Sets status to "Processing"
        - Updates updated_at automatically (model auto_now)

        Note:
        - 'user' is currently unused here, but kept for future audit fields if you add them.
        """
        ppe.status = "Processing"
        ppe.save(update_fields=["status", "updated_at"])

    # -------------------------
    # helpers: attendance interval & worked minutes
    # -------------------------
    def _attendance_interval(self, att: Attendance):
        """
        Return (start_dt, end_dt) as timezone-aware datetimes from Attendance.time_in/time_out.

        Safety behavior:
        - If time_in or time_out is missing -> returns (None, None)
        - If end_dt < start_dt (bad device time) -> clamp end_dt to start_dt

        Used by:
        - night diff computation
        - work minute computation
        """
        if att.time_in is None or att.time_out is None:
            return None, None

        start_dt = att.time_in
        end_dt = att.time_out

        tz = timezone.get_current_timezone()
        if timezone.is_naive(start_dt):
            start_dt = timezone.make_aware(start_dt, tz)
        if timezone.is_naive(end_dt):
            end_dt = timezone.make_aware(end_dt, tz)

        # If time_out is earlier than time_in, assume it crossed midnight (next day)
        if end_dt < start_dt:
            end_dt = end_dt + timedelta(days=1)

        return start_dt, end_dt

    def _attendance_work_minutes(self, att: Attendance, shift: Shift) -> int:
        """
        Compute payable work minutes for the day, clamped to the shift window.

        Rule:
        - Only minutes within [shift_start, shift_end] count as regular work minutes.
        - Punching in early doesn't increase regular time (overtime handled via events).
        - Punching out late doesn't increase regular time (overtime handled via events).
        - Deduct break_minutes once.

        Handles:
        - Overnight shifts via shift.crosses_midnight (shift_end next day)
        """
        start_dt, end_dt = self._attendance_interval(att)
        if not start_dt or not end_dt:
            return 0

        tz = timezone.get_current_timezone()

        shift_start_dt = timezone.make_aware(
            datetime.combine(att.date, shift.start_time),
            tz,
        )
        shift_end_dt = timezone.make_aware(
            datetime.combine(att.date, shift.end_time),
            tz,
        )

        # Overnight shift end is next day
        if getattr(shift, "crosses_midnight", False):
            shift_end_dt = shift_end_dt + timedelta(days=1)

        # Clamp actual interval to shift window
        effective_start = max(start_dt, shift_start_dt)
        effective_end = min(end_dt, shift_end_dt)

        if effective_end <= effective_start:
            return 0

        minutes = int((effective_end - effective_start).total_seconds() // 60)

        # Break minutes deducted once per day/shift (simple and consistent)
        minutes = max(0, minutes - int(shift.break_minutes or 0))
        return minutes

    # -------------------------
    # payslip line creator
    # -------------------------
    def _create_line(self,payroll: Payroll,line_type: str,description: str,
        amount: Decimal,
        rule: Pay_Rule | None = None,
        source_type: str | None = None,
        source_id: int | None = None,
        quantity_min: int | None = None,
        rate_applied: Decimal | None = None,
        commission_tax_rule: Commission_Tax_Rule | None = None,
        payroll_tax_bracket: Payroll_Tax_Bracket | None = None,
    ):
        """
        Compute payable work minutes for the day, clamped to the shift window.

        Rule:
        - Only minutes within [shift_start, shift_end] count as regular work minutes.
        - Punching in early doesn't increase regular time (overtime handled via events).
        - Punching out late doesn't increase regular time (overtime handled via events).
        - Deduct break_minutes once.

        Handles:
        - Overnight shifts via shift.crosses_midnight (shift_end next day)
        """
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
            commission_tax_rule=commission_tax_rule,
            payroll_tax_bracket=payroll_tax_bracket,
        )

    def _stringify_error(self, e: ValidationError) -> str:
        """
        Convert a DRF ValidationError into a readable string.

        Why:
        - DRF ValidationError.detail can be dict/list/string
        - We want a clean message to show on the UI or include in a wrapper error.
        """
        detail = getattr(e, "detail", None)
        if isinstance(detail, dict):
            # pick something readable
            if "detail" in detail:
                return str(detail["detail"])
            return str(detail)
        return str(detail or e)


