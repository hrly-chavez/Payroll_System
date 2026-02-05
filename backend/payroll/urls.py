from django.urls import path
from .views import *

urlpatterns = [
    # Payroll Rules (Pay_Rule)
    path('superadmin/pay-rules/', PayRuleListCreateView.as_view(), name='pay-rules-list-create'),
    path('superadmin/pay-rules/<int:pk>/', PayRuleDetailView.as_view(), name='pay-rule-detail'),
    path('superadmin/pay-rules/<int:pk>/status/', PayRuleUpdateStatusView.as_view(), name='pay-rule-update-status'),

    path('superadmin/deductions/', DeductionListCreateView.as_view(), name='deductions-list-create'),
    path('superadmin/deductions/<int:pk>/', DeductionDetailView.as_view(), name='deduction-detail'),
    path('superadmin/deductions/<int:pk>/status/', DeductionUpdateStatusView.as_view(), name='deduction-update-status'),
    path("periods/", PayrollPeriodListCreateView.as_view(), name="payroll-periods"),
    path("periods/<int:period_id>/eligible-employees/", PayrollPeriodEligibleEmployeesView.as_view()),
]
    