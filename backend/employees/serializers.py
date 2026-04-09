from rest_framework import serializers
from shared_model.models import *
from django.utils import timezone
from django.utils.html import strip_tags
import re
from datetime import date

#---------------------address

class ProvinceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Province
        fields = ['id', 'name']

class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ['id', 'name', 'province']

class BarangaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Barangay
        fields = ['id', 'name', 'city']

class ShiftSerializer(serializers.ModelSerializer):
    display_time = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = ["id", "name", "start_time", "end_time", "display_time"]

    def get_display_time(self, obj):
        return f"{obj.start_time.strftime('%H:%M')} - {obj.end_time.strftime('%H:%M')}"
    
class DepartmentSerializer(serializers.ModelSerializer):
    shift = ShiftSerializer(read_only=True, source="shift_id")
    shift_id = serializers.PrimaryKeyRelatedField(
        queryset=Shift.objects.all(),
        write_only=True
    )

    holiday_base = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = "__all__"

    def get_holiday_base(self, obj):
        return list(
            obj.holiday_calendars.values_list("base", flat=True)
        )

    def create(self, validated_data):
        # Pop the _current_user from context instead of kwargs
        current_user = self.context.get("current_user")
        
        # Create the instance normally
        instance = Department.objects.create(**validated_data)

        # Attach _current_user for your signals
        instance._current_user = current_user
        instance.save()
        return instance
        


#User model (user account)
class UserAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["user_id", "user_name", "role", "is_active", "user_status"]

#gamit pag load sa admin department nga mga employees
class EmployeeSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True)
    shift_info = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    role = serializers.CharField(source="user.role", read_only=True)
    class Meta:
        model = Employee
        fields = [
            "id",
            "id_no",
            "role",
            "fname",
            "lname",
            "name",
            "suffix",
            "initial",
            "department_name",
            "position",
            "status",
            "employment_status",
            "shift_info",
            "hired_date",
            "bank_info",
            "email",
            "contact_no",
            "address",
            "profile_picture",
        ]

    def get_name(self, obj):
        return f"{obj.fname} {obj.lname}"

    def get_shift_info(self, obj):
        if obj.shift:
            return f"{obj.shift.start_time} - {obj.shift.end_time}"
        return None
    
    # <-- method name matches the field name
    def get_address(self, obj):
        if not obj.address:
            return None
        addr = obj.address
        return {
            "street": addr.street or "",
            "sitio": addr.sitio or "",
            "barangay_name": addr.barangay.name if addr.barangay else "",
            "city_name": addr.city.name if addr.city else "",
            "province_name": addr.province.name if addr.province else "",
            "zip_code": addr.zip_code or "",
        }

    
# =========================
# Address Serializer
# =========================
class AddressSerializer(serializers.ModelSerializer):
    province = serializers.PrimaryKeyRelatedField(
        queryset=Province.objects.all()
    )
    city = serializers.PrimaryKeyRelatedField(
        queryset=City.objects.all()
    )
    barangay = serializers.PrimaryKeyRelatedField(
        queryset=Barangay.objects.all()
    )

    # READ-ONLY display fields
    province_name = serializers.CharField(
        source="province.name", read_only=True
    )
    city_name = serializers.CharField(
        source="city.name", read_only=True
    )
    barangay_name = serializers.CharField(
        source="barangay.name", read_only=True
    )

    class Meta:
        model = Address
        fields = [
            "street",
            "sitio",
            "barangay",
            "barangay_name",
            "city",
            "city_name",
            "province",
            "province_name",
            "zip_code",
        ]

    # -------------------------
    # CUSTOM VALIDATORS
    # -------------------------
    def validate_street(self, value):
        if value and re.search(r"[<>]", value):
            raise ValidationError("Street cannot contain < or > characters.")
        return value

    def validate_sitio(self, value):
        if value and re.search(r"[<>]", value):
            raise ValidationError("Sitio cannot contain < or > characters.")
        return value

    def validate_zip_code(self, value):
        if value and not value.isdigit():
            raise ValidationError("Zip code must contain numbers only.")
        return value


