import re
from rest_framework import serializers
from shared_model.models import *
from django.utils import timezone
from decimal import Decimal,InvalidOperation
from rest_framework.validators import UniqueValidator
from rest_framework.exceptions import ValidationError
from django.db import models


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
        fields = "__all__"
        read_only_fields = ["id", "code", "status", "created_at"]

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        cutoff_type = attrs.get("cutoff_type")

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({
                "detail": "Start date must be before or equal to end date."
            })

        if not cutoff_type:
            raise serializers.ValidationError({
                "cutoff_type": "Cutoff type is required."
            })

        if cutoff_type not in ["FIRST", "SECOND"]:
            raise serializers.ValidationError({
                "cutoff_type": "Invalid cutoff type."
            })

        # overlap check:
        # new period overlaps an existing one if:
        # existing.start <= new.end AND existing.end >= new.start
        if start_date and end_date:
            overlaps = Payroll_Period.objects.filter(
                start_date__lte=end_date,
                end_date__gte=start_date,
            ).exists()

            if overlaps:
                raise serializers.ValidationError({
                    "detail": "This payroll period overlaps with an existing payroll period."
                })

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

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name"]
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

    # run-specific verify state
    is_excluded_for_run = serializers.SerializerMethodField()
    exclusion_id = serializers.SerializerMethodField()
    exclusion_remarks = serializers.SerializerMethodField()

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
            # run-specific exclusion state
            "is_excluded_for_run",
            "exclusion_id",
            "exclusion_remarks",
        ]

    def get_is_excluded_for_run(self, obj):
        exclusion_map = self.context.get("deduction_exclusion_map", {})
        exclusion = exclusion_map.get(obj.id)
        return bool(exclusion and exclusion.is_excluded)

    def get_exclusion_id(self, obj):
        exclusion_map = self.context.get("deduction_exclusion_map", {})
        exclusion = exclusion_map.get(obj.id)
        return exclusion.id if exclusion else None

    def get_exclusion_remarks(self, obj):
        exclusion_map = self.context.get("deduction_exclusion_map", {})
        exclusion = exclusion_map.get(obj.id)
        return exclusion.remarks if exclusion else None
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

