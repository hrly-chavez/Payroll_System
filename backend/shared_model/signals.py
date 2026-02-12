from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.forms.models import model_to_dict
from django.core.serializers.json import DjangoJSONEncoder
from .models import AuditLog
import json

_old_values = {}

def serialize_instance(instance):
    """Serialize model instance to dict."""
    data = model_to_dict(instance)
    data["id"] = instance.pk
    return json.loads(json.dumps(data, cls=DjangoJSONEncoder))

@receiver(pre_save)
def store_old_data(sender, instance, **kwargs):
    """Store old data before updating."""
    if sender == AuditLog:
        return
    if instance.pk:
        try:
            old_instance = sender.objects.get(pk=instance.pk)
            _old_values[(sender, instance.pk)] = serialize_instance(old_instance)
        except sender.DoesNotExist:
            pass

def get_instance_user(instance):
    """Return the manually attached _current_user from the view if available."""
    user = getattr(instance, "_current_user", None)
    if user:
        print(f"[DEBUG] _current_user found on {instance}: {user.user_name} ({user.role})")
    else:
        print(f"[DEBUG] No _current_user on {instance}")
    if user and user.is_authenticated:
        return user
    return None

def create_audit_log(instance, action, old_data=None, new_data=None):
    """Helper to create audit logs with optional data."""
    user = get_instance_user(instance)
    print(f"[DEBUG] Creating AuditLog for {instance} | Action: {action} | User: {user}")
    AuditLog.objects.create(
        user=user,
        action=action,
        model_name=instance.__class__.__name__,
        object_id=str(instance.pk),
        old_data=old_data,
        new_data=new_data,
    )

@receiver(post_save)
def log_save(sender, instance, created, **kwargs):
    """Log CREATE or UPDATE actions."""
    if sender == AuditLog:
        return

    old_data = _old_values.get((sender, instance.pk), {}) if not created else {}
    new_data = serialize_instance(instance)
    user = get_instance_user(instance)

    if created:
        # CREATE: old/new data is blank
        create_audit_log(instance, action="CREATE", old_data="", new_data="")
    else:
        # UPDATE: log only changed fields
        changed_fields = {}
        for field, new_value in new_data.items():
            old_value = old_data.get(field)
            if old_value != new_value:
                changed_fields[field] = {"old": old_value, "new": new_value}

        if changed_fields:
            old_str = {k: v["old"] for k, v in changed_fields.items()}
            new_str = {k: v["new"] for k, v in changed_fields.items()}
            create_audit_log(instance, action="UPDATE", old_data=old_str, new_data=new_str)

@receiver(post_delete)
def log_delete(sender, instance, **kwargs):
    """Log DELETE actions: old/new data is None."""
    if sender == AuditLog:
        return
    create_audit_log(instance, action="DELETE", old_data=None, new_data=None)
