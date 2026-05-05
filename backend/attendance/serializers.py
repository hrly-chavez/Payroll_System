from rest_framework import serializers
from shared_model.models import *
from datetime import datetime, time

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

#Admin & SuperAdmin Can see All attendance Logs (includes Bar Graph)
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


#========================SHIFT================
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
            "crosses_midnight",
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

#===============EXCESS TIME============
class PendingExcessTimeQueueSerializer(serializers.ModelSerializer):
    attendance_id = serializers.IntegerField(source="attendance.id", read_only=True)
    attendance_date = serializers.DateField(source="attendance.date", read_only=True)
    time_in = serializers.DateTimeField(source="attendance.time_in", read_only=True)
    time_out = serializers.DateTimeField(source="attendance.time_out", read_only=True)

    employee_id = serializers.IntegerField(source="employee.id", read_only=True)
    full_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    shift_name = serializers.SerializerMethodField()

    class Meta:
        model = Excess_Time_Request
        fields = [
            "id",
            "minutes",
            "start_time",
            "end_time",
            "status",
            "resolution_type",
            "remarks",
            "created_at",
            "attendance_id",
            "attendance_date",
            "time_in",
            "time_out",
            "employee_id",
            "full_name",
            "department_name",
            "shift_name",
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

class ExcessTimeResolveSerializer(serializers.Serializer):
    ACTION_CHOICES = [
        ("Approve as Overtime", "Approve as Overtime"),
        ("Approve as Offset", "Approve as Offset"),
        ("Decline", "Decline"),
    ]

    action = serializers.ChoiceField(choices=ACTION_CHOICES)
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        action = attrs.get("action")
        reason = (attrs.get("reason") or "").strip()

        if action == "Decline" and not reason:
            raise serializers.ValidationError({
                "reason": "Decline reason is required."
            })

        attrs["reason"] = reason
        return attrs

#==============Attendance Correction
class AttendanceCorrectionCreateSerializer(serializers.ModelSerializer):
    """
    Employee creates a correction request.
    Client sends: date, issue_type, reason, file_attached(optional)
    Backend resolves attendance by (request.user.employee, date).
    """

    class Meta:
        model = Attendance_Correction
        fields = ["id", "date", "issue_type", "reason", "file_attached"]

    def validate_file_attached(self, file):
        if not file:
            return file

        allowed_extensions = ["jpg", "jpeg", "png", "webp", "pdf"]
        ext = file.name.split(".")[-1].lower()

        if ext not in allowed_extensions:
            raise serializers.ValidationError(
                "Invalid file type. Only JPG, PNG, WEBP, and PDF are allowed."
            )

        if file.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("File size must be under 5MB.")

        return file

    def create(self, validated_data):
        request = self.context["request"]
        emp = getattr(request.user, "employee", None)
        if not emp:
            raise serializers.ValidationError({"detail": "No employee profile found for this user."})

        date = validated_data["date"]

        # Ensure there is an Attendance row for this employee+date
        attendance, _created = Attendance.objects.get_or_create(
            employee=emp,
            date=date,
            defaults={"status": "PRESENT"},
        )

        correction = Attendance_Correction.objects.create(
            attendance=attendance,
            requested_by=emp,
            **validated_data,
        )
        return correction


class AttendanceCorrectionListSerializer(serializers.ModelSerializer):
    attendance_id = serializers.IntegerField(source="attendance.id", read_only=True)
    employee_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    file_attached = serializers.SerializerMethodField()

    class Meta:
        model = Attendance_Correction
        fields = [
            "id",
            "attendance_id",
            "employee_name",
            "department_name",
            "date",
            "issue_type",
            "reason",
            "file_attached",
            "requested_at",
            "status",
            "reviewed_at",
            "decline_reason",
        ]

    def get_employee_name(self, obj):
        return f"{obj.requested_by.fname} {obj.requested_by.lname}"

    def get_department_name(self, obj):
        if obj.requested_by.department:
            return obj.requested_by.department.name
        return None
    def get_file_attached(self, obj):
        if not obj.file_attached:
            return None

        request = self.context.get("request")
        url = obj.file_attached.url

        if request:
            return request.build_absolute_uri(url)

        return url

class AttendanceCorrectionReviewSerializer(serializers.Serializer):
    """
    HR/SuperAdmin action endpoint.
    status: Verified | Declined
    decline_reason: required when Declined
    """
    status = serializers.ChoiceField(choices=["Verified", "Declined"])
    decline_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        status = attrs.get("status")
        decline_reason = (attrs.get("decline_reason") or "").strip()

        if status == "Declined" and not decline_reason:
            raise serializers.ValidationError({"decline_reason": "Decline reason is required."})

        attrs["decline_reason"] = decline_reason
        return attrs

class AttendanceEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance_Event
        fields = [
            "id",
            "type",
            "minutes",
            "start_time",
            "end_time",
            "approval_status",
            "event_remarks",
        ]

class AttendanceMiniSerializer(serializers.ModelSerializer):
    events = AttendanceEventSerializer(many=True, read_only=True)

    class Meta:
        model = Attendance
        fields = ["id", "date", "status", "time_in", "time_out", "events"]

class AttendanceCorrectionDetailSerializer(serializers.ModelSerializer):
    attendance = AttendanceMiniSerializer(read_only=True)
    employee_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    file_attached = serializers.SerializerMethodField()
    
    class Meta:
        model = Attendance_Correction
        fields = [
            "id",
            "date",
            "issue_type",
            "reason",
            "file_attached",
            "requested_at",
            "status",
            "decline_reason",
            "employee_name",
            "department_name",
            "attendance",
        ]

    def get_employee_name(self, obj):
        return f"{obj.requested_by.fname} {obj.requested_by.lname}"

    def get_department_name(self, obj):
        dept = getattr(obj.requested_by, "department", None)
        return getattr(dept, "name", None)
    
    def get_file_attached(self, obj):
        if not obj.file_attached:
            return None

        request = self.context.get("request")
        url = obj.file_attached.url

        if request:
            return request.build_absolute_uri(url)

        return url

# =========================
# Attendance Event (Create)
# =========================
class AttendanceEventCreateSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=[c[0] for c in Attendance_Event.TYPE_CHOICES])
    minutes = serializers.IntegerField(required=False, min_value=0)
    start_time = serializers.TimeField(required=False, allow_null=True)
    end_time = serializers.TimeField(required=False, allow_null=True)
    approval_status = serializers.ChoiceField(
        choices=[c[0] for c in Attendance_Event.APPROVAL_STATUS_CHOICES],
        required=False
    )
    event_remarks = serializers.CharField(required=False, allow_blank=True)
    holiday_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        start_time = attrs.get("start_time")
        end_time = attrs.get("end_time")

        if start_time and end_time and end_time < start_time:
            raise serializers.ValidationError(
                {"end_time": "end_time must be later than or equal to start_time."}
            )

        return attrs


