from datetime import datetime
import re
from rest_framework import serializers
from shared_model.models import *
from decimal import Decimal, InvalidOperation
from django.db.models import Q

LEAVE_NAME_REGEX = re.compile(r"^[A-Za-z0-9 _-]+$")


#=========Leave Type & Request============
class LeaveTypeSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        max_length=20,
        error_messages={
            "blank": "Leave name is required.",
            "required": "Leave name is required.",
        },
    )

    class Meta:
        model = Leave_Type
        fields = [
            "id",
            "name",
            "is_paid",
            "requires_approval",
            "is_active",
            "max_days",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_name(self, value):
        name = (value or "").strip()

        if not name:
            raise serializers.ValidationError("Leave name is required.")

        if not LEAVE_NAME_REGEX.fullmatch(name):
            raise serializers.ValidationError(
                "Leave name can only contain letters, numbers, spaces, underscore (_) and hyphen (-)."
            )

        qs = Leave_Type.objects.filter(name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError("A leave type with this name already exists.")

        return name

    def create(self, validated_data):
        # Create instance in memory without saving _current_user as a field
        instance = Leave_Type(**validated_data)

        # Attach the _current_user for signals
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            instance._current_user = request.user

        # Save the instance (triggers post_save signal)
        instance.save()
        return instance

class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    leave_type = serializers.CharField(source="leave_type.name", read_only=True)
    leave_type_id = serializers.PrimaryKeyRelatedField(
        queryset=Leave_Type.objects.all(), source="leave_type", write_only=True
    )

    def get_employee_name(self, obj):
        emp = obj.employee
        if not emp:
            return None
        parts = [emp.fname]
        if emp.initial:
            parts.append(emp.initial + ".")
        parts.append(emp.lname)
        if emp.suffix:
            parts.append(emp.suffix)
        return " ".join(parts)

    class Meta:
        model = Leave_Request
        fields = [
            "id",
            "employee_name",
            "leave_type",
            "leave_type_id",
            "is_half_day",
            "half_day_part",
            "date_from",
            "date_to",
            "reason",
            "status",
            "requested_at",
        ]

#=========Commission Type============
class CommissionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Commission_Type
        fields = ["id", "name", "is_taxable", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        v = (value or "").strip()

        qs = Commission_Type.objects.filter(name__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                "A commission type with this name already exists."
            )

        return v
    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        instance = Commission_Type(**validated_data)

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

#=========Allowance Type============
class AllowanceTypeSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        max_length=50,
        error_messages={
            "blank": "Allowance type name is required.",
            "required": "Allowance type name is required.",
        },
    )

    class Meta:
        model = Allowance_Type
        fields = "__all__"
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        name = (value or "").strip()

        if not re.fullmatch(r"[A-Za-z ]+", name):
            raise serializers.ValidationError(
                "Allowance type name must contain letters and spaces only."
            )

        qs = Allowance_Type.objects.filter(name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                "An allowance type with this name already exists."
            )

        return name

#=========Holiday=============
class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = (
            'id',
            'name',
            'date',
            'type',
            'base',
            'status',
        )
    def validate(self, attrs):
        date = attrs.get("date")
        qs = Holiday.objects.filter(date=date)

        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(  
                {"date": "Holiday already exists for this date."}
            )

        return attrs

class HolidayPolicySerializer(serializers.ModelSerializer):
    # nice-to-have fields for frontend tables
    department_name = serializers.CharField(source="department.name", read_only=True)
    base_display = serializers.CharField(source="get_base_display", read_only=True)
    holiday_type_display = serializers.CharField(source="get_holiday_type_display", read_only=True)

    class Meta:
        model = HolidayPolicy
        fields = [
            "id",
            "department",
            "department_name",
            "base",
            "base_display",
            "holiday_type",
            "holiday_type_display",
            "requires_work",
            "created_at",
        ]

    def validate(self, attrs):
        """
        Enforce: base must be active for the department.
        (Your model.clean already does this, but doing it here gives cleaner API errors.)
        """
        department = attrs.get("department") or getattr(self.instance, "department", None)
        base = attrs.get("base") or getattr(self.instance, "base", None)

        if department and base:
            ok = DepartmentHolidayCalendar.objects.filter(
                department=department,
                base=base,
                is_active=True,
            ).exists()
            if not ok:
                raise serializers.ValidationError({
                    "base": "This base is not active for the selected department."
                })

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        instance = HolidayPolicy(**validated_data)

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

#=========Loan Request============
class LoanRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_id_no = serializers.CharField(source="employee.id_no", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True)
    rule_name = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_id_no",
            "department_name",
            "rule",
            "rule_name",
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
            "created_by",
            "approved_by",
            "approved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "employee",
            "employee_name",
            "employee_id_no",
            "department_name",
            "rule",
            "rule_name",
            "remaining_balance",
            "deduction_mode",
            "deduction_value",
            "apply_to_cutoff",
            "status",
            "declined_reason",
            "created_by",
            "approved_by",
            "approved_at",
            "created_at",
            "updated_at",
        ]
    def get_rule_name(self, obj):
        return obj.rule.name if obj.rule else None
    def get_employee_name(self, obj):
        emp = obj.employee
        if not emp:
            return None

        parts = [emp.fname]
        if getattr(emp, "initial", None):
            parts.append(emp.initial + ".")
        parts.append(emp.lname)
        if getattr(emp, "suffix", None):
            parts.append(emp.suffix)

        return " ".join(parts)
    
class LoanRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Loan
        fields = [
            "id",
            "name",
            "principal_amount",
            "effective_from",
            "effective_to",
            "remarks",
        ]
        read_only_fields = ["id"]

    def validate_principal_amount(self, value):
        try:
            amount = Decimal(str(value))
        except (InvalidOperation, ValueError):
            raise serializers.ValidationError("Invalid principal amount.")

        if amount <= 0:
            raise serializers.ValidationError("Principal amount must be greater than 0.")

        return value

    def validate(self, attrs):
        request = self.context.get("request")
        employee = getattr(request.user, "employee", None)

        if not employee:
            raise serializers.ValidationError({"detail": "Employee profile not found."})

        effective_from = attrs.get("effective_from")
        effective_to = attrs.get("effective_to")

        if effective_to and effective_from and effective_to < effective_from:
            raise serializers.ValidationError({
                "effective_to": "effective_to cannot be earlier than effective_from."
            })

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        employee = request.user.employee

        principal_amount = Decimal(str(validated_data["principal_amount"]))

        loan = Loan.objects.create(
            employee=employee,
            rule=None,
            name=validated_data["name"],
            principal_amount=principal_amount,
            remaining_balance=principal_amount,
            deduction_mode=None,
            deduction_value=None,
            apply_to_cutoff=None,
            effective_from=validated_data["effective_from"],
            effective_to=validated_data.get("effective_to"),
            status="Pending",
            remarks=validated_data.get("remarks", ""),
            declined_reason=None,
            created_by=request.user,
        )
        return loan
    
class LoanDeclineSerializer(serializers.Serializer):
    decline_reason = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
