from .current_user import set_current_user, clear_current_user

class CurrentUserMiddleware:
    """
    Store current authenticated user in thread-local storage.
    Works for Django Admin and DRF.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):

        # Set user before view executes
        if hasattr(request, "user"):
            set_current_user(request.user)

        response = self.get_response(request)

        # Clear after request finishes (very important)
        clear_current_user()

        return response