# =========================
# Attendance Correction (Apply)
# =========================

#helper
def compute_late_undertime(date, time_in, time_out):
    if not time_in or not time_out:
        return 0, 0

    shift_start = time(9, 0, 0)
    shift_end = time(18, 0, 0)

    late_minutes = 0
    undertime_minutes = 0

    if time_in.time() > shift_start:
        diff = datetime.combine(date, time_in.time()) - datetime.combine(date, shift_start)
        late_minutes = int(diff.total_seconds() // 60)

    if time_out.time() < shift_end:
        diff = datetime.combine(date, shift_end) - datetime.combine(date, time_out.time())
        undertime_minutes = int(diff.total_seconds() // 60)

    return late_minutes, undertime_minutes

class AttendanceCorrectionApplySerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=["PRESENT", "ABSENT", "HALF_DAY", "REST_DAY", "HOLIDAY"],
        required=False,
    )
    time_in = serializers.DateTimeField(required=False, allow_null=True)
    time_out = serializers.DateTimeField(required=False, allow_null=True)

    # NEW
    replace_events = serializers.BooleanField(required=False, default=False)
    events = AttendanceEventCreateSerializer(many=True, required=False)

    def validate(self, attrs):
        time_in = attrs.get("time_in", None)
        time_out = attrs.get("time_out", None)

        # If both provided, ensure logical order
        if time_in and time_out and time_out < time_in:
            raise serializers.ValidationError(
                {"time_out": "time_out must be later than or equal to time_in."}
            )

        # Require at least one change: attendance edits OR events
        has_core_change = any(k in attrs for k in ["status", "time_in", "time_out"])
        has_events = "events" in attrs and len(attrs.get("events") or []) > 0

        if not has_core_change and not has_events:
            raise serializers.ValidationError({"detail": "No changes provided."})

        # Explicit: Missing Both allows null/null time_in/time_out
        correction = self.context.get("correction")
        if correction and getattr(correction, "issue_type", None) == "Missing Both":
            return attrs
        
        events = attrs.get("events") or []

        correction = self.context.get("correction")
        attendance = getattr(correction, "attendance", None)

        if attendance and events:
            actual_time_in = attrs.get("time_in") or attendance.time_in
            actual_time_out = attrs.get("time_out") or attendance.time_out

            if not actual_time_in or not actual_time_out:
                return attrs

            late_expected, ut_expected = compute_late_undertime(
                attendance.date,
                actual_time_in,
                actual_time_out
            )

            for e in events:
                event_type = e.get("type")

                if "minutes" not in e:
                    raise serializers.ValidationError({
                        "events": f"{event_type} requires minutes."
                    })

                minutes = e["minutes"]

                if event_type == "Late" and minutes != late_expected:
                    raise serializers.ValidationError({
                        "events": f"Late minutes mismatch. Expected {late_expected}, got {minutes}."
                    })

                if event_type == "Undertime" and minutes != ut_expected:
                    raise serializers.ValidationError({
                        "events": f"Undertime minutes mismatch. Expected {ut_expected}, got {minutes}."
                    })
        return attrs


#==============PIE CHART DISPLAY============================
class AttendanceStatsSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()

    present = serializers.IntegerField()
    late = serializers.IntegerField()
    absent = serializers.IntegerField()
    leave = serializers.IntegerField()
    undertime = serializers.IntegerField()
    overtime = serializers.IntegerField()

class AttendanceAdminMonthlyStatsSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    present = serializers.IntegerField()
    late = serializers.IntegerField()
    absent = serializers.IntegerField()
    leave = serializers.IntegerField()
    undertime = serializers.IntegerField()
    overtime = serializers.IntegerField()


class AttendanceAnalyticsQuerySerializer(serializers.Serializer):
    """
    Query params ONLY.
    GET ?mode=Day|Week|Month|Year&date=YYYY-MM-DD(optional)
    """
    mode = serializers.ChoiceField(choices=["Day", "Week", "Month", "Year"])
    date = serializers.DateField(required=False)


class AttendanceAnalyticsRangeSerializer(serializers.Serializer):
    """
    Response payload ONLY.
    """
    mode = serializers.ChoiceField(choices=["Day", "Week", "Month", "Year"])
    date = serializers.DateField()

    start_date = serializers.DateField()
    end_date = serializers.DateField()

    present = serializers.IntegerField()
    late = serializers.IntegerField()
    absent = serializers.IntegerField()
    leave = serializers.IntegerField()
    undertime = serializers.IntegerField()
    overtime = serializers.IntegerField() 
class EmployeeDropdownSerializer(serializers.ModelSerializer):
    value = serializers.IntegerField(source="id")
    label = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = ["value", "label"]

    def get_label(self, obj):
        fname = (getattr(obj, "fname", "") or "").strip()
        lname = (getattr(obj, "lname", "") or "").strip()
        full = f"{fname} {lname}".strip()
        return full or f"Employee #{obj.id}"


class AttendanceLogRowSerializer(serializers.Serializer):
    """
    Matches your HRLogRow shape.
    """
    id = serializers.IntegerField()
    date = serializers.DateField()
    status = serializers.CharField(allow_blank=True, allow_null=True)
    time_in = serializers.CharField(allow_null=True)
    time_out = serializers.CharField(allow_null=True)
    employee_id = serializers.IntegerField()
    full_name = serializers.CharField()
    department_name = serializers.CharField(allow_null=True)
    shift_name = serializers.CharField(allow_null=True)
    event_types = serializers.CharField(allow_blank=True, allow_null=True)

# import biometrics file
class BiometricsUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        if not value.name.endswith(".xlsx"):
            raise serializers.ValidationError("Only .xlsx files are allowed.")
        return value