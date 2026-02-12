from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

#reason nganong wa ga gamit ko router is flexible ang pag add sa urls like naa nani crud
#unlike sa i tagsa tagsa, masud sad sa isa ka function ang crud sa isa ka table
router = DefaultRouter()
router.register(r"departments", DepartmentViewSet)
router.register(r"shifts", ShiftViewSet)
router.register(r"employees", EmployeeViewSet)
router.register(r"salaries", EmployeeSalaryViewSet)
router.register(r"deductions", EmployeeDeductionViewSet) 
router.register(r"allowances", EmployeeAllowanceViewSet)


urlpatterns = [
    path("", include(router.urls)),
    #address
    path("provinces/", ProvinceListAPIView.as_view(), name="provinces-list"),
    path("provinces/<int:province_id>/cities/", CityListByProvinceAPIView.as_view(), name="cities-by-province"),
    path("cities/<int:city_id>/barangays/", BarangayListByCityAPIView.as_view(), name="barangays-by-city"),
    path("allowance-types/", AllowanceTypeListAPIView.as_view(), name="allowance-types-list"),
    #company note
    path("company-notes/", CompanyNoteListCreateView.as_view(), name="company-notes"),

]
