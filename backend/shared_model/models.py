
from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
import uuid, re
from datetime import datetime


class Province(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class City(models.Model):
    name = models.CharField(max_length=100)
    province = models.ForeignKey(Province, on_delete=models.PROTECT, related_name="cities")
    def __str__(self):
        return f"{self.name} {self.province.name}"

class Barangay(models.Model):
    name = models.CharField(max_length=100)
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="barangays")

    def __str__(self):
        return f"{self.name} {self.city.name}"
class Address(models.Model):
    province = models.ForeignKey(Province, on_delete=models.PROTECT, related_name="addresses")
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="addresses")
    barangay = models.ForeignKey(Barangay, on_delete=models.PROTECT, related_name="addresses")
    street = models.CharField(max_length=255, blank=True, null=True)
    sitio = models.CharField(max_length=255, blank=True, null=True)
    zip_code = models.CharField(max_length=10, blank=True, null=True)

    def __str__(self):
        return f"{self.province.name} - {self.city.name} - {self.barangay.name}"
class Department(models.Model):
    
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    created_at = models.DateField(auto_now_add=True)
    shift_id = models.ForeignKey("Shift", on_delete=models.SET_NULL,related_name="departments",null=True,blank=True)
   
    
    def __str__(self):
        return self.name

class Shift(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=0)
    grace_minutes = models.PositiveIntegerField(default=0, help_text="Minutes allowed before counting as late/undertime, depending on rules.")
    is_overnight = models.BooleanField(default=False,help_text="Business label only: check if this is considered a night/graveyard schedule (e.g., 00:00–09:00 or 22:00–06:00).")
    crosses_midnight = models.BooleanField(default=False,
        help_text="Technical: check ONLY if the shift ends the next day (end_time earlier than start_time), e.g., 22:00–06:00.")
    is_active = models.BooleanField(default=True)

    def clean(self):
        # Validate cross-midnight time logic
        if self.crosses_midnight:
            # Example: 22:00 -> 06:00 (end <= start)
            if self.end_time > self.start_time:
                raise ValidationError({
                    "end_time": "For cross-midnight shifts, end_time must be earlier than or equal to start_time (e.g., 22:00 to 06:00)."
                })
        else:
            # Example: 00:00 -> 09:00 (end > start)
            if self.end_time <= self.start_time:
                raise ValidationError({
                    "end_time": "For non-cross-midnight shifts, end_time must be later than start_time (e.g., 08:00 to 17:00)."
                })

    def save(self, *args, **kwargs):
        # Ensure admin/UI validation always runs
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Shift_Workday(models.Model):

    class DayOfWeek(models.IntegerChoices):
        MONDAY = 1, "Monday"
        TUESDAY = 2, "Tuesday"
        WEDNESDAY = 3, "Wednesday"
        THURSDAY = 4, "Thursday"
        FRIDAY = 5, "Friday"
        SATURDAY = 6, "Saturday"
        SUNDAY = 7, "Sunday"

    id = models.AutoField(primary_key=True)
    day_of_week = models.PositiveSmallIntegerField(choices=DayOfWeek.choices)
    is_workday = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    shift = models.ForeignKey(Shift,on_delete=models.CASCADE,related_name="workdays")
    
    def __str__(self):
        return f"{self.shift.name} - {self.get_day_of_week_display()} ({'Workday' if self.is_workday else 'Off'})"
    
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

    EMPLOYMENT_STATUS_CHOICES = [
        ("REGULAR", "Regular"),
        ("PROBATION", "Probation"),
        ("NEW_HIRE", "New Hire"),
        ("OJT", "OJT"),
    ]

    profile_picture = models.ImageField(
        upload_to="employees/",  # This will save files in MEDIA_ROOT/employees/
        null=True,
        blank=True
    )

    id = models.AutoField(primary_key=True)
    id_no = models.CharField(max_length=50,unique=True,null=True,blank=True)
    fname = models.CharField(max_length=50)
    lname = models.CharField(max_length=50)
    initial = models.CharField(max_length=1,null=True,blank=True)
    suffix = models.CharField(max_length=20,null=True,blank=True)
    status = models.CharField(max_length=15, choices=EMP_STATUS,default="Single")
    employment_status = models.CharField(max_length=20,choices=EMPLOYMENT_STATUS_CHOICES,default="NEW_HIRE")
    address = models.ForeignKey(Address, on_delete=models.CASCADE, null=True, blank=True, related_name="residents")
    contact_no = models.CharField(max_length=12)
    hired_date = models.DateField()
    position = models.CharField(max_length=20)
    bank_info = models.CharField(max_length=50,null=True,blank=True)
    email = models.CharField(max_length=50, unique=True)
    created_at = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    shift = models.ForeignKey( Shift, on_delete=models.SET_NULL,related_name="employees",null=True,blank=True)
    department = models.ForeignKey( Department,on_delete=models.PROTECT,related_name="employees",null=True,blank=True)
    
    def __str__(self):
        return f"{self.fname} {self.lname}"

    def save(self, *args, **kwargs):
        if not self.id_no:
            last_employee = Employee.objects.filter(id_no__isnull=False).order_by("-id").first()

            if last_employee and last_employee.id_no:
                # Extract number from last ID (e.g., EMP-0005 → 5)
                match = re.search(r"(\d+)$", last_employee.id_no)
                if match:
                    last_number = int(match.group(1))
                    new_number = last_number + 1
                else:
                    new_number = 1
            else:
                new_number = 1

            year = datetime.now().year
            self.id_no = f"EMP-{year}-{new_number:04d}" # EMP-year-0001 format

        super().save(*args, **kwargs)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["email"],
                condition=models.Q(is_active=True),
                name="unique_active_employee_email"
            )
        ]
    
class UserManager(BaseUserManager):
    #Mao ni ang makita na UI sa django-admin kung mag og User
    def create_user(self, user_name, password=None, role="EMPLOYEE", **extra_fields):
        if not user_name:
            raise ValueError("user_name is required")

        user = self.model(user_name=user_name, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, user_name, password=None, **extra_fields):
        user = self.create_user(user_name=user_name, password=password, role="SUPER_ADMIN", **extra_fields)
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True  # CRUCIAL
        user.save(using=self._db)
        return user

