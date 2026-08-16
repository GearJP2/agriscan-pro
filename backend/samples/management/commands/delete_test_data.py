from django.core.management.base import BaseCommand, CommandError

from samples.services.test_data_service import TestDataService


class Command(BaseCommand):
    help = "Delete all generated test samples (TEST- prefix) and associated test notifications."

    def handle(self, *args, **options):
        self.stdout.write("Deleting test data...")
        try:
            result = TestDataService.delete_test_samples(user=None)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully deleted {result['deleted']} test samples."
                )
            )
        except Exception as exc:
            raise CommandError(f"Failed to delete test data: {str(exc)}")
