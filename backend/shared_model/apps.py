from django.apps import AppConfig


class SharedModelConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'shared_model'

    def ready(self):
        import shared_model.signals
