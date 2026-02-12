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

    path("leaves/", LeaveRequestListCreateView.as_view(), name="leave-request"),

    # Commission Types
    path("superadmin/commission-types/", CommissionTypeListView.as_view(), name="commission-type-list",),
    path("superadmin/commission-types/create/", CommissionTypeCreateView.as_view(), name="commission-type-create",),
    path("superadmin/commission-types/<int:pk>/", CommissionTypeUpdateView.as_view(), name="commission-type-update",),
    

]
