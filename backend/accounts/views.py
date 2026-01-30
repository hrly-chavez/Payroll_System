from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from shared_model.models import *


@api_view(['POST'])
def login_view(request):
    username = request.data.get('user_name')
    password = request.data.get('user_password')

    if not username or not password:
        return Response(
            {"error": "Username and password are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = User.objects.get(user_name=username)
    except User.DoesNotExist:
        return Response(
            {"error": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not user.is_active:
        return Response(
            {"error": "Account is disabled"},
            status=status.HTTP_403_FORBIDDEN
        )

    if not user.check_password(password):
        return Response(
            {"error": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # Role-based redirect path
    redirect_map = {
        'EMPLOYEE': '/employee_dashboard',
        'ADMIN': '/admin/dashboard',
        'SUPER_ADMIN': '/super-admin/dashboard',
    }

    redirect_path = redirect_map.get(user.role, '/login')

    return Response(
        {
            "message": "Login successful",
            "user": {
                "user_id": user.user_id,
                "user_name": user.user_name,
                "role": user.role,
            },
            "redirect_to": redirect_path,
        },
        status=status.HTTP_200_OK
    )