class PayrollPeriodEmployeeAllowanceListSerializer(serializers.ModelSerializer):
    allowance_type = AllowanceTypeMiniSerializer(read_only=True)

    class Meta:
        model = PayrollPeriodEmployeeAllowance
        fields = [
            "id",
            "allowance_type",
            "allowance_date",
            "amount",
            "remarks",
            "created_at",
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

class LeaveTypeMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Leave_Type
        fields = ["id", "name", "is_paid"]

class LeaveRequestMiniSerializer(serializers.ModelSerializer):
    leave_type = LeaveTypeMiniSerializer(read_only=True)

    class Meta:
        model = Leave_Request
        fields = ["id", "status", "leave_type"]

class LeaveDayMiniSerializer(serializers.ModelSerializer):
    leave_request = LeaveRequestMiniSerializer(read_only=True)

    class Meta:
        model = Leave_Day
        fields = ["id", "date", "units", "is_paid", "pay_rate", "leave_request"]

#==========COMMISION=========
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

    # run-specific exclusion state
    is_excluded_for_run = serializers.SerializerMethodField()
    exclusion_id = serializers.SerializerMethodField()
    exclusion_remarks = serializers.SerializerMethodField()

    class Meta:
        model = PayrollPeriodEmployeeCommission
        fields = [
            "id",
            "commission_type",
            "amount",
            "remarks",
            "created_at",

            # run-specific exclusion state
            "is_excluded_for_run",
            "exclusion_id",
            "exclusion_remarks",
        ]

    def get_is_excluded_for_run(self, obj):
        exclusion_map = self.context.get("commission_exclusion_map", {})
        exclusion = exclusion_map.get(obj.id)
        return bool(exclusion and exclusion.is_excluded)

    def get_exclusion_id(self, obj):
        exclusion_map = self.context.get("commission_exclusion_map", {})
        exclusion = exclusion_map.get(obj.id)
        return exclusion.id if exclusion else None

    def get_exclusion_remarks(self, obj):
        exclusion_map = self.context.get("commission_exclusion_map", {})
        exclusion = exclusion_map.get(obj.id)
        return exclusion.remarks if exclusion else None
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

       
# Create commission from modal
class PayrollPeriodEmployeeCommissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollPeriodEmployeeCommission
        fields = ["commission_type", "amount", "remarks"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0.")
        return value
#============================

#Loan
class LoanMiniSerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source="rule.name", read_only=True)

    class Meta:
        model = Loan
        fields = [
            "id",
            "name",
            "principal_amount",
            "remaining_balance",
            "deduction_mode",
            "deduction_value",
            "apply_to_cutoff",
            "effective_from",
            "effective_to",
            "status",
            "remarks",
            "declined_reason",
            "rule",
            "rule_name",
            "approved_at",
            "created_at",
        ]

#===================Fine================
class PayrollPeriodEmployeeFineCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollPeriodEmployeeFine
        fields = ["name", "amount", "remarks"]

    def validate_name(self, value):
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Fine name is required.")
        if len(v) > 100:
            raise serializers.ValidationError("Fine name is too long.")
        return v

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0.")
        return value

    def validate_remarks(self, value):
        if value:
            return value.strip()
        return value
    
class PayrollPeriodEmployeeFineListSerializer(serializers.ModelSerializer):
    is_excluded_for_run = serializers.SerializerMethodField()
    exclusion_id = serializers.SerializerMethodField()
    exclusion_remarks = serializers.SerializerMethodField()

    class Meta:
        model = PayrollPeriodEmployeeFine
        fields = [
            "id",
            "name",
            "amount",
            "remarks",
            "created_at",
            "is_excluded_for_run",
            "exclusion_id",
            "exclusion_remarks",
        ]

    def _get_exclusion(self, obj):
        fine_exclusion_map = self.context.get("fine_exclusion_map", {})
        return fine_exclusion_map.get(obj.id)

    def get_is_excluded_for_run(self, obj):
        return obj.id in self.context.get("fine_exclusion_map", {})

    def get_exclusion_id(self, obj):
        ex = self._get_exclusion(obj)
        return ex.id if ex else None

    def get_exclusion_remarks(self, obj):
        ex = self._get_exclusion(obj)
        return ex.remarks if ex else None
#============================
# Aggregated snapshot shown in Verify Employee modal before payroll generation
class PayrollVerifySnapshotSerializer(serializers.Serializer):
    # Aggregated snapshot shown in Verify Employee modal
    period_id = serializers.IntegerField()
    employee_id = serializers.IntegerField()
    full_name = serializers.CharField()
    department_name = serializers.CharField(allow_null=True)
    status = serializers.CharField()

    # upcoming/current target run
    target_run_no = serializers.IntegerField()

    shift = ShiftMiniSerializer(allow_null=True)
    salary = EmployeeSalaryMiniSerializer(allow_null=True)

    taxes = EmployeeDeductionMiniSerializer(many=True)   # SSS/PAGIBIG/PHILHEALTH...
    loans = LoanMiniSerializer(many=True)                # new Loan model preview

    # regular/master allowances
    allowances = EmployeeAllowanceMiniSerializer(many=True)

    # manual/payroll-period-specific additional allowances
    additional_allowances = PayrollPeriodEmployeeAllowanceListSerializer(many=True)

    attendances = AttendanceMiniSerializer(many=True)
    leave_days = LeaveDayMiniSerializer(many=True)
    commissions = PayrollPeriodEmployeeCommissionListSerializer(many=True)
    fines = PayrollPeriodEmployeeFineListSerializer(many=True)

#NOTE: This is for additional allowance in a particular payroll period
class PayrollPeriodEmployeeAllowanceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollPeriodEmployeeAllowance
        fields = ["allowance_type", "allowance_date", "amount", "remarks"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0.")
        return value

    def validate_allowance_date(self, value):
        period = self.context.get("period")
        if period:
            if value < period.start_date or value > period.end_date:
                raise serializers.ValidationError(
                    "Allowance date must be within the selected payroll period."
                )
        return value

class PayrollRunInputExclusionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollRunInputExclusion
        fields = [
            "id",
            "period",
            "employee",
            "target_run_no",
            "source_type",
            "source_id",
            "is_excluded",
            "remarks",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "period",
            "employee",
            "target_run_no",
            "source_type",
            "source_id",
            "created_by",
            "created_at",
            "updated_at",
        ]

class ExcludePayrollInputSerializer(serializers.Serializer):
    source_type = serializers.ChoiceField(choices=PayrollRunInputExclusion.SOURCE_TYPE_CHOICES)
    source_id = serializers.IntegerField()
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_source_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("Invalid source ID.")
        return value

class IncludePayrollInputSerializer(serializers.Serializer):
    source_type = serializers.ChoiceField(choices=PayrollRunInputExclusion.SOURCE_TYPE_CHOICES)
    source_id = serializers.IntegerField()

    def validate_source_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("Invalid source ID.")
        return value


#==========================================PAYRULE ========================================

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

#==========================================COMMISSION RULE ========================================
class CommissionTypeMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Commission_Type
        fields = ["id", "name", "is_taxable", "is_active"]

class CommissionTaxRuleSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        max_length=100,
        validators=[
            UniqueValidator(
                queryset=Commission_Tax_Rule.objects.all(),
                message="A commission tax rule with this name already exists. Please choose a different name.",
            )
        ],
    )

    commission_type_name = serializers.CharField(source="commission_type.name", read_only=True)
    applies_to_name = serializers.CharField(source="applies_to.name", read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = Commission_Tax_Rule
        fields = "__all__"

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.fname} {obj.employee.lname}".strip()
        return None

    def validate(self, attrs):
        commission_type = attrs.get("commission_type", getattr(self.instance, "commission_type", None))
        applies_to = attrs.get("applies_to", getattr(self.instance, "applies_to", None))
        employee = attrs.get("employee", getattr(self.instance, "employee", None))

        min_amount = attrs.get("min_amount", getattr(self.instance, "min_amount", None))
        max_amount = attrs.get("max_amount", getattr(self.instance, "max_amount", None))

        effective_from = attrs.get("effective_from", getattr(self.instance, "effective_from", None))
        effective_to = attrs.get("effective_to", getattr(self.instance, "effective_to", None))

        if applies_to and employee:
            raise ValidationError({
                "applies_to": ["Choose either Department or Employee, not both."],
                "employee": ["Choose either Department or Employee, not both."],
            })

        if effective_to and effective_from and effective_to < effective_from:
            raise ValidationError({"effective_to": ["effective_to cannot be earlier than effective_from."]})

        if min_amount is not None and max_amount is not None and max_amount < min_amount:
            raise ValidationError({"max_amount": ["max_amount cannot be less than min_amount."]})

        # Optional guard: prevent negative rate_value
        rate_value = attrs.get("rate_value", getattr(self.instance, "rate_value", None))
        if rate_value is not None:
            if Decimal(str(rate_value)) < 0:
                raise ValidationError({"rate_value": ["Rate value cannot be negative."]})

        # ---- bracket overlap validation (same commission_type + same scope + overlapping effective range)
        if not commission_type:
            return attrs

        qs = Commission_Tax_Rule.objects.filter(commission_type=commission_type, is_active=True)

        # same scope
        if employee:
            qs = qs.filter(employee=employee)
        else:
            qs = qs.filter(employee__isnull=True)
            if applies_to:
                qs = qs.filter(applies_to=applies_to)
            else:
                qs = qs.filter(applies_to__isnull=True)

        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        # overlap in dates: (existing.start <= new.end_or_inf) AND (existing.end_or_inf >= new.start)
        new_start = effective_from
        new_end = effective_to  # can be None

        qs = qs.filter(effective_from__lte=(new_end or new_start)).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=new_start)
        )

        # overlap amount bracket (max=None means infinity)
        INF = Decimal("999999999999")

        a_min = Decimal(str(min_amount or 0))
        a_max = Decimal(str(max_amount)) if max_amount is not None else INF

        for existing in qs:
            b_min = Decimal(str(existing.min_amount or 0))
            b_max = Decimal(str(existing.max_amount)) if existing.max_amount is not None else INF

            overlaps = not (a_max < b_min or b_max < a_min)
            if overlaps:
                raise ValidationError({
                    "min_amount": ["Bracket overlaps an existing commission rule in the same scope/effective range."],
                    "max_amount": ["Bracket overlaps an existing commission rule in the same scope/effective range."],
                })

        return attrs