class EmployeeCreateSerializer(serializers.ModelSerializer):
    address = AddressSerializer()
    profile_picture = serializers.ImageField(required=False)

    class Meta:
        model = Employee
        fields = [
            "id_no", "fname", "initial", "lname", "suffix", "status", "employment_status",
            "contact_no", "email", "hired_date", "position", "bank_info",
            "shift", "department", "address", "profile_picture",
        ]

    # -------------------------
    # GLOBAL STRING SANITIZER
    # -------------------------
    def sanitize_string(self, value):
        if not value:
            return value
        value = value.strip()
        value = strip_tags(value)          # remove HTML tags
        value = re.sub(r"[<>]", "", value) # remove < >
        value = re.sub(r"\s+", " ", value) # normalize spaces
        return value

    # -------------------------
    # FIELD VALIDATIONS
    # -------------------------
    def validate_fname(self, value):
        return self.sanitize_string(value)

    def validate_lname(self, value):
        return self.sanitize_string(value)

    def validate_initial(self, value):
        return self.sanitize_string(value)

    def validate_suffix(self, value):
        return self.sanitize_string(value)

    def validate_position(self, value):
        return self.sanitize_string(value)

    def validate_bank_info(self, value):
        if not value:
            return value
        return self.sanitize_string(value)

    def validate_contact_no(self, value):
        value = self.sanitize_string(value)
        if not re.match(r"^\d{11}$", value):
            raise serializers.ValidationError("Contact number must be exactly 11 digits.")
        return value

    def validate_hired_date(self, value):
        if value < date.today():
            raise serializers.ValidationError("Hired date cannot be in the past.")
        return value

    # -------------------------
    # EMAIL VALIDATION
    # -------------------------
    def validate_email(self, value):
        value = self.sanitize_string(value)

        if "<" in value or ">" in value:
            raise serializers.ValidationError("Invalid email format.")

        if Employee.objects.filter(email__iexact=value, is_active=True).exists():
            raise serializers.ValidationError("An employee with this email already exists.")

        return value.lower()

    # -------------------------
    # ADDRESS VALIDATION
    # -------------------------
    def validate_address(self, value):
        for key, val in value.items():
            if isinstance(val, str):
                sanitized = self.sanitize_string(val)
                # Additional numeric validation for zip code
                if key == "zip_code" and sanitized and not sanitized.isdigit():
                    raise serializers.ValidationError({"zip_code": "Zip code must contain digits only."})
                value[key] = sanitized
        return value
    
    def validate_profile_picture(self, value):
        # If no file was uploaded, skip validation
        if not value:
            return value

        # Check MIME type
        if value.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
            raise serializers.ValidationError("Only JPEG and PNG images are allowed.")

        # Check file size (max 2MB)
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Image size should not exceed 2MB.")

        return value

    # -------------------------
    # CREATE METHOD
    # -------------------------
    def create(self, validated_data):
        user = validated_data.pop("_current_user", None)
        address_data = validated_data.pop("address")

        address = Address(**address_data)
        if user:
            address._current_user = user
        address.save()

        employee = Employee(**validated_data)
        employee.address = address
        if user:
            employee._current_user = user
        employee.save()
        return employee
   
class EmployeeUpdateSerializer(serializers.ModelSerializer):
    address = AddressSerializer(required=False)
    reason = serializers.CharField(write_only=True, required=True)
    profile_picture = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Employee
        fields = [
            "fname", "initial", "lname", "suffix", "status", "employment_status", "contact_no",
            "email", "hired_date", "position", "bank_info", "shift",
            "department", "address", "is_active", "reason", "profile_picture",
        ]

    # -------------------------
    # EMAIL VALIDATION
    # -------------------------
    def validate_email(self, value):
        employee = self.instance

        if Employee.objects.filter(
            email__iexact=value,
            is_active=True
        ).exclude(id=employee.id).exists():
            raise serializers.ValidationError("An employee with this email already exists.")

        return value

    def update(self, instance, validated_data):
        user = validated_data.pop("_current_user", None)
        reason = validated_data.pop("reason", None)  
        address_data = validated_data.pop("address", None)

        # Attach _reason for audit logging in signals
        if reason:
            setattr(instance, "_audit_reason", reason)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if user:
            instance._current_user = user

        instance.save()

        if address_data:
            address = instance.address
            for attr, value in address_data.items():
                setattr(address, attr, value)
            if user:
                address._current_user = user
            address.save()

         # IMPORTANT: RETURN THE INSTANCE
        return instance
  
