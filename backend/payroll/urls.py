from django.urls import path
from .views import *

urlpatterns = [
    # Payroll Rules (Pay_Rule)
    path("superadmin/pay-rules/", SuperAdminPayRuleListCreateView.as_view(), name="superadmin-payrule-list-create"),
    path("superadmin/pay-rules/<int:pk>/", SuperAdminPayRuleRetrieveUpdateView.as_view(), name="superadmin-payrule-detail"),

    #Deductions
    path('superadmin/deductions/', DeductionListCreateView.as_view(), name='deductions-list-create'),
    path('superadmin/deductions/<int:pk>/', DeductionDetailView.as_view(), name='deduction-detail'),
    path('superadmin/deductions/<int:pk>/status/', DeductionUpdateStatusView.as_view(), name='deduction-update-status'),

    #Payroll Period
    path("periods/", PayrollPeriodListCreateView.as_view(), name="payroll-periods"),
    path("periods/<int:period_id>/eligible-employees/",PayrollPeriodEligibleEmployeesView.as_view(),name="payroll-period-eligible-employees"),

    #Verify Employee
    path("periods/<int:period_id>/employees/<int:employee_id>/verify-snapshot/",PayrollVerifyEmployeeSnapshotView.as_view(),name="payroll-verify-employee-snapshot"),
    path("periods/<int:period_id>/employees/<int:employee_id>/verify/",PayrollVerifyEmployeeView.as_view(),name="payroll-verify-employee"),
]
    