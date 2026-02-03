from rest_framework import serializers
from shared_model.models import *

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
    
class AddressSerializer(serializers.Serializer):
    province = serializers.CharField()
    city = serializers.CharField()
    barangay = serializers.CharField()
    street = serializers.CharField(required=False, allow_blank=True)
    sitio = serializers.CharField(required=False, allow_blank=True)
    zip_code = serializers.CharField(required=False, allow_blank=True)

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