import pandas as pd
from django.core.management.base import BaseCommand
from django.utils.timezone import make_aware
from datetime import datetime, date
from shared_model.models import Employee, Attendance, Shift, Department
import os
import re

class Command(BaseCommand):
    help = "Seed employees and attendance from Excel (.xls or .xlsx) with packed string rows"

    def add_arguments(self, parser):
        parser.add_argument("file_path", type=str)

    def handle(self, *args, **kwargs):
        file_path = kwargs["file_path"]

        # -------------------------
        # Detect engine based on file extension
        # -------------------------
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".xls":
            engine = "xlrd"
        elif ext == ".xlsx":
            engine = "openpyxl"
        else:
            self.stdout.write(self.style.ERROR("Unsupported file type. Use .xls or .xlsx"))
            return

        # -------------------------
        # Fetch shift and department once
        # -------------------------
        try:
            shift = Shift.objects.get(id=1)
            department = Department.objects.get(id=2)
        except Shift.DoesNotExist:
            self.stdout.write(self.style.ERROR("Shift with ID 1 does not exist"))
            return
        except Department.DoesNotExist:
            self.stdout.write(self.style.ERROR("Department with ID 2 does not exist"))
            return

        # -------------------------
        # Read Excel file
        # -------------------------
        try:
            df = pd.read_excel(file_path, engine=engine, header=None)
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f"File not found: {file_path}"))
            return
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Failed to read Excel file: {e}"))
            return

        # -------------------------
        # Parse each row (packed string)
        # -------------------------
        for _, row in df.iterrows():
            raw = str(row[0]).strip()  # assume the first column has the packed string
            match = re.search(r"ID:(\S+)\s+Name:(.*?)\s+Dept:(\S+)\s+Shift:(\S+)", raw)
            if not match:
                self.stdout.write(self.style.WARNING(f"Skipping invalid row: {raw}"))
                continue

            id_no, full_name, dept_name, shift_name = match.groups()

            # -------------------------
            # Handle missing name safely
            # -------------------------
            full_name = full_name.strip()
            if not full_name:
                self.stdout.write(self.style.WARNING(f"Row with ID {id_no} has empty name. Using 'Unknown'."))
            name_parts = full_name.split() if full_name else []
            fname = name_parts[0] if len(name_parts) >= 1 else "Unknown"
            lname = name_parts[-1] if len(name_parts) >= 2 else "Unknown"

            # -------------------------
            # CREATE EMPLOYEE IF NOT EXISTS
            # -------------------------
            employee, created = Employee.objects.get_or_create(
                id_no=id_no,
                defaults={
                    "fname": fname,
                    "lname": lname,
                    "contact_no": "09123456789",
                    "hired_date": date.today(),
                    "position": "Agent",
                    "email": f"{id_no}@payroll.local",
                    "shift": shift,
                    "department": department,
                    "is_active": True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created employee {id_no}"))

            # -------------------------
            # ATTENDANCE
            # -------------------------
            # For now, just mark as PRESENT today
            att_date = date.today()
            time_in = None
            time_out = None
            status = "PRESENT"

            Attendance.objects.update_or_create(
                employee=employee,
                date=att_date,
                defaults={
                    "time_in": time_in,
                    "time_out": time_out,
                    "status": status,
                },
            )

        self.stdout.write(self.style.SUCCESS("Seeding completed!"))