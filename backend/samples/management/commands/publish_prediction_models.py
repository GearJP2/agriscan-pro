from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from samples.services.prediction_model_publish_service import (
    PredictionModelPublishError,
    PredictionModelPublishService,
)


class Command(BaseCommand):
    help = 'Mark trained prediction models as published after metric review.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--version',
            default='latest',
            help='Artifact version directory to publish. Defaults to latest.',
        )
        parser.add_argument(
            '--toxins',
            default='all',
            help='Comma-separated toxin codes to publish, or "all".',
        )
        parser.add_argument(
            '--output-dir',
            default=str(settings.BASE_DIR / 'prediction_artifacts'),
            help='Directory containing versioned prediction artifacts.',
        )
        parser.add_argument(
            '--min-f1',
            type=float,
            default=0.50,
            help='Minimum F1 required to publish without --force.',
        )
        parser.add_argument(
            '--min-roc-auc',
            type=float,
            default=0.60,
            help='Minimum ROC-AUC required to publish without --force when ROC-AUC is available.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Publish selected models even if metric guardrails are not met.',
        )

    def handle(self, *args, **options):
        try:
            result = PredictionModelPublishService.publish(
                version=options['version'],
                toxins=PredictionModelPublishService.parse_toxins(options['toxins']),
                output_dir=Path(options['output_dir']),
                min_f1=options['min_f1'],
                min_roc_auc=options['min_roc_auc'],
                force=options['force'],
            )
        except PredictionModelPublishError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS(
            'Published {updated} model(s) in {version}.'.format(
                updated=result['updated'],
                version=result['version'],
            )
        ))
