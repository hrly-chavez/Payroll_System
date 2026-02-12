from rest_framework import serializers
from shared_model.models import *
from django.utils import timezone
class DeductionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deduction_Type
        fields = '__all__'  # Sends all fields to the frontend





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
        fields = [
            "id", "name", "start_time", "end_time",
            "break_minutes", "grace_minutes", "is_overnight",
            "workdays"
        ]

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
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = Pay_Rule
        fields = '__all__'

    def validate(self, attrs):
        """
        Enforce scope rules:
        - Either applies_to OR employee OR none (global)
        - Not both applies_to and employee at the same time
        """
        applies_to = attrs.get("applies_to", getattr(self.instance, "applies_to", None))
        employee = attrs.get("employee", getattr(self.instance, "employee", None))

        if applies_to and employee:
            raise serializers.ValidationError(
                {"detail": "Choose only one scope: either Department (applies_to) or Employee, not both."}
            )

        return attrs
    
    