class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ('EMPLOYEE', 'Employee'),
        ('ADMIN', 'Admin'),
        ('SUPER_ADMIN', 'Super Admin'),
    )

    STATUS_CHOICES = (
        ("ACTIVE", "Active"),
        ("INACTIVE", "Inactive")
    )

    user_id = models.AutoField(primary_key=True)
    user_name = models.CharField(max_length=150, unique=True)

    # IMPORTANT: Django expects field name "password"
    password = models.CharField(max_length=128)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='EMPLOYEE')
    is_active = models.BooleanField(default=True)
    user_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ACTIVE")
    is_staff = models.BooleanField(default=False)

    employee = models.OneToOneField(
        "shared_model.Employee",
        on_delete=models.CASCADE,
        related_name="user",
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "user_name"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"

    def __str__(self):
        return f"{self.user_name} ({self.role})"
    
class PayrollMinimumSetting(models.Model): #minimum wage
    id = models.AutoField(primary_key=True)

    # Minimum daily wage (for example, in PHP)
    daily_minimum_wage = models.DecimalField(max_digits=10, decimal_places=2, default=500)

    # You can add other types like monthly/hourly minimums if needed later
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Minimum Wage: {self.daily_minimum_wage}"
        
class Employee_Salary(models.Model):
    PAY_TYPES = [
        ("Monthly","Monthly"),
        ("Daily","Daily"),
        ("Hourly","Hourly"),
    ]

    WAGE_TYPES = [
        ("MINIMUM", "Minimum Wage"),
        ("ABOVE_MINIMUM", "Above Minimum Wage"),
    ]

    id = models.AutoField(primary_key=True)
    pay_type =  models.CharField(max_length=20, choices=PAY_TYPES)
    #per_day = models.IntegerField()
    base_rate = models.DecimalField(max_digits=12, decimal_places=2)
    wage_type = models.CharField(max_length=20, choices=WAGE_TYPES, default="ABOVE_MINIMUM", help_text="Indicates if employee is minimum wage or above minimum wage")
    effective_from = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True,null=True,
    blank=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="salaries")

    def __str__(self):
        return f"{self.pay_type} {self.base_rate}"
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "effective_from"],
                name="unique_salary_start_per_employee"
            )
        ]
       
class Deduction_Type(models.Model):
   
#     DEDUCTIONS
#   Government Deductions
#     - SSS
#     - Pag-IBIG
#     - PhilHealth

#   Other Deductions
#     - Company Loan
#     - Cash Advance
    calculation_choices = [
            ("Fixed","Fixed"),
            ("Percent","Percent"),
        ]

    CATEGORY_CHOICES = [
        ("TAX", "Tax / Government Mandatory"),
        ("OTHER", "Other Deduction"),
    ]
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=100 )
    category = models.CharField(max_length=10,choices=CATEGORY_CHOICES,default="TAX",help_text="Used to classify deductions (e.g., TAX vs OTHER)")
    salary_range_from = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    salary_range_to = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    calculation_type = models.CharField(max_length=20, choices=calculation_choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)
    create_at = models.DateField(auto_now_add=True)

    def __str__(self):
        return self.code  

class Employee_Deduction(models.Model):
    frequency_choices = [
        ("Monthly","Monthly"),
        ("Per Period","Per Period"),
        ("One Time","One Time"),
    ]
    status_choices = [
        ("Active","Active"),
        ("Inactive","Inactive"),
    ]
    id = models.AutoField(primary_key=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    frequency = models.CharField(max_length=20, choices=frequency_choices)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True,blank=True)
    status = models.CharField(max_length=15, choices=status_choices)
    created_at = models.DateField(auto_now_add=True)

    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="deductions")
    deduction_type = models.ForeignKey(Deduction_Type,on_delete=models.PROTECT,related_name="employee_deductions", null=True, blank=True) 

    def __str__(self):
        return f"{self.amount} {self.deduction_type}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "deduction_type", "effective_from"],
                name="unique_employee_deduction_start"
            )
        ]

class Allowance_Type(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50, unique=True)
    code = models.CharField(max_length=10, null=True, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateField(default=timezone.now)
    code = models.CharField(max_length=10, null=True, blank=True, default="")

    def __str__(self):
        return self.name

class Employee_Allowance(models.Model):
    frequency_choices = [
        ("Monthly","Monthly"),
        ("Per Period","Per Period"),
        ("One Time","One Time"),
        ("Per Day","Per Day"),
    ]
    status_choices = [
        ("Active","Active"),
        ("Inactive","Inactive"),
    ]

    id = models.AutoField(primary_key=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    frequency = models.CharField(max_length=20, choices=frequency_choices)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True,blank=True)
    status = models.CharField(max_length=15, choices=status_choices)
    created_at = models.DateField(auto_now_add=True)
    allowance_type = models.ForeignKey(Allowance_Type,on_delete=models.PROTECT,related_name="employee_allowances")
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="allowances")

    def __str__(self):
        return f"{self.amount} {self.allowance_type}"
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "allowance_type", "effective_from"],
                name="unique_employee_allowance_start"
            )
        ]

class Commission_Type(models.Model):

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50, unique=True)
    is_taxable = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name

class Holiday(models.Model):
    holiday_types = [
        ("Regular","Regular"),
        ("Special Non-Working","Special Non-Working"),
        ("Special Working","Special Working"),
        ("Company Holiday","Company Holiday"),
    ]
    HOLIDAY_BASE_CHOICES = [
        ("PH", "Philippines"),
        ("US", "United States"),
        ("COMPANY", "Company"),
    ]
    
    id = models.AutoField(primary_key=True)
    date = models.DateField()
    name = models.CharField(max_length=50)
    type = models.CharField(max_length=50, choices=holiday_types)
    base = models.CharField(max_length=20,choices=HOLIDAY_BASE_CHOICES, null=True, blank=True)
    remarks = models.TextField(null=True,blank=True)
    status = models.CharField(max_length=20,choices=[("Pending","Pending"),("Approved","Approved"),("Declined","Declined")],default="Pending")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return f"{self.date} - {self.name} type {self.type}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["date", "base"],
                name="unique_holiday_per_base_per_date"
            )
        ]

