from django.contrib import admin
from .models import *

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'user_name', 'role', 'is_active', 'employee')
    list_filter = ('role', 'is_active')
    search_fields = ('user_name',)

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'shift_id')
    list_filter = ('shift_id',)
    search_fields = ('name',)

admin.site.register(Shift)
admin.site.register(Shift_Workday)
admin.site.register(Employee)
admin.site.register(Address)

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
    list_display = ('name','date','type','base','is_active','created_at','status')
    list_filter = ('type','base','is_active',)
    search_fields = ('name',)
    ordering = ('-date',)
    date_hierarchy = 'date'
    readonly_fields = ('created_at',)
    list_editable = ('is_active',)



@admin.register(Employee_Salary)
class Employee_Salary(admin.ModelAdmin):
    list_display = ('pay_type', )

@admin.register(Employee_Deduction)
class Employee_Deduction(admin.ModelAdmin):
    list_display = ('id', )

@admin.register(Deduction_Type)
class DeductionTypeAdmin(admin.ModelAdmin):
    list_display = ('code', 'calculation_type', 'amount', 'is_active', 'create_at')
    list_filter = ('calculation_type', 'is_active')
    search_fields = ('code',)
    ordering = ('-create_at',)
    date_hierarchy = 'create_at'

@admin.register(Allowance_Type)
class Allowance_Type(admin.ModelAdmin):
    list_display = ('name', )

@admin.register(Employee_Allowance)
class Employee_Allowance(admin.ModelAdmin):
    list_display = ('id', )

admin.site.register(Attendance)
admin.site.register(Attendance_Event)
admin.site.register(Payroll_Period)


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
    list_display = ('name', 'is_paid', 'pay_rate', 'requires_approval', 'is_active', 'created_at')
    list_filter = ('is_paid', 'requires_approval', 'is_active')
    search_fields = ['name'] 
    ordering = ['-created_at']  
    readonly_fields = ('created_at',)

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