from django.db import models
from django.contrib.auth.hashers import make_password, check_password

class User(models.Model):

    ROLE_CHOICES = (
        ('EMPLOYEE', 'Employee'),
        ('ADMIN', 'Admin'),
        ('SUPER_ADMIN', 'Super Admin'),
    )

    user_id = models.AutoField(primary_key=True)
    user_name = models.CharField(max_length=150, unique=True)
    user_password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='EMPLOYEE')
    is_active = models.BooleanField(default=True)

    # Temporary field (no FK yet)
    emp_id = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def set_password(self, raw_password):
        self.user_password = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.user_password)
    
    def save(self, *args, **kwargs):
        if self.user_password and not self.user_password.startswith("pbkdf2_"):
            self.set_password(self.user_password)
        super().save(*args, **kwargs)


    def __str__(self):
        return f"{self.user_name} ({self.role})"

    class Meta:
        db_table = 'users'