class HolidayPolicy(models.Model):
    HOLIDAY_BASE_CHOICES = [
        ("PH", "Philippines"),
        ("US", "United States"),
        ("COMPANY", "Company"),
    ]
    HOLIDAY_TYPES = [
        ("Regular", "Regular"),
        ("Special Non-Working", "Special Non-Working"),
        ("Special Working", "Special Working"),
        ("Company Holiday", "Company Holiday"),
    ]

    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    base = models.CharField(max_length=20, choices=HOLIDAY_BASE_CHOICES, null=True, blank=True)
    holiday_type = models.CharField(max_length=50, choices=HOLIDAY_TYPES)
    requires_work = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    def clean(self):
        ok = DepartmentHolidayCalendar.objects.filter(
            department=self.department,
            base=self.base,
            is_active=True
        ).exists()
        if not ok:
            raise ValidationError({"base": "This base is not active for the selected department."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["department", "base", "holiday_type"],
                name="unique_holiday_policy_per_dept_base_type"
            )
        ]

class DepartmentHolidayCalendar(models.Model):
    HOLIDAY_BASE_CHOICES = [ ("PH", "Philippines"), ("US", "United States"), ("COMPANY", "Company"), ] 
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="holiday_calendars") 
    base = models.CharField(max_length=20, choices=HOLIDAY_BASE_CHOICES, null=True, blank=True) 
    is_active = models.BooleanField(default=True) 
    def __str__(self):
        return f"{self.department.name} - {self.get_base_display()}"
    class Meta: 
             constraints = [ 
                 models.UniqueConstraint(fields=["department", "base"],
                                          name="unique_dept_holiday_base") 
                                          ]
  

class Attendance(models.Model):
    STATUS_CHOICES = [
        ("PRESENT", "Present"),
        ("ABSENT", "Absent"),
        ("HALF_DAY", "Half Day"),
        ("REST_DAY", "Rest Day"),
        ("HOLIDAY", "Holiday"),
    ]
   
    id = models.AutoField(primary_key=True)
    date = models.DateField()
    status = models.CharField(max_length=20,choices=STATUS_CHOICES,default="PRESENT")
    time_in = models.DateTimeField(null=True, blank=True)
    time_out = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="attendances")

    def __str__(self):
        return f"{self.date} - {self.employee}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "date"],
                name="unique_attendance_per_employee_per_day"
            )
        ]
  
class Attendance_Event(models.Model): 
    TYPE_CHOICES = [
        ("Night Differential","Night Differential"),
        ("Late","Late"),
        ("Undertime","Undertime"),
        ("Overtime","Overtime"),
        ("Regular Holiday","Regular Holiday"),  
        ("Special Holiday","Special Holiday"),
        ("Special Non Working Holiday","Special Non Working Holiday"),
        ("Company Holiday","Company Holiday"),
        ("Absent","Absent"),
    ]
    APPROVAL_STATUS_CHOICES = [
        ("Pending","Pending"),
        ("Approved","Approved"),    
        ("Declined","Declined"),
    ]
    id = models.AutoField(primary_key=True)
    type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    minutes = models.PositiveIntegerField(default=0)
    start_time = models.TimeField(null=True,blank=True)
    end_time = models.TimeField(null=True,blank=True)
    approval_status = models.CharField(max_length=20,choices=APPROVAL_STATUS_CHOICES) 
    event_remarks = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="approved_attendance_events")
    attendance = models.ForeignKey(Attendance,on_delete=models.CASCADE,related_name="events")
    holiday = models.ForeignKey(Holiday, on_delete=models.SET_NULL, null=True, blank=True, related_name="attendance_events")

    def __str__(self):
        return self.type

class Excess_Time_Request(models.Model):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Approved", "Approved"),
        ("Declined", "Declined"),
    ]

    RESOLUTION_TYPE_CHOICES = [
        ("Overtime", "Overtime"),
        ("Offset", "Offset"),
    ]

    id = models.AutoField(primary_key=True)
    attendance = models.ForeignKey(Attendance,on_delete=models.CASCADE,related_name="excess_time_requests")
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="excess_time_requests")
    date = models.DateField(help_text="Work date / shift start date of the source attendance.")
    minutes = models.PositiveIntegerField(default=0)
    # Excess time window
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20,choices=STATUS_CHOICES,default="Pending")

    # Final resolution chosen by SuperAdmin:
    # Overtime / Offset / null (while still pending or declined before choosing)
    resolution_type = models.CharField(max_length=20,choices=RESOLUTION_TYPE_CHOICES,null=True,blank=True)
    remarks = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="approved_excess_time_requests")
    approved_at = models.DateTimeField(null=True, blank=True)
    declined_reason = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        constraints = [
            # One active excess-time request per attendance for now.
            # This keeps the source record unique and prevents duplicate auto-created pending requests.
            models.UniqueConstraint(
                fields=["attendance"],
                name="unique_excess_time_request_per_attendance"
            )
        ]

    def __str__(self):
        return f"{self.employee} - {self.date} - {self.minutes} min ({self.status})"

class Offset_Credit(models.Model):
    STATUS_CHOICES = [
        ("Active", "Active"),
        ("Used", "Used"),
        ("Expired", "Expired"),
    ]

    id = models.AutoField(primary_key=True)
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="offset_credits")
    source_request = models.OneToOneField(Excess_Time_Request,on_delete=models.CASCADE,related_name="offset_credit")
    attendance = models.ForeignKey(Attendance,on_delete=models.CASCADE,related_name="offset_credits")
    approved_minutes = models.PositiveIntegerField(default=0)
    used_minutes = models.PositiveIntegerField(default=0)
    remaining_minutes = models.PositiveIntegerField(default=0)

    # Next shift only:
    # this is the work_date where the offset may be consumed
    target_date = models.DateField()
    status = models.CharField(max_length=20,choices=STATUS_CHOICES,default="Active")
    approved_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="approved_offset_credits")
    approved_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    expired_at = models.DateTimeField(null=True, blank=True)
    remarks = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-target_date", "-created_at"]
        indexes = [
            models.Index(fields=["employee", "target_date", "status"]),
        ]

    def __str__(self):
        return f"{self.employee} - Offset {self.remaining_minutes}/{self.approved_minutes} min for {self.target_date}"

