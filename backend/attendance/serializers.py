from rest_framework import serializers
from shared_model.models import *


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = "__all__"

class PunchInSerializer(serializers.Serializer):
    """
    No input fields needed.
     use request.user.employee and server time.
    """
    def validate(self, attrs):
        return attrs

class PunchOutSerializer(serializers.Serializer):
    """
    No input fields needed.
     use request.user.employee and server time.
    """
    def validate(self, attrs):
        return attrs

#Each employee Logs
class AttendanceLogSerializer(serializers.ModelSerializer):
    shift_name = serializers.SerializerMethodField()
    event_types = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            "id",
            "date",
            "status",
            "time_in",
            "time_out",
            "shift_name",
            "event_types",
        ]

    def get_shift_name(self, obj):
        # employee.shift may be null
        shift = getattr(obj.employee, "shift", None)
        return getattr(shift, "name", None)

    def get_event_types(self, obj):
        # Example output: "Late, UnderTime" (or empty)
        types = list(obj.events.values_list("type", flat=True))
        return ", ".join(types) if types else ""

#Admin & SuperAdmin Can see All attendance Logs
class CEOandHRAttendanceLogSerializer(serializers.ModelSerializer):
    employee_id = serializers.IntegerField(source="employee.id", read_only=True)
    full_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    shift_name = serializers.SerializerMethodField()
    event_types = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            "id",
            "date",
            "status",
            "time_in",
            "time_out",
            "employee_id",
            "full_name",
            "department_name",
            "shift_name",
            "event_types",
        ]

    def get_full_name(self, obj):
        emp = obj.employee
        return f"{emp.fname} {emp.lname}"

    def get_department_name(self, obj):
        dept = getattr(obj.employee, "department", None)
        return getattr(dept, "name", None)

    def get_shift_name(self, obj):
        shift = getattr(obj.employee, "shift", None)
        return getattr(shift, "name", None)

    def get_event_types(self, obj):
        types = list(obj.events.values_list("type", flat=True))
        return ", ".join(types) if types else ""
