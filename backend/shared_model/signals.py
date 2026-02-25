from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.forms.models import model_to_dict
from django.core.serializers.json import DjangoJSONEncoder
from .models import AuditLog, Notification, Province, City, Barangay, Holiday
from accounts.current_user import get_current_user
import json
from django.db.models.fields.files import FieldFile
_old_values = {}

def serialize_instance(instance):
    """Serialize model instance to dict (FileField-safe)."""
    data = model_to_dict(instance)
    data["id"] = instance.pk

    # Convert FileFields (FieldFile) into JSON-serializable values
    for k, v in list(data.items()):
        if isinstance(v, FieldFile):
            data[k] = v.name if v else None  # store file path string

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
    
    if hasattr(instance, "user") and instance.user:
        return instance.user
    return None


from django.apps import apps
from django.db import connection

def auditlog_table_exists():
    try:
        return "shared_model_auditlog" in connection.introspection.table_names()
    except Exception:
        return False

def create_audit_log(instance, action, old_data=None, new_data=None):
    #  Don’t log during migrate until table exists
    if not auditlog_table_exists():
        return

    user = get_instance_user(instance)
    AuditLog = apps.get_model("shared_model", "AuditLog")

    AuditLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
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
    
    if sender in [AuditLog, Notification, Province, City, Barangay, Holiday]:
        return

    # Skip if manually set
    if getattr(instance, "_skip_audit_log", False):
        return

    old_data = _old_values.get((sender, instance.pk), {}) if not created else {}
    new_data = serialize_instance(instance)
    user = get_instance_user(instance)

    if created:
        # CREATE: old/new data is blank
        create_audit_log(instance, action="CREATE", old_data={}, new_data=new_data)
    else:
        # UPDATE: log only changed fields
        changed_fields = {}
        # Fields we never want to log
        EXCLUDED_FIELDS = ["password", "last_login"]
        for field, new_value in new_data.items():

            # Skip sensitive fields
            if field in EXCLUDED_FIELDS:
                continue

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
    
    if sender in [AuditLog, Notification, Province, City, Barangay, Holiday]:
        return

    # Skip if manually set
    if getattr(instance, "_skip_audit_log", False):
        return
    create_audit_log(instance, action="DELETE", old_data=None, new_data=None)