class Attendance_Correction(models.Model):
    issue_choices = [
        ("Missing Time In", "Missing Time In"),
        ("Missing Time Out", "Missing Time Out"),
        ("Missing Time In & Time Out", "Missing Time In & Time Out"),
        ("Wrong Time In", "Wrong Time In"),
        ("Wrong Time Out", "Wrong Time Out"),
        ("WRONG_BOTH", "Wrong Time In & Time Out"),
        ("Wrong Status", "Wrong Status"),
        ("Other", "Other"),
    ]
    status_choices = [
        ("Pending","Pending"),
        ("Verified","Verified"),
        ("Declined","Declined"),
    ]

    id = models.AutoField(primary_key=True)
    date = models.DateField(null=True,blank=True)
    issue_type = models.CharField(max_length=40, choices=issue_choices)
    reason = models.TextField()
    # Supports images + pdf + docs
    file_attached = models.FileField(upload_to="attendance_corrections/%Y/%m/",null=True,blank=True,)
    requested_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20,choices=status_choices, default="Pending")
    attendance  = models.ForeignKey(Attendance,on_delete=models.CASCADE,related_name="corrections")
    requested_by = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="attendance_correction_requests")
    reviewed_by = models.ForeignKey("User",on_delete=models.SET_NULL,null=True,blank=True,related_name="reviewed_attendance_corrections")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    decline_reason = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.requested_by} | {self.date} | {self.issue_type} | {self.status}"
    
    class Meta:
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["status"]),
        ]

class Leave_Type(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=20, unique=True)
    is_paid = models.BooleanField(default=True)
    requires_approval = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.name} {self.is_paid}"

class Leave_Request(models.Model):
    half_day_choices = [
        ("AM","AM"),
        ("PM","PM"),
    ]
    STATUS_CHOICES = [ 
        ("Pending","Pending"),
        ("Approved","Approved"),
        ("Declined","Declined"),
        ("Cancelled","Cancelled"),
    ]

    id = models.AutoField(primary_key=True)
    date_from = models.DateField()
    date_to = models.DateField()
    is_half_day = models.BooleanField(default=False)
    half_day_part = models.CharField(max_length=5, choices=half_day_choices, null=True, blank=True)
    reason = models.TextField()
    status = models.CharField(max_length=15,choices=STATUS_CHOICES,default="Pending")
    requested_at = models.DateTimeField(default=timezone.now)
    approved_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="approved_leave_requests")
    approved_at = models.DateTimeField(null=True, blank=True)
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="leave_requests")
    leave_type = models.ForeignKey(Leave_Type,on_delete=models.PROTECT,related_name="leave_requests")
    

    def __str__(self):
        return f"{self.date_from} to {self.date_to}" 

class Leave_Day(models.Model):
    id = models.AutoField(primary_key=True)
    date = models.DateField()
    units = models.DecimalField(max_digits=3,decimal_places=2,default=1.00)
    is_paid = models.BooleanField(default=False)
    pay_rate = models.DecimalField(max_digits=4,decimal_places=2,default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    leave_request = models.ForeignKey(Leave_Request,on_delete=models.CASCADE, related_name="days")
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="leave_days")

    def __str__(self):
        return f"{self.date} is {self.is_paid}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "date"],
                name="unique_leave_day_per_employee_per_date"
            )
        ]

