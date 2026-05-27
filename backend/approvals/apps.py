from django.apps import AppConfig


class ApprovalsConfig(AppConfig):

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'approvals'
    def ready(self):
        from approvals.services.holiday_services import (
            auto_generate_next_year_holidays
        )

        auto_generate_next_year_holidays()
