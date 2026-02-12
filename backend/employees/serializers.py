from rest_framework import serializers
from shared_model.models import *
from django.utils import timezone

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
        fields = "__all__"

#User model (user account)
class UserAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["user_id", "user_name", "role", "is_active"]

#gamit pag load sa admin department nga mga employees
class EmployeeSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True)
    shift_info = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    class Meta:
        model = Employee
        fields = [
            "id",
            "fname",
            "lname",
            "name",
            "suffix",
            "initial",
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


# =========================
# Employee Create Serializer
# =========================
class EmployeeCreateSerializer(serializers.ModelSerializer):
    address = AddressSerializer()

    class Meta:
        model = Employee
        fields = [
            "id_no", "fname", "initial", "lname", "suffix", "status",
            "contact_no", "email", "hired_date", "position", "bank_info",
            "shift", "department", "address",
        ]

    def create(self, validated_data):
        # extract _current_user if passed from view
        user = validated_data.pop("_current_user", None)
        address_data = validated_data.pop("address")

        # Create Address instance manually
        address = Address(**address_data)
        if user:
            address._current_user = user  # attach user for audit
        address.save()  # triggers post_save, AuditLog sees _current_user

        # Instantiate Employee manually
        employee = Employee(**validated_data)
        employee.address = address

        if user:
            employee._current_user = user

        employee.save()  # triggers post_save, AuditLog sees _current_user

        return employee

class EmployeeUpdateSerializer(serializers.ModelSerializer):
    address = AddressSerializer(required=False)

    class Meta:
        model = Employee
        fields = [
            "fname", "initial", "lname", "suffix", "status", "contact_no",
            "email", "hired_date", "position", "bank_info", "shift",
            "department", "address", "is_active",
        ]

    def update(self, instance, validated_data):
        user = validated_data.pop("_current_user", None)
        address_data = validated_data.pop("address", None)

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

         # ✅ IMPORTANT: RETURN THE INSTANCE
        return instance


    
#para sa salary
class EmployeeSalarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee_Salary
        fields = ["id", "employee", "pay_type", "base_rate", "effective_from", "created_at"]

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
        # Get current user from context
        user = self.context.get("_current_user")
        instance = Employee_Salary(**validated_data)
        if user:
            instance._current_user = user  # attach for AuditLog
        instance.save()
        return instance

    def update(self, instance, validated_data):
        user = self.context.get("_current_user")
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if user:
            instance._current_user = user
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
        employee = data["employee"]
        deduction_type = data.get("deduction_type")

        if not deduction_type:
            raise serializers.ValidationError(
                "deduction_type is required"
            )

        # Get latest salary
        salary = (
            Employee_Salary.objects
            .filter(employee=employee)
            .order_by("-effective_from")
            .first()
        )

        if not salary:
            raise serializers.ValidationError("Employee has no active salary")

        base_salary = salary.base_rate

        # Validate salary range
        deduction_type = Deduction_Type.objects.filter(
            id=deduction_type.id,
            is_active=True,
            salary_range_from__lte=base_salary,
            salary_range_to__gte=base_salary,
        ).order_by("-salary_range_from").first()

        if not deduction_type:
            raise serializers.ValidationError(
                f"Salary not valid for {data['deduction_type'].code}"
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
    
    def update(self, instance, validated_data):
        user = validated_data.pop("_current_user", None) or self.context.get("_current_user")
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if user:
            instance._current_user = user
        instance.save()
        return instance


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
            instance._current_user = user  # ✅ attach for AuditLog

        instance.save()
        return instance

class AllowanceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Allowance_Type
        fields = ["id", "name", "code", "is_active"]

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
class AuditLogSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.user_name", read_only=True)
    timestamp = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S")  # 24-hour format
    
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user_id",
            "username",
            "action",
            "model_name",
            "object_id",
            "old_data",
            "new_data",
            "timestamp",
        ]

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
