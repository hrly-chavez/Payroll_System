from django.urls import path
from .views import *

urlpatterns = [
    path('superadmin/deductions/', DeductionListCreateView.as_view(), name='deductions-list-create'),
    path('superadmin/deductions/<int:pk>/', DeductionDetailView.as_view(), name='deduction-detail'),
    path('superadmin/deductions/<int:pk>/status/', DeductionUpdateStatusView.as_view(), name='deduction-update-status'),

    #PAYROLL PERIOD
    path("periods/", PayrollPeriodListCreateView.as_view(), name="payroll-periods"),
    path("periods/<int:period_id>/eligible-employees/", PayrollPeriodEligibleEmployeesView.as_view()),
]
