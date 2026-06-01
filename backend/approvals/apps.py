from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class ApprovalsConfig(AppConfig):

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'approvals'

    def ready(self):
        try:
            from approvals.services.holiday_services import (
                auto_generate_next_year_holidays
            )

            auto_generate_next_year_holidays()

        except Exception as e:
            logger.warning(
                f"Skipping holiday auto-generation during startup: {e}"
            )