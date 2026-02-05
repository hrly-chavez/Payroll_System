from rest_framework import viewsets, status, generics
from shared_model.models import *
from .serializers import *
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from accounts.permissions import IsRole;
import random, string

#--------------------------Address
# List all provinces
class ProvinceListAPIView(generics.ListAPIView):
    permission_classes = [AllowAny]
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer

# List cities for a province
class CityListByProvinceAPIView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = CitySerializer

    def get_queryset(self):
        province_id = self.kwargs.get("province_id")
        return City.objects.filter(province_id=province_id)

# List barangays for a city
class BarangayListByCityAPIView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = BarangaySerializer

    def get_queryset(self):
        city_id = self.kwargs.get("city_id")
        return Barangay.objects.filter(city_id=city_id)

#--------------------------Department
class DepartmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]
    queryset = Department.objects.all().order_by("-created_at")
    serializer_class = DepartmentSerializer

# para ni sa populate ang shifts sa drop down
class ShiftViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Shift.objects.filter(is_active=True)
    serializer_class = ShiftSerializer

class ShiftSerializer(serializers.ModelSerializer):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN"]
    display_time = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = ["id", "name", "start_time", "end_time", "display_time"]

    def get_display_time(self, obj):
        return f"{obj.start_time.strftime('%H:%M')} - {obj.end_time.strftime('%H:%M')}"

#employee details crud
class EmployeeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]
    queryset = Employee.objects.filter(is_active=True)
    
    # Use different serializer for list/details vs creation
    def get_serializer_class(self):
        if self.action == "create":
            return EmployeeCreateSerializer
        return EmployeeSerializer

    @action(
        detail=False,
        methods=["get"],
        url_path=r"by-department/(?P<dept_id>\d+)"
    )
    def by_department(self, request, dept_id=None):
        employees = self.queryset.filter(department_id=dept_id)
        serializer = self.get_serializer(employees, many=True)
        return Response(serializer.data)
    
    @action(
        detail=True,
        methods=["get"],
        url_path=r"details"
    )
    def details(self, request, pk=None):
        employee = self.get_object()
        serializer = self.get_serializer(employee)
        return Response(serializer.data)
    
    # --- Add nested address handling ---
    def create(self, request, *args, **kwargs):
        serializer = EmployeeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()

        # --- Determine the role for the user being created ---
        signed_in_user = request.user
        requested_role = request.data.get("role", "EMPLOYEE")  # default to EMPLOYEE

        # Role restriction logic
        if signed_in_user.role == "ADMIN":
            # Admins can only create EMPLOYEE users
            if requested_role != "EMPLOYEE":
                return Response(
                    {"error": "ADMINs can only create EMPLOYEE users."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif signed_in_user.role == "SUPER_ADMIN":
            # SUPER_ADMIN can create ADMIN or SUPER_ADMIN users
            if requested_role not in ["ADMIN", "SUPER_ADMIN"]:
                return Response(
                    {"error": "SUPER_ADMIN can only create ADMIN or SUPER_ADMIN users."},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            # Employees cannot create users
            return Response(
                {"error": "You do not have permission to create users."},
                status=status.HTTP_403_FORBIDDEN
            )

        # --- Generate username and random password ---
        username = f"{employee.fname.lower()}{employee.id}"
        password = "".join(random.choices(string.ascii_letters + string.digits, k=8))  # 8-char random

        # --- Create User ---
        user = User.objects.create_user(
            user_name=username,
            password=password,
            role=requested_role,
            employee=employee
        )

        return Response(
            {
                "message": "Employee and user created successfully",
                "employee_id": employee.id,
                "username": username,
                "password": password  # send this so it can be communicated to the employee
            },
            status=status.HTTP_201_CREATED
        )
    
#employee salary
class EmployeeSalaryViewSet(viewsets.ModelViewSet):
    queryset = Employee_Salary.objects.all().order_by("-effective_from")
    serializer_class = EmployeeSalarySerializer
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN"]  # only these roles can manage salaries

    # Optionally, filter by employee if query param is provided
    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset