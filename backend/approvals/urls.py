from django.urls import path
from .views import *
urlpatterns = [
    path('superadmin/holidays/<int:pk>/status/', HolidayUpdateStatusView.as_view(), name='holiday-update-status'),
    path('holidays/', HolidayListView.as_view()),
    path('superadmin/holidays/', HolidayListView.as_view()),
    path('holidays/create/', HolidayCreateView.as_view()),
    path("superadmin/holidays/<int:pk>/", HolidayUpdateDeleteView.as_view(), name="holiday-update-delete"),
    path("generate-holidays/", GenerateHolidayView.as_view(), name="generate-holidays"),
 
    # Leave Types
    path('superadmin/leave-types/', LeaveTypeListView.as_view(), name='leave-list'),
    path('superadmin/leave-types/create/', LeaveTypeCreateView.as_view(), name='leave-create'),
    path('superadmin/leave-types/<int:pk>/', LeaveTypeUpdateView.as_view(), name='leave-update'),

    # for employee
    path("leaves/", LeaveRequestListCreateView.as_view(), name="leave-requests"),

    #admin
    path("all-requests/", AllRequestsListCreateView.as_view()), #all req tab
    path("admin/leaves/", AdminLeaveRequestListView.as_view(), name="admin-leave-requests"), 
    path("admin/leaves/<int:pk>/status/", admin_update_leave_status, name="admin-leave-update-status"),#req tab 
    
    # Commission Types
    path("superadmin/commission-types/", CommissionTypeListView.as_view(), name="commission-type-list",),
    path("superadmin/commission-types/create/", CommissionTypeCreateView.as_view(), name="commission-type-create",),
    path("superadmin/commission-types/<int:pk>/", CommissionTypeUpdateView.as_view(), name="commission-type-update",),

    #Allowance Type
    path("allowance-type/add/", AllowanceTypeCreateView.as_view()),
    path("allowance-type/", AllowanceTypeListView.as_view()),
    path("allowance-type/<int:pk>/", AllowanceTypeUpdateView.as_view()),
    
    #Holiday Policy
    path("holiday-policy/", HolidayPolicyListCreateView.as_view(), name="holiday-policy-list-create"),
    path("holiday-policy/<int:pk>/", HolidayPolicyRetrieveUpdateDestroyView.as_view(), name="holiday-policy-detail"),
    path("holiday-policy/ensure/", HolidayPolicyEnsureView.as_view(), name="holiday-policy-ensure"),
    path("departments/<int:department_id>/holiday-bases/", DepartmentActiveHolidayBasesView.as_view(), name="department-holiday-bases"),

    #Loan Request
    path("loans/", EmployeeLoanRequestListCreateView.as_view(), name="employee-loan-requests"),
    path("superadmin/loans/", SuperAdminLoanRequestListView.as_view(), name="superadmin-loan-requests"),
    path("superadmin/loans/<int:pk>/approve/", SuperAdminLoanApproveView.as_view(), name="superadmin-loan-approve"),
    path("superadmin/loans/<int:pk>/decline/", SuperAdminLoanDeclineView.as_view(), name="superadmin-loan-decline"),
    path("superadmin/loans/<int:pk>/activate/", SuperAdminLoanActivateView.as_view(), name="superadmin-loan-activate"),

    #Leave Credit Max
    path("superadmin/leave-credit-max/",LeaveCreditMaxListView.as_view(),name="leave-credit-max-list"),
    path("superadmin/leave-credit-max/create/",LeaveCreditMaxCreateView.as_view(),name="leave-credit-max-create"),
    path("superadmin/leave-credit-max/<int:pk>/",LeaveCreditMaxDetailView.as_view(),name="leave-credit-max-detail"),
    path("leave-types-with-credit/",EmployeeLeaveTypeCreditListView.as_view(),name="leave-types-with-credit"),
]
