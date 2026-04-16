from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *
from django.conf.urls.static import static


#reason nganong wa ga gamit ko router is flexible ang pag add sa urls like naa nani crud
#unlike sa i tagsa tagsa, masud sad sa isa ka function ang crud sa isa ka table
router = DefaultRouter()
router.register(r"departments", DepartmentViewSet)
router.register(r"shifts", ShiftViewSet)
router.register(r"employees", EmployeeViewSet)
router.register(r"salaries", EmployeeSalaryViewSet)
router.register(r"deductions", EmployeeDeductionViewSet) 
router.register(r"allowances", EmployeeAllowanceViewSet)
router.register(r"users", UserViewSet, basename="users")
router.register(r"user-activity-logs", UserActivityLogViewSet, basename="user-activity-logs")


urlpatterns = [
    path("", include(router.urls)),
    #address
    path("provinces/", ProvinceListAPIView.as_view(), name="provinces-list"),
    path("provinces/<int:province_id>/cities/", CityListByProvinceAPIView.as_view(), name="cities-by-province"),
    path("cities/<int:city_id>/barangays/", BarangayListByCityAPIView.as_view(), name="barangays-by-city"),
    path("allowance-types/", AllowanceTypeListAPIView.as_view(), name="allowance-types-list"),

    #audit logs for each employee
    path("auditlogs/employee/<int:employee_id>/", employee_audit_logs, name="employee-audit-logs"),
    #company note
    path("company-notes/latest/", LatestCompanyNoteView.as_view(), name="latest-company-note"),
    path("company-notes/", CompanyNoteCreateView.as_view(), name="create-company-note"),

    #forgot pass
    path("forgot-password/", ForgotPasswordView.as_view()),
    #check token
    path("check-reset-token/<token>/", CheckResetTokenView.as_view()),
    #reset pass
    path("reset-password-confirm/", ResetPasswordConfirmView.as_view()),

    #payroll settings for salary
    path("settings/", PayrollSettingView.as_view(), name="get-payroll-setting"),

    path("reports/attendance-corrections/", AttendanceCorrectionLogListView.as_view()),
    path("reports/attendance-corrections/pdf/", AttendanceCorrectionLogsPDFView.as_view()),
    path("dropdown/", EmployeeDropdownListView.as_view()), 

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
