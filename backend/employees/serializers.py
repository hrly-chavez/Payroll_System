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
        fields = ["id", "name", "shift", "shift_id", "is_active", "created_at"]

#gamit pag load sa admin department nga mga employees
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
    
class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            "province",
            "city",
            "barangay",
            "street",
            "sitio",
            "zip_code",
        ]

    def create(self, validated_data):
        province_name = validated_data.pop("province")
        city_name = validated_data.pop("city")
        barangay_name = validated_data.pop("barangay")

        province, _ = Province.objects.get_or_create(name=province_name)
        city, _ = City.objects.get_or_create(
            name=city_name,
            province=province
        )
        barangay, _ = Barangay.objects.get_or_create(
            name=barangay_name,
            city=city
        )

        address = Address.objects.create(
            province=province,
            city=city,
            barangay=barangay,
            **validated_data
        )

        return address
    
#gamit if mag create employee
class EmployeeCreateSerializer(serializers.ModelSerializer):
    address = AddressSerializer()

    class Meta:
        model = Employee
        fields = [
            "id_no",
            "fname",
            "initial",
            "lname",
            "suffix",
            "status",
            "contact_no",
            "email",
            "hired_date",
            "position",
            "bank_info",
            "shift",
            "department",
            "address",
        ]

    def create(self, validated_data):
        address_data = validated_data.pop("address")
        address = AddressSerializer().create(address_data)

        employee = Employee.objects.create(
            address=address,
            **validated_data
        )
        return employee
    
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
            raise serializers.ValidationError("A salary for this employee starting from this date already exists.")
        return attrs
    
#para sa deduction sa taxes like sss, pagibig, philhealth
class EmployeeDeductionCreateSerializer(serializers.ModelSerializer):
    manual_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        write_only=True
    )

    class Meta:
        model = Employee_Deduction
        fields = [
            "employee",
            "deduction_type",
            "frequency",
            "effective_from",
            "status",
            "manual_amount",
        ]

    def validate(self, data):
        employee = data["employee"]
        deduction_type = data["deduction_type"]
        manual_amount = data.get("manual_amount")

        salary = (
            Employee_Salary.objects
            .filter(employee=employee)
            .order_by("-effective_from")
            .first()
        )

        if not salary:
            raise serializers.ValidationError("Employee has no active salary")

        base_salary = salary.base_rate

        # Salary range check
        if not (
            deduction_type.salary_range_from
            <= base_salary
            <= deduction_type.salary_range_to
        ):
            raise serializers.ValidationError(
                f"Salary not valid for {deduction_type.code}"
            )

        # --- COMPUTATION ---
        if deduction_type.calculation_type == "Fixed":
            amount = deduction_type.amount

        elif deduction_type.calculation_type == "Percent":
            if manual_amount:
                amount = manual_amount
            else:
                amount = base_salary * (deduction_type.amount / 100)

        else:
            raise serializers.ValidationError("Invalid calculation type")

        data["computed_amount"] = round(amount, 2)
        return data

    def create(self, validated_data):
        amount = validated_data.pop("computed_amount")
        validated_data.pop("manual_amount", None)

        return Employee_Deduction.objects.create(
            amount=amount,
            **validated_data
        )

#deduction_type isulod rha sa 
class DeductionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deduction_Type
        fields = [
            "id",
            "code",
            "salary_range_from",
            "salary_range_to",
            "calculation_type",
            "amount",
            "is_active",
        ]