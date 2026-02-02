from rest_framework import viewsets
from shared_model.models import Department, Shift
from .serializers import DepartmentSerializer, ShiftSerializer

#--------------------------Department
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all().order_by("-created_at")
    serializer_class = DepartmentSerializer

# para ni sa populate ang shifts sa drop down
class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.filter(is_active=True)
    serializer_class = ShiftSerializer
