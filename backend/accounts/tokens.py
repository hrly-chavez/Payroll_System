from django.contrib.auth.tokens import PasswordResetTokenGenerator
from datetime import timedelta, datetime, timezone
from django.utils.http import base36_to_int
from django.utils import timezone as dj_timezone


class ShortLivedTokenGenerator(PasswordResetTokenGenerator):

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.password}{timestamp}"

    def check_token(self, user, token):
        if not (user and token):
            return False

        # Run Django default validation first
        if not super().check_token(user, token):
            return False

        try:
            ts_b36 = token.split("-")[1]
            ts_int = base36_to_int(ts_b36)
        except Exception:
            return False

        # Correct timestamp calculation
        token_time = datetime(2001, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=ts_int)

        # Expire after 5 minutes
        if dj_timezone.now() > token_time + timedelta(minutes=5):
            return False

        return True


short_lived_token_generator = ShortLivedTokenGenerator()