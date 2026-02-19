from django.urls import path
from .views import *

urlpatterns = [
    path("punch-in/", PunchInView.as_view(), name="attendance-punch-in"),
    path("punch-in-eligibility/", PunchInEligibilityView.as_view(), name="attendance-punch-in-eligibility"),
    path("punch-out/", PunchOutView.as_view(), name="attendance-punch-out"),
    path("today/", TodayAttendanceView.as_view(), name="attendance-today"),
    path("logs/", AttendanceLogsView.as_view(), name="attendance-logs"),
    path("admin/logs/", CEOandHRAttendanceLogsView.as_view(), name="attendance-admin-logs"),
    path("super_admin/logs/", CEOandHRAttendanceLogsView.as_view(), name="attendance-super_admin-logs"),
    path("shifts/", ShiftListCreateView.as_view(), name="shift-list-create"),
    path("shifts/<int:pk>/", ShiftRetrieveUpdateDestroyView.as_view(), name="shift-detail"),
]
