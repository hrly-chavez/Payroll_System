from rest_framework import viewsets, status, generics
from shared_model.models import *
from .serializers import *
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from accounts.permissions import IsRole;
import random, string
from rest_framework.views import APIView
from decimal import Decimal
from django.db import transaction
from django.utils.timezone import now

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
        # Serialize the newly created employee using READ serializer
        employee_data = EmployeeSerializer(employee).data

        return Response(
            {
                "message": "Employee and user created successfully",
                "employee_id": employee_data,
                "username": username,
                "password": password  # send this so it can be communicated to the employee
            },
            status=status.HTTP_201_CREATED
        )
    # ---------------------------------
    # UPDATE EMPLOYEE DETAILS
    # /employees/employees/<id>/update/
    # ---------------------------------
    @action(
        detail=True,
        methods=["put", "patch"],
        url_path="update",
    )
    def update_employee(self, request, pk=None):
        employee = self.get_object()

        serializer = EmployeeUpdateSerializer(
            employee,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "message": "Employee updated successfully",
                "employee": EmployeeSerializer(employee).data,
            }
        )
    
#employee salary
class EmployeeSalaryViewSet(viewsets.ModelViewSet):
    queryset = Employee_Salary.objects.all().order_by("-effective_from")
    serializer_class = EmployeeSalarySerializer
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset

    @action(detail=False, methods=["get"], url_path="latest")
    def latest_salary(self, request):
        employee_id = request.query_params.get("employee")
        if not employee_id:
            return Response(
                {"detail": "employee query param is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            employee_id = int(employee_id)
        except ValueError:
            return Response(
                {"detail": "Invalid employee ID"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get the latest salary regardless of the effective_from filter
        salary = (
            Employee_Salary.objects
            .filter(employee_id=employee_id)
            .order_by("-effective_from")
            .first()
        )

        if not salary:
            return Response(
                {"detail": "No salary found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(salary)
        return Response(serializer.data)
    
    #  NEW ACTION
    @action(detail=False, methods=["post"], url_path="edit")
    @transaction.atomic
    def edit_salary(self, request):
        """
        Create a NEW salary row for the employee (for audit) and recompute percent deductions
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Create new salary row
        new_salary = serializer.save()

        # Recompute percent-based deductions linked to this employee and effective_from
        self._recompute_percentage_deductions(
            employee_id=new_salary.employee_id,
            salary_amount=new_salary.base_rate,
            effective_from=new_salary.effective_from
        )

        return Response(self.get_serializer(new_salary).data, status=status.HTTP_201_CREATED)

    def _recompute_percentage_deductions(self, employee_id: int, salary_amount: Decimal, effective_from):
        deductions = Employee_Deduction.objects.filter(
            employee_id=employee_id,
            deduction_type__calculation_type="Percent"
        )

        for ded in deductions:
            percent_value = ded.deduction_type.amount
            ded.amount = round(salary_amount * (percent_value / 100), 2)
            ded.save(update_fields=["amount"])


            
#employee deduction
class EmployeeDeductionViewSet(viewsets.ModelViewSet):
    queryset = Employee_Deduction.objects.all()
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return EmployeeDeductionListSerializer
        return EmployeeDeductionCreateSerializer


    # ----------------- NEW ENDPOINT -----------------
    @action(detail=False, methods=["get"], url_path="deduction-types")
    def deduction_types(self, request):
        """
        Returns ONLY TAX / Government deductions
        """
        deduction_types = Deduction_Type.objects.filter(
            is_active=True,
            category="TAX"   # 👈 FILTER HERE
        )

        data = [
            {
                "id": d.id,
                "code": d.code,
                "category": d.category,
                "calculation_type": d.calculation_type,
                "amount": float(d.amount),
                "salary_range_from": float(d.salary_range_from),
                "salary_range_to": float(d.salary_range_to),
            }
            for d in deduction_types
        ]
        return Response(data, status=status.HTTP_200_OK)

#--------------------- ALLOWANCE
class EmployeeAllowanceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]
    queryset = Employee_Allowance.objects.all()

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return EmployeeAllowanceSerializer  # read
        return EmployeeAllowanceCreateSerializer  # create/update

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset
    
    @action(detail=True, methods=["post"])
    def edit_allowance(self, request, pk=None):
        """
        Custom action to "edit" an allowance:
        - Create a new Employee_Allowance record
        - Keep the old one for history
        """
        original = self.get_object()  # the current allowance
        data = request.data.copy()
        
        # Ensure we use the same employee and allowance_type
        data["employee"] = original.employee.id
        data["allowance_type"] = original.allowance_type.id
        data["status"] = data.get("status", "Active")

        serializer = EmployeeAllowanceCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {"message": "Allowance updated successfully"},
            status=status.HTTP_201_CREATED
        )


class AllowanceTypeListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]
    """
    GET /employees/allowance-types/ → list all active allowance types
    """
    def get(self, request):
        allowance_types = Allowance_Type.objects.filter(is_active=True)
        serializer = AllowanceTypeSerializer(allowance_types, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)