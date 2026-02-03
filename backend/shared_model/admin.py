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