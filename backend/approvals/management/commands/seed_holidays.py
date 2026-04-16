# your_app/management/commands/seed_holidays.py

import json
from datetime import date as date_cls
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

from django.core.management.base import BaseCommand
from django.db import transaction

from shared_model.models import Holiday  #  change to your actual import


NAGER_URL = "https://date.nager.at/api/v3/PublicHolidays/{year}/{country}"

# =========================
#  GLOBAL (hardcoded) DATA
# =========================
# Use real "global" dates your org wants (these are SAFE placeholders you can edit).
# If you don't want placeholders, just replace with your exact global list.
GLOBAL_HOLIDAYS = [
    # example global observances / org-wide days
    {"month": 1, "day": 1, "name": "Global New Year’s Day", "type": "Regular"},
    {"month": 12, "day": 25, "name": "Global Christmas Day", "type": "Regular"},
]

# ========================
#  FIXED (hardcoded) DATA
# ========================
# "Fixed" = recurring company-specific dates (same month/day every year).
# Replace with your actual fixed company holidays.
FIXED_HOLIDAYS = [
    {"month": 2, "day": 14, "name": "Company Foundation Day", "type": "Company Holiday"},
    {"month": 12, "day": 31, "name": "Year-End Company Holiday", "type": "Company Holiday"},
]


def safe_name(raw: str, max_len: int = 50) -> str:
    """
    Holiday.name max_length=50
    If longer, truncate safely.
    """
    raw = (raw or "").strip()
    if len(raw) <= max_len:
        return raw
    return raw[: max_len - 1].rstrip() + "…"


def fetch_public_holidays(year: int, country: str) -> list[dict]:
    url = NAGER_URL.format(year=year, country=country)
    req = Request(url, headers={"User-Agent": "DjangoHolidaySeeder/1.0"})
    with urlopen(req, timeout=30) as resp:
        payload = resp.read().decode("utf-8")
        return json.loads(payload)


def upsert_holiday(
    *,
    holiday_date: date_cls,
    base: str,
    name: str,
    h_type: str,
    status: str,
    is_active: bool = True,
    remarks=None,
):
    return Holiday.objects.update_or_create(
        date=holiday_date,
        base=base,
        defaults={
            "name": safe_name(name, 50),
            "type": h_type,
            "status": status,
            "is_active": is_active,
            "remarks": remarks,
        },
    )


class Command(BaseCommand):
    help = "Seed PH/US (Nager.Date) + GLOBAL + FIXED holidays into Holiday table."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, default=2026, help="Year to seed (default: 2026)")

        parser.add_argument(
            "--countries",
            nargs="+",
            default=["PH", "US"],
            help='Country codes to seed from Nager.Date (default: PH US)',
        )

        parser.add_argument(
            "--status",
            type=str,
            default="Approved",
            choices=["Pending", "Approved", "Declined"],
            help="Status to set for seeded holidays (default: Approved)",
        )

        parser.add_argument(
            "--type",
            type=str,
            default="Regular",
            choices=["Regular", "Special Non-Working", "Special Working", "Company Holiday"],
            help="Default type for Nager.Date holidays (default: Regular)",
        )

        parser.add_argument(
            "--include-global",
            action="store_true",
            help="Also seed hardcoded GLOBAL holidays",
        )

        parser.add_argument(
            "--include-fixed",
            action="store_true",
            help="Also seed hardcoded FIXED holidays",
        )

        parser.add_argument(
            "--global-base",
            type=str,
            default="GLOBAL",
            help='Base value for global holidays (default: "GLOBAL")',
        )

        parser.add_argument(
            "--fixed-base",
            type=str,
            default="FIXED",
            help='Base value for fixed holidays (default: "FIXED")',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        year: int = options["year"]
        countries: list[str] = [c.upper().strip() for c in options["countries"]]
        default_status: str = options["status"]
        default_type: str = options["type"]

        include_global: bool = options["include_global"]
        include_fixed: bool = options["include_fixed"]
        global_base: str = (options["global_base"] or "GLOBAL").upper().strip()
        fixed_base: str = (options["fixed_base"] or "FIXED").upper().strip()

        created_count = 0
        updated_count = 0

        # -------------------------
        # 1) NAGER.DATE (PH/US ...)
        # -------------------------
        supported_api_bases = {"PH", "US"}  # adjust if you want more
        for c in countries:
            if c not in supported_api_bases:
                self.stdout.write(
                    self.style.WARNING(f"Skipping {c}: API seeding supports only {sorted(supported_api_bases)}")
                )

        countries = [c for c in countries if c in supported_api_bases]

        if countries:
            for country in countries:
                self.stdout.write(f"\nFetching {year} holidays for {country} (Nager.Date)...")
                try:
                    items = fetch_public_holidays(year, country)
                except (HTTPError, URLError, TimeoutError) as e:
                    self.stdout.write(self.style.ERROR(f"Failed to fetch {country}: {e}"))
                    continue
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Unexpected error fetching {country}: {e}"))
                    continue

                for item in items:
                    d_str = item.get("date")
                    if not d_str:
                        continue
                    try:
                        holiday_date = date_cls.fromisoformat(d_str)
                    except ValueError:
                        continue

                    raw_name = item.get("localName") or item.get("name") or ""
                    obj, created = upsert_holiday(
                        holiday_date=holiday_date,
                        base=country,
                        name=raw_name,
                        h_type=default_type,      # API doesn't map to your choices
                        status=default_status,    # default Approved
                        is_active=True,
                        remarks=None,
                    )
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

                self.stdout.write(self.style.SUCCESS(f"Done: {country} ({len(items)} records pulled)."))
        else:
            self.stdout.write(self.style.WARNING("No valid API countries selected. (PH/US only)"))

        # -------------------------
        # 2) GLOBAL (hardcoded list)
        # -------------------------
        if include_global:
            self.stdout.write(f"\nSeeding GLOBAL holidays for {year}...")
            for h in GLOBAL_HOLIDAYS:
                try:
                    holiday_date = date_cls(year, int(h["month"]), int(h["day"]))
                except Exception:
                    continue

                obj, created = upsert_holiday(
                    holiday_date=holiday_date,
                    base=global_base,
                    name=h.get("name", ""),
                    h_type=h.get("type") or "Regular",
                    status=default_status,
                    is_active=True,
                    remarks=None,
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1

            self.stdout.write(self.style.SUCCESS(f"Done: GLOBAL ({len(GLOBAL_HOLIDAYS)} records)."))

        # -------------------------
        # 3) FIXED (recurring list)
        # -------------------------
        if include_fixed:
            self.stdout.write(f"\nSeeding FIXED holidays for {year}...")
            for h in FIXED_HOLIDAYS:
                try:
                    holiday_date = date_cls(year, int(h["month"]), int(h["day"]))
                except Exception:
                    continue

                obj, created = upsert_holiday(
                    holiday_date=holiday_date,
                    base=fixed_base,
                    name=h.get("name", ""),
                    h_type=h.get("type") or "Company Holiday",
                    status=default_status,
                    is_active=True,
                    remarks=None,
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1

            self.stdout.write(self.style.SUCCESS(f"Done: FIXED ({len(FIXED_HOLIDAYS)} records)."))

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSeed complete for year {year}. Created: {created_count}, Updated: {updated_count}"
            )
        )
