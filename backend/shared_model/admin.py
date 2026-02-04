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

@admin.register(Payroll_Period)
class PayrollPeriodAdmin(admin.ModelAdmin):
    # Columns to display in the list view
    list_display = ('code', 'start_date', 'end_date', 'pay_date', 'status', 'created_at')
    
    # Filter options
    list_filter = ('status',)
    
    # Searchable fields
    search_fields = ('code',)
    
@admin.register(Payroll)
class PayrollAdmin(admin.ModelAdmin):
    # Columns to display in the list view
    list_display = ('get_employee_name', 'get_period', 'total_amount', 'status')
    
    # Filter options
    list_filter = ('status',)
    
    # Searchable fields
    search_fields = ('employee__fname', 'employee__lname', 'payroll_period__code')

    # Methods to display related fields
    def get_employee_name(self, obj):
        return f"{obj.employee.fname} {obj.employee.lname}"
    get_employee_name.short_description = 'Employee Name'
    get_employee_name.admin_order_field = 'employee__fname'

    def get_period(self, obj):
        return obj.payroll_period.code
    get_period.short_description = 'Payroll Period'
    get_period.admin_order_field = 'payroll_period__code'

    # Total amount = net pay (or could be total_earnings, adjust as needed)
    def total_amount(self, obj):
        return obj.net_pay
    total_amount.short_description = 'Total Amount'