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

class PunchInEligibilitySerializer(serializers.Serializer):
    can_punch_in = serializers.BooleanField()
    reason = serializers.CharField()

    # ISO datetime strings; can be null if shift missing
    shift_start_dt = serializers.CharField(allow_null=True)
    shift_end_dt = serializers.CharField(allow_null=True)
    earliest_allowed_dt = serializers.CharField(allow_null=True)
    now_dt = serializers.CharField()

    # ISO date string (YYYY-MM-DD)
    work_date = serializers.CharField()

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
  
class ShiftWorkdaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift_Workday
        fields = ["day_of_week", "is_workday"]

class ShiftSerializer(serializers.ModelSerializer):
    workdays = ShiftWorkdaySerializer(many=True, required=False)

    class Meta:
        model = Shift
        fields = [
            "id",
            "name",
            "start_time",
            "end_time",
            "break_minutes",
            "grace_minutes",
            "is_overnight",
            "is_active",
            "workdays",   #  added
        ]

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        workdays_data = validated_data.pop("workdays", [])

        #  DO NOT use objects.create()
        shift = Shift(**validated_data)

        #  Attach user BEFORE save
        if user:
            shift._current_user = user

        shift.save()

        # If UI didn't send anything, default all days
        if not workdays_data:
            workdays_data = [
                {"day_of_week": i, "is_workday": True} for i in range(1, 8)
            ]

        Shift_Workday.objects.bulk_create([
            Shift_Workday(shift=shift, **wd) for wd in workdays_data
        ])

        return shift

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        workdays_data = validated_data.pop("workdays", None)

        # Update shift fields
        for attr, val in validated_data.items():
            setattr(instance, attr, val)

        #  Attach user BEFORE save
        if user:
            instance._current_user = user

        instance.save()

        # Replace workdays if provided
        if workdays_data is not None:
            instance.workdays.all().delete()
            Shift_Workday.objects.bulk_create([
                Shift_Workday(shift=instance, **wd) for wd in workdays_data
            ])

        return instance