class Loan(models.Model):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Approved", "Approved"),
        ("Active", "Active"),
        ("Completed", "Completed"),
        ("Cancelled", "Cancelled"),
    ]

    DEDUCTION_MODE_CHOICES = [
        ("FIXED", "Fixed"),
        ("PERCENT", "Percent"),
    ]

    APPLY_TO_CUTOFF_CHOICES = [
        ("FIRST", "First Cutoff"),
        ("SECOND", "Second Cutoff"),
        ("BOTH", "Both"),
    ]

    id = models.AutoField(primary_key=True)
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="loans",)
    rule = models.ForeignKey("LoanRule",on_delete=models.SET_NULL,null=True,blank=True,related_name="loans",)

    name = models.CharField(max_length=100)
    principal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    remaining_balance = models.DecimalField(max_digits=12, decimal_places=2)

    # copied snapshot from selected rule at creation time
    deduction_mode = models.CharField(max_length=20, choices=DEDUCTION_MODE_CHOICES,null=True,
    blank=True)
    deduction_value = models.DecimalField(max_digits=12, decimal_places=2,null=True,
    blank=True)
    apply_to_cutoff = models.CharField(max_length=10, choices=APPLY_TO_CUTOFF_CHOICES,null=True,
    blank=True)

    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    remarks = models.TextField(blank=True, default="")
    declined_reason = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="created_loans",)
    approved_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="approved_loans",)
    approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.principal_amount <= 0:
            raise ValidationError({"principal_amount": "Principal amount must be greater than 0."})

        if self.remaining_balance < 0:
            raise ValidationError({"remaining_balance": "Remaining balance cannot be negative."})

        if self.remaining_balance > self.principal_amount:
            raise ValidationError({"remaining_balance": "Remaining balance cannot exceed principal amount."})

        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({"effective_to": "effective_to cannot be earlier than effective_from."})

        # deduction settings required only once approved/active/completed
        if self.status in ["Approved", "Active", "Completed"]:
            if not self.rule:
                raise ValidationError({"rule": "Loan rule is required once the loan is approved."})

            if not self.deduction_mode:
                raise ValidationError({"deduction_mode": "Deduction mode is required once the loan is approved."})

            if self.deduction_value is None:
                raise ValidationError({"deduction_value": "Deduction value is required once the loan is approved."})

            if self.deduction_value < 0:
                raise ValidationError({"deduction_value": "Deduction value cannot be negative."})

            if not self.apply_to_cutoff:
                raise ValidationError({"apply_to_cutoff": "Apply to cutoff is required once the loan is approved."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} - {self.name} - {self.remaining_balance}"

class LoanRule(models.Model):
    DEDUCTION_MODE_CHOICES = [
        ("FIXED", "Fixed"),
        ("PERCENT", "Percent"),
    ]

    APPLY_TO_CUTOFF_CHOICES = [
        ("FIRST", "First Cutoff"),
        ("SECOND", "Second Cutoff"),
        ("BOTH", "Both"),
    ]

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    # scope pattern:
    # employee set   => employee-specifi
    # department set => department-specific
    # both null      => applies to all
    department = models.ForeignKey(Department,on_delete=models.CASCADE,null=True,blank=True,related_name="loan_rules",)
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,null=True,blank=True,related_name="loan_rules",)

    deduction_mode = models.CharField(max_length=20, choices=DEDUCTION_MODE_CHOICES)
    deduction_value = models.DecimalField(max_digits=12, decimal_places=2)
    apply_to_cutoff = models.CharField(max_length=10, choices=APPLY_TO_CUTOFF_CHOICES)

    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    def clean(self):
        if self.department and self.employee:
            raise ValidationError({
                "department": "Choose either Department or Employee, not both.",
                "employee": "Choose either Department or Employee, not both.",
            })

        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({
                "effective_to": "effective_to cannot be earlier than effective_from."
            })

        if self.deduction_value < 0:
            raise ValidationError({
                "deduction_value": "Deduction value cannot be negative."
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        scope = "Employee" if self.employee_id else ("Department" if self.department_id else "All")
        return f"{self.name} [{scope}]"

class LoanPayment(models.Model):
    id = models.AutoField(primary_key=True)

    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    payroll = models.ForeignKey(
        "Payroll",
        on_delete=models.CASCADE,
        related_name="loan_payments",
    )
    payroll_period = models.ForeignKey(
        "Payroll_Period",
        on_delete=models.CASCADE,
        related_name="loan_payments",
    )

    deducted_amount = models.DecimalField(max_digits=12, decimal_places=2)
    previous_balance = models.DecimalField(max_digits=12, decimal_places=2)
    new_balance = models.DecimalField(max_digits=12, decimal_places=2)

    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.deducted_amount < 0:
            raise ValidationError({"deducted_amount": "Deducted amount cannot be negative."})
        if self.previous_balance < 0 or self.new_balance < 0:
            raise ValidationError({"new_balance": "Balances cannot be negative."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"LoanPayment #{self.id} - {self.deducted_amount}"

class CashAdvance(models.Model):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Approved", "Approved"),
        ("Active", "Active"),
        ("Completed", "Completed"),
        ("Cancelled", "Cancelled"),
    ]

    DEDUCTION_MODE_CHOICES = [
        ("FIXED", "Fixed"),
        ("PERCENT", "Percent"),
    ]

    APPLY_TO_CUTOFF_CHOICES = [
        ("FIRST", "First Cutoff"),
        ("SECOND", "Second Cutoff"),
        ("BOTH", "Both"),
    ]

    id = models.AutoField(primary_key=True)
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="cash_advances",
    )

    rule = models.ForeignKey(
        "CashAdvanceRule",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cash_advances",
    )

    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    remaining_balance = models.DecimalField(max_digits=12, decimal_places=2)

    # copied snapshot from selected rule at creation time
    deduction_mode = models.CharField(max_length=20, choices=DEDUCTION_MODE_CHOICES)
    deduction_value = models.DecimalField(max_digits=12, decimal_places=2)
    apply_to_cutoff = models.CharField(max_length=10, choices=APPLY_TO_CUTOFF_CHOICES)

    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    remarks = models.TextField(blank=True, default="")

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_cash_advances",
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_cash_advances",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.amount < 0:
            raise ValidationError({"amount": "Amount cannot be negative."})

        if self.remaining_balance < 0:
            raise ValidationError({"remaining_balance": "Remaining balance cannot be negative."})

        if self.remaining_balance > self.amount:
            raise ValidationError({"remaining_balance": "Remaining balance cannot exceed amount."})

        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({"effective_to": "effective_to cannot be earlier than effective_from."})

        if self.deduction_value < 0:
            raise ValidationError({"deduction_value": "Deduction value cannot be negative."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} - {self.name} - {self.remaining_balance}"

class CashAdvanceRule(models.Model):
    DEDUCTION_MODE_CHOICES = [
        ("FIXED", "Fixed"),
        ("PERCENT", "Percent"),
    ]

    APPLY_TO_CUTOFF_CHOICES = [
        ("FIRST", "First Cutoff"),
        ("SECOND", "Second Cutoff"),
        ("BOTH", "Both"),
    ]

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="cash_advance_rules",
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cash_advance_rules",
    )

    deduction_mode = models.CharField(max_length=20, choices=DEDUCTION_MODE_CHOICES)
    deduction_value = models.DecimalField(max_digits=12, decimal_places=2)
    apply_to_cutoff = models.CharField(max_length=10, choices=APPLY_TO_CUTOFF_CHOICES)

    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    def clean(self):
        if self.department and self.employee:
            raise ValidationError({
                "department": "Choose either Department or Employee, not both.",
                "employee": "Choose either Department or Employee, not both.",
            })

        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({
                "effective_to": "effective_to cannot be earlier than effective_from."
            })

        if self.deduction_value < 0:
            raise ValidationError({
                "deduction_value": "Deduction value cannot be negative."
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        scope = "Employee" if self.employee_id else ("Department" if self.department_id else "All")
        return f"{self.name} [{scope}]"

class CashAdvancePayment(models.Model):
    id = models.AutoField(primary_key=True)

    cash_advance = models.ForeignKey(
        CashAdvance,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    payroll = models.ForeignKey(
        "Payroll",
        on_delete=models.CASCADE,
        related_name="cash_advance_payments",
    )
    payroll_period = models.ForeignKey(
        "Payroll_Period",
        on_delete=models.CASCADE,
        related_name="cash_advance_payments",
    )

    deducted_amount = models.DecimalField(max_digits=12, decimal_places=2)
    previous_balance = models.DecimalField(max_digits=12, decimal_places=2)
    new_balance = models.DecimalField(max_digits=12, decimal_places=2)

    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.deducted_amount < 0:
            raise ValidationError({"deducted_amount": "Deducted amount cannot be negative."})
        if self.previous_balance < 0 or self.new_balance < 0:
            raise ValidationError({"new_balance": "Balances cannot be negative."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"CashAdvancePayment #{self.id} - {self.deducted_amount}"

class Company_Note(models.Model):
    id = models.AutoField(primary_key=True)
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="company_notes")

    def __str__(self):
        return self.note

class Payroll_Period(models.Model):
    period_status_choices = [
        ("Open","Open"),
        ("Processing","Processing"),
        ("Closed","Closed"),
        ("Paid","Paid"),
    ]
    period_type_choices = [
        ("FIRST", "First Cutoff"),
        ("SECOND", "Second Cutoff"),
        ]

    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=100,unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    cutoff_type = models.CharField(max_length=10,choices=period_type_choices,default="FIRST")
    pay_date = models.DateField(null=True, blank=True)
    color = models.CharField(max_length=20, default="#ff4d4f")
    status = models.CharField(max_length=20, choices=period_status_choices, default="Open")
    created_at = models.DateField(auto_now_add=True)

class Pay_Rule(models.Model):
    event_type_choices = [
        ("Night Differential","Night Differential"),
        ("Late","Late"),
        ("Undertime","Undertime"),
        ("Overtime","Overtime"),
        ("Regular Holiday","Regular Holiday"),  
        ("Special Holiday","Special Holiday"),
        ("Special Non Working Holiday","Special Non Working Holiday"),
        ("Company Holiday","Company Holiday"),
        ("Absent","Absent"),
    ]
    categories = [
        ("Earning","Earning"),
        ("Deduction","Deduction"),
    ]
    RATE_TYPE_CHOICES = [
        ("PER_MINUTE", "Per Minute"),
        ("MULTIPLIER", "Multiplier"),
        ("FIXED", "Fixed"),
        ("PER_DAY", "Per Day"),
    ]
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100,unique=True)
    event_type = models.CharField(max_length=40,choices=event_type_choices)
    category = models.CharField(max_length=20,choices=categories)
    rate_type = models.CharField(max_length=20, choices=RATE_TYPE_CHOICES)
    rate_value = models.DecimalField(max_digits=10, decimal_places=4)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True,blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateField(auto_now=True)
    
    applies_to = models.ForeignKey(Department,on_delete=models.CASCADE,null=True,blank=True,related_name="pay_rules")
    employee = models.ForeignKey("Employee",on_delete=models.SET_NULL,null=True,blank=True,related_name="pay_rules")
    
    def __str__(self):
        return f"{self.name} - {self.event_type}"

class Commission_Tax_Rule(models.Model):
    """
    Commission tax/withholding rules using AMOUNT BRACKETS.
    Separate from Pay_Rule because Pay_Rule is attendance-event/minutes driven.
    """

    RATE_TYPE_CHOICES = [
        ("MULTIPLIER", "Multiplier"),  # tax = commission_amount * rate_value
        ("FIXED", "Fixed"),            # tax = rate_value
    ]

    id = models.AutoField(primary_key=True)

    name = models.CharField(max_length=100, unique=True)
    commission_type = models.ForeignKey("Commission_Type",on_delete=models.PROTECT,related_name="tax_rules",)

    # bracket range
    min_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    rate_type = models.CharField(max_length=20, choices=RATE_TYPE_CHOICES)
    rate_value = models.DecimalField(max_digits=10, decimal_places=4, default=0.0000)

    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    # optional scoping
    applies_to = models.ForeignKey("Department",on_delete=models.CASCADE,null=True,blank=True,related_name="commission_tax_rules",)
    employee = models.ForeignKey("Employee",on_delete=models.SET_NULL,null=True,blank=True,related_name="commission_tax_rules",)

    def clean(self):
        if self.max_amount is not None and self.max_amount < self.min_amount:
            raise ValidationError({"max_amount": "max_amount cannot be less than min_amount."})
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({"effective_to": "effective_to cannot be earlier than effective_from."})
        if self.applies_to and self.employee:
            raise ValidationError({
                "applies_to": "Choose either Department or Employee, not both.",
                "employee": "Choose either Department or Employee, not both.",
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        rng = f"{self.min_amount} - {self.max_amount}" if self.max_amount is not None else f"{self.min_amount}+"
        scope = "Employee" if self.employee_id else ("Department" if self.applies_to_id else "Global")
        return f"{self.name} ({self.commission_type}) [{scope}] ({rng})"

class Payroll_Setting(models.Model):
    id = models.AutoField(primary_key=True)

    # 22 is common for 5-day week companies, 26 for 6-day week
    daily_rate_divisor = models.PositiveSmallIntegerField(default=22)

    # since you're semi-monthly:
    is_semi_monthly = models.BooleanField(default=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payroll Setting (divisor={self.daily_rate_divisor})"

class Payroll(models.Model):
    status_choices = [
        ("Draft","Draft"),
        ("Generated","Generated"),
        ("Approved","Approved"),
        ("Disapproved","Disapproved"),
        ("Paid","Paid"),
        ("Void","Void"),
    ]

    id = models.AutoField(primary_key=True)
    payroll_period = models.ForeignKey(Payroll_Period, on_delete=models.CASCADE, related_name="payrolls")
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="payrolls")
    #  version/run number (1 = initial, 2 = regenerated, etc.)
    run_no = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=status_choices, default="Draft")
    basic_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    net_before_excess_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    generated_at = models.DateField(auto_now_add=True)
    approved_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="approved_payrolls",)
    approved_at = models.DateField(null=True, blank=True)
    #  void metadata (for audit + easier explanation to users)
    voided_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="voided_payrolls",)
    voided_at = models.DateTimeField(null=True, blank=True)
    void_reason = models.TextField(null=True, blank=True)

    #  link chain of regenerations (optional but very useful)
    regenerated_from = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="regenerations",
    )

    def __str__(self):
        return f"{self.status} - Run {self.run_no} - {self.generated_at} to {self.payroll_period}"

    class Meta:
        constraints = [
            #  allows multiple payrolls per period/employee but prevents duplicate run_no
            models.UniqueConstraint(
                fields=["payroll_period", "employee", "run_no"],
                name="unique_payroll_run_per_period_employee",
            )
        ]

class Payroll_Tax_Bracket(models.Model):
    RATE_TYPE_CHOICES = [
        ("PERCENT", "Percent"),  # rate_value stored like 0.1500 meaning 15%
        ("FIXED", "Fixed"),
    ]

    APPLY_MODE_CHOICES = [
        ("EXCESS_ONLY", "Excess Only"),  # default
        ("ALWAYS", "Always"),            # tax whole amount when bracket matches
    ]

    id = models.AutoField(primary_key=True)

    name = models.CharField(max_length=100, unique=True)

    min_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    rate_type = models.CharField(max_length=20, choices=RATE_TYPE_CHOICES)
    rate_value = models.DecimalField(max_digits=10, decimal_places=4, default=0.0000)

    apply_mode = models.CharField(
        max_length=20,
        choices=APPLY_MODE_CHOICES,
        default="EXCESS_ONLY",
    )

    effective_from = models.DateField(default=timezone.now)
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    # optional scoping (same pattern as Commission_Tax_Rule)
    applies_to = models.ForeignKey(
        "Department",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="payroll_tax_brackets",
    )
    employee = models.ForeignKey(
        "Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payroll_tax_brackets",
    )

    def clean(self):
        if self.max_amount is not None and self.max_amount < self.min_amount:
            raise ValidationError({"max_amount": "max_amount cannot be less than min_amount."})

        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({"effective_to": "effective_to cannot be earlier than effective_from."})

        if self.applies_to and self.employee:
            raise ValidationError({
                "applies_to": "Choose either Department or Employee, not both.",
                "employee": "Choose either Department or Employee, not both.",
            })

        # percent safety: 0 to 1000% (adjust if you want stricter)
        if self.rate_type == "PERCENT" and self.rate_value < 0:
            raise ValidationError({"rate_value": "Percent rate_value cannot be negative."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        rng = f"{self.min_amount} - {self.max_amount}" if self.max_amount is not None else f"{self.min_amount}+"
        scope = "Employee" if self.employee_id else ("Department" if self.applies_to_id else "Global")
        return f"{self.name} [{scope}] ({rng}) {self.rate_type} {self.rate_value} {self.apply_mode}"

class Payslip(models.Model):
    LINE_TYPES = [
        ("EARNING", "Earning"),
        ("DEDUCTION", "Deduction"),
        ("INFORMATION", "Information"),
    ]

    SOURCE_TYPES = [
        ("ATTENDANCE_EVENT", "Attendance Event"),
        ("ATTENDANCE", "Attendance"),
        ("LEAVE_DAY", "Leave Day"),
        ("MANUAL", "Manual"),
        ("ADJUSTMENT", "Adjustment"),
        ("COMMISSION_TAX_RULE", "Commission Tax Rule"),
        ("PAYROLL_TAX_BRACKET", "Payroll Tax Bracket"),
    ]

    id = models.AutoField(primary_key=True)

    # Which payroll this line belongs to
    payroll = models.ForeignKey(Payroll,on_delete=models.CASCADE,related_name="payslip_lines")

    # Which rule produced it (optional but recommended for auditability)
    rule = models.ForeignKey(Pay_Rule,on_delete=models.SET_NULL,null=True,blank=True,related_name="payslip_lines")

    line_type = models.CharField(max_length=20, choices=LINE_TYPES)
    description = models.TextField()

    # Where it came from
    source_type = models.CharField(max_length=30,choices=SOURCE_TYPES,null=True,blank=True)

    # ID of the source record (attendance_event.id / attendance.id / manual table later)
    source_id = models.PositiveIntegerField(null=True, blank=True)

    # For minute-based computations (late/OT/UT)
    quantity_min = models.PositiveIntegerField(null=True, blank=True)

    # Snapshot of the rate used at generation time (audit)
    rate_applied = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)

    # Final computed amount for this line (store as positive; line_type tells direction)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    created_at = models.DateTimeField(auto_now_add=True)
    commission_tax_rule = models.ForeignKey("Commission_Tax_Rule",on_delete=models.SET_NULL,null=True,blank=True,related_name="payslip_lines")
    payroll_tax_bracket = models.ForeignKey("Payroll_Tax_Bracket",on_delete=models.SET_NULL,null=True,blank=True,related_name="payslip_lines")
    
    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["payroll"]),
            models.Index(fields=["source_type", "source_id"]),
            models.Index(fields=["rule"]),
            models.Index(fields=["line_type"]),
        ]
        # MySQL note: conditional unique constraints are not supported/enforced,
        # so we enforce duplicate prevention in application logic (get_or_create / exists checks).
        constraints = []

    def __str__(self):
        return f"{self.payroll_id} - {self.get_line_type_display()} - {self.description} ({self.amount})"

class PayrollPeriodEmployee(models.Model):
    STATUS_CHOICES = [
        ("Pending", "Pending"),        # default – HR has not verified
        ("Verified", "Verified"),      # HR verified
        ("Processing", "Processing"),  # payroll & payslip generated, waiting CEO
        ("Approved", "Approved"),      # CEO approved
        ("Declined", "Declined"),      # CEO declined
    ]

    id = models.AutoField(primary_key=True)
    period = models.ForeignKey(Payroll_Period,on_delete=models.CASCADE,related_name="period_employees")
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="payroll_periods")
    status = models.CharField(max_length=20,choices=STATUS_CHOICES,default="Pending")
    verified_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="verified_payroll_period_employees")
    verified_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="approved_payroll_period_employees")
    approved_at = models.DateTimeField(null=True, blank=True)
    declined_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["period", "employee"],
                name="unique_employee_per_payroll_period"
            )
        ]
        ordering = ["employee__lname", "employee__fname"]

    def __str__(self):
        return f"{self.employee} - {self.period} ({self.status})"

