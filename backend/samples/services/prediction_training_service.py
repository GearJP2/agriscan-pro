"""Train baseline mycotoxin prediction models from exported dataset rows."""

import json
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from django.conf import settings

from .prediction_dataset_service import PredictionDatasetService


@dataclass(frozen=True)
class PredictionTrainingConfig:
    min_detected: int = 30
    min_below_lod_or_zero: int = 30
    min_usable_context: int = 60
    test_size: float = 0.2
    random_state: int = 42
    include_weather: bool = False
    fetch_weather: bool = True
    logistic_max_iter: int = 5000


class PredictionTrainingService:
    """Train explainable tabular baselines and write versioned artifacts."""

    FEATURE_COLUMNS = [
        'food_feed_type',
        'sub_type',
        'commodity',
        'region',
        'province',
        'district',
        'collection_month',
        'collection_quarter',
        'collection_season_thailand',
        'purpose',
        'sample_type',
        'processing_type',
        'context_location_type',
        'context_has_exact_coordinates',
        'context_latitude',
        'context_longitude',
        'context_harvest_month',
        'context_harvest_quarter',
        'context_harvest_season_thailand',
        'context_sowing_month',
        'context_storage_duration_days',
        'context_moisture_pct',
        'context_soil_ph',
        'context_crop_variety',
        'context_crop_season',
        'context_soil_type',
        'context_has_crop_rotation',
        'context_has_fertiliser_details',
        'context_has_fungicide_details',
        'weather_temperature_c_mean_90d',
        'weather_humidity_pct_mean_90d',
        'weather_precipitation_mm_total_90d',
        'weather_soil_temperature_c_mean_90d',
        'weather_days_observed_90d',
        'weather_location_label',
    ]
    CATEGORICAL_COLUMNS = {
        'food_feed_type',
        'sub_type',
        'commodity',
        'region',
        'province',
        'district',
        'collection_season_thailand',
        'purpose',
        'sample_type',
        'processing_type',
        'context_location_type',
        'context_harvest_season_thailand',
        'context_crop_variety',
        'context_crop_season',
        'context_soil_type',
        'weather_location_label',
    }

    @classmethod
    def train_and_save(cls, output_dir=None, config=None) -> dict:
        config = config or PredictionTrainingConfig()
        output_path = Path(output_dir or settings.BASE_DIR / 'prediction_artifacts')
        version = datetime.now(timezone.utc).strftime('v%Y%m%d%H%M%S')
        version_dir = output_path / version
        version_dir.mkdir(parents=True, exist_ok=True)

        rows = list(PredictionDatasetService.iter_rows(
            include_weather=config.include_weather,
            fetch_weather=config.fetch_weather,
        ))
        report = cls.train_rows(rows, version_dir=version_dir, version=version, config=config)
        metadata_path = version_dir / 'metadata.json'
        metadata_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding='utf-8')
        report['metadata_path'] = str(metadata_path)
        return report

    @classmethod
    def train_rows(cls, rows: Iterable[dict], version_dir: Path, version: str, config=None) -> dict:
        sklearn = cls.import_sklearn()
        config = config or PredictionTrainingConfig()
        grouped = cls.group_rows(rows)
        models = []
        skipped = []

        for toxin_type in sorted(grouped):
            toxin_rows = grouped[toxin_type]
            readiness = cls.assess_target(toxin_rows, config)
            if not readiness['eligible']:
                skipped.append(readiness)
                continue
            models.append(cls.train_toxin(toxin_type, toxin_rows, version_dir, version, sklearn, config, readiness))

        return {
            'version': version,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'model_family': 'scaled_logistic_regression_detection_plus_scaled_ridge_concentration',
            'feature_columns': cls.FEATURE_COLUMNS,
            'training_config': {
                'min_detected': config.min_detected,
                'min_below_lod_or_zero': config.min_below_lod_or_zero,
                'min_usable_context': config.min_usable_context,
                'test_size': config.test_size,
                'random_state': config.random_state,
                'include_weather': config.include_weather,
                'fetch_weather': config.fetch_weather,
                'logistic_max_iter': config.logistic_max_iter,
                'preprocessing': 'DictVectorizer plus sparse-safe StandardScaler',
            },
            'trained_models': models,
            'skipped_targets': skipped,
        }

    @staticmethod
    def import_sklearn():
        try:
            from joblib import dump
            from sklearn.feature_extraction import DictVectorizer
            from sklearn.linear_model import LogisticRegression, Ridge
            from sklearn.metrics import (
                accuracy_score,
                f1_score,
                mean_absolute_error,
                mean_squared_error,
                precision_score,
                recall_score,
                roc_auc_score,
            )
            from sklearn.model_selection import train_test_split
            from sklearn.pipeline import Pipeline
            from sklearn.preprocessing import StandardScaler
        except ImportError as exc:
            raise RuntimeError(
                'Prediction training requires scikit-learn and joblib. '
                'Install backend requirements before running this command.'
            ) from exc

        return {
            'dump': dump,
            'DictVectorizer': DictVectorizer,
            'LogisticRegression': LogisticRegression,
            'Ridge': Ridge,
            'accuracy_score': accuracy_score,
            'f1_score': f1_score,
            'mean_absolute_error': mean_absolute_error,
            'mean_squared_error': mean_squared_error,
            'precision_score': precision_score,
            'recall_score': recall_score,
            'roc_auc_score': roc_auc_score,
            'train_test_split': train_test_split,
            'Pipeline': Pipeline,
            'StandardScaler': StandardScaler,
        }

    @staticmethod
    def group_rows(rows: Iterable[dict]) -> dict[str, list[dict]]:
        grouped = defaultdict(list)
        for row in rows:
            grouped[row['toxin_type']].append(row)
        return dict(grouped)

    @classmethod
    def assess_target(cls, rows: list[dict], config: PredictionTrainingConfig) -> dict:
        measured = len(rows)
        detected = sum(1 for row in rows if int(row['detected']) == 1)
        below_lod_or_zero = measured - detected
        usable_context = sum(1 for row in rows if int(row['usable_context']) == 1)
        eligible = (
            detected >= config.min_detected
            and below_lod_or_zero >= config.min_below_lod_or_zero
            and usable_context >= config.min_usable_context
        )
        return {
            'toxin_type': rows[0]['toxin_type'] if rows else '',
            'measured': measured,
            'detected': detected,
            'below_lod_or_zero': below_lod_or_zero,
            'usable_context': usable_context,
            'eligible': eligible,
        }

    @classmethod
    def build_feature_dict(cls, row: dict) -> dict:
        features = {}
        for column in cls.FEATURE_COLUMNS:
            value = row.get(column, '')
            if column in cls.CATEGORICAL_COLUMNS:
                features[column] = str(value or 'missing').strip() or 'missing'
            else:
                features[column] = cls.to_float(value)

        month = int(cls.to_float(row.get('collection_month')) or 0)
        if month:
            features['collection_month_sin'] = math.sin(2 * math.pi * month / 12)
            features['collection_month_cos'] = math.cos(2 * math.pi * month / 12)
        else:
            features['collection_month_sin'] = 0.0
            features['collection_month_cos'] = 0.0
        return features

    @staticmethod
    def to_float(value) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    @classmethod
    def train_toxin(cls, toxin_type, rows, version_dir, version, sklearn, config, readiness) -> dict:
        x = [cls.build_feature_dict(row) for row in rows]
        y = [int(row['detected']) for row in rows]
        split = sklearn['train_test_split'](
            x,
            y,
            test_size=config.test_size,
            random_state=config.random_state,
            stratify=y,
        )
        x_train, x_test, y_train, y_test = split

        classifier = sklearn['Pipeline']([
            ('features', sklearn['DictVectorizer'](sparse=True)),
            ('scale', sklearn['StandardScaler'](with_mean=False)),
            ('model', sklearn['LogisticRegression'](
                class_weight='balanced',
                max_iter=config.logistic_max_iter,
            )),
        ])
        classifier.fit(x_train, y_train)
        y_pred = classifier.predict(x_test)
        y_prob = classifier.predict_proba(x_test)[:, 1]

        positive_rows = [row for row in rows if int(row['detected']) == 1]
        regression_metrics = cls.train_regressor(toxin_type, positive_rows, version_dir, sklearn, config)
        artifact_path = version_dir / f'{toxin_type}_detection.joblib'
        sklearn['dump']({
            'version': version,
            'toxin_type': toxin_type,
            'task': 'detection',
            'features': cls.FEATURE_COLUMNS,
            'pipeline': classifier,
        }, artifact_path)

        return {
            **readiness,
            'artifact_path': str(artifact_path),
            'published': False,
            'classification_metrics': {
                'accuracy': round(float(sklearn['accuracy_score'](y_test, y_pred)), 4),
                'precision': round(float(sklearn['precision_score'](y_test, y_pred, zero_division=0)), 4),
                'recall': round(float(sklearn['recall_score'](y_test, y_pred, zero_division=0)), 4),
                'f1': round(float(sklearn['f1_score'](y_test, y_pred, zero_division=0)), 4),
                'roc_auc': round(float(sklearn['roc_auc_score'](y_test, y_prob)), 4),
                'prevalence': round(sum(y) / len(y), 4),
                'test_rows': len(y_test),
            },
            'regression_metrics': regression_metrics,
        }

    @classmethod
    def train_regressor(cls, toxin_type, positive_rows, version_dir, sklearn, config) -> dict | None:
        if len(positive_rows) < 10:
            return None
        x = [cls.build_feature_dict(row) for row in positive_rows]
        y = [float(row['concentration_log1p']) for row in positive_rows]
        x_train, x_test, y_train, y_test = sklearn['train_test_split'](
            x,
            y,
            test_size=config.test_size,
            random_state=config.random_state,
        )
        regressor = sklearn['Pipeline']([
            ('features', sklearn['DictVectorizer'](sparse=True)),
            ('scale', sklearn['StandardScaler'](with_mean=False)),
            ('model', sklearn['Ridge'](alpha=1.0)),
        ])
        regressor.fit(x_train, y_train)
        y_pred = regressor.predict(x_test)
        artifact_path = version_dir / f'{toxin_type}_concentration.joblib'
        sklearn['dump']({
            'toxin_type': toxin_type,
            'task': 'concentration_log1p',
            'features': cls.FEATURE_COLUMNS,
            'pipeline': regressor,
        }, artifact_path)
        rmse = math.sqrt(float(sklearn['mean_squared_error'](y_test, y_pred)))
        return {
            'artifact_path': str(artifact_path),
            'mae_log1p': round(float(sklearn['mean_absolute_error'](y_test, y_pred)), 4),
            'rmse_log1p': round(rmse, 4),
            'test_rows': len(y_test),
        }
