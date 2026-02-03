from django.core.management.base import BaseCommand
from shared_model.models import Province, City, Barangay
import requests

PSGC_BASE = "https://psgc.gitlab.io/api"

class Command(BaseCommand):
    help = "Seed Cebu province, its cities, and barangays from PSGC API"

    def handle(self, *args, **kwargs):
        self.stdout.write("📥 Fetching Region 7 provinces from PSGC API...")

        # --- Get all Region 7 provinces ---
        region_provinces = requests.get(f"{PSGC_BASE}/regions/070000000/provinces.json").json()

        # --- Find Cebu province ---
        province_data = next((p for p in region_provinces if p["name"] == "Cebu"), None)
        if not province_data:
            self.stdout.write(self.style.ERROR("❌ Cebu province not found in PSGC API"))
            return

        province_obj, _ = Province.objects.get_or_create(name=province_data["name"])
        prov_code = province_data["code"]
        self.stdout.write(f"➡️ Province: {province_data['name']}")

        # --- Cities / Municipalities ---
        municipalities = requests.get(
            f"{PSGC_BASE}/provinces/{prov_code}/cities-municipalities.json"
        ).json()

        for city_data in municipalities:
            city_obj, _ = City.objects.get_or_create(
                name=city_data["name"],
                province=province_obj
            )
            self.stdout.write(f"   🏙 City: {city_data['name']}")

            # --- Barangays ---
            barangays = requests.get(
                f"{PSGC_BASE}/cities-municipalities/{city_data['code']}/barangays.json"
            ).json()

            for brgy_data in barangays:
                Barangay.objects.get_or_create(
                    name=brgy_data["name"],
                    city=city_obj
                )

            self.stdout.write(f"      ✅ {len(barangays)} barangays added under {city_data['name']}")

        self.stdout.write(self.style.SUCCESS("🎉 Cebu province, its cities, and barangays seeded successfully!"))
