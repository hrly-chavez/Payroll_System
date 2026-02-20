import re
from rest_framework import serializers
from shared_model.models import *
from django.utils import timezone
from decimal import Decimal,InvalidOperation

NUMERIC_LIKE_REGEX = re.compile(r"^(?=.*\d)[0-9.,]+$")

def parse_decimal_allow_comma_dot(value, field_name: str) -> Decimal:
    if value is None:
        raise serializers.ValidationError({field_name: "This field is required."})

    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))

    if not isinstance(value, str):
        raise serializers.ValidationError({field_name: "Invalid value type."})

    v = value.strip()
    if not v:
        raise serializers.ValidationError({field_name: "This field is required."})

    if not NUMERIC_LIKE_REGEX.match(v):
        raise serializers.ValidationError({
            field_name: "Numbers only. Allowed characters: digits, comma (,), dot (.)."
        })

    v = v.replace(",", "")
    try:
        return Decimal(v)
    except (InvalidOperation, ValueError):
        raise serializers.ValidationError({field_name: "Invalid number format."})


class DeductionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deduction_Type
        fields = "__all__"

    def validate(self, data):
        code = (data.get("code") or "").strip()
        category = (data.get("category") or "").strip()
        calc_type = (data.get("calculation_type") or "").strip()  # "Fixed" / "Percent"

        salary_from = parse_decimal_allow_comma_dot(data.get("salary_range_from"), "salary_range_from")
        salary_to = parse_decimal_allow_comma_dot(data.get("salary_range_to"), "salary_range_to")
        data["salary_range_from"] = salary_from
        data["salary_range_to"] = salary_to

        if "amount" in data and data.get("amount") is not None:
            data["amount"] = parse_decimal_allow_comma_dot(data.get("amount"), "amount")

        # ✅ from <= to
        if salary_from > salary_to:
            raise serializers.ValidationError({
                "salary_range_from": "Salary Range (From) cannot be greater than Salary Range (To).",
                "salary_range_to": "Salary Range (To) cannot be less than Salary Range (From).",
            })

        qs = Deduction_Type.objects.all()
        if self.instance:
            qs = qs.exclude(id=self.instance.id)

        # ✅ RULE 3: Overlap only within SAME code + SAME category + SAME calculation_type
        conflict_same_group = qs.filter(
            code=code,
            category=category,
            calculation_type=calc_type,
            salary_range_from__lte=salary_to,
            salary_range_to__gte=salary_from,
        ).first()

        if conflict_same_group:
            raise serializers.ValidationError({
                "non_field_errors": [
                    f"Cannot save. Salary range {salary_from} - {salary_to} overlaps with existing range "
                    f"{conflict_same_group.salary_range_from} - {conflict_same_group.salary_range_to} "
                    f"under the same Code '{code}', Category '{category}', and Type '{calc_type}'."
                ]
            })

        # ✅ RULE 4: Different code, SAME category + SAME type cannot have EXACT same range
        exact_range_conflict = qs.filter(
            category=category,
            calculation_type=calc_type,
            salary_range_from=salary_from,
            salary_range_to=salary_to,
        ).exclude(code=code).first()

        if exact_range_conflict:
            raise serializers.ValidationError({
                "non_field_errors": [
                    f"Cannot save. The salary range {salary_from} - {salary_to} already exists in "
                    f"Category '{category}' with Type '{calc_type}' under Code '{exact_range_conflict.code}'."
                ]
            })

        return data

#==================================PAYROLL PERIOD=================================
# Used to create and return payroll period data (date range, code, status)
class PayrollPeriodCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payroll_Period
        fields = '__all__'
        read_only_fields = ["id", "code", "status", "created_at"]

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({"detail": "Start date must be before or equal to end date."})

        # overlap check:
        # new period overlaps an existing one if:
        # existing.start <= new.end AND existing.end >= new.start
        if start_date and end_date:
            overlaps = Payroll_Period.objects.filter(
                start_date__lte=end_date,
                end_date__gte=start_date,
            ).exists()
            if overlaps:
                raise serializers.ValidationError({"detail": "This payroll period overlaps with an existing payroll period."})

        return attrs

