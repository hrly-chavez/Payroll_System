from django.contrib import admin
from .models import *

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'user_name', 'role', 'is_active', 'employee')
    list_filter = ('role', 'is_active')
    search_fields = ('user_name',)

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "is_active", "created_at", "shift_id")

@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("id","name","start_time","end_time","break_minutes","grace_minutes","is_overnight","is_active",)
    list_filter = ("is_active", "is_overnight")
    search_fields = ("id", "name")
    ordering = ("id",)

@admin.register(Shift_Workday)
class ShiftWorkdayAdmin(admin.ModelAdmin):
    list_display = ("id","shift","day_of_week","is_workday","created_at",)
    list_filter = ("shift", "is_workday", "day_of_week")
    search_fields = ("id", "shift__name")
    ordering = ("shift", "day_of_week")

admin.site.register(Employee)
admin.site.register(Address)
@admin.register(Payroll)
class PayrollAdmin(admin.ModelAdmin):
    list_display = ( "id", "employee","payroll_period","status","basic_pay","total_earnings","total_deductions","net_pay","generated_at",)

    list_filter = ("status","payroll_period","generated_at",)

    search_fields = ("employee__fname","employee__lname","payroll_period__code",)

    ordering = ("-generated_at",)

    readonly_fields = ("basic_pay","total_earnings","total_deductions","net_pay","generated_at","approved_at",)
@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "payroll",
        "line_type",
        "description",
        "amount",
        "source_type",
        "rate_applied",
        "created_at",
    )

    list_filter = (
        "line_type",
        "source_type",
        "created_at",
    )

    search_fields = (
        "payroll__employee__fname",
        "payroll__employee__lname",
        "description",
    )

    ordering = ("payroll", "id")

    readonly_fields = (
        "payroll",
        "rule",
        "line_type",
        "description",
        "source_type",
        "source_id",
        "quantity_min",
        "rate_applied",
        "amount",
        "created_at",
    )

@admin.register(Payroll_Setting)
class PayrollSettingAdmin(admin.ModelAdmin):
    list_display = ("id", "daily_rate_divisor", "is_semi_monthly", "updated_at")

@admin.register(Province)
class Province(admin.ModelAdmin):
    list_display = ('name',)

@admin.register(City)
class City(admin.ModelAdmin):
    list_display = ('name',)

@admin.register(Barangay)
class Barangay(admin.ModelAdmin):
    list_display = ('name',)

@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'name',
        'date',
        'type',
        'base',
        'is_active',
        'created_at',
        'status'
    )

    list_filter = (
        'type',
        'base',
        'is_active',
    )

    search_fields = ('name',)
    ordering = ('-date',)
    date_hierarchy = 'date'

    fields = (
        'date',
        'name',
        'type',
        'base',
        'remarks',
        'status',
        'is_active',
        'created_at',
    )

    list_editable = ('is_active',)


@admin.register(Employee_Salary)
class Employee_SalaryAdmin(admin.ModelAdmin):
    list_display = ('pay_type', 'employee_fname')

    # This method fetches the first name from the related Employee
    def employee_fname(self, obj):
        return obj.employee.fname

    # Optional: allow sorting by employee's first name
    employee_fname.admin_order_field = 'employee__fname'
    employee_fname.short_description = 'Employee First Name'


@admin.register(Employee_Deduction)
class EmployeeDeductionAdmin(admin.ModelAdmin):
    list_display = ("id","deduction_type","amount","frequency","status","effective_from","effective_to","balance","created_at",)

    list_filter = ("status","frequency","deduction_type","effective_from",)

    search_fields = ("id","employee__first_name","employee__last_name","deduction_type__name",)

    ordering = ("-created_at",)

    readonly_fields = ("created_at",)

@admin.register(Deduction_Type)
class DeductionTypeAdmin(admin.ModelAdmin):
    list_display = ("id","code","calculation_type","amount","is_active","create_at",)

    list_filter = ("calculation_type","is_active",)

    search_fields = ("id","code",)

    ordering = ("-create_at",)

    date_hierarchy = "create_at"


@admin.register(Allowance_Type)
class AllowanceTypeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "code",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
        "created_at",
    )

    search_fields = (
        "name",
        "code",
    )

    ordering = ("-created_at",)

    fields = (
        "name",
        "code",
        "is_active",
        "created_at",
    )


