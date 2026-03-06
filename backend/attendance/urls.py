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
    path("super_admin/overtime/pending/", SuperAdminPendingOvertimeView.as_view(), name="superadmin-overtime-pending"),
    path("super_admin/overtime/<int:pk>/status/",SuperAdminOvertimeStatusView.as_view(),name="superadmin-overtime-status",),
    path("shifts/", ShiftListCreateView.as_view(), name="shift-list-create"),
    path("shifts/<int:pk>/", ShiftRetrieveUpdateDestroyView.as_view(), name="shift-detail"),    
    # Attendance Correction (Employee)
    path("corrections/", EmployeeAttendanceCorrectionCreateView.as_view(), name="attendance-correction-create"),
    path("corrections/my/", EmployeeAttendanceCorrectionListView.as_view(), name="attendance-correction-my"),
    path("corrections/meta/", AttendanceCorrectionMetaView.as_view(), name="attendance-correction-meta"),

    # Attendance Correction (Admin/HR)
    path("admin/corrections/pending/", AdminPendingAttendanceCorrectionsView.as_view(), name="attendance-correction-admin-pending"),
    path("admin/corrections/<int:pk>/", AdminAttendanceCorrectionDetailView.as_view(), name="attendance-correction-admin-detail"),
    path("admin/corrections/<int:pk>/review/", AdminReviewAttendanceCorrectionView.as_view(), name="attendance-correction-admin-review"),
    path("admin/corrections/<int:pk>/apply/", AdminApplyAttendanceCorrectionView.as_view(), name="attendance-correction-admin-apply"),
    #Pie Chart Display
    path("stats/", AttendanceStatsView.as_view(), name="attendance-stats"),
    path("admin/stats/", AttendanceAdminMonthlyStatsView.as_view(), name="attendance-admin-stats"),
    path("attendance/admin/stats/", AttendanceAdminMonthlyStatsView.as_view()),

    # Bar Chart Analytics (Day/Week/Month/Year)
    path("admin/analytics/", AttendanceAdminAnalyticsView.as_view(), name="attendance-admin-analytics"),
    path("super_admin/analytics/", AttendanceAdminAnalyticsView.as_view(), name="attendance-super_admin-analytics"),

    #pdf generation
    path("attendance-logs/pdf/", AttendanceLogsPDFView.as_view(), name="attendance_logs_pdf"),
    path("attendance-logs/employees/dropdown/", AttendanceEmployeesDropdownView.as_view(), name="attendance_logs_employee_dropdown"),
    path("attendance-logs/", AttendanceLogsView.as_view(), name="attendance_logs"),
]
