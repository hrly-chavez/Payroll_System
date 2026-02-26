from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import time, date, timedelta
from shared_model.models import (
    Department, Shift, Shift_Workday, Deduction_Type,
    Allowance_Type, Commission_Type, HolidayPolicy,
    Leave_Type, Pay_Rule
)

class Command(BaseCommand):
    help = "Seed initial data for Departments, Shifts, Allowances, Deductions, etc."

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding initial data...")

        # 1️⃣ Shifts
        shifts_data = [
            {"name": "Day Shift", "start_time": time(8, 0), "end_time": time(17, 0), "break_minutes": 60, "grace_minutes": 15},
            {"name": "Night Shift", "start_time": time(22, 0), "end_time": time(6, 0), "break_minutes": 60, "grace_minutes": 15, "crosses_midnight": True, "is_overnight": True},
        ]
        shifts = []
        for s in shifts_data:
            shift, _ = Shift.objects.get_or_create(**s)
            shifts.append(shift)
        self.stdout.write(f"Created {len(shifts)} shifts")

        # 2️⃣ Departments
        dept_names = ["Management", "Operations", "Fulfillment", "HR", "IT", "Accounting"]
        departments = []

        for name in dept_names:
            dept, created = Department.objects.get_or_create(
                name=name,
                defaults={
                    "holiday_base": "PH",
                    "shift_id": shifts[0],  # ✅ Shift instance because your field is named shift_id
                }
            )
            departments.append(dept)

        self.stdout.write(f"Created {len(departments)} departments")

        # 3️⃣ Shift Workdays
        for shift in shifts:
            for day in range(1, 8):  # Monday=1 ... Sunday=7
                Shift_Workday.objects.get_or_create(
                    shift=shift,
                    day_of_week=day,
                    defaults={"is_workday": day <= 5}  # Mon-Fri workdays
                )
        self.stdout.write("Created shift workdays")

        # 4️⃣ Deduction Types
        deductions = [
            {"code": "SSS", "category": "TAX", "calculation_type": "Percent", "amount": 11.0},
            {"code": "PhilHealth", "category": "TAX", "calculation_type": "Percent", "amount": 4.0},
            {"code": "Pag-IBIG", "category": "TAX", "calculation_type": "Percent", "amount": 2.0},
            {"code": "Company Loan", "category": "OTHER", "calculation_type": "Fixed", "amount": 1000.0},
        ]
        for d in deductions:
            Deduction_Type.objects.get_or_create(**d)
        self.stdout.write(f"Created {len(deductions)} deduction types")

        # 5️⃣ Allowance Types
        allowances = ["Meal Allowance", "Transportation", "Mobile Allowance", "Housing Allowance"]
        for a in allowances:
            Allowance_Type.objects.get_or_create(name=a)
        self.stdout.write(f"Created {len(allowances)} allowance types")

        # 6️⃣ Commission Types
        commissions = ["Sales Commission", "Referral Bonus"]
        for c in commissions:
            Commission_Type.objects.get_or_create(name=c, is_taxable=True)
        self.stdout.write(f"Created {len(commissions)} commission types")

        # 7️⃣ Holiday Policies (for all departments)
        holiday_types = ["Regular", "Special Non-Working", "Special Working", "Company Holiday"]
        for dept in departments:
            for h_type in holiday_types:
                HolidayPolicy.objects.get_or_create(
                    department=dept,
                    holiday_type=h_type,
                    defaults={"requires_work": h_type != "Regular"}
                )
        self.stdout.write("Created holiday policies")

        # 8️⃣ Leave Types
        leaves = [
            {"name": "Sick Leave", "is_paid": True},
            {"name": "Vacation Leave", "is_paid": True},
            {"name": "Unpaid Leave", "is_paid": False},
        ]
        for l in leaves:
            Leave_Type.objects.get_or_create(**l)
        self.stdout.write(f"Created {len(leaves)} leave types")

        # 9️⃣ Pay Rules
        pay_rules_data = [
            {"name": "Night Differential", "event_type": "Night Differential", "category": "Earning", "rate_type": "MULTIPLIER", "rate_value": 1.2},
            {"name": "Late Deduction", "event_type": "Late", "category": "Deduction", "rate_type": "PER_MINUTE", "rate_value": 1.0},
            {"name": "Overtime", "event_type": "Overtime", "category": "Earning", "rate_type": "MULTIPLIER", "rate_value": 1.5},
        ]
        today = date.today()
        for rule in pay_rules_data:
            Pay_Rule.objects.get_or_create(
                name=rule["name"],
                defaults={
                    "event_type": rule["event_type"],
                    "category": rule["category"],
                    "rate_type": rule["rate_type"],
                    "rate_value": rule["rate_value"],
                    "effective_from": today,
                    "is_active": True,
                    "applies_to": departments[0]  # default: Management
                }
            )
        self.stdout.write(f"Created {len(pay_rules_data)} pay rules")

        self.stdout.write(self.style.SUCCESS("Seeding complete!"))