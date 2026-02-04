from django.urls import path
from .views import HolidayListView, HolidayUpdateStatusView, HolidayCreateView
urlpatterns = [
    path('superadmin/holidays/<int:pk>/status/', HolidayUpdateStatusView.as_view(), name='holiday-update-status'),
    path('holidays/', HolidayListView.as_view()),
    path('superadmin/holidays/', HolidayListView.as_view()),
    path('holidays/create/', HolidayCreateView.as_view()),

]
