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

class PayrollSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payroll
        fields = ['id', 'employee_name', 'period', 'total_amount', 'status']

class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Leave_Type
        fields = [
            'id',
            'name',
            'is_paid',
            'pay_rate',
            'requires_approval',
            'is_active',
            'created_at',
        ]

class LeaveRequestSerializer(serializers.ModelSerializer):
    leave_type = serializers.CharField(
        source="leave_type.name",
        read_only=True
    )

    leave_type_id = serializers.PrimaryKeyRelatedField(
        queryset=Leave_Type.objects.all(),
        source="leave_type",
        write_only=True
    )

    class Meta:
        model = Leave_Request
        fields = [
            "id",
            "leave_type",   # ← STRING NAME
            "leave_type_id",
            "is_half_day",
            "half_day_part",
            "date_from",
            "date_to",
            "reason",
            "status",
            "requested_at",
        ]

