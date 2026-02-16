from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from shared_model.models import *

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response({
        "user_name": user.user_name,
        "role": user.role,
    })

@api_view(["GET"])
@permission_classes([AllowAny])
def first_superadmin_check(request):
    """
    Returns whether there are users in the DB and whether a SUPER_ADMIN exists
    ignoring Django superusers created via manage.py createsuperuser.
    """
    total_users = User.objects.filter(is_superuser=False).count()

    super_admin_exists = User.objects.filter(
        role="SUPER_ADMIN",
        is_superuser=False  # <-- ignore Django superusers
    ).exists()

    return Response({
        "total_users": total_users,
        "super_admin_exists": super_admin_exists,
    })