class PayrollPeriodEmployeeCommission(models.Model):
    id = models.AutoField(primary_key=True)

    period = models.ForeignKey(Payroll_Period,on_delete=models.CASCADE,related_name="commissions")
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="period_commissions")
    commission_type = models.ForeignKey(Commission_Type,on_delete=models.PROTECT,related_name="period_employee_commissions", null=True,blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    remarks = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="created_period_commissions")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Prevent duplicate commission type for same employee in same payroll period
            models.UniqueConstraint(
                fields=["period", "employee", "commission_type"],
                name="unique_commission_type_per_employee_per_period"
            )
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.employee} -({self.amount}) [{self.period.code}]"

class PayrollRunInputExclusion(models.Model):
    """
    Run-specific payroll input exclusion decided before generation.

    Purpose:
    - lets HR exclude one payroll input ONLY for one upcoming/current payroll run
    - does NOT modify the original master/source record
    - after reset/regenerate, the next run_no starts fresh unless excluded again

    Reusable for:
    - DEDUCTION  -> Employee_Deduction.id
    - COMMISSION -> PayrollPeriodEmployeeCommission.id
    - ALLOWANCE  -> Employee_Allowance.id
    """

    SOURCE_TYPE_CHOICES = [
        ("DEDUCTION", "Deduction"),
        ("COMMISSION", "Commission"),
        ("ALLOWANCE", "Allowance"),
        ("FINE", "Fine"),
        ("ADDITIONAL_EARNING", "Additional Earning"),
    ]

    id = models.AutoField(primary_key=True)

    period = models.ForeignKey(Payroll_Period,on_delete=models.CASCADE,related_name="run_input_exclusions",)
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="payroll_run_input_exclusions",)
    target_run_no = models.PositiveIntegerField()
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES)
    source_id = models.PositiveIntegerField()
    is_excluded = models.BooleanField(default=True)
    remarks = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="created_payroll_run_input_exclusions",)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["period", "employee", "target_run_no", "source_type", "source_id"],
                name="unique_payroll_run_input_exclusion",
            )
        ]
        indexes = [
            models.Index(fields=["period", "employee", "target_run_no"]),
            models.Index(fields=["source_type", "source_id"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.employee} | {self.period.code} | run {self.target_run_no} | "
            f"{self.source_type}:{self.source_id} | excluded={self.is_excluded}"
        )

class PayrollPeriodEmployeeAllowance(models.Model):
    """
    Manual/additional allowance entered by HR for one employee
    within one payroll period.

    Purpose:
    - extra transportation allowance
    - special same-day allowance adjustments
    - one-off payroll-period allowance inputs

    This is DIFFERENT from Employee_Allowance:
    - Employee_Allowance = master/setup recurring allowance
    - PayrollPeriodEmployeeAllowance = run input / manual payroll-period entry
    """

    id = models.AutoField(primary_key=True)

    period = models.ForeignKey(Payroll_Period,on_delete=models.CASCADE,related_name="additional_allowances",)
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="period_additional_allowances",)
    allowance_type = models.ForeignKey(Allowance_Type,on_delete=models.PROTECT,related_name="period_employee_allowances",)
    allowance_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    remarks = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="created_period_allowances",)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-allowance_date", "-created_at"]
        indexes = [
            models.Index(fields=["period", "employee"]),
            models.Index(fields=["allowance_date"]),
        ]

    def __str__(self):
        return f"{self.employee} - {self.allowance_type} ({self.amount}) [{self.period.code}]"

