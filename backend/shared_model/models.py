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

# Create your models here.
class Department(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    created_at = models.DateField(auto_now_add=True)
    shift_id = models.ForeignKey("Shift", on_delete=models.PROTECT,related_name="departments")

class Shift(models.Model):
    id = models.AutoField(primary_key=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=0)
    grace_minutes = models.PositiveIntegerField(default=0)
    is_overnight = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

class Shift_Workday(models.Model):
    DAYS_OF_WEEK = [
        ("SAT","Saturday"),
        ("MON","Monday"),
        ("TUE","Tuesday"),
        ("WED","Wednesday"),
        ("THUR","Thursday"),
        ("FRI","Friday"),
        ("SUN","Sunday"),
    ]
    id = models.AutoField(primary_key=True)
    day_of_week = models.CharField(max_length=10,choices=DAYS_OF_WEEK)
    is_workday = models.BooleanField(default=True)
    created_at = models.DateField(auto_now_add=True)
    shift_id = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name="workdays")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["shift", "day_of_week"],
                name="unique_shift_day"
            )
        ]

class Employee(models.Model):
    EMP_STATUS = [
    ("SINGLE", "Single"),
    ("MARRIED", "Married"),
    ("WIDOWED", "Widowed"),
    ("SEPARATED", "Separated"),
    ]

    id = models.AutoField(primary_key=True)
    id_no = models.CharField()
    fname = models.CharField(max_length=50)
    lname = models.CharField(max_length=50)
    initial = models.CharField(max_length=1)
    suffix = models.CharField(max_length=20)
    status = models.CharField(max_length=15, choices=EMP_STATUS)
    address = models.TextField()
    contact_no = models.CharField(max_length=12)
    hired_date = models.DateField()
    position = models.CharField(max_length=20)
    bank_info = models.CharField(max_length=50)
    email = models.CharField(max_length=50)
    created_at = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    shift = models.ForeignKey( Shift, on_delete=models.PROTECT,related_name="employees")
    department = models.ForeignKey( Department,on_delete=models.PROTECT,related_name="employees")


    

    
