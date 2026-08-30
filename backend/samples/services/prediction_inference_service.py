"""Load trained prediction artifacts and estimate mycotoxin risk."""

import json
import math
from datetime import datetime
from pathlib import Path

from django.conf import settings

from .prediction_dataset_service import PredictionDatasetService
from .prediction_training_service import PredictionTrainingService


class PredictionModelUnavailable(Exception):
    """Raised when no trained prediction model is available."""


class PredictionInferenceService:
    """Run estimates from the latest offline-trained baseline artifacts."""

    @classmethod
    def estimate(cls, payload: dict, artifacts_dir=None) -> dict:
        metadata_path, metadata = cls.load_latest_metadata(artifacts_dir=artifacts_dir)
        trained_models = cls.get_published_models(metadata)
        if not trained_models:
            raise PredictionModelUnavailable('No published toxin models are available yet.')

        features = PredictionTrainingService.build_feature_dict(cls.payload_to_dataset_row(payload))
        predictions = []
        for model_meta in trained_models:
            predictions.append(cls.estimate_toxin(model_meta, features, metadata_path.parent))

        predictions.sort(key=lambda item: item['detectionProbability'], reverse=True)
        return {
            'modelVersion': metadata.get('version', ''),
            'modelFamily': metadata.get('model_family', ''),
            'createdAt': metadata.get('created_at', ''),
            'featureColumns': metadata.get('feature_columns', []),
            'input': payload,
            'predictions': predictions,
            'warning': (
                'Research estimate only. This is not a laboratory result '
                'or regulatory compliance decision.'
            ),
        }

    @classmethod
    def load_latest_metadata(cls, artifacts_dir=None) -> tuple[Path, dict]:
        root = Path(artifacts_dir or settings.BASE_DIR / 'prediction_artifacts')
        if not root.exists():
            raise PredictionModelUnavailable('Prediction artifacts directory does not exist.')

        candidates = sorted(root.glob('*/metadata.json'), reverse=True)
        if not candidates:
            raise PredictionModelUnavailable('No prediction metadata file was found.')

        metadata_path = candidates[0]
        try:
            return metadata_path, json.loads(metadata_path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError) as exc:
            raise PredictionModelUnavailable('Latest prediction metadata could not be loaded.') from exc

    @classmethod
    def get_model_status(cls, artifacts_dir=None) -> dict:
        root = Path(artifacts_dir or settings.BASE_DIR / 'prediction_artifacts')
        if not root.exists():
            return cls.empty_status()

        versions = []
        for metadata_path in sorted(root.glob('*/metadata.json'), reverse=True):
            try:
                metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
            except (OSError, json.JSONDecodeError):
                continue
            versions.append(cls.summarize_metadata(metadata_path, metadata))

        if not versions:
            return cls.empty_status()

        latest = versions[0]
        return {
            'status': 'published' if latest['publishedTargets'] else 'trained_unpublished',
            'latest': latest,
            'versions': versions,
        }

    @staticmethod
    def empty_status() -> dict:
        return {
            'status': 'not_trained',
            'latest': None,
            'versions': [],
        }

    @classmethod
    def summarize_metadata(cls, metadata_path: Path, metadata: dict) -> dict:
        trained_models = metadata.get('trained_models', [])
        published_models = cls.get_published_models(metadata)
        return {
            'version': metadata.get('version', metadata_path.parent.name),
            'createdAt': metadata.get('created_at', ''),
            'modelFamily': metadata.get('model_family', ''),
            'metadataPath': str(metadata_path),
            'trainedTargets': len(trained_models),
            'publishedTargets': len(published_models),
            'skippedTargets': len(metadata.get('skipped_targets', [])),
            'targets': [cls.summarize_model(model) for model in trained_models],
        }

    @staticmethod
    def summarize_model(model_meta: dict) -> dict:
        metrics = model_meta.get('classification_metrics', {})
        return {
            'toxinType': model_meta.get('toxin_type', ''),
            'published': bool(model_meta.get('published', False)),
            'trainingRows': model_meta.get('measured', 0),
            'detectedRows': model_meta.get('detected', 0),
            'usableContext': model_meta.get('usable_context', 0),
            'classificationMetrics': metrics,
        }

    @staticmethod
    def get_published_models(metadata: dict) -> list[dict]:
        return [
            model
            for model in metadata.get('trained_models', [])
            if model.get('published') is True
        ]

    @classmethod
    def estimate_toxin(cls, model_meta: dict, features: dict, version_dir: Path) -> dict:
        artifact = cls.resolve_artifact_path(model_meta.get('artifact_path'), version_dir)
        model_payload = cls.load_artifact(artifact)
        pipeline = model_payload['pipeline']
        probability = float(pipeline.predict_proba([features])[0][1])
        concentration = cls.estimate_concentration(model_meta, features, version_dir)
        metrics = model_meta.get('classification_metrics', {})
        return {
            'toxinType': model_meta.get('toxin_type', ''),
            'detectionProbability': round(probability, 4),
            'riskBand': cls.risk_band(probability),
            'estimatedConcentrationUgKg': concentration,
            'classificationMetrics': metrics,
            'trainingRows': model_meta.get('measured', 0),
            'detectedRows': model_meta.get('detected', 0),
            'published': model_meta.get('published', False),
        }

    @classmethod
    def estimate_concentration(cls, model_meta: dict, features: dict, version_dir: Path) -> float | None:
        regression = model_meta.get('regression_metrics') or {}
        artifact_path = regression.get('artifact_path')
        if not artifact_path:
            return None
        artifact = cls.resolve_artifact_path(artifact_path, version_dir)
        model_payload = cls.load_artifact(artifact)
        prediction_log = float(model_payload['pipeline'].predict([features])[0])
        return round(max(0.0, math.expm1(prediction_log)), 4)

    @staticmethod
    def resolve_artifact_path(raw_path, version_dir: Path) -> Path:
        if not raw_path:
            raise PredictionModelUnavailable('Prediction artifact path is missing.')
        artifact = Path(raw_path)
        if not artifact.is_absolute():
            artifact = version_dir / artifact
        if not artifact.exists():
            raise PredictionModelUnavailable(f'Prediction artifact was not found: {artifact}')
        return artifact

    @staticmethod
    def load_artifact(path: Path):
        try:
            from joblib import load
        except ImportError as exc:
            raise PredictionModelUnavailable(
                'Prediction inference requires joblib. Install backend requirements first.'
            ) from exc
        return load(path)

    @classmethod
    def payload_to_dataset_row(cls, payload: dict) -> dict:
        collection_date = payload.get('collection_date')
        if isinstance(collection_date, str):
            collection_date = datetime.strptime(collection_date, '%Y-%m-%d').date()
        month = collection_date.month if collection_date else 0
        commodity = payload.get('sub_type') or ''
        province = PredictionDatasetService.clean_location(payload.get('province'))
        return {
            'food_feed_type': PredictionDatasetService.clean_category(payload.get('food_feed_type')),
            'sub_type': PredictionDatasetService.clean_category(payload.get('sub_type')),
            'commodity': PredictionDatasetService.clean_category(commodity),
            'region': PredictionDatasetService.clean_category(payload.get('region')),
            'province': province,
            'district': PredictionDatasetService.clean_location(payload.get('district')),
            'collection_month': month,
            'collection_quarter': PredictionDatasetService.quarter(month) if month else 0,
            'collection_season_thailand': (
                PredictionDatasetService.thailand_season(month) if month else ''
            ),
            'purpose': PredictionDatasetService.clean_category(payload.get('purpose')),
            'sample_type': PredictionDatasetService.clean_category(payload.get('sample_type')),
            'processing_type': PredictionDatasetService.clean_category(payload.get('processing_type')),
        }

    @staticmethod
    def sample_to_payload(sample) -> dict:
        return {
            'food_feed_type': sample.food_feed_type or 'food',
            'sub_type': sample.sub_type or sample.vegetation_variety,
            'province': sample.province,
            'collection_date': sample.collection_date,
            'region': sample.region,
            'district': sample.district,
            'purpose': sample.purpose or '',
            'sample_type': sample.sample_type or '',
            'processing_type': sample.processing_type or '',
        }

    @staticmethod
    def risk_band(probability: float) -> str:
        if probability >= 0.7:
            return 'high'
        if probability >= 0.4:
            return 'medium'
        return 'low'
