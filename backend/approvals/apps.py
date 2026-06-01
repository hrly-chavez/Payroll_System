from django.apps import AppConfig


class ApprovalsConfig(AppConfig):

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'approvals'
    def ready(self):
        from approvals.services.holiday_services import (
            auto_generate_next_year_holidays
        )

        try:
            auto_generate_next_year_holidays()
        except Exception:
            # Database may not be available during build-time commands
            # (e.g., collectstatic). This is safe to skip — holidays
            # will be generated on the next runtime startup.
            pass