@admin.register(Employee_Allowance)
class Employee_Allowance(admin.ModelAdmin):
    list_display = ('id', )

class AttendanceEventInline(admin.TabularInline):
    model = Attendance_Event
    extra = 0
    fields = ("type", "minutes", "start_time", "end_time", "approval_status", "approved_by", "holiday", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "date",
        "status",
        "employee",
        "employee_id_no",
        "employee_department",
        "time_in",
        "time_out",
        "created_at",
    )

    list_filter = (
        "status",
        "date",
        "employee__department",
    )

    search_fields = (
        "employee__id_no",
        "employee__fname",
        "employee__lname",
    )

    ordering = ("-date", "-id")
    date_hierarchy = "date"

    inlines = [AttendanceEventInline] 

    def employee_id_no(self, obj):
        return getattr(obj.employee, "id_no", "")
    employee_id_no.short_description = "Employee ID No"

    def employee_department(self, obj):
        dept = getattr(obj.employee, "department", None)
        return getattr(dept, "name", "") if dept else ""
    employee_department.short_description = "Department"

@admin.register(Attendance_Event)
class AttendanceEventAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "type",
        "approval_status",
        "minutes",
        "start_time",
        "end_time",
        "attendance_date",
        "employee",
        "employee_id_no",
        "holiday",
        "approved_by",
        "created_at",
    )

    list_filter = (
        "type",
        "approval_status",
        "attendance__date",
        "attendance__employee__department",
        "holiday__base",
        "holiday__type",
    )

    search_fields = (
        "attendance__employee__id_no",
        "attendance__employee__fname",
        "attendance__employee__lname",
        "approved_by__user_name",   # adjust if your User model uses user_name
        "event_remarks",
    )

    ordering = ("-attendance__date", "-id")
    date_hierarchy = "attendance__date"

    def attendance_date(self, obj):
        return obj.attendance.date if obj.attendance else None
    attendance_date.short_description = "Attendance Date"

    def employee(self, obj):
        return obj.attendance.employee if obj.attendance else None
    employee.short_description = "Employee"

    def employee_id_no(self, obj):
        emp = obj.attendance.employee if obj.attendance else None
        return getattr(emp, "id_no", "") if emp else ""
    employee_id_no.short_description = "Employee ID No"


admin.site.register(Payroll_Period)

@admin.register(Commission_Type)
class CommissionTypeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "code",
        "is_taxable",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_taxable",
        "is_active",
        "created_at",
    )

    search_fields = (
        "name",
        "code",
    )

    ordering = ("-created_at",)

    fields = (
        "name",
        "code",
        "is_taxable",
        "is_active",
        "created_at",
    )
    
@admin.register(Pay_Rule)
class PayRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'event_type', 'category', 'rate_type', 'rate_value', 'is_active', 'created_at' )
    
    list_filter = ('category', 'event_type', 'rate_type', 'is_active')
    search_fields = ('name', 'event_type', 'category')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    list_display_links = ('name', 'event_type')
    raw_id_fields = ('applies_to', 'employee')

@admin.register(Leave_Type)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'name',
        'is_paid',
        
        'requires_approval',
        'is_active',
        'created_at'
    )

    list_filter = (
        'is_paid',
        'requires_approval',
        'is_active'
    )

    search_fields = ['name']
    ordering = ['-created_at']

    fields = (
        'name',
        'is_paid',
        
        'requires_approval',
        'is_active',
        'created_at'
    )

@admin.register(Leave_Request)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employee",
        "leave_type",
        "date_from",
        "date_to",
        "status",
        "requested_at",
    )
    list_filter = ("status", "leave_type", "requested_at")
    search_fields = ("employee__user__username", "reason")
    ordering = ("-requested_at",)
    readonly_fields = ("requested_at", "approved_at")

@admin.register(HolidayPolicy)
class HolidayPolicyAdmin(admin.ModelAdmin):
    list_display = (
        "department",
        "holiday_type",
        "requires_work",
        "created_at",
    )

    list_filter = (
        "department",
        "holiday_type",
        "requires_work",
    )

    search_fields = (
        "department__name",
        "holiday_type",
    )

    fields = (
        "department",
        "holiday_type",
        "requires_work",
        "created_at",
    )

    ordering = ("-created_at",)


admin.site.register(AuditLog)
admin.site.register(Company_Note)
admin.site.register(Notification)