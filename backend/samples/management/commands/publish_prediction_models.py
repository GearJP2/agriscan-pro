import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


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
        metadata_path = self.resolve_metadata_path(
            Path(options['output_dir']),
            options['version'],
        )
        try:
            metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(f'Could not read prediction metadata: {exc}') from exc

        toxins = self.parse_toxins(options['toxins'])
        updated = 0
        trained_models = metadata.get('trained_models', [])
        selected_models = []
        for model in trained_models:
            toxin_type = model.get('toxin_type')
            if toxins is None or toxin_type in toxins:
                selected_models.append(model)

        if not options['force']:
            failures = self.metric_guardrail_failures(
                selected_models,
                min_f1=options['min_f1'],
                min_roc_auc=options['min_roc_auc'],
            )
            if failures:
                raise CommandError(
                    'Metric guardrails failed. Inspect models first or rerun with --force: '
                    + '; '.join(failures)
                )

        for model in selected_models:
            if not model.get('published', False):
                updated += 1
            model['published'] = True

        if toxins is not None:
            found = {model.get('toxin_type') for model in trained_models}
            missing = sorted(toxins - found)
            if missing:
                raise CommandError(f'Toxin model(s) not found: {", ".join(missing)}')

        metadata_path.write_text(
            json.dumps(metadata, indent=2, sort_keys=True),
            encoding='utf-8',
        )
        self.stdout.write(self.style.SUCCESS(
            f'Published {updated} model(s) in {metadata_path.parent.name}.'
        ))

    @staticmethod
    def parse_toxins(value):
        if value == 'all':
            return None
        toxins = {item.strip().upper() for item in value.split(',') if item.strip()}
        if not toxins:
            raise CommandError('--toxins must be "all" or a comma-separated list.')
        return toxins

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

    @staticmethod
    def metric_guardrail_failures(models: list[dict], *, min_f1: float, min_roc_auc: float) -> list[str]:
        failures = []
        for model in models:
            toxin_type = model.get('toxin_type', '')
            metrics = model.get('classification_metrics', {})
            f1 = metrics.get('f1')
            roc_auc = metrics.get('roc_auc')
            if f1 is None:
                failures.append(f'{toxin_type}: missing f1')
                continue
            if f1 < min_f1:
                failures.append(f'{toxin_type}: f1 {f1:.3f} < {min_f1:.3f}')
            if roc_auc is not None and roc_auc < min_roc_auc:
                failures.append(f'{toxin_type}: roc_auc {roc_auc:.3f} < {min_roc_auc:.3f}')
        return failures
