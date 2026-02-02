from rest_framework import viewsets
from shared_model.models import *
from .serializers import *
from rest_framework.decorators import action
from rest_framework.response import Response

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
    serializer_class = EmployeeSerializer

    @action(
        detail=False,
        methods=["get"],
        url_path=r"by-department/(?P<dept_id>\d+)"
    )
    def by_department(self, request, dept_id=None):
        employees = self.queryset.filter(department_id=dept_id)
        serializer = self.get_serializer(employees, many=True)
        return Response(serializer.data)
    
    # New: Get a single employee by ID
    @action(
        detail=True,  # <--- detail=True because we are fetching one employee
        methods=["get"],
        url_path=r"details"
    )
    def details(self, request, pk=None):
        employee = self.get_object()  # pk comes from the URL
        serializer = self.get_serializer(employee)
        return Response(serializer.data)