from django.urls import path
from .views import HolidayListView, HolidayUpdateStatusView
urlpatterns = [
    path('superadmin/holiday/<int:pk>/status/', HolidayUpdateStatusView.as_view(), name='holiday-update-status'),
    path('superadmin/holidays/',HolidayListView.as_view(),name='holidays-list'),



]
