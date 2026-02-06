from rest_framework import serializers
from shared_model.models import Holiday, Leave_Type, Payroll

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

