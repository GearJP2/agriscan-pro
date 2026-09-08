"""Build model-ready rows from stored sample and mycotoxin result data."""

import csv
import math
import re
from datetime import date, datetime
from typing import Iterable, TextIO

from ..constants.mycotoxin_constants import TOXIN_LABELS
from ..models import MycotoxinResult
from .prediction_weather_service import PredictionWeatherService, PredictionWeatherServiceError


class PredictionDatasetService:
    """Export a flat training table without mutating source sample data."""

    BASE_FIELDNAMES = [
        'sample_id',
        'toxin_type',
        'toxin_label',
        'detected',
        'concentration_ug_kg',
        'concentration_log1p',
        'is_below_lod',
        'usable_context',
        'food_feed_type',
        'sub_type',
        'commodity',
        'region',
        'province',
        'district',
        'collection_date',
        'collection_year',
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
        'recorded_by_username',
    ]
    FIELDNAMES = BASE_FIELDNAMES + PredictionWeatherService.FEATURE_COLUMNS

    @classmethod
    def get_queryset(cls):
        return (
            MycotoxinResult.objects.select_related('sample', 'sample__recorded_by')
            .select_related('sample__prediction_context')
            .filter(value__isnull=False)
            .order_by('sample__sample_id', 'toxin_type')
        )

    @classmethod
    def iter_rows(cls, queryset=None, *, include_weather=False, fetch_weather=True) -> Iterable[dict]:
        results = queryset if queryset is not None else cls.get_queryset()
        for result in results:
            yield cls.build_row(
                result,
                include_weather=include_weather,
                fetch_weather=fetch_weather,
            )

    @classmethod
    def write_csv(cls, output: TextIO, queryset=None, *, include_weather=False, fetch_weather=True) -> int:
        writer = csv.DictWriter(output, fieldnames=cls.FIELDNAMES)
        writer.writeheader()
        count = 0
        for row in cls.iter_rows(
            queryset=queryset,
            include_weather=include_weather,
            fetch_weather=fetch_weather,
        ):
            writer.writerow(row)
            count += 1
        return count

    @classmethod
    def build_row(cls, result: MycotoxinResult, *, include_weather=False, fetch_weather=True) -> dict:
        sample = result.sample
        value = float(result.value or 0)
        detected = value > 0
        collection_date = cls.normalize_date(sample.collection_date)
        commodity = sample.sub_type or sample.vegetation_variety
        context = getattr(sample, 'prediction_context', None)

        row = {
            'sample_id': sample.sample_id,
            'toxin_type': result.toxin_type,
            'toxin_label': TOXIN_LABELS.get(result.toxin_type, result.toxin_type),
            'detected': int(detected),
            'concentration_ug_kg': value,
            'concentration_log1p': round(math.log1p(value), 8) if detected else 0,
            'is_below_lod': int(result.is_below_lod),
            'usable_context': int(cls.has_usable_context(sample)),
            'food_feed_type': cls.clean_category(sample.food_feed_type),
            'sub_type': cls.clean_category(sample.sub_type),
            'commodity': cls.clean_category(commodity),
            'region': cls.clean_category(sample.region),
            'province': cls.clean_location(sample.province),
            'district': cls.clean_location(sample.district),
            'collection_date': collection_date.isoformat() if collection_date else '',
            'collection_year': collection_date.year if collection_date else '',
            'collection_month': collection_date.month if collection_date else '',
            'collection_quarter': cls.quarter(collection_date.month) if collection_date else '',
            'collection_season_thailand': cls.thailand_season(collection_date.month) if collection_date else '',
            'purpose': cls.clean_category(sample.purpose),
            'sample_type': cls.clean_category(sample.sample_type),
            'processing_type': cls.clean_category(sample.processing_type),
            **cls.context_features(context),
            'recorded_by_username': sample.recorded_by.username if sample.recorded_by else '',
        }
        row.update(cls.weather_features(
            sample,
            collection_date=collection_date,
            include_weather=include_weather,
            fetch_weather=fetch_weather,
        ))
        return row

    @staticmethod
    def weather_features(sample, *, collection_date=None, include_weather=False, fetch_weather=True) -> dict:
        context = getattr(sample, 'prediction_context', None)
        if not include_weather:
            return PredictionWeatherService.empty_features()
        try:
            return PredictionWeatherService.get_features(
                sample.province,
                collection_date or sample.collection_date,
                latitude=getattr(context, 'latitude', None),
                longitude=getattr(context, 'longitude', None),
                fetch_missing=fetch_weather,
            )
        except PredictionWeatherServiceError:
            return PredictionWeatherService.empty_features(
                location=PredictionWeatherService.select_location(
                    sample.province,
                    latitude=getattr(context, 'latitude', None),
                    longitude=getattr(context, 'longitude', None),
                )
            )

    @classmethod
    def context_features(cls, context) -> dict:
        harvest_date = cls.normalize_date(getattr(context, 'harvest_date', None))
        sowing_date = cls.normalize_date(getattr(context, 'sowing_date', None))
        latitude = getattr(context, 'latitude', None)
        longitude = getattr(context, 'longitude', None)
        return {
            'context_location_type': cls.clean_category(getattr(context, 'location_type', 'unknown')),
            'context_has_exact_coordinates': int(latitude is not None and longitude is not None),
            'context_latitude': latitude if latitude is not None else '',
            'context_longitude': longitude if longitude is not None else '',
            'context_harvest_month': harvest_date.month if harvest_date else '',
            'context_harvest_quarter': cls.quarter(harvest_date.month) if harvest_date else '',
            'context_harvest_season_thailand': (
                cls.thailand_season(harvest_date.month) if harvest_date else ''
            ),
            'context_sowing_month': sowing_date.month if sowing_date else '',
            'context_storage_duration_days': getattr(context, 'storage_duration_days', None) or '',
            'context_moisture_pct': getattr(context, 'moisture_pct', None) or '',
            'context_soil_ph': getattr(context, 'soil_ph', None) or '',
            'context_crop_variety': cls.clean_category(getattr(context, 'crop_variety', '')),
            'context_crop_season': cls.clean_category(getattr(context, 'crop_season', '')),
            'context_soil_type': cls.clean_category(getattr(context, 'soil_type', '')),
            'context_has_crop_rotation': int(bool(cls.clean_category(getattr(context, 'crop_rotation', '')))),
            'context_has_fertiliser_details': int(bool(
                cls.clean_category(getattr(context, 'fertiliser_details', ''))
            )),
            'context_has_fungicide_details': int(bool(
                cls.clean_category(getattr(context, 'fungicide_details', ''))
            )),
        }

    @staticmethod
    def normalize_date(value):
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str) and value:
            return datetime.strptime(value, '%Y-%m-%d').date()
        return None

    @staticmethod
    def clean_category(value) -> str:
        text = str(value or '').strip().lower()
        text = re.sub(r'\s+', ' ', text)
        return text

    @classmethod
    def clean_location(cls, value) -> str:
        text = cls.clean_category(value)
        if text in {'', 'unknown', 'n/a', 'na', '-'}:
            return ''
        return text.title()

    @staticmethod
    def has_usable_context(sample) -> bool:
        province = str(sample.province or '').strip().lower()
        return bool(sample.collection_date and province and province not in {'unknown', 'n/a', 'na', '-'})

    @staticmethod
    def quarter(month: int) -> int:
        return ((month - 1) // 3) + 1

    @staticmethod
    def thailand_season(month: int) -> str:
        if month in {11, 12, 1, 2}:
            return 'cool'
        if month in {3, 4, 5}:
            return 'hot'
        return 'rainy'