#for salary
def get_salary_for_deduction(pay_type, base_rate):
    """
    Converts the employee's salary to the equivalent monthly amount
    for deduction lookup based on Payroll Setting.
    """
    payroll_setting = Payroll_Setting.objects.first()  # assuming 1 row
    divisor = payroll_setting.daily_rate_divisor if payroll_setting else 22

    if pay_type == "Monthly":
        salary_for_deduction = base_rate
    elif pay_type == "Daily":
        salary_for_deduction = base_rate * divisor
    elif pay_type == "Hourly":
        salary_for_deduction = base_rate * 8 * divisor
    else:
        salary_for_deduction = base_rate

    return salary_for_deduction

def get_minimum_wage():
    setting = PayrollMinimumSetting.objects.first()
    return setting.daily_minimum_wage if setting else 0  # no hardcoded 500

def calculate_wage_type(pay_type, base_rate):

    payroll_setting = Payroll_Setting.objects.first()
    divisor = payroll_setting.daily_rate_divisor if payroll_setting else 20

    minimum_wage = get_minimum_wage()

    daily_equivalent = 0

    if pay_type == "Monthly":
        daily_equivalent = base_rate / divisor

    elif pay_type == "Daily":
        daily_equivalent = base_rate

    elif pay_type == "Hourly":
        daily_equivalent = base_rate * 8

    return "ABOVE_MINIMUM" if daily_equivalent >= minimum_wage  else "MINIMUM"

class EmployeeSalarySerializer(serializers.ModelSerializer):
    reason = serializers.CharField(write_only=True, required=False)
    class Meta:
        model = Employee_Salary
        fields = ["id", "employee", "pay_type", "base_rate", "wage_type", "effective_from", "created_at", "reason", ]

    def validate(self, attrs):
        # Ensure unique salary per employee per effective_from
        employee = attrs.get("employee")
        effective_from = attrs.get("effective_from")
        if Employee_Salary.objects.filter(employee=employee, effective_from=effective_from).exists():
            raise serializers.ValidationError(
                "A salary for this employee starting from this date already exists."
            )
        return attrs

    def create(self, validated_data):
        user = self.context.get("_current_user")
        reason = validated_data.pop("reason", None)

        # Calculate wage_type based on pay_type and base_rate
        pay_type = validated_data.get("pay_type")
        base_rate = validated_data.get("base_rate")
        validated_data["wage_type"] = calculate_wage_type(pay_type, base_rate)

        instance = Employee_Salary(**validated_data)
        if user:
            instance._current_user = user
            instance._audit_reason = reason or f"Salary created by {user.user_name}"
        if reason:
            setattr(instance, "_audit_reason", reason)
        
        instance.save()
        return instance

    def update(self, instance, validated_data):
        user = self.context.get("_current_user")
        reason = validated_data.pop("reason", None)

        # Recalculate wage_type if pay_type or base_rate changed
        pay_type = validated_data.get("pay_type", instance.pay_type)
        base_rate = validated_data.get("base_rate", instance.base_rate)
        validated_data["wage_type"] = calculate_wage_type(pay_type, base_rate)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if user:
            instance._current_user = user
        if reason:
            setattr(instance, "_audit_reason", reason)
        instance.save()
        
        return instance
#para sa deduction sa taxes like sss, pagibig, philhealth
#para sad ni sya sa POST / PUT
class EmployeeDeductionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee_Deduction
        fields = [
            "employee",
            "deduction_type",
            "frequency",
            "effective_from",
            "status",
        ]

    def validate(self, data):
        # Support PATCH (partial update)
        employee = data.get("employee") or getattr(self.instance, "employee", None)
        deduction_type = data.get("deduction_type") or getattr(self.instance, "deduction_type", None)

        if not employee:
            raise serializers.ValidationError("employee is required")

        if not deduction_type:
            raise serializers.ValidationError("deduction_type is required")

        # If only status is being updated → skip salary recalculation
        if set(data.keys()) == {"status"}:
            return data

        # Get latest salary
        salary = (
            Employee_Salary.objects
            .filter(employee=employee)
            .order_by("-effective_from")
            .first()
        )

        if not salary:
            raise serializers.ValidationError("Employee has no active salary")

        # Convert employee salary to monthly equivalent for deduction range check
        base_salary = get_salary_for_deduction(salary.pay_type, salary.base_rate)

        # Validate salary range
        deduction_type = Deduction_Type.objects.filter(
            id=deduction_type.id,
            is_active=True,
            salary_range_from__lte=base_salary,
            salary_range_to__gte=base_salary,
        ).order_by("-salary_range_from").first()

        if not deduction_type:
            raise serializers.ValidationError(
                f"Salary not valid for {deduction_type.code}"
            )

        # Compute amount
        if deduction_type.calculation_type == "Fixed":
            amount = deduction_type.amount
        elif deduction_type.calculation_type == "Percent":
            amount = base_salary * (deduction_type.amount / 100)
        else:
            raise serializers.ValidationError("Invalid calculation type")

        data["deduction_type"] = deduction_type
        data["amount"] = round(amount, 2)

        return data

    def create(self, validated_data):
        user = validated_data.pop("_current_user", None)

        # Try to find existing deduction first
        obj = Employee_Deduction.objects.filter(
            employee=validated_data["employee"],
            deduction_type=validated_data["deduction_type"],
            effective_from=validated_data["effective_from"],
        ).first()

        if obj:
            # Update existing
            for k, v in validated_data.items():
                setattr(obj, k, v)
            if user:
                obj._current_user = user
            obj.save()
        else:
            # Create new
            obj = Employee_Deduction(**validated_data)
            if user:
                obj._current_user = user
            obj.save()  # signal sees _current_user
        return obj


class EmployeeDeductionListSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = Employee_Deduction
        fields = [
            "id",
            "name",
            "amount",
            "frequency",
            "effective_from",
            "status",
        ]

    def get_name(self, obj):
        if obj.deduction_type:
            return obj.deduction_type.code

        return "-"


#------------------- ALLOWANCE
#PUT / POST
class EmployeeAllowanceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee_Allowance
        fields = [
            "employee",
            "allowance_type",
            "amount",
            "frequency",
            "effective_from",
            "effective_to",
            "status",
        ]

    def validate(self, data):
        # Optional: check overlapping allowances for same employee + type
        existing = Employee_Allowance.objects.filter(
            employee=data["employee"],
            allowance_type=data["allowance_type"],
            effective_from=data["effective_from"],
        )
        if existing.exists():
            raise serializers.ValidationError("Allowance already exists for this period")
        return data
    
    def create(self, validated_data):
        user = validated_data.pop("_current_user", None)

        instance = Employee_Allowance(**validated_data)

        if user:
            instance._current_user = user

        instance.save()

        return instance

class AllowanceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Allowance_Type
        fields = ["id", "name", "is_active"]

#this is the read or get for allowance
class EmployeeAllowanceSerializer(serializers.ModelSerializer):
    allowance_type = AllowanceTypeSerializer(read_only=True)  # nested

    class Meta:
        model = Employee_Allowance
        fields = [
            "id",
            "employee",
            "allowance_type",
            "amount",
            "frequency",
            "effective_from",
            "effective_to",
            "status",
        ]

#audit logs
class UserActivityAuditLogSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    timestamp = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S")

    class Meta:
        model = AuditLog
        fields = ["id", "username", "role", "action", "model_name", "timestamp", "reason"]

    def get_username(self, obj):
        if obj.user_id:
            try:
                return obj.user.user_name
            except:
                return "Deleted User"
        return "Anonymous"

    def get_role(self, obj):
        if obj.user_id:
            try:
                return obj.user.role
            except:
                return None
        return None


#------------ COMPANY NOTE SERIALIZER-----------
class CompanyNoteSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = Company_Note
        fields = ["id", "note", "created_at", "created_by"]

    def get_created_by(self, obj):
        if obj.user:
            return obj.user.user_name
        return "System"

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user

        return Company_Note.objects.create(
            user=user,   # ✅ SAVE USER TO DB
            **validated_data
        )

class AttendanceCorrectionLogSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Attendance_Correction
        fields = [
            "id",
            "requested_at",
            "date",
            "issue_type",
            "status",
            "reason",
            "decline_reason",
            "reviewed_at",
            "employee_name",
            "reviewed_by_name",
            "file_url",
        ]

    def get_employee_name(self, obj):
        # assuming Employee.__str__ returns name (common)
        return str(obj.requested_by) if obj.requested_by else ""

    def get_reviewed_by_name(self, obj):
        return str(obj.reviewed_by) if obj.reviewed_by else ""

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file_attached and hasattr(obj.file_attached, "url"):
            # make absolute URL if request exists
            return request.build_absolute_uri(obj.file_attached.url) if request else obj.file_attached.url
        return None

class EmployeeDropdownSerializer(serializers.ModelSerializer):
    value = serializers.IntegerField(source="id") 
    label = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = ["value", "label"]

    def get_label(self, obj):
        return f"{obj.fname} {obj.lname}".strip()