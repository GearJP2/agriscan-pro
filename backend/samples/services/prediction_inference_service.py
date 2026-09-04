"""Load trained prediction artifacts and estimate mycotoxin risk."""

import json
import math
from datetime import date, datetime
from pathlib import Path

from django.conf import settings
from django.db.models import Count, Max, Q

from ..constants.mycotoxin_constants import TOXIN_LABELS
from ..models import MycotoxinResult, Sample
from .prediction_dataset_service import PredictionDatasetService
from .prediction_training_service import PredictionTrainingService
from .prediction_weather_service import PredictionWeatherService, PredictionWeatherServiceError


class PredictionModelUnavailable(Exception):
    """Raised when no trained prediction model is available."""


class PredictionInferenceService:
    """Run estimates from the latest offline-trained baseline artifacts."""

    @classmethod
    def estimate(cls, payload: dict, artifacts_dir=None) -> dict:
        metadata_path, metadata = cls.load_latest_published_metadata(artifacts_dir=artifacts_dir)
        trained_models = cls.get_published_models(metadata)

        include_weather = metadata.get('training_config', {}).get('include_weather', False)
        dataset_row = cls.payload_to_dataset_row(payload, include_weather=include_weather)
        features = PredictionTrainingService.build_feature_dict(
            dataset_row
        )
        predictions = []
        for model_meta in trained_models:
            predictions.append(cls.estimate_toxin(model_meta, features, metadata_path.parent))

        predictions.sort(key=lambda item: item['detectionProbability'], reverse=True)
        return {
            'modelVersion': metadata.get('version', ''),
            'modelFamily': metadata.get('model_family', ''),
            'createdAt': metadata.get('created_at', ''),
            'featureColumns': metadata.get('feature_columns', []),
            'featureSummary': cls.summarize_feature_provenance(dataset_row),
            'usesWeatherFeatures': include_weather,
            'input': payload,
            'predictions': predictions,
            'warning': (
                'Research area-risk estimate only. This is based on historical sample '
                'and location context; it is not a laboratory result or regulatory '
                'compliance decision.'
            ),
        }

    @classmethod
    def recommend_sampling(cls, request: dict, artifacts_dir=None) -> dict:
        target_date = PredictionDatasetService.normalize_date(request.get('target_date')) or date.today()
        limit = request.get('limit') or 10
        max_candidates = request.get('max_candidates') or 25
        min_priority_score = request.get('min_priority_score')
        if min_priority_score is None:
            min_priority_score = request.get('min_risk_threshold')
        if min_priority_score is None:
            min_priority_score = 0.40
        mode = request.get('mode') or 'all'
        candidates = cls.build_sampling_candidates(
            food_feed_type=request.get('food_feed_type') or '',
            provinces=request.get('provinces') or [],
            sub_types=request.get('sub_types') or [],
            include_districts=request.get('include_districts', True),
            max_candidates=max_candidates,
        )

        scored_candidates = []
        errors = []
        for candidate in candidates:
            payload = {
                'food_feed_type': candidate['foodFeedType'],
                'sub_type': candidate['subType'],
                'region': candidate['region'],
                'province': candidate.get('modelProvince', candidate['province']),
                'district': candidate['district'],
                'collection_date': target_date,
                'purpose': 'research',
                'sample_type': candidate['sampleType'],
                'processing_type': candidate['processingType'],
                'location_type': candidate['locationType'],
            }
            try:
                estimate = cls.estimate(payload, artifacts_dir=artifacts_dir)
            except PredictionModelUnavailable:
                raise
            except Exception as exc:  # Defensive: keep one bad candidate from blocking all recommendations.
                errors.append({
                    'foodFeedType': candidate['foodFeedType'],
                    'subType': candidate['subType'],
                    'province': candidate['province'],
                    'district': candidate['district'],
                    'detail': str(exc),
                })
                continue

            if not estimate.get('predictions'):
                continue

            top_prediction = estimate['predictions'][0]
            historical_signal = cls.historical_signal(
                toxin_type=top_prediction['toxinType'],
                food_feed_type=candidate['foodFeedType'],
                sub_type=candidate['subType'],
                province=candidate.get('historicalProvince', candidate['province']),
                district=candidate['district'],
                include_districts=request.get('include_districts', True),
            )
            feature_summary = estimate.get('featureSummary') or {}
            weather_available = bool(
                estimate.get('usesWeatherFeatures')
                and (feature_summary.get('weatherDaysObserved90d') or 0) > 0
            )
            priority = cls.surveillance_priority(
                detection_probability=top_prediction['detectionProbability'],
                historical_detection_rate=historical_signal['detection_rate'],
                historical_sample_count=candidate['historicalSampleCount'],
                weather_available=weather_available,
            )
            scored_item = {
                'rank': 0,
                'foodFeedType': candidate['foodFeedType'],
                'subType': candidate['subType'],
                'province': candidate['province'],
                'district': candidate['district'],
                'region': candidate['region'],
                'areaSpecific': candidate.get('areaSpecific', True),
                'areaConfidence': candidate.get('areaConfidence', 'high'),
                'targetDate': target_date.isoformat(),
                'recommendedToxin': top_prediction['toxinType'],
                'recommendedToxinLabel': TOXIN_LABELS.get(top_prediction['toxinType'], top_prediction['toxinType']),
                'priorityScore': priority['score'],
                'priorityBand': priority['band'],
                'priorityDrivers': priority['drivers'],
                'actionBasis': priority['basis'],
                'scoreBreakdown': priority['breakdown'],
                'detectionProbability': top_prediction['detectionProbability'],
                'riskBand': top_prediction['riskBand'],
                'estimatedConcentrationUgKg': top_prediction['estimatedConcentrationUgKg'],
                'modelVersion': estimate['modelVersion'],
                'usesWeatherFeatures': estimate['usesWeatherFeatures'],
                'weatherAvailable': weather_available,
                'weatherLocationLabel': feature_summary.get('weatherLocationLabel', ''),
                'historicalSampleCount': candidate['historicalSampleCount'],
                'latestHistoricalSampleDate': candidate['latestHistoricalSampleDate'],
                'historicalMeasuredCount': historical_signal['measured_count'],
                'historicalDetectedCount': historical_signal['detected_count'],
                'historicalDetectionRate': historical_signal['detection_rate'],
                'volumeConfidence': priority['volume_confidence'],
            }
            scored_item['reason'] = cls.recommendation_reason(candidate, scored_item, top_prediction, estimate)
            scored_candidates.append(scored_item)

        scored_candidates.sort(
            key=lambda item: (
                item['priorityScore'],
                item['historicalDetectionRate'],
                item['detectionProbability'],
                item['historicalSampleCount'],
            ),
            reverse=True,
        )
        recommendations = [
            item
            for item in scored_candidates
            if item['priorityScore'] >= min_priority_score
        ]
        area_specific_recommendations = [
            item for item in recommendations if item.get('areaSpecific', True)
        ][:limit]
        national_surveillance_signals = [
            item for item in recommendations if not item.get('areaSpecific', True)
        ][:limit]
        for index, item in enumerate(area_specific_recommendations, start=1):
            item['rank'] = index
        for index, item in enumerate(national_surveillance_signals, start=1):
            item['rank'] = index
        combined_recommendations = [
            *area_specific_recommendations,
            *national_surveillance_signals,
        ][:limit]
        if mode == 'area_specific':
            visible_recommendations = area_specific_recommendations
        elif mode == 'national_signal':
            visible_recommendations = national_surveillance_signals
        else:
            visible_recommendations = combined_recommendations

        return {
            'targetDate': target_date.isoformat(),
            'mode': mode,
            'requestedLimit': limit,
            'candidateCount': len(candidates),
            'scoredCandidateCount': len(scored_candidates),
            'belowThresholdCount': max(len(scored_candidates) - len(recommendations), 0),
            'belowPriorityThresholdCount': max(len(scored_candidates) - len(recommendations), 0),
            'minRiskThreshold': min_priority_score,
            'minPriorityScore': min_priority_score,
            'returned': len(visible_recommendations),
            'areaSpecificReturned': len(area_specific_recommendations),
            'nationalSignalReturned': len(national_surveillance_signals),
            'usesWeatherFeatures': scored_candidates[0]['usesWeatherFeatures'] if scored_candidates else False,
            'recommendations': visible_recommendations,
            'areaSpecificRecommendations': area_specific_recommendations,
            'nationalSurveillanceSignals': national_surveillance_signals,
            'message': (
                'No priority testing targets found for the selected filters.'
                if not visible_recommendations and scored_candidates
                else ''
            ),
            'errors': errors,
            'warning': (
                'Sampling recommendations are research prioritization guidance. '
                'They identify which food/feed and area combinations should be considered '
                'for testing; they are not laboratory results or regulatory decisions.'
            ),
        }

    @staticmethod
    def build_sampling_candidates(
        *,
        food_feed_type='',
        provinces=None,
        sub_types=None,
        include_districts=True,
        max_candidates=25,
    ) -> list[dict]:
        queryset = Sample.objects.exclude(province__isnull=True).exclude(province__exact='')
        queryset = queryset.exclude(collection_date__isnull=True)

        if food_feed_type:
            queryset = queryset.filter(food_feed_type=food_feed_type)
        if provinces:
            province_filter = Q()
            for province in provinces:
                province_filter |= Q(province__iexact=province)
            queryset = queryset.filter(province_filter)
        if sub_types:
            sub_type_filter = Q()
            for sub_type in sub_types:
                sub_type_filter |= Q(sub_type__iexact=sub_type) | Q(vegetation_variety__iexact=sub_type)
            queryset = queryset.filter(sub_type_filter)

        group_fields = ['food_feed_type', 'sub_type', 'vegetation_variety', 'region', 'province']
        if include_districts:
            group_fields.append('district')

        rows = (
            queryset
            .values(*group_fields)
            .annotate(
                historical_sample_count=Count('id'),
                latest_historical_sample_date=Max('collection_date'),
            )
            .order_by('-historical_sample_count', '-latest_historical_sample_date')[:max_candidates]
        )

        candidates = []
        seen = set()
        for row in rows:
            sub_type = row.get('sub_type') or row.get('vegetation_variety')
            raw_province = str(row.get('province') or '').strip()
            province = PredictionDatasetService.clean_location(raw_province)
            district = PredictionDatasetService.clean_location(row.get('district')) if include_districts else ''
            if not sub_type:
                continue
            area_specific = bool(province)
            display_province = province if area_specific else 'Unspecified area'
            key = (
                row.get('food_feed_type') or 'food',
                str(sub_type).strip().lower(),
                str(display_province).strip().lower(),
                str(district).strip().lower(),
            )
            if key in seen:
                continue
            seen.add(key)
            candidates.append({
                'foodFeedType': row.get('food_feed_type') or 'food',
                'subType': str(sub_type).strip(),
                'region': PredictionDatasetService.clean_location(row.get('region')),
                'province': display_province,
                'modelProvince': province,
                'historicalProvince': raw_province,
                'district': district,
                'areaSpecific': area_specific,
                'areaConfidence': 'high' if area_specific else 'low',
                'sampleType': '',
                'processingType': '',
                'locationType': 'province' if area_specific else 'unknown',
                'historicalSampleCount': row.get('historical_sample_count') or 0,
                'latestHistoricalSampleDate': (
                    row['latest_historical_sample_date'].isoformat()
                    if row.get('latest_historical_sample_date')
                    else ''
                ),
            })
        return candidates

    @staticmethod
    def count_historical_detected(
        *,
        toxin_type,
        food_feed_type,
        sub_type,
        province,
        district='',
        include_districts=True,
    ) -> int:
        return PredictionInferenceService.historical_signal(
            toxin_type=toxin_type,
            food_feed_type=food_feed_type,
            sub_type=sub_type,
            province=province,
            district=district,
            include_districts=include_districts,
        )['detected_count']

    @staticmethod
    def historical_signal(
        *,
        toxin_type,
        food_feed_type,
        sub_type,
        province,
        district='',
        include_districts=True,
    ) -> dict:
        queryset = MycotoxinResult.objects.filter(toxin_type=toxin_type)
        if province:
            queryset = queryset.filter(sample__province__iexact=province)
        if food_feed_type:
            queryset = queryset.filter(sample__food_feed_type=food_feed_type)
        if sub_type:
            queryset = queryset.filter(
                Q(sample__sub_type__iexact=sub_type)
                | Q(sample__vegetation_variety__iexact=sub_type)
            )
        if include_districts and district:
            queryset = queryset.filter(sample__district__iexact=district)
        measured_count = queryset.count()
        detected_count = queryset.filter(value__gt=0).count()
        return {
            'measured_count': measured_count,
            'detected_count': detected_count,
            'detection_rate': round(detected_count / measured_count, 4) if measured_count else 0.0,
        }

    @staticmethod
    def surveillance_priority(
        *,
        detection_probability,
        historical_detection_rate,
        historical_sample_count,
        weather_available,
    ) -> dict:
        probability = max(float(detection_probability or 0), 0.0)
        historical_rate = max(float(historical_detection_rate or 0), 0.0)
        sample_count = max(int(historical_sample_count or 0), 0)
        volume_confidence = min(math.log1p(sample_count) / math.log1p(50), 1.0) if sample_count else 0.0
        weather_bonus = 1.0 if weather_available else 0.0
        model_weight = 0.50
        historical_weight = 0.35
        volume_weight = 0.10
        weather_weight = 0.05
        model_contribution = model_weight * probability
        historical_contribution = historical_weight * historical_rate
        volume_contribution = volume_weight * volume_confidence
        weather_contribution = weather_weight * weather_bonus
        score = model_contribution + historical_contribution + volume_contribution + weather_contribution
        drivers = []
        if probability >= 0.40:
            drivers.append('model-risk')
        if historical_rate >= 0.25:
            drivers.append('historical-detections')
        if volume_confidence >= 0.50:
            drivers.append('historical-volume')
        if weather_available:
            drivers.append('weather-context')
        if not drivers:
            drivers.append('baseline-surveillance')
        basis = 'model_and_history'
        if probability < 0.40 and historical_rate >= 0.25:
            basis = 'historical_signal'
        elif probability >= 0.40 and historical_rate < 0.25:
            basis = 'model_signal'
        band = 'high' if score >= 0.70 else 'medium' if score >= 0.40 else 'low'
        return {
            'score': round(score, 4),
            'band': band,
            'basis': basis,
            'drivers': drivers,
            'volume_confidence': round(volume_confidence, 4),
            'breakdown': {
                'modelProbabilityWeight': model_weight,
                'modelProbabilityValue': round(probability, 4),
                'modelProbabilityContribution': round(model_contribution, 4),
                'historicalDetectionWeight': historical_weight,
                'historicalDetectionValue': round(historical_rate, 4),
                'historicalDetectionContribution': round(historical_contribution, 4),
                'volumeWeight': volume_weight,
                'volumeValue': round(volume_confidence, 4),
                'volumeContribution': round(volume_contribution, 4),
                'weatherWeight': weather_weight,
                'weatherValue': round(weather_bonus, 4),
                'weatherContribution': round(weather_contribution, 4),
            },
        }

    @staticmethod
    def recommendation_reason(candidate: dict, scored_item: dict, top_prediction: dict, estimate: dict) -> str:
        probability_pct = round(top_prediction['detectionProbability'] * 100, 1)
        priority_pct = round(scored_item['priorityScore'] * 100, 1)
        historical_pct = round(scored_item['historicalDetectionRate'] * 100, 1)
        area = candidate['province']
        if candidate.get('district'):
            area = f"{candidate['district']}, {area}"
        weather_note = ' Weather was included in the model.' if estimate.get('usesWeatherFeatures') else ''
        return (
            f"{candidate['subType']} in {area} is ranked for {top_prediction['toxinType']} "
            f"with a {priority_pct}% surveillance priority score. The published model estimates "
            f"{probability_pct}% detection risk, while historical results show "
            f"{scored_item['historicalDetectedCount']} detected result(s) from "
            f"{scored_item['historicalMeasuredCount']} measured result(s) "
            f"({historical_pct}%) and {candidate['historicalSampleCount']} historical sample(s)."
            f"{weather_note}"
        )

    @classmethod
    def load_latest_metadata(cls, artifacts_dir=None) -> tuple[Path, dict]:
        for metadata_path, metadata in cls.iter_metadata_versions(artifacts_dir=artifacts_dir):
            return metadata_path, metadata
        raise PredictionModelUnavailable('Latest prediction metadata could not be loaded.')

    @classmethod
    def load_latest_published_metadata(cls, artifacts_dir=None) -> tuple[Path, dict]:
        for metadata_path, metadata in cls.iter_metadata_versions(artifacts_dir=artifacts_dir):
            if cls.get_published_models(metadata):
                return metadata_path, metadata
        raise PredictionModelUnavailable('No published toxin models are available yet.')

    @classmethod
    def iter_metadata_versions(cls, artifacts_dir=None):
        root = Path(artifacts_dir or settings.BASE_DIR / 'prediction_artifacts')
        if not root.exists():
            raise PredictionModelUnavailable('Prediction artifacts directory does not exist.')

        candidates = sorted(root.glob('*/metadata.json'), reverse=True)
        if not candidates:
            raise PredictionModelUnavailable('No prediction metadata file was found.')

        for metadata_path in candidates:
            try:
                yield metadata_path, json.loads(metadata_path.read_text(encoding='utf-8'))
            except (OSError, json.JSONDecodeError):
                continue

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
        latest_published = next(
            (version for version in versions if version['publishedTargets']),
            None,
        )
        return {
            'status': 'published' if latest_published else 'trained_unpublished',
            'latest': latest,
            'activePublished': latest_published,
            'versions': versions,
        }

    @staticmethod
    def empty_status() -> dict:
        return {
            'status': 'not_trained',
            'latest': None,
            'activePublished': None,
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
            'skippedTargetDetails': [
                cls.summarize_skipped_target(target)
                for target in metadata.get('skipped_targets', [])
            ],
            'targets': [
                cls.summarize_model(model, version_dir=metadata_path.parent)
                for model in trained_models
            ],
        }

    @staticmethod
    def summarize_model(model_meta: dict, version_dir: Path | None = None) -> dict:
        metrics = model_meta.get('classification_metrics', {})
        return {
            'toxinType': model_meta.get('toxin_type', ''),
            'published': bool(model_meta.get('published', False)),
            'trainingRows': model_meta.get('measured', 0),
            'detectedRows': model_meta.get('detected', 0),
            'usableContext': model_meta.get('usable_context', 0),
            'classificationMetrics': metrics,
            'artifactHealth': PredictionInferenceService.summarize_artifact_health(
                model_meta,
                version_dir=version_dir,
            ),
        }

    @staticmethod
    def summarize_artifact_health(model_meta: dict, version_dir: Path | None = None) -> dict:
        classifier_path = model_meta.get('artifact_path')
        regression_path = (model_meta.get('regression_metrics') or {}).get('artifact_path')
        return {
            'classifierArtifactPath': classifier_path or '',
            'classifierArtifactExists': PredictionInferenceService.artifact_exists(
                classifier_path,
                version_dir=version_dir,
            ),
            'regressionArtifactPath': regression_path or '',
            'regressionArtifactExists': (
                None
                if not regression_path
                else PredictionInferenceService.artifact_exists(regression_path, version_dir=version_dir)
            ),
        }

    @staticmethod
    def artifact_exists(raw_path, version_dir: Path | None = None) -> bool:
        if not raw_path:
            return False
        artifact = Path(raw_path)
        if not artifact.is_absolute() and version_dir is not None:
            artifact = version_dir / artifact
        return artifact.exists()

    @staticmethod
    def summarize_skipped_target(target_meta: dict) -> dict:
        reasons = []
        if target_meta.get('eligible') is False:
            if target_meta.get('detected', 0) < target_meta.get('min_detected', 0):
                reasons.append('Not enough detected examples')
            if target_meta.get('below_lod_or_zero', 0) < target_meta.get('min_below_lod_or_zero', 0):
                reasons.append('Not enough below-LOD or zero examples')
            if target_meta.get('usable_context', 0) < target_meta.get('min_usable_context', 0):
                reasons.append('Not enough usable sample context')
        return {
            'toxinType': target_meta.get('toxin_type', ''),
            'measured': target_meta.get('measured', 0),
            'detected': target_meta.get('detected', 0),
            'belowLodOrZero': target_meta.get('below_lod_or_zero', 0),
            'usableContext': target_meta.get('usable_context', 0),
            'reasons': reasons or target_meta.get('reasons', []),
        }

    @staticmethod
    def get_published_models(metadata: dict) -> list[dict]:
        return [
            model
            for model in metadata.get('trained_models', [])
            if model.get('published') is True
        ]

    @staticmethod
    def summarize_feature_provenance(row: dict) -> dict:
        optional_context_signals = [
            row.get('context_location_type') not in ('', 'unknown'),
            bool(row.get('context_harvest_month')),
            bool(row.get('context_sowing_month')),
            bool(row.get('context_has_exact_coordinates')),
            row.get('context_moisture_pct') not in ('', None),
            row.get('context_soil_ph') not in ('', None),
            bool(row.get('context_crop_variety')),
            bool(row.get('context_crop_season')),
            bool(row.get('context_soil_type')),
            row.get('context_storage_duration_days') not in ('', None),
            bool(row.get('context_has_crop_rotation')),
            bool(row.get('context_has_fertiliser_details')),
            bool(row.get('context_has_fungicide_details')),
        ]
        weather_days = row.get('weather_days_observed_90d') or 0
        return {
            'commodity': row.get('commodity', ''),
            'province': row.get('province', ''),
            'district': row.get('district', ''),
            'collectionMonth': row.get('collection_month') or None,
            'collectionSeasonThailand': row.get('collection_season_thailand', ''),
            'locationPrecision': (
                'exact_coordinates'
                if row.get('context_has_exact_coordinates')
                else 'province'
            ),
            'optionalContextSignalsFilled': sum(1 for signal in optional_context_signals if signal),
            'optionalContextSignalsTotal': len(optional_context_signals),
            'weatherDaysObserved90d': weather_days,
            'weatherLocationLabel': row.get('weather_location_label', ''),
        }

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
    def payload_to_dataset_row(cls, payload: dict, *, include_weather=False) -> dict:
        collection_date = payload.get('collection_date')
        if isinstance(collection_date, str):
            collection_date = datetime.strptime(collection_date, '%Y-%m-%d').date()
        month = collection_date.month if collection_date else 0
        commodity = payload.get('sub_type') or ''
        province = PredictionDatasetService.clean_location(payload.get('province'))
        row = {
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
            **cls.context_payload_features(payload),
        }
        row.update(cls.weather_features(
            payload.get('province'),
            collection_date,
            include_weather=include_weather,
            latitude=payload.get('latitude'),
            longitude=payload.get('longitude'),
        ))
        return row

    @staticmethod
    def weather_features(province, collection_date, *, include_weather=False, latitude=None, longitude=None) -> dict:
        if not include_weather:
            return PredictionWeatherService.empty_features()
        try:
            return PredictionWeatherService.get_features(
                province,
                collection_date,
                latitude=latitude,
                longitude=longitude,
            )
        except PredictionWeatherServiceError:
            return PredictionWeatherService.empty_features(
                location=PredictionWeatherService.select_location(
                    province,
                    latitude=latitude,
                    longitude=longitude,
                )
            )

    @classmethod
    def context_payload_features(cls, payload: dict) -> dict:
        harvest_date = payload.get('harvest_date')
        if isinstance(harvest_date, str):
            harvest_date = datetime.strptime(harvest_date, '%Y-%m-%d').date()
        sowing_date = payload.get('sowing_date')
        if isinstance(sowing_date, str):
            sowing_date = datetime.strptime(sowing_date, '%Y-%m-%d').date()
        latitude = payload.get('latitude')
        longitude = payload.get('longitude')
        return {
            'context_location_type': PredictionDatasetService.clean_category(
                payload.get('location_type') or 'unknown'
            ),
            'context_has_exact_coordinates': int(latitude is not None and longitude is not None),
            'context_latitude': latitude if latitude is not None else '',
            'context_longitude': longitude if longitude is not None else '',
            'context_harvest_month': harvest_date.month if harvest_date else '',
            'context_harvest_quarter': PredictionDatasetService.quarter(
                harvest_date.month
            ) if harvest_date else '',
            'context_harvest_season_thailand': (
                PredictionDatasetService.thailand_season(harvest_date.month)
                if harvest_date else ''
            ),
            'context_sowing_month': sowing_date.month if sowing_date else '',
            'context_storage_duration_days': payload.get('storage_duration_days') or '',
            'context_moisture_pct': payload.get('moisture_pct') or '',
            'context_soil_ph': payload.get('soil_ph') or '',
            'context_crop_variety': PredictionDatasetService.clean_category(payload.get('crop_variety')),
            'context_crop_season': PredictionDatasetService.clean_category(payload.get('crop_season')),
            'context_soil_type': PredictionDatasetService.clean_category(payload.get('soil_type')),
            'context_has_crop_rotation': int(bool(PredictionDatasetService.clean_category(
                payload.get('crop_rotation')
            ))),
            'context_has_fertiliser_details': int(bool(PredictionDatasetService.clean_category(
                payload.get('fertiliser_details')
            ))),
            'context_has_fungicide_details': int(bool(PredictionDatasetService.clean_category(
                payload.get('fungicide_details')
            ))),
        }

    @staticmethod
    def sample_to_payload(sample) -> dict:
        payload = {
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
        context = getattr(sample, 'prediction_context', None)
        if context:
            payload.update({
                'latitude': context.latitude,
                'longitude': context.longitude,
                'location_type': context.location_type,
                'harvest_date': context.harvest_date,
                'sowing_date': context.sowing_date,
                'crop_variety': context.crop_variety,
                'crop_season': context.crop_season,
                'storage_duration_days': context.storage_duration_days,
                'moisture_pct': context.moisture_pct,
                'soil_type': context.soil_type,
                'soil_ph': context.soil_ph,
                'crop_rotation': context.crop_rotation,
                'fertiliser_details': context.fertiliser_details,
                'fungicide_details': context.fungicide_details,
            })
        return payload

    @staticmethod
    def risk_band(probability: float) -> str:
        if probability >= 0.7:
            return 'high'
        if probability >= 0.4:
            return 'medium'
        return 'low'
