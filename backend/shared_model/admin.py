from django.contrib import admin
from .models import *

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'user_name', 'role', 'is_active', 'emp_id')
    list_filter = ('role', 'is_active')
    search_fields = ('user_name',)
