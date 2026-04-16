import pandas as pd
from django.core.management.base import BaseCommand
from django.utils.timezone import make_aware
from datetime import datetime, date, timedelta
from calendar import monthrange
from shared_model.models import Employee, Attendance, Shift, Department
from django.contrib.auth import get_user_model
import re
import os

User = get_user_model()


class Command(BaseCommand):
    help = "Import employees and attendance from biometric Excel"

    def add_arguments(self, parser):
        parser.add_argument("file_path", type=str)

    def handle(self, *args, **kwargs):
        file_path = kwargs["file_path"]

        ext = os.path.splitext(file_path)[1].lower()
        engine = "xlrd" if ext == ".xls" else "openpyxl"

        df = pd.read_excel(file_path, engine=engine, header=None)

        shift = Shift.objects.get(id=1)
        department = Department.objects.get(id=2)

        i = 0

        # -------------------------
        # PARSE YEAR FROM FILE HEADER (Optional)
        # Example: "2026:1/25-2/7 Punch"
        # -------------------------
        header_raw = str(df.iloc[0, 0])
        year_match = re.search(r"(\d{4})", header_raw)
        IMPORT_YEAR = int(year_match.group(1)) if year_match else 2026

        # Example header: "2026:2/8-2/26 Punch"
        header_raw = str(df.iloc[0, 0])
        year_match = re.search(r"(\d{4})", header_raw)
        IMPORT_YEAR = int(year_match.group(1)) if year_match else 2026

        # Extract starting month/day
        start_match = re.search(r"(\d{1,2})/(\d{1,2})", header_raw)
        if start_match:
            start_month = int(start_match.group(1))
            start_day = int(start_match.group(2))
        else:
            start_month = 1
            start_day = 1

        while i < len(df):
            raw = str(df.iloc[i, 0])
            if "ID:" not in raw:
                i += 1
                continue

            match = re.search(r"ID:(\S+)\s+Name:(.*?)\s+Dept:(\S+)\s+Shift:(\S+)", raw)
            if not match:
                i += 1
                continue

            id_no, full_name, dept_name, shift_name = match.groups()
            # Split the name
            name_parts = full_name.strip().split()

            # Skip only if BOTH first name and last name are missing
            if not name_parts:
                self.stdout.write(self.style.WARNING(f"Skipping employee with no name: '{full_name}'"))
                i += 3  # skip this employee's 3-row block
                continue

            fname = name_parts[0]
            lname = name_parts[-1] if len(name_parts) > 1 else ""

            # -------------------------
            # CREATE EMPLOYEE
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

            # -------------------------
            # CREATE USER ACCOUNT
            # -------------------------
            if not hasattr(employee, "user"):
                base_username = fname.lower()
                username = base_username
                counter = 1
                while User.objects.filter(user_name=username).exists():
                    username = f"{base_username}{counter}"
                    counter += 1

                User.objects.create_user(
                    user_name=username,
                    password=f"{fname.lower()}123",
                    role="EMPLOYEE",
                    employee=employee,
                    is_active=True,
                )
                self.stdout.write(self.style.SUCCESS(f"Created user account: {username}"))

            # -------------------------
            # ATTENDANCE IMPORT (FIXED - PAIRING LOGIC)
            # -------------------------
            dates_row = df.iloc[i + 1]
            times_row = df.iloc[i + 2]

            # Dynamic rolling date variables
            current_year = IMPORT_YEAR
            current_month = None
            previous_day = None

            all_punches = []

            # -------------------------
            # STEP 1: COLLECT ALL PUNCHES
            # -------------------------
            for col in range(1, len(dates_row)):
                day_cell = dates_row[col]
                if pd.isna(day_cell):
                    continue

                try:
                    day = int(float(day_cell))
                except ValueError:
                    continue

                # Initialize month
                if current_month is None:
                    current_month = start_month

                # Month rollover
                if previous_day is not None and day < previous_day:
                    if current_month == 12:
                        current_month = 1
                        current_year += 1
                    else:
                        current_month += 1

                # Validate day
                max_days = monthrange(current_year, current_month)[1]
                if day > max_days:
                    if current_month == 12:
                        current_month = 1
                        current_year += 1
                    else:
                        current_month += 1
                    day = 1

                attendance_date = date(current_year, current_month, day)
                previous_day = day

                raw_times = str(times_row[col]).strip()
                if raw_times == "0":
                    continue

                times = re.findall(r"\d{2}:\d{2}", raw_times)
                if not times:
                    continue

                parsed = sorted([datetime.strptime(t, "%H:%M").time() for t in times])

                # Convert to datetime and store
                for t in parsed:
                    dt = make_aware(datetime.combine(attendance_date, t))
                    all_punches.append(dt)

            # -------------------------
            # STEP 2: SORT ALL PUNCHES
            # -------------------------
            all_punches = sorted(all_punches)

            # -------------------------
            # STEP 3: PAIR PUNCHES (IN → OUT)
            # -------------------------
            paired = []

            idx = 0
            while idx < len(all_punches):
                time_in = all_punches[idx]
                time_out = None

                if idx + 1 < len(all_punches):
                    next_punch = all_punches[idx + 1]

                    # If within 16 hours → valid pair
                    if (next_punch - time_in).total_seconds() <= 16 * 3600:
                        time_out = next_punch
                        idx += 2
                    else:
                        idx += 1
                else:
                    idx += 1

                paired.append((time_in, time_out))

            # -------------------------
            # STEP 4: SAVE TO DATABASE
            # -------------------------
            for time_in, time_out in paired:
                attendance_date = time_in.date()

                attendance, _ = Attendance.objects.update_or_create(
                    employee=employee,
                    date=attendance_date,
                    defaults={"status": "PRESENT"},
                )

                # Do NOT overwrite existing values
                if not attendance.time_in:
                    attendance.time_in = time_in

                if time_out and not attendance.time_out:
                    attendance.time_out = time_out

                attendance.save()

            i += 3

        self.stdout.write(self.style.SUCCESS("Attendance import completed"))