# Used to list employees inside a payroll period modal (name, department, status)
class EligibleEmployeeSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="employee_id", read_only=True)
    full_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="employee.department.name", read_only=True)
    status = serializers.CharField(read_only=True) # status comes from PayrollPeriodEmployee

    class Meta:
        model = PayrollPeriodEmployee
        fields = ["id", "full_name", "department_name", "status"]

    def get_full_name(self, obj: PayrollPeriodEmployee):
        e = obj.employee
        return f"{e.fname} {e.lname}".strip()


#=========================VERIFY EMPLOYEE==========================
# Serializes workdays of a shift (used for verification preview only)
class ShiftWorkdaySerializer(serializers.ModelSerializer):
    day = serializers.CharField(source="get_day_of_week_display", read_only=True)

    class Meta:
        model = Shift_Workday
        fields = ["day_of_week", "day", "is_workday"]

# Minimal shift details for Verify Employee modal (not for payroll computation)
class ShiftMiniSerializer(serializers.ModelSerializer):
    workdays = ShiftWorkdaySerializer(many=True, read_only=True)

    class Meta:
        model = Shift
        fields = '__all__' 

# Returns the employee's latest effective salary for verification preview
class EmployeeSalaryMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee_Salary
        fields = ["id", "pay_type", "base_rate", "effective_from"]

# Minimal deduction type data (used to identify tax)
class DeductionTypeMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deduction_Type
        fields = ["id", "code", "category", "calculation_type", "amount", "salary_range_from", "salary_range_to"]

# Returns tax or loan deductions active during the payroll period
class EmployeeDeductionMiniSerializer(serializers.ModelSerializer):
    deduction_type = DeductionTypeMiniSerializer(read_only=True)

    class Meta:
        model = Employee_Deduction
        fields = [
            "id",
            "amount",
            "frequency",
            "effective_from",
            "effective_to",
            "status",
            "deduction_type",
            # loan fields
            "total_loan_amount",
            "balance",
            "amortization_per_period",
        ]

# Minimal allowance type details for verification preview
class AllowanceTypeMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Allowance_Type
        fields = ["id", "code", "name"]

# Returns employee allowances active during the payroll period (verification preview only)
class EmployeeAllowanceMiniSerializer(serializers.ModelSerializer):
    allowance_type = AllowanceTypeMiniSerializer(read_only=True)

    class Meta:
        model = Employee_Allowance
        fields = [
            "id",
            "amount",
            "frequency",
            "effective_from",
            "effective_to",
            "status",
            "allowance_type",
        ]

#Retruns employee Attendance
class AttendanceEventMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance_Event
        fields = '__all__'

#Returns employee Attendance Event
class AttendanceMiniSerializer(serializers.ModelSerializer):
    events = AttendanceEventMiniSerializer(many=True, read_only=True)

    class Meta:
        model = Attendance
        fields = [
            "id",
            "date",
            "status",
            "time_in",
            "time_out",
            "events",
        ]

# Aggregated snapshot shown in Verify Employee modal before payroll generation
class PayrollVerifySnapshotSerializer(serializers.Serializer):
    # Aggregated snapshot shown in Verify Employee modal
    period_id = serializers.IntegerField()
    employee_id = serializers.IntegerField()
    full_name = serializers.CharField()
    department_name = serializers.CharField(allow_null=True)
    status = serializers.CharField()

    shift = ShiftMiniSerializer(allow_null=True)
    salary = EmployeeSalaryMiniSerializer(allow_null=True)

    taxes = EmployeeDeductionMiniSerializer(many=True)   # SSS/PAGIBIG/PHILHEALTH...
    loans = EmployeeDeductionMiniSerializer(many=True)   # loan deductions only
    allowances = EmployeeAllowanceMiniSerializer(many=True)
    attendances = AttendanceMiniSerializer(many=True)  
    warnings = serializers.ListField(child=serializers.CharField(), required=False)


