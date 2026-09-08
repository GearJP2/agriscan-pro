import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from samples.services.prediction_inference_service import PredictionInferenceService


class Command(BaseCommand):
    help = 'Inspect trained prediction model artifacts before publishing.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--model-version',
            dest='model_version',
            default='latest',
            help='Artifact version directory to inspect. Defaults to latest.',
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
            help='Minimum F1 score used for the review recommendation.',
        )
        parser.add_argument(
            '--min-roc-auc',
            type=float,
            default=0.60,
            help='Minimum ROC-AUC used for the review recommendation when available.',
        )
        parser.add_argument(
            '--show-skipped',
            action='store_true',
            help='Include toxin targets skipped during training.',
        )

    def handle(self, *args, **options):
        metadata_path = self.resolve_metadata_path(
            Path(options['output_dir']),
            options['model_version'],
        )
        try:
            metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(f'Could not read prediction metadata: {exc}') from exc

        min_f1 = options['min_f1']
        min_roc_auc = options['min_roc_auc']
        summary = PredictionInferenceService.summarize_metadata(metadata_path, metadata)
        training_config = metadata.get('training_config', {})
        trained_models = metadata.get('trained_models', [])
        skipped_targets = metadata.get('skipped_targets', [])

        self.stdout.write(f'Prediction model version: {summary["version"]}')
        self.stdout.write(f'Metadata: {summary["metadataPath"]}')
        self.stdout.write(f'Created at: {summary["createdAt"] or "unknown"}')
        self.stdout.write(f'Model family: {summary["modelFamily"] or "unknown"}')
        self.stdout.write(
            'Weather features: {state}'.format(
                state='included' if training_config.get('include_weather') else 'not included',
            )
        )
        self.stdout.write(
            'Targets: {trained} trained, {published} published, {skipped} skipped'.format(
                trained=summary['trainedTargets'],
                published=summary['publishedTargets'],
                skipped=summary['skippedTargets'],
            )
        )
        self.stdout.write('')

        if not trained_models:
            self.stdout.write(self.style.WARNING('No trained toxin models found in this metadata file.'))
        else:
            self.write_target_table(summary['targets'], min_f1=min_f1, min_roc_auc=min_roc_auc)

        if options['show_skipped'] and skipped_targets:
            self.stdout.write('')
            self.stdout.write('Skipped targets')
            for target in skipped_targets:
                self.stdout.write(
                    '- {toxin}: measured={measured}, detected={detected}, '
                    'below_lod_or_zero={below_lod}, usable_context={usable}'.format(
                        toxin=target.get('toxin_type', ''),
                        measured=target.get('measured', 0),
                        detected=target.get('detected', 0),
                        below_lod=target.get('below_lod_or_zero', 0),
                        usable=target.get('usable_context', 0),
                    )
                )

        self.stdout.write('')
        self.stdout.write(
            'Publish command after review: python manage.py publish_prediction_models '
            f'--model-version {summary["version"]} --toxins <comma-separated-toxins>'
        )

    def write_target_table(self, targets, *, min_f1: float, min_roc_auc: float):
        self.stdout.write(
            '{toxin:<12} {state:<12} {rows:>8} {detected:>9} {f1:>8} {roc:>8} {decision:<18}'.format(
                toxin='Toxin',
                state='State',
                rows='Rows',
                detected='Detected',
                f1='F1',
                roc='ROC-AUC',
                decision='Review',
            )
        )
        self.stdout.write('-' * 82)
        for target in targets:
            metrics = target.get('classificationMetrics', {})
            f1 = metrics.get('f1')
            roc_auc = metrics.get('roc_auc')
            decision = self.review_decision(
                f1=f1,
                roc_auc=roc_auc,
                min_f1=min_f1,
                min_roc_auc=min_roc_auc,
            )
            state = 'published' if target.get('published') else 'unpublished'
            self.stdout.write(
                '{toxin:<12} {state:<12} {rows:>8} {detected:>9} {f1:>8} {roc:>8} {decision:<18}'.format(
                    toxin=target.get('toxinType', ''),
                    state=state,
                    rows=target.get('trainingRows', 0),
                    detected=target.get('detectedRows', 0),
                    f1=self.format_metric(f1),
                    roc=self.format_metric(roc_auc),
                    decision=decision,
                )
            )

    @staticmethod
    def review_decision(*, f1, roc_auc, min_f1: float, min_roc_auc: float) -> str:
        if f1 is None:
            return 'hold: no f1'
        if f1 < min_f1:
            return 'hold: low f1'
        if roc_auc is not None and roc_auc < min_roc_auc:
            return 'hold: low auc'
        return 'review publish'

    @staticmethod
    def format_metric(value) -> str:
        if value is None:
            return 'N/A'
        return f'{float(value):.3f}'

    @staticmethod
    def resolve_metadata_path(output_dir: Path, version: str) -> Path:
        if version == 'latest':
            candidates = sorted(output_dir.glob('*/metadata.json'), reverse=True)
            if not candidates:
                raise CommandError('No prediction metadata file was found.')
            return candidates[0]

        metadata_path = output_dir / version / 'metadata.json'
        if not metadata_path.exists():
            raise CommandError(f'No prediction metadata file was found for {version}.')
        return metadata_path