#==========================================PAYROLL TAX RULE========================================

class PayrollTaxBracketSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        max_length=100,
        validators=[
            UniqueValidator(
                queryset=Payroll_Tax_Bracket.objects.all(),
                message="A payroll tax bracket with this name already exists. Please choose a different name.",
            )
        ],
    )

    applies_to_name = serializers.CharField(source="applies_to.name", read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = Payroll_Tax_Bracket
        fields = "__all__"

    def validate(self, attrs):
        # Use incoming values, fall back to instance values on update
        applies_to = attrs.get("applies_to", getattr(self.instance, "applies_to", None))
        employee = attrs.get("employee", getattr(self.instance, "employee", None))

        min_amount = attrs.get("min_amount", getattr(self.instance, "min_amount", None))
        max_amount = attrs.get("max_amount", getattr(self.instance, "max_amount", None))

        effective_from = attrs.get("effective_from", getattr(self.instance, "effective_from", None))
        effective_to = attrs.get("effective_to", getattr(self.instance, "effective_to", None))

        rate_type = attrs.get("rate_type", getattr(self.instance, "rate_type", None))
        rate_value = attrs.get("rate_value", getattr(self.instance, "rate_value", None))

        # Scope validation
        if applies_to and employee:
            raise ValidationError(
                {
                    "applies_to": ["Choose either Department or Employee, not both."],
                    "employee": ["Choose either Department or Employee, not both."],
                }
            )

        # Amount range validation
        if max_amount is not None and min_amount is not None and max_amount < min_amount:
            raise ValidationError({"max_amount": ["max_amount cannot be less than min_amount."]})

        # Date validation
        if effective_to and effective_from and effective_to < effective_from:
            raise ValidationError({"effective_to": ["effective_to cannot be earlier than effective_from."]})

        # Rate validation
        if rate_value is not None:
            try:
                rv = Decimal(str(rate_value))
            except Exception:
                raise ValidationError({"rate_value": ["Invalid rate value."]})

            if rv < 0:
                raise ValidationError({"rate_value": ["Rate value cannot be negative."]})

            # Since your percent is stored as "15" for 15%, we only enforce non-negative.
            # If you want, you can add an upper bound later (e.g. <= 100).
            if rate_type == "PERCENT":
                if rv < 0:
                    raise ValidationError({"rate_value": ["Percent rate_value cannot be negative."]})
                if rv > Decimal("1"):
                    raise ValidationError({"rate_value": ["Percent rate_value cannot be greater than 1.00 (100%)."]})

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        instance = Payroll_Tax_Bracket(**validated_data)

        if user:
            instance._current_user = user

        # Runs model.clean() too because your model save() calls full_clean()
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

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.fname} {obj.employee.lname}".strip()
        return None

