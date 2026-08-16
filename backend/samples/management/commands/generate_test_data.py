from datetime import datetime
from django.core.management.base import BaseCommand, CommandError

from samples.services.test_data_service import TestDataService


class Command(BaseCommand):
    help = "Generate realistic test samples for UI and analytics verification."

    def add_arguments(self, parser):
        parser.add_argument(
            "--seed",
            type=int,
            default=42,
            help="Random seed for reproducible sample generation (default: 42)",
        )
        parser.add_argument(
            "--as-of",
            type=str,
            default=None,
            help="Anchor date (YYYY-MM-DD) for deterministic generation across days",
        )

    def handle(self, *args, **options):
        seed = options["seed"]
        as_of_str = options.get("as_of")
        as_of_date = None

        if as_of_str:
            try:
                as_of_date = datetime.strptime(as_of_str, "%Y-%m-%d").date()
            except ValueError:
                raise CommandError(f"Invalid date format for --as-of: '{as_of_str}'. Use YYYY-MM-DD.")

        self.stdout.write(f"Generating test data with seed={seed}, as_of={as_of_date or 'today'}...")
        try:
            result = TestDataService.generate_test_samples(user=None, seed=seed, as_of=as_of_date)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully generated {result['created']} test samples "
                    f"({result['positive']} positive, {result['negative']} negative)."
                )
            )
        except Exception as exc:
            raise CommandError(f"Failed to generate test data: {str(exc)}")
