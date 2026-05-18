from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from shared_model.models import *
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from django.conf import settings

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    try:
        user = request.user

        return Response({
            "user_id": str(user.user_id),
            "user_name": str(user.user_name),
            "role": str(user.role),
        })

    except Exception as e:
        return Response({
            "error": str(e),
            "user_type": str(type(request.user)),
        }, status=500)

#this is for login endpoint
class CookieTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        access = serializer.validated_data["access"]
        refresh = serializer.validated_data["refresh"]

        user = serializer.user

        res = Response({
            "message": "Login successful",
            "user_name": user.user_name,
            "role": user.role,
        }, status=status.HTTP_200_OK)

        res.set_cookie(
            key="access_token",
            value=access,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
        )

        res.set_cookie(
            key="refresh_token",
            value=refresh,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
        )

        return res

class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        # Get refresh token from cookie
        refresh_token = request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response({"detail": "Refresh token missing"}, status=status.HTTP_400_BAD_REQUEST)

        # Pass the refresh token to the serializer directly
        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)

        access = serializer.validated_data.get("access")
        refresh = serializer.validated_data.get("refresh")  # Only if ROTATE_REFRESH_TOKENS=True

        # Return cookies instead of JSON
        res = Response({"message": "Token refreshed"}, status=status.HTTP_200_OK)
        res.set_cookie(
            key="access_token",
            value=access,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
        )

        if refresh:
            res.set_cookie(
                key="refresh_token",
                value=refresh,
                httponly=True,
                secure=not settings.DEBUG,
                samesite="Lax",
            )

        return res

#this is for logout
@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    refresh_token = request.COOKIES.get("refresh_token")
    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()  # This revokes it
        except Exception:
            pass

    response = Response({"message": "Logged out successfully"})
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return response

#checking if there is an existing superadmin or user
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