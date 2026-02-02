from django.db import models
from django.contrib.auth.hashers import make_password, check_password


class Department(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    created_at = models.DateField(auto_now_add=True)
    shift_id = models.ForeignKey("Shift", on_delete=models.SET_NULL,related_name="departments",null=True,blank=True)

class Shift(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=0)
    grace_minutes = models.PositiveIntegerField(default=0)
    is_overnight = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

class ShiftWorkday(models.Model):

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

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["shift", "day_of_week"],
                name="unique_shift_day_of_week"
            )
        ]


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
    id_no = models.CharField(max_length=50,unique=True)
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
    shift = models.ForeignKey( Shift, on_delete=models.SET_NULL,related_name="employees",null=True,blank=True)
    department = models.ForeignKey( Department,on_delete=models.PROTECT,related_name="employees")

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
    employee = models.OneToOneField( Employee, on_delete=models.CASCADE,related_name="user")
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
    
class Employee_Salary(models.Model):
    PAY_TYPES = [
        ("Monthly","Monthly"),
        ("Per Period","Per Period"),
        ("Daily","Daily"),
        ("Hourly","Hourly"),
    ]

    id = models.AutoField(primary_key=True)
    pay_type =  models.CharField(max_length=20, choices=PAY_TYPES)
    #per_day = models.IntegerField()
    base_rate = models.PositiveIntegerField()
    effective_from = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True,null=True,
    blank=True)
    employee = models.ForeignKey( "Employee", on_delete=models.CASCADE,related_name="salaries",null=True,
    blank=True)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "effective_from"],
                name="unique_salary_start_per_employee"
            )
        ]
    
    
class Deduction_Type(models.Model):
    calculation_choices = [
        ("Fixed","Fixed"),
        ("Percent","Percent"),
    ]

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=100,unique=True)
    calulation_type = models.CharField(max_length=20, choices=calculation_choices)
    is_active = models.BooleanField(default=True)
    create_at = models.DateField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["code"],
                name="unique_deduction_code"
            )
        ]

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
    amount = models.PositiveIntegerField()
    frequency = models.CharField(max_length=20, choices=frequency_choices)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True,blank=True)
    status = models.CharField(max_length=15, choices=status_choices)
    created_at = models.DateField(auto_now_add=True)

    # Loan-only fields
    total_loan_amount = models.PositiveIntegerField(null=True,blank=True)
    balance = models.PositiveIntegerField(null=True,blank=True)
    amortization_per_period = models.PositiveIntegerField(null=True,blank=True)

    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="deductions")
    deduction_type = models.ForeignKey(Deduction_Type,on_delete=models.PROTECT,related_name="employee_deductions") 

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "deduction_type", "effective_from"],
                name="unique_employee_deduction_start"
            )
        ]

class Allowance_Type(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    created_at = models.DateField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["code"],
                name="unique_allowance_code"
            )
        ]

class Employee_Allowance(models.Model):
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
    amount = models.PositiveIntegerField()
    frequency = models.CharField(max_length=20, choices=frequency_choices)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True,blank=True)
    status = models.CharField(max_length=15, choices=status_choices)
    created_at = models.DateField(auto_now_add=True)
    allowance_type = models.ForeignKey(Allowance_Type,on_delete=models.PROTECT,related_name="employee_allowances")
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="allowances")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "allowance_type", "effective_from"],
                name="unique_employee_allowance_start"
            )
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
    status = models.CharField(max_length=20,choices=STATUS_CHOICES)
    time_in = models.TimeField()
    time_out = models.TimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="attendances")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "date"],
                name="unique_attendance_per_employee_per_day"
            )
        ]

class Attendance_Event(models.Model):
    TYPE_CHOICES = [
        ("Late","Late"),
        ("OverTime","OverTime"),
        ("UnderTime","UnderTime"),
        ("Worked Holiday","Worked Holiday"),
    ]
    APPROVAL_STATUS_CHOICES = [
        ("Pending","Pending"),
        ("Approved","Approved"),    
        ("Declined","Declined"),
    ]
    id = models.AutoField(primary_key=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    minutes = models.TimeField()
    start_time = models.TimeField(null=True,blank=True)
    end_time = models.TimeField(null=True,blank=True)
    approval_status = models.CharField(max_length=20,choices=APPROVAL_STATUS_CHOICES) 
    event_remarks = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="approved_attendance_events")
    attendance = models.ForeignKey(Attendance,on_delete=models.CASCADE,related_name="events")

class Leave_Type(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=20)
    code = models.CharField(max_length=20)
    is_paid = models.BooleanField(default=False)
    pay_rate = models.DecimalField(max_digits=4, decimal_places=2,default=1.00)
    requires_approval = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateField(auto_now=True)

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
    status = models.CharField(max_length=15,choices=STATUS_CHOICES,null=True,blank=True)
    requested_at = models.DateTimeField(auto_now=True)
    approved_by = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="approved_leave_requests")
    approved_at = models.DateTimeField(null=True, blank=True)
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="leave_requests")

class Leave_Day(models.Model):
    id = models.AutoField(primary_key=True)
    date = models.DateField()
    units = models.DecimalField(max_digits=3,decimal_places=2,default=1.00)
    is_paid = models.BooleanField(default=False)
    pay_rate = models.DecimalField(max_digits=4,decimal_places=2,default=0.00)
    created_at = models.DateTimeField()
    leave_request = models.ForeignKey("LeaveRequest",on_delete=models.CASCADE, related_name="days")
    employee = models.ForeignKey(Employee,on_delete=models.CASCADE,related_name="leave_days")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "leave_date"],
                name="unique_leave_day_per_employee_per_date"
            )
        ]

class Holiday(models.Model):
    holiday_types = [
        ("Regular","Regular"),
        ("Speacial Non-Working","Speacial Non-Working"),
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
    base = models.CharField(max_length=20,choices=HOLIDAY_BASE_CHOICES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["holiday_date", "holiday_base"],
                name="unique_holiday_per_base_per_date"
            )
        ]
class Company_Note(models.Model):
    id = models.AutoField(primary_key=True)
    note = models.TextField()
    created_at = models.DateField(auto_now_add=True)
    user = models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="company_notes")



