import json

from datetime import date as date_cls, datetime
from urllib.request import urlopen, Request

from shared_model.models import Holiday


NAGER_URL = "https://date.nager.at/api/v3/PublicHolidays/{year}/{country}"


def safe_name(raw: str, max_len: int = 50) -> str:
    raw = (raw or "").strip()

    if len(raw) <= max_len:
        return raw

    return raw[: max_len - 1].rstrip() + "…"


def fetch_public_holidays(year: int, country: str):
    url = NAGER_URL.format(year=year, country=country)

    req = Request(
        url,
        headers={"User-Agent": "PayrollSystem/1.0"}
    )

    with urlopen(req, timeout=30) as resp:
        payload = resp.read().decode("utf-8")

        return json.loads(payload)


def generate_holidays(year: int):
    countries = ["PH", "US"]

    created_count = 0

    for country in countries:

        items = fetch_public_holidays(year, country)

        for item in items:

            d_str = item.get("date")

            if not d_str:
                continue

            holiday_date = date_cls.fromisoformat(d_str)

            raw_name = item.get("localName") or item.get("name")

            _, created = Holiday.objects.update_or_create(
                date=holiday_date,
                base=country,
                defaults={
                    "name": safe_name(raw_name),
                    "type": "Regular",
                    "status": "Approved",
                    "is_active": True,
                },
            )

            if created:
                created_count += 1

    return created_count


def auto_generate_next_year_holidays():
    next_year = datetime.now().year + 1

    exists = Holiday.objects.filter(
        date__year=next_year
    ).exists()

    if exists:
        return

    generate_holidays(next_year)

    print(f"Auto-generated holidays for {next_year}")