#Now used as Additional Deduction
class PayrollPeriodEmployeeFine(models.Model):
    id = models.AutoField(primary_key=True)

    period = models.ForeignKey(Payroll_Period,on_delete=models.CASCADE,related_name="employee_fines")
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="payroll_fines")
    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    remarks = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="created_payroll_fines")

    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({"amount": "Amount must be greater than 0."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    class Meta:
        indexes = [
            models.Index(fields=["period", "employee"]),
        ]

class PayrollPeriodEmployeeAdditionalEarning(models.Model):
    id = models.AutoField(primary_key=True)

    period = models.ForeignKey(Payroll_Period,on_delete=models.CASCADE,related_name="employee_earnings")
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="payroll_earnings")
    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    remarks = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="created_payroll_earnings")

    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({"amount": "Amount must be greater than 0."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    class Meta:
        indexes = [
            models.Index(fields=["period", "employee"]),
        ]

#audit logs
class AuditLog(models.Model):
    ACTION_CHOICES = [
        ("CREATE", "Create"),
        ("UPDATE", "Update"),
        ("DELETE", "Delete"),
    ]

    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        null=True,  # allow null for AnonymousUser
        blank=True,
        related_name="audit_logs"
    )
    action = models.CharField(
        max_length=50,
        choices=ACTION_CHOICES  # restrict to CREATE/UPDATE/DELETE
    )
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=50)
    old_data = models.JSONField(null=True, blank=True)
    new_data = models.JSONField(null=True, blank=True)
    reason = models.TextField(null=True, blank=True, default="Created via system")
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"{self.action} {self.model_name} ({self.object_id})"
    
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

class PasswordResetToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens"
    )

    token = models.CharField(max_length=255, unique=True)

    created_at = models.DateTimeField(auto_now_add=True)

    expires_at = models.DateTimeField()

    is_used = models.BooleanField(default=False)

    class Meta:
        db_table = "password_reset_tokens"

    def is_expired(self):
        return timezone.now() > self.expires_at

    @classmethod
    def cleanup_expired(cls):
        """Delete expired or used tokens to keep the table clean."""
        cls.objects.filter(
            expires_at__lt=timezone.now()
        ).delete()
    