from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.forms.models import model_to_dict
from .models import AuditLog, Employee, Employee_Salary, Employee_Deduction, Employee_Allowance, User
from .middleware import get_current_user
import json

_old_values = {}

def serialize_instance(instance):
    """Serialize model instance to dict."""
    from django.core.serializers.json import DjangoJSONEncoder
    data = model_to_dict(instance)
    data["id"] = instance.pk
    return json.loads(json.dumps(data, cls=DjangoJSONEncoder))

@receiver(pre_save)
def store_old_data(sender, instance, **kwargs):
    if not instance.pk or sender == AuditLog:
        return
    try:
        old_instance = sender.objects.get(pk=instance.pk)
        _old_values[instance.pk] = serialize_instance(old_instance)
    except sender.DoesNotExist:
        pass

def safe_get_user():
    """Return the current user or None if anonymous."""
    try:
        user = get_current_user()
        if not user or user.is_anonymous:
            return None
        return user
    except Exception:
        return None

def create_audit_log(instance, action, old_data=None, new_data=None):
    """Helper to create audit logs."""
    AuditLog.objects.create(
        user=safe_get_user(),
        action=action,
        model_name=instance.__class__.__name__,
        object_id=str(instance.pk),
        old_data=old_data,
        new_data=new_data
    )

@receiver(post_save)
def log_save(sender, instance, created, **kwargs):
    if sender == AuditLog:
        return

    old_data = _old_values.get(instance.pk, {}) if not created else {}
    new_data = serialize_instance(instance)

    if created:
        # For CREATE, set both old_data and new_data to blank
        create_audit_log(instance, action="CREATE", old_data="", new_data="")
    else:
        # UPDATE: only store changed fields
        changed_fields = {}
        for field, new_value in new_data.items():
            old_value = old_data.get(field)
            if old_value != new_value:
                changed_fields[field] = {"old": old_value, "new": new_value}

        if changed_fields:
            old_str = ", ".join([f'{k}: "{v["old"]}"' for k, v in changed_fields.items()])
            new_str = ", ".join([f'{k}: "{v["new"]}"' for k, v in changed_fields.items()])
            create_audit_log(instance, action="UPDATE", old_data=old_str, new_data=new_str)


@receiver(post_delete)
def log_delete(sender, instance, **kwargs):
    if sender == AuditLog:
        return
    # DELETE: store None for old/new
    create_audit_log(instance, action="DELETE", old_data=None, new_data=None)
