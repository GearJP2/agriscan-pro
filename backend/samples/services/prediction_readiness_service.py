"""Data-quality checks that gate mycotoxin model training and publication."""

import json
from pathlib import Path

from django.conf import settings
from django.db.models import Count, Q

from ..constants.mycotoxin_constants import TOXIN_LABELS
from ..models import MycotoxinResult


class PredictionReadinessService:
    """Summarise whether the stored lab results support a defensible baseline."""

    MIN_DETECTED = 30
    MIN_BELOW_LOD = 30
    MIN_CONTEXT_COVERAGE = 60

    @classmethod
    def get_readiness(cls) -> dict:
        model_metadata = cls.get_latest_model_metadata()
        context_filter = (
            Q(sample__collection_date__isnull=False)
            & Q(sample__province__isnull=False)
            & ~Q(sample__province__iexact='')
            & ~Q(sample__province__iexact='unknown')
        )
        rows = (
            MycotoxinResult.objects.values('toxin_type')
            .annotate(
                measured=Count('id'),
                detected=Count('id', filter=Q(value__gt=0)),
                below_lod=Count('id', filter=Q(is_below_lod=True)),
                usable_context=Count('id', filter=context_filter),
            )
            .order_by('toxin_type')
        )

        targets = []
        for row in rows:
            below_lod_or_zero = row['measured'] - row['detected']
            eligible = (
                row['detected'] >= cls.MIN_DETECTED
                and below_lod_or_zero >= cls.MIN_BELOW_LOD
                and row['usable_context'] >= cls.MIN_CONTEXT_COVERAGE
            )
            targets.append({
                'toxinType': row['toxin_type'],
                'label': TOXIN_LABELS.get(row['toxin_type'], row['toxin_type']),
                'measured': row['measured'],
                'detected': row['detected'],
                'belowLodOrZero': below_lod_or_zero,
                'belowLodRecorded': row['below_lod'],
                'usableContext': row['usable_context'],
                'eligibleForBaseline': eligible,
            })

        targets.sort(key=lambda item: (-item['detected'], item['toxinType']))
        eligible_count = sum(target['eligibleForBaseline'] for target in targets)
        return {
            'modelStatus': 'trained' if model_metadata else 'not_trained',
            'latestModel': model_metadata,
            'trainingGuardrails': {
                'minDetected': cls.MIN_DETECTED,
                'minBelowLodOrZero': cls.MIN_BELOW_LOD,
                'minUsableContext': cls.MIN_CONTEXT_COVERAGE,
            },
            'summary': {
                'toxinsWithResults': len(targets),
                'eligibleForBaseline': eligible_count,
                'message': (
                    'Eligible targets can enter baseline training; no prediction model has been published yet.'
                    if eligible_count else
                    'No toxin yet meets the minimum training-data requirements.'
                ),
            },
            'targets': targets,
        }

    @staticmethod
    def get_latest_model_metadata() -> dict | None:
        root = Path(settings.BASE_DIR / 'prediction_artifacts')
        if not root.exists():
            return None

        candidates = sorted(root.glob('*/metadata.json'), reverse=True)
        if not candidates:
            return None

        try:
            metadata = json.loads(candidates[0].read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            return None

        return {
            'version': metadata.get('version', ''),
            'createdAt': metadata.get('created_at', ''),
            'trainedTargets': len(metadata.get('trained_models', [])),
        }
