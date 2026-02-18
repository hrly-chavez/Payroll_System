from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Notification(models.Model):
    CATEGORY_CHOICES = [
        ('leave', 'Leave'),
        ('attendance', 'Attendance'),
        ('holiday', 'Holiday'),
        ('payroll', 'Payroll'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    is_read = models.BooleanField(default=False)
    redirect_url = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.title}"
