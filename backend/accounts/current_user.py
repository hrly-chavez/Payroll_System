# utils/current_user.py
import threading

_user_ctx = threading.local()

def set_current_user(user):
    _user_ctx.user = user

def get_current_user():
    return getattr(_user_ctx, "user", None)
