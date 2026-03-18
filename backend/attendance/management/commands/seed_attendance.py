import pandas as pd
from django.core.management.base import BaseCommand
from django.utils.timezone import make_aware
from datetime import datetime, date, timedelta
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

        IMPORT_YEAR = 2026
        IMPORT_MONTH = 2

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

            name_parts = full_name.split()
            fname = name_parts[0] if name_parts else "Unknown"
            lname = name_parts[-1] if len(name_parts) > 1 else "Unknown"

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

                # ensure username uniqueness
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
            # ATTENDANCE IMPORT
            # -------------------------

            dates_row = df.iloc[i + 1]
            times_row = df.iloc[i + 2]

            previous_attendance = None

            for col in range(1, len(dates_row)):

                day = dates_row[col]

                if pd.isna(day):
                    continue

                raw_times = str(times_row[col]).strip()

                if raw_times == "0":
                    continue

                times = re.findall(r"\d{2}:\d{2}", raw_times)

                if not times:
                    continue

                parsed = sorted([datetime.strptime(t, "%H:%M").time() for t in times])

                attendance_date = date(IMPORT_YEAR, IMPORT_MONTH, int(day))

                for t in parsed:

                    # -------------------------
                    # MIDNIGHT PUNCH (TIME IN)
                    # -------------------------
                    if 0 <= t.hour < 6:

                        attendance, created = Attendance.objects.update_or_create(
                            employee=employee,
                            date=attendance_date,
                            defaults={"status": "PRESENT"},
                        )

                        if not attendance.time_in:
                            attendance.time_in = make_aware(
                                datetime.combine(attendance_date, t)
                            )
                            attendance.save()

                        previous_attendance = attendance


                    # -------------------------
                    # MORNING PUNCH (TIME OUT)
                    # -------------------------
                    elif t.hour <= shift.end_time.hour:

                        if previous_attendance and not previous_attendance.time_out:

                            previous_attendance.time_out = make_aware(
                                datetime.combine(previous_attendance.date + timedelta(days=1), t)
                            )
                            previous_attendance.save()

                        else:

                            Attendance.objects.update_or_create(
                                employee=employee,
                                date=attendance_date,
                                defaults={
                                    "time_out": make_aware(datetime.combine(attendance_date, t)),
                                    "status": "PRESENT",
                                },
                            )


                    # -------------------------
                    # NIGHT PUNCH (TIME IN)
                    # -------------------------
                    else:

                        attendance, created = Attendance.objects.update_or_create(
                            employee=employee,
                            date=attendance_date,
                            defaults={"status": "PRESENT"},
                        )

                        if not attendance.time_in:
                            attendance.time_in = make_aware(
                                datetime.combine(attendance_date, t)
                            )
                            attendance.save()

                        previous_attendance = attendance
            i += 3

        self.stdout.write(self.style.SUCCESS("Attendance import completed"))