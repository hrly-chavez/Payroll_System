from django.urls import path
from .views import *
from . import views

urlpatterns = [
    path("me/", me),
    path("first-superadmin-check/", views.first_superadmin_check),  # <-- new endpoint
    path("login/", CookieTokenObtainPairView.as_view(), name="login"),
    path("logout/", logout_view, name="logout"),
]
