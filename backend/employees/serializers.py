from rest_framework import serializers
from shared_model.models import *

class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = ["id", "start_time", "end_time", "break_minutes", "grace_minutes", "is_overnight", "is_active"]

class DepartmentSerializer(serializers.ModelSerializer):
    # This will display the nested shift details
    shift = ShiftSerializer(read_only=True, source="shift_id")
    
    # This is for creating/updating a department
    shift_id = serializers.PrimaryKeyRelatedField(
        queryset=Shift.objects.all(),
        write_only=True
    )

    class Meta:
        model = Department
        fields = ["id", "name", "shift", "shift_id", "is_active", "created_at"]

class EmployeeSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True)
    shift_info = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "name",
            "department_name",
            "position",
            "status",
            "shift_info",
            "hired_date",
            "bank_info",
            "email",
            "contact_no",
            "address",
        ]

    def get_name(self, obj):
        return f"{obj.fname} {obj.lname}"

    def get_shift_info(self, obj):
        if obj.shift:
            return f"{obj.shift.start_time} - {obj.shift.end_time}"
        return None