from rest_framework import viewsets, status, generics
from shared_model.models import *
from .serializers import *
from rest_framework.decorators import action
from rest_framework.response import Response

#--------------------------Address
# List all provinces
class ProvinceListAPIView(generics.ListAPIView):
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer

# List cities for a province
class CityListByProvinceAPIView(generics.ListAPIView):
    serializer_class = CitySerializer

    def get_queryset(self):
        province_id = self.kwargs.get("province_id")
        return City.objects.filter(province_id=province_id)

# List barangays for a city
class BarangayListByCityAPIView(generics.ListAPIView):
    serializer_class = BarangaySerializer

    def get_queryset(self):
        city_id = self.kwargs.get("city_id")
        return Barangay.objects.filter(city_id=city_id)

#--------------------------Department
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all().order_by("-created_at")
    serializer_class = DepartmentSerializer

# para ni sa populate ang shifts sa drop down
class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.filter(is_active=True)
    serializer_class = ShiftSerializer

class EmployeeViewSet(viewsets.ModelViewSet):
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
        return Response(
            {"message": "Employee created successfully"},
            status=status.HTTP_201_CREATED
        )