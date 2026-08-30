from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from samples.services.prediction_training_service import (
    PredictionTrainingConfig,
    PredictionTrainingService,
)


class Command(BaseCommand):
    help = 'Train baseline mycotoxin prediction models and write versioned artifacts.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output-dir',
            default=str(settings.BASE_DIR / 'prediction_artifacts'),
            help='Directory for versioned model artifacts and metadata.',
        )
        parser.add_argument('--min-detected', type=int, default=30)
        parser.add_argument('--min-below-lod-or-zero', type=int, default=30)
        parser.add_argument('--min-usable-context', type=int, default=60)

    def handle(self, *args, **options):
        config = PredictionTrainingConfig(
            min_detected=options['min_detected'],
            min_below_lod_or_zero=options['min_below_lod_or_zero'],
            min_usable_context=options['min_usable_context'],
        )
        try:
            report = PredictionTrainingService.train_and_save(
                output_dir=Path(options['output_dir']),
                config=config,
            )
        except RuntimeError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS(
            'Trained {trained} eligible toxin model(s); skipped {skipped}. Metadata: {path}'.format(
                trained=len(report['trained_models']),
                skipped=len(report['skipped_targets']),
                path=report['metadata_path'],
            )
        ))
