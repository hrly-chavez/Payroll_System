from django.urls import path
from .views import *

urlpatterns = [
    path("punch-in/", PunchInView.as_view(), name="attendance-punch-in"),
    path("punch-out/", PunchOutView.as_view(), name="attendance-punch-out"),
    path("today/", TodayAttendanceView.as_view(), name="attendance-today"),
]
