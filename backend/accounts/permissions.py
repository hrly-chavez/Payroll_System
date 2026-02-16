from rest_framework.permissions import BasePermission

class IsRole(BasePermission):

    def has_permission(self, request, view):

        # Handle ViewSet public actions safely
        public_actions = getattr(view, "public_actions", [])
        action = getattr(view, "action", None)

        if action and action in public_actions:
            return True

        # Must be authenticated beyond this point
        if not request.user or not request.user.is_authenticated:
            return False

        allowed_roles = getattr(view, "allowed_roles", None)

        if not allowed_roles:
            return True

        return request.user.role in allowed_roles