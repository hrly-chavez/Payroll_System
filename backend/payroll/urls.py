from django.urls import path
from .views import *

urlpatterns = [
    
    # Payroll Rules (Pay_Rule)
    path("superadmin/pay-rules/choices/", PayRuleChoicesView.as_view(), name="superadmin-payrule-choices"),
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

    # Commissions
    path("commission-types/", CommissionTypeListView.as_view(), name="commission-types"),
    path("periods/<int:period_id>/employees/<int:employee_id>/commissions/",PayrollPeriodEmployeeCommissionListCreateView.as_view(),name="payroll-period-employee-commissions"),

    # Payroll Generation
    path("periods/<int:period_id>/generate/", GeneratePayrollForPeriodView.as_view(), name="payroll-generate-period"),
    path("periods/<int:period_id>/employees/<int:employee_id>/generate/", GeneratePayrollForEmployeeView.as_view(), name="payroll-generate-employee"),
]
    