#==================================COMMISION================================
# Commission type dropdown
class CommissionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Commission_Type
        fields = ["id", "name", "code", "is_taxable", "is_active"]

# List commissions in the modal
class PayrollPeriodEmployeeCommissionListSerializer(serializers.ModelSerializer):
    commission_type = CommissionTypeSerializer(read_only=True)

    class Meta:
        model = PayrollPeriodEmployeeCommission
        fields = ["id", "commission_type", "amount", "remarks", "created_at"]

# Create commission from modal
class PayrollPeriodEmployeeCommissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollPeriodEmployeeCommission
        fields = ["commission_type", "amount", "remarks"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0.")
        return value

#==========================================PAYRULE ========================================

class PayRuleSerializer(serializers.ModelSerializer):
    applies_to_name = serializers.CharField(source="applies_to.name", read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = Pay_Rule
        fields = "__all__"

    def validate(self, attrs):
        """
        Enforce:
        - Either applies_to OR employee OR none (global)
        - Not both at the same time
        - effective_to >= effective_from
        - rate_value >= 0
        """

        # Handle updates properly
        applies_to = attrs.get("applies_to", getattr(self.instance, "applies_to", None))
        employee = attrs.get("employee", getattr(self.instance, "employee", None))

        effective_from = attrs.get(
            "effective_from",
            getattr(self.instance, "effective_from", None)
        )
        effective_to = attrs.get(
            "effective_to",
            getattr(self.instance, "effective_to", None)
        )

        rate_value = attrs.get(
            "rate_value",
            getattr(self.instance, "rate_value", None)
        )

        #  Scope validation
        if applies_to and employee:
            raise serializers.ValidationError({"detail": "Choose only one scope: either Department (applies_to) or Employee, not both."})

        #  Date validation
        if effective_to and effective_from and effective_to < effective_from:
            raise ValidationError(
                {"detail": "effective_to cannot be earlier than effective_from."}
            )

        #  Rate value validation
        if rate_value is not None:
            try:
                if Decimal(rate_value) < 0:
                    raise ValidationError(
                        {"rate_value": "Rate value cannot be negative."}
                    )
            except Exception:
                raise ValidationError(
                    {"rate_value": "Invalid rate value."}
                )

        return attrs

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.fname} {obj.employee.lname}".strip()
        return None
    
#==========================================PAYROLL GENERATION===========================

class GeneratePayrollPeriodResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    generated = serializers.IntegerField()


class GeneratePayrollEmployeeResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    employee_id = serializers.IntegerField()

#==========================================PAYROLL PAYSLIP OUTPUT===========================

class PayslipLineSerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source="rule.name", read_only=True)
    rule_event_type = serializers.CharField(source="rule.event_type", read_only=True)
    rule_category = serializers.CharField(source="rule.category", read_only=True)

    class Meta:
        model = Payslip
        fields = [
            "id",
            "line_type",
            "description",
            "amount",
            "source_type",
            "source_id",
            "quantity_min",
            "rate_applied",
            "created_at",
            "rule",            # id (optional)
            "rule_name",
            "rule_event_type",
            "rule_category",
        ]

class PayrollResultSerializer(serializers.Serializer):
    payroll_id = serializers.IntegerField()
    payroll_status = serializers.CharField()
    period_id = serializers.IntegerField()
    period_code = serializers.CharField()
    period_start_date = serializers.DateField()
    period_end_date = serializers.DateField()

    employee_id = serializers.IntegerField()
    employee_full_name = serializers.CharField()
    department_name = serializers.CharField(allow_null=True)

    ppe_status = serializers.CharField()
    basic_pay = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_earnings = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_deductions = serializers.DecimalField(max_digits=12, decimal_places=2)
    net_pay = serializers.DecimalField(max_digits=12, decimal_places=2)

    lines = PayslipLineSerializer(many=True)


