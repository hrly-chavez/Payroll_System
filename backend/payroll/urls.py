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
    #Payroll Result
    path("periods/<int:period_id>/employees/<int:employee_id>/payroll-result/",PayrollEmployeeResultView.as_view(),name="payroll-employee-result",),
    path("my-payrolls/", EmployeePayrollListView.as_view(), name="employee-my-payrolls"),
    path("employee-payrolls/", AdminEmployeePayrollListView.as_view(), name="employee-payroll"),
    # CEO / SuperAdmin Approval
    path("periods/<int:period_id>/approval-queue/",PayrollPeriodApprovalQueueView.as_view(),name="payroll-period-approval-queue",),
    path("periods/<int:period_id>/employees/<int:employee_id>/approve/",PayrollApproveEmployeeView.as_view(),name="payroll-approve-employee",),
    path("periods/<int:period_id>/employees/<int:employee_id>/decline/",PayrollDeclineEmployeeView.as_view(),name="payroll-decline-employee",),
    #Reset Payroll
    path("periods/<int:period_id>/employees/<int:employee_id>/reset-after-decline/",PayrollResetAfterDeclineView.as_view(),name="payroll-reset-after-decline",),
    # Mark period as Paid (only Closed -> Paid)
    path("periods/<int:period_id>/mark-paid/", PayrollPeriodMarkPaidView.as_view(), name="payroll-period-mark-paid"),
    #Download Payroll
    path("my-payrolls/<int:period_id>/download/", EmployeePayrollDownloadPDFView.as_view(), name="employee-my-payrolls-download"),

    #payroll logs
    path("reports/payroll-periods/", PayrollPeriodReportListView.as_view()),
    path("reports/payroll-periods/<int:period_id>/employees/", PayrollPeriodEmployeeReportListView.as_view()),

    path("reports/payroll-periods/<int:period_id>/release-logs/pdf/", PayrollPeriodReleaseLogsPDFView.as_view()),
]
        