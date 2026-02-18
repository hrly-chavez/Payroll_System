from django.urls import path
from .views import *
urlpatterns = [
    path('superadmin/holidays/<int:pk>/status/', HolidayUpdateStatusView.as_view(), name='holiday-update-status'),
    path('holidays/', HolidayListView.as_view()),
    path('superadmin/holidays/', HolidayListView.as_view()),
    path('holidays/create/', HolidayCreateView.as_view()),
 
    # Leave Types
    path('superadmin/leave-types/', LeaveTypeListView.as_view(), name='leave-list'),
    path('superadmin/leave-types/create/', LeaveTypeCreateView.as_view(), name='leave-create'),
    path('superadmin/leave-types/<int:pk>/', LeaveTypeUpdateView.as_view(), name='leave-update'),

    # for employee
    path("leaves/", LeaveRequestListCreateView.as_view(), name="leave-requests"),
    path("approvals/leaves/<int:pk>/", LeaveRequestUpdateView.as_view()),

    #admin
    path("all-requests/", AllRequestsListCreateView.as_view()),
    path("admin/leaves/", AdminLeaveRequestListView.as_view(), name="admin-leave-requests"),
    path("admin/leaves/<int:pk>/status/", admin_update_leave_status, name="admin-leave-update-status"),
    
    # Commission Types
    path("superadmin/commission-types/", CommissionTypeListView.as_view(), name="commission-type-list",),
    path("superadmin/commission-types/create/", CommissionTypeCreateView.as_view(), name="commission-type-create",),
    path("superadmin/commission-types/<int:pk>/", CommissionTypeUpdateView.as_view(), name="commission-type-update",),

    #Allowance Type
    path("allowance-type/add/", AllowanceTypeCreateView.as_view()),
    path("allowance-type/", AllowanceTypeListView.as_view()),
    path("allowance-type/<int:pk>/", AllowanceTypeUpdateView.as_view()),
    

]
