from django.core.management.base import BaseCommand, CommandError

from samples.models import Sample
from samples.services.prediction_weather_service import (
    PredictionWeatherService,
    PredictionWeatherServiceError,
)


class Command(BaseCommand):
    help = 'Prefetch/cache 90-day NASA POWER weather features for registered samples.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, help='Maximum number of unique province/date windows to fetch.')

    def handle(self, *args, **options):
        seen = set()
        fetched = 0
        failed = 0
        samples = (
            Sample.objects.exclude(province='')
            .exclude(province__iexact='unknown')
            .order_by('province', 'collection_date')
        )

        for sample in samples:
            key = (sample.province, sample.collection_date)
            if key in seen:
                continue
            seen.add(key)
            if options.get('limit') and fetched >= options['limit']:
                break

            try:
                PredictionWeatherService.get_features(sample.province, sample.collection_date)
                fetched += 1
            except PredictionWeatherServiceError as exc:
                failed += 1
                self.stderr.write(f'Failed {sample.province} {sample.collection_date}: {exc}')

        if failed:
            raise CommandError(f'Cached {fetched} weather window(s); {failed} failed.')

        self.stdout.write(self.style.SUCCESS(f'Cached {fetched} prediction weather window(s).'))
