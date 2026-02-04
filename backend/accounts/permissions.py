# accounts/permissions.py
from rest_framework.permissions import BasePermission

class IsRole(BasePermission):
    """
    Role-based permission.

    Usage:
        class SomeView(viewsets.ModelViewSet):
            permission_classes = [IsAuthenticated, IsRole]
            allowed_roles = ['SUPER_ADMIN', 'ADMIN']  # roles allowed to access this view
    """

    def has_permission(self, request, view):
        # must be authenticated
        if not request.user or not request.user.is_authenticated:
            return False

        # get allowed roles from view
        allowed_roles = getattr(view, "allowed_roles", None)

        # if no roles defined, allow any authenticated user
        if not allowed_roles:
            return True

        # check if user's role is in allowed roles
        return request.user.role in allowed_roles