#==========================================LOAN TAX RULE========================================

class LoanRuleSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        max_length=100,
        validators=[
            UniqueValidator(
                queryset=LoanRule.objects.all(),
                message="A loan rule with this name already exists. Please choose a different name.",
            )
        ],
    )

    department_name = serializers.CharField(source="department.name", read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = LoanRule
        fields = "__all__"

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.fname} {obj.employee.lname}".strip()
        return None

    def validate(self, attrs):
        department = attrs.get("department", getattr(self.instance, "department", None))
        employee = attrs.get("employee", getattr(self.instance, "employee", None))

        effective_from = attrs.get("effective_from", getattr(self.instance, "effective_from", None))
        effective_to = attrs.get("effective_to", getattr(self.instance, "effective_to", None))

        deduction_value = attrs.get("deduction_value", getattr(self.instance, "deduction_value", None))

        if department and employee:
            raise ValidationError({
                "department": ["Choose either Department or Employee, not both."],
                "employee": ["Choose either Department or Employee, not both."],
            })

        if effective_to and effective_from and effective_to < effective_from:
            raise ValidationError({
                "effective_to": ["effective_to cannot be earlier than effective_from."]
            })

        if deduction_value is not None:
            try:
                if Decimal(str(deduction_value)) < 0:
                    raise ValidationError({
                        "deduction_value": ["Deduction value cannot be negative."]
                    })
            except Exception:
                raise ValidationError({
                    "deduction_value": ["Invalid deduction value."]
                })

        return attrs

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
    net_before_excess_tax = serializers.DecimalField(max_digits=12, decimal_places=2)
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

