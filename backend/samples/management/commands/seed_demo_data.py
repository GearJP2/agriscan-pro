from django.core.management.base import BaseCommand, CommandError

from samples.services.test_data_service import TestDataService


class Command(BaseCommand):
    help = "Seed demo samples using the centralized TestDataService (legacy compatibility command)."

    def handle(self, *args, **options):
        self.stdout.write("Seeding demo samples...")
        try:
            result = TestDataService.generate_test_samples(user=None, seed=42)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully seeded {result['created']} test samples."
                )
            )
        except Exception as exc:
            raise CommandError(f"Failed to seed demo data: {str(exc)}")
