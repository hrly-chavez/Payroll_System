from django.urls import path
from .views import *

urlpatterns = [
    path('', NotificationListView.as_view()),
    path('unread-count/', UnreadCountView.as_view()),
    path('mark-all-read/', MarkAllReadView.as_view()),
    path('<int:pk>/mark-read/', MarkSingleReadView.as_view()),
    path('<int:pk>/', DeleteNotificationView.as_view()),
]
