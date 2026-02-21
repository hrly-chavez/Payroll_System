from datetime import datetime
from rest_framework import serializers
from shared_model.models import *

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

# serializers.py
class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Leave_Type
        fields = [
            "id",
            "name",
            "is_paid",
            "requires_approval",
            "is_active",
            "created_at",
        ]

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

class  CommissionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Commission_Type
        fields = [
            "id",
            "name",
            "code",
            "is_taxable",
            "is_active",
            "created_at",
        ]

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        # DO NOT use objects.create()
        instance = Commission_Type(**validated_data)

        # Attach BEFORE save so signal sees it
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

class AllowanceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Allowance_Type
        fields = "__all__"
        read_only_fields = ["id", "created_at"]

    def validate_code(self, value):
        qs = Allowance_Type.objects.filter(code__iexact=value.strip())

        # ✅ If updating, exclude current instance
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                "Allowance code already exists."
            )

        return value.strip()

#holiday policy
class HolidayPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = HolidayPolicy  # replace with your actual model
        fields = "__all__"

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        # DO NOT use objects.create()
        instance = HolidayPolicy(**validated_data)

        # Attach _current_user BEFORE saving
        if user:
            instance._current_user = user

        instance.save()
        return instance

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        # Update fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Attach _current_user BEFORE saving
        if user:
            instance._current_user = user

        instance.save()
        return instance