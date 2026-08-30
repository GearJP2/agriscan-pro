from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from samples.services.prediction_dataset_service import PredictionDatasetService


class Command(BaseCommand):
    help = 'Export model-ready sample/toxin rows for prediction training.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            help='Optional CSV output path. If omitted, CSV is written to stdout.',
        )
        parser.add_argument(
            '--include-weather',
            action='store_true',
            help='Fetch/cache and include 90-day pre-collection NASA POWER weather features.',
        )
        parser.add_argument(
            '--cached-weather-only',
            action='store_true',
            help='Use cached prediction weather only; missing cache values are exported blank/zero.',
        )

    def handle(self, *args, **options):
        output_path = options.get('output')
        if not output_path:
            PredictionDatasetService.write_csv(
                self.stdout,
                include_weather=options['include_weather'],
                fetch_weather=not options['cached_weather_only'],
            )
            return

        path = Path(output_path)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open('w', newline='', encoding='utf-8') as handle:
                row_count = PredictionDatasetService.write_csv(
                    handle,
                    include_weather=options['include_weather'],
                    fetch_weather=not options['cached_weather_only'],
                )
        except OSError as exc:
            raise CommandError(f'Could not write prediction dataset: {exc}') from exc

        self.stdout.write(self.style.SUCCESS(
            f'Exported {row_count} prediction dataset rows to {path}'
        ))