#payroll logs
class PayrollPeriodListSerializer(serializers.ModelSerializer):
    period_label = serializers.SerializerMethodField()

    class Meta:
        model = Payroll_Period
        fields = [
            "id",
            "code",
            "start_date",
            "end_date",
            "pay_date",
            "status",
            "created_at",
            "period_label",
        ]

    def get_period_label(self, obj):
        return f"{obj.start_date} - {obj.end_date}"


class PayrollPeriodEmployeeSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PayrollPeriodEmployee
        fields = [
            "id",
            "status",
            "verified_at",
            "approved_at",
            "declined_reason",
            "created_at",
            "updated_at",
            "employee_name",
            "verified_by_name",
            "approved_by_name",
        ]

    def get_employee_name(self, obj):
        # Employee.__str__ usually returns full name; if not, adjust to fname/lname
        return str(obj.employee) if obj.employee else ""

    def get_verified_by_name(self, obj):
        return str(obj.verified_by) if obj.verified_by else ""

    def get_approved_by_name(self, obj):
        return str(obj.approved_by) if obj.approved_by else ""

# ===================== BULK CEO / SUPERADMIN APPROVAL =====================

class BulkPayrollDeclineItemSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    declined_reason = serializers.CharField()

    def validate_declined_reason(self, v: str):
        v = (v or "").strip()
        if not v:
            raise serializers.ValidationError("Decline reason is required.")
        if len(v) < 3:
            raise serializers.ValidationError("Decline reason is too short.")
        return v


class BulkPayrollDecisionInputSerializer(serializers.Serializer):
    approve_employee_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        default=list,
    )
    declines = BulkPayrollDeclineItemSerializer(
        many=True,
        required=False,
        default=list,
    )

    def validate(self, attrs):
        approve_ids = attrs.get("approve_employee_ids") or []
        declines = attrs.get("declines") or []

        decline_ids = [item["employee_id"] for item in declines]

        if not approve_ids and not declines:
            raise serializers.ValidationError({
                "detail": "At least one approve or decline action is required."
            })

        if len(approve_ids) != len(set(approve_ids)):
            raise serializers.ValidationError({
                "approve_employee_ids": "Duplicate employee IDs are not allowed."
            })

        if len(decline_ids) != len(set(decline_ids)):
            raise serializers.ValidationError({
                "declines": "Duplicate decline employee IDs are not allowed."
            })

        overlap = set(approve_ids) & set(decline_ids)
        if overlap:
            raise serializers.ValidationError({
                "detail": f"Employees cannot be both approved and declined: {sorted(list(overlap))}"
            })

        return attrs


class BulkPayrollDecisionResultSerializer(serializers.Serializer):
    approved_employee_ids = serializers.ListField(child=serializers.IntegerField())
    declined_employee_ids = serializers.ListField(child=serializers.IntegerField())
    skipped_employee_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    detail = serializers.CharField()        

