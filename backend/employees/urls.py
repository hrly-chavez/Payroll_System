from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r"departments", DepartmentViewSet)
router.register(r"shifts", ShiftViewSet)
router.register(r"employees", EmployeeViewSet)

urlpatterns = [
    path("", include(router.urls)),
    #address
    path("provinces/", ProvinceListAPIView.as_view(), name="provinces-list"),
    path("provinces/<int:province_id>/cities/", CityListByProvinceAPIView.as_view(), name="cities-by-province"),
    path("cities/<int:city_id>/barangays/", BarangayListByCityAPIView.as_view(), name="barangays-by-city"),
]
