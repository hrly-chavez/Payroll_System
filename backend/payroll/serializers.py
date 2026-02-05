from rest_framework import serializers
from shared_model.models import *
from django.utils import timezone
class DeductionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deduction_Type
        fields = '__all__'  # Sends all fields to the frontend





#==================================PAYROLL PERIOD=================================
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

# for clicking the payroll period (shows modal)
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