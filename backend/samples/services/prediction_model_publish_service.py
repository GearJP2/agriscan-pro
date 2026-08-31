"""Publish reviewed prediction model artifacts."""

import json
from pathlib import Path

from django.conf import settings


class PredictionModelPublishError(RuntimeError):
    """Raised when prediction model publishing cannot be completed."""


class PredictionModelPublishService:
    """Shared implementation for API and management-command publishing."""

    DEFAULT_MIN_F1 = 0.50
    DEFAULT_MIN_ROC_AUC = 0.60

    @classmethod
    def publish(
        cls,
        *,
        version: str = 'latest',
        toxins: list[str] | None = None,
        output_dir=None,
        min_f1: float = DEFAULT_MIN_F1,
        min_roc_auc: float = DEFAULT_MIN_ROC_AUC,
        force: bool = False,
    ) -> dict:
        metadata_path = cls.resolve_metadata_path(
            Path(output_dir or settings.BASE_DIR / 'prediction_artifacts'),
            version,
        )
        try:
            metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError) as exc:
            raise PredictionModelPublishError(f'Could not read prediction metadata: {exc}') from exc

        normalized_toxins = cls.normalize_toxins(toxins)
        trained_models = metadata.get('trained_models', [])
        selected_models = [
            model
            for model in trained_models
            if normalized_toxins is None or model.get('toxin_type') in normalized_toxins
        ]

        if normalized_toxins is not None:
            found = {model.get('toxin_type') for model in trained_models}
            missing = sorted(normalized_toxins - found)
            if missing:
                raise PredictionModelPublishError(f'Toxin model(s) not found: {", ".join(missing)}')

        if not selected_models:
            raise PredictionModelPublishError('No toxin models were selected for publishing.')

        if not force:
            failures = cls.metric_guardrail_failures(
                selected_models,
                min_f1=min_f1,
                min_roc_auc=min_roc_auc,
            )
            if failures:
                raise PredictionModelPublishError(
                    'Metric guardrails failed. Inspect models first or rerun with force enabled: '
                    + '; '.join(failures)
                )

        updated = 0
        published_toxins = []
        for model in selected_models:
            if not model.get('published', False):
                updated += 1
            model['published'] = True
            published_toxins.append(model.get('toxin_type', ''))

        try:
            metadata_path.write_text(
                json.dumps(metadata, indent=2, sort_keys=True),
                encoding='utf-8',
            )
        except OSError as exc:
            raise PredictionModelPublishError(f'Could not write prediction metadata: {exc}') from exc

        return {
            'version': metadata.get('version', metadata_path.parent.name),
            'metadataPath': str(metadata_path),
            'updated': updated,
            'publishedToxins': published_toxins,
            'publishedTargets': sum(
                1
                for model in metadata.get('trained_models', [])
                if model.get('published') is True
            ),
            'force': force,
            'minF1': min_f1,
            'minRocAuc': min_roc_auc,
        }

    @staticmethod
    def normalize_toxins(toxins: list[str] | None) -> set[str] | None:
        if toxins is None:
            return None
        normalized = {toxin.strip().upper() for toxin in toxins if toxin and toxin.strip()}
        if not normalized:
            raise PredictionModelPublishError('At least one toxin code is required.')
        return normalized

    @staticmethod
    def parse_toxins(value: str):
        if value == 'all':
            return None
        toxins = [item.strip().upper() for item in value.split(',') if item.strip()]
        if not toxins:
            raise PredictionModelPublishError('--toxins must be "all" or a comma-separated list.')
        return toxins

    @staticmethod
    def resolve_metadata_path(output_dir: Path, version: str) -> Path:
        if version == 'latest':
            candidates = sorted(output_dir.glob('*/metadata.json'), reverse=True)
            if not candidates:
                raise PredictionModelPublishError('No prediction metadata file was found.')
            return candidates[0]

        metadata_path = output_dir / version / 'metadata.json'
        if not metadata_path.exists():
            raise PredictionModelPublishError(f'No prediction metadata file was found for {version}.')
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
