import re
from rest_framework import serializers
from shared_model.models import *
from django.utils import timezone
from decimal import Decimal,InvalidOperation
from rest_framework.validators import UniqueValidator

#  salary/amount numeric-like: must contain at least 1 digit, and only digits/comma/dot
NUMERIC_LIKE_REGEX = re.compile(r"^(?=.*\d)[0-9.,]+$")

#  Deduction code safe chars only (prevents special characters like ; ' " = ( ) etc.)
# allowed: letters, digits, underscore, hyphen
CODE_SAFE_REGEX = re.compile(r"^[A-Za-z0-9_-]+$")


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
        #  NOTE: make sure your model field is really named "code"
        code = (data.get("code") or "").strip()
        category = (data.get("category") or "").strip()
        calc_type = (data.get("calculation_type") or "").strip()  # "Fixed" / "Percent"

        #  Deduction code: block special characters
        if not code:
            raise serializers.ValidationError({"code": "This field is required."})

        if not CODE_SAFE_REGEX.match(code):
            raise serializers.ValidationError({
                "code": "Invalid code. Use letters, numbers, underscore (_) or hyphen (-) only."
            })

        salary_from = parse_decimal_allow_comma_dot(data.get("salary_range_from"), "salary_range_from")
        salary_to = parse_decimal_allow_comma_dot(data.get("salary_range_to"), "salary_range_to")
        data["salary_range_from"] = salary_from
        data["salary_range_to"] = salary_to

        if "amount" in data and data.get("amount") is not None:
            data["amount"] = parse_decimal_allow_comma_dot(data.get("amount"), "amount")

        #  Salary Range (To) must be > 0
        if salary_to <= Decimal("0"):
            raise serializers.ValidationError({
                "salary_range_to": "Salary Range (To) must be greater than 0."
            })

        #  from <= to
        if salary_from > salary_to:
            raise serializers.ValidationError({
                "salary_range_from": "Salary Range (From) cannot be greater than Salary Range (To).",
                "salary_range_to": "Salary Range (To) cannot be less than Salary Range (From).",
            })

        qs = Deduction_Type.objects.all()
        if self.instance:
            qs = qs.exclude(id=self.instance.id)

        #  ONLY BLOCK EXACT DUPLICATE:
        # same code + same category + same type + same salary range (from/to)
        exact_duplicate = qs.filter(
            code=code,
            category=category,
            calculation_type=calc_type,
            salary_range_from=salary_from,
            salary_range_to=salary_to,
        ).first()

        if exact_duplicate:
            raise serializers.ValidationError({
                "non_field_errors": [
                    f"Duplicate not allowed. The exact entry already exists for "
                    f"Code '{code}', Category '{category}', Type '{calc_type}', "
                    f"Range {salary_from} - {salary_to}."
                ]
            })

        return data
    
    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        # DO NOT use objects.create()
        instance = Deduction_Type(**validated_data)

        # Attach BEFORE save
        if user:
            instance._current_user = user

        instance.save()
        return instance

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if user:
            instance._current_user = user

        instance.save()
        return instance

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
        fields = ["id", "name"]

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
        fields = ["id", "name", "is_taxable", "is_active"]

    def validate_name(self, value):
        v = (value or "").strip()

        qs = Commission_Type.objects.filter(name__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError("A commission type with this name already exists.")
        return v

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
from rest_framework.exceptions import ValidationError
from decimal import Decimal

class PayRuleSerializer(serializers.ModelSerializer):
    #  override name field validator + message here
    name = serializers.CharField(
        max_length=100,
        validators=[
            UniqueValidator(
                queryset=Pay_Rule.objects.all(),
                message="A pay rule with this name already exists. Please choose a different name."
            )
        ],
    )

    applies_to_name = serializers.CharField(source="applies_to.name", read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = Pay_Rule
        fields = "__all__"

    def validate(self, attrs):
        applies_to = attrs.get("applies_to", getattr(self.instance, "applies_to", None))
        employee = attrs.get("employee", getattr(self.instance, "employee", None))

        effective_from = attrs.get("effective_from", getattr(self.instance, "effective_from", None))
        effective_to = attrs.get("effective_to", getattr(self.instance, "effective_to", None))
        rate_value = attrs.get("rate_value", getattr(self.instance, "rate_value", None))

        if applies_to and employee:
            raise ValidationError({
                "applies_to": ["Choose either Department or Employee, not both."],
                "employee": ["Choose either Department or Employee, not both."],
            })

        if effective_to and effective_from and effective_to < effective_from:
            raise ValidationError({
                "effective_to": ["effective_to cannot be earlier than effective_from."],
            })

        if rate_value is not None:
            try:
                if Decimal(str(rate_value)) < 0:
                    raise ValidationError({"rate_value": ["Rate value cannot be negative."]})
            except Exception:
                raise ValidationError({"rate_value": ["Invalid rate value."]})

        return attrs
    
    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        # DO NOT use objects.create()
        instance = Pay_Rule(**validated_data)

        # Attach BEFORE save
        if user:
            instance._current_user = user

        instance.save()
        return instance

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Attach BEFORE save
        if user:
            instance._current_user = user

        instance.save()
        return instance

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
    declined_reason = serializers.CharField(allow_null=True, required=False)
    
    basic_pay = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_earnings = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_deductions = serializers.DecimalField(max_digits=12, decimal_places=2)
    net_pay = serializers.DecimalField(max_digits=12, decimal_places=2)

    lines = PayslipLineSerializer(many=True)

#For employee dashboard payroll(rows & columns)
class EmployeePayrollRowSerializer(serializers.Serializer):
    # Employee identity (for frontend modal)
    employee_id = serializers.IntegerField()
    employee_full_name = serializers.CharField()
    department_name = serializers.CharField(allow_null=True)

    # Period
    period_id = serializers.IntegerField()
    period_code = serializers.CharField()
    period_start_date = serializers.DateField()
    period_end_date = serializers.DateField()
    pay_date = serializers.DateField(allow_null=True)
    period_status = serializers.CharField()

    # Status
    ppe_status = serializers.CharField()
    declined_reason = serializers.CharField(allow_null=True, required=False)

    # Payroll summary (latest active)
    payroll_id = serializers.IntegerField(allow_null=True)
    payroll_status = serializers.CharField(allow_null=True)
    run_no = serializers.IntegerField(allow_null=True)
    net_pay = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)

# ===================== CEO APPROVAL QUEUE =====================

class PayrollApprovalEmployeeSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    full_name = serializers.CharField()
    department_name = serializers.CharField(allow_null=True)

    ppe_status = serializers.CharField()
    declined_reason = serializers.CharField(allow_null=True, required=False)

    payroll_id = serializers.IntegerField(allow_null=True)
    payroll_status = serializers.CharField(allow_null=True)
    run_no = serializers.IntegerField(allow_null=True)
    net_pay = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)


class PayrollDeclineInputSerializer(serializers.Serializer):
    declined_reason = serializers.CharField()

    def validate_declined_reason(self, v: str):
        v = (v or "").strip()
        if not v:
            raise serializers.ValidationError("Decline reason is required.")
        if len(v) < 3:
            raise serializers.ValidationError("Decline reason is too short.")
        return v

#Void Reason(nullable)
class PayrollResetAfterDeclineSerializer(serializers.Serializer):
    void_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)  