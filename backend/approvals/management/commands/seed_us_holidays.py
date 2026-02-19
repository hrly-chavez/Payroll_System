import json
from datetime import date as date_cls
from urllib.request import urlopen, Request

from django.core.management.base import BaseCommand
from django.db import transaction

from shared_model.models import Holiday  # ✅ change this


class Command(BaseCommand):
    help = "Seed US public holidays from Nager.Date API"

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, default=2026)

    @transaction.atomic
    def handle(self, *args, **options):
        year = options["year"]
        url = f"https://date.nager.at/api/v3/PublicHolidays/{year}/US"

        self.stdout.write(f"Fetching US holidays for {year}...")

        req = Request(url, headers={"User-Agent": "DjangoHolidaySeeder"})
        response = urlopen(req)
        data = json.loads(response.read().decode("utf-8"))

        created_count = 0
        updated_count = 0

        for item in data:
            holiday_date = date_cls.fromisoformat(item["date"])
            holiday_name = (item.get("localName") or item.get("name"))[:50]

            obj, created = Holiday.objects.update_or_create(
                date=holiday_date,
                base="US",
                defaults={
                    "name": holiday_name,
                    "type": "Regular",  # US federal holidays = Regular
                    "status": "Approved",
                    "is_active": True,
                },
            )

            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created: {created_count}, Updated: {updated_count}"
            )
        )
