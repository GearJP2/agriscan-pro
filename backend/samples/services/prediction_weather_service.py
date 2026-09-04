"""Historical weather summaries for prediction features."""

from datetime import timedelta
import hashlib
import json
import logging

import requests
from django.conf import settings
from django.utils import timezone

from ..models import ExternalDataCache
from .nasa_power_service import (
    DEFAULT_COORDINATES,
    MISSING_VALUE,
    NASA_POWER_PARAMETERS,
    PROVINCE_COORDINATES,
    _normalize_province_name,
)

logger = logging.getLogger('agriscan.samples')

NASA_POWER_DAILY_ENDPOINT = 'https://power.larc.nasa.gov/api/temporal/daily/point'
PREDICTION_WEATHER_SOURCE = 'NASA_POWER_PREDICTION'


class PredictionWeatherServiceError(RuntimeError):
    pass


class PredictionWeatherService:
    """Fetch and cache 90-day pre-collection weather summaries."""

    FEATURE_COLUMNS = [
        'weather_temperature_c_mean_90d',
        'weather_humidity_pct_mean_90d',
        'weather_precipitation_mm_total_90d',
        'weather_soil_temperature_c_mean_90d',
        'weather_days_observed_90d',
        'weather_location_label',
    ]

    @classmethod
    def get_features(
        cls,
        province: str | None,
        collection_date,
        *,
        latitude=None,
        longitude=None,
        fetch_missing=True,
    ) -> dict:
        if not collection_date:
            return cls.empty_features()

        params = cls.build_request_params(province, collection_date, latitude=latitude, longitude=longitude)
        cache_key = cls.cache_key(params)
        cached = ExternalDataCache.objects.filter(
            source=PREDICTION_WEATHER_SOURCE,
            cache_key=cache_key,
        ).first()
        if cached:
            return cached.payload

        if not fetch_missing:
            return cls.empty_features(location=cls.select_location(province, latitude=latitude, longitude=longitude))

        try:
            response = requests.get(
                NASA_POWER_DAILY_ENDPOINT,
                params=params,
                timeout=settings.NASA_POWER_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            logger.warning('prediction_weather.nasa_power_request_failed', extra={'error': str(exc)})
            raise PredictionWeatherServiceError('NASA POWER prediction weather request failed.') from exc

        parameter_data = payload.get('properties', {}).get('parameter')
        features = cls.summarize_parameter_data(
            parameter_data,
            cls.select_location(province, latitude=latitude, longitude=longitude),
        )
        cls.store_cached_features(cache_key, features)
        return features

    @classmethod
    def build_request_params(cls, province: str | None, collection_date, *, latitude=None, longitude=None) -> dict:
        location = cls.select_location(province, latitude=latitude, longitude=longitude)
        end = collection_date - timedelta(days=1)
        start = end - timedelta(days=settings.PREDICTION_WEATHER_WINDOW_DAYS - 1)
        return {
            'parameters': ','.join(NASA_POWER_PARAMETERS),
            'community': 'AG',
            'longitude': location['longitude'],
            'latitude': location['latitude'],
            'start': start.strftime('%Y%m%d'),
            'end': end.strftime('%Y%m%d'),
            'format': 'JSON',
        }

    @staticmethod
    def select_location(province: str | None, *, latitude=None, longitude=None) -> dict:
        if latitude is not None and longitude is not None:
            return {
                'label': 'Exact coordinates',
                'latitude': float(latitude),
                'longitude': float(longitude),
            }

        selected_province = _normalize_province_name(province)
        coordinates = PROVINCE_COORDINATES.get(selected_province or '')
        if coordinates:
            latitude, longitude = coordinates
            return {
                'label': selected_province,
                'latitude': latitude,
                'longitude': longitude,
            }
        return DEFAULT_COORDINATES.copy()

    @staticmethod
    def cache_key(params: dict) -> str:
        stable = json.dumps(params, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(stable.encode('utf-8')).hexdigest()

    @staticmethod
    def store_cached_features(cache_key: str, features: dict) -> None:
        now = timezone.now()
        ExternalDataCache.objects.update_or_create(
            source=PREDICTION_WEATHER_SOURCE,
            cache_key=cache_key,
            defaults={
                'payload': features,
                'expires_at': now + timedelta(days=3650),
            },
        )

    @classmethod
    def summarize_parameter_data(cls, parameter_data: dict | None, location: dict) -> dict:
        if not isinstance(parameter_data, dict):
            raise PredictionWeatherServiceError('NASA POWER returned an invalid prediction weather payload.')

        temperature = cls.clean_values(parameter_data.get('T2M', {}).values())
        humidity = cls.clean_values(parameter_data.get('RH2M', {}).values())
        precipitation = cls.clean_values(parameter_data.get('PRECTOTCORR', {}).values())
        soil_temperature = cls.clean_values(parameter_data.get('TS', {}).values())
        observed_days = max(
            len(temperature),
            len(humidity),
            len(precipitation),
            len(soil_temperature),
        )

        return {
            'weather_temperature_c_mean_90d': cls.mean(temperature),
            'weather_humidity_pct_mean_90d': cls.mean(humidity),
            'weather_precipitation_mm_total_90d': cls.total(precipitation),
            'weather_soil_temperature_c_mean_90d': cls.mean(soil_temperature),
            'weather_days_observed_90d': observed_days,
            'weather_location_label': location['label'],
        }

    @staticmethod
    def clean_values(values) -> list[float]:
        cleaned = []
        for value in values:
            if value is None or value == MISSING_VALUE:
                continue
            try:
                cleaned.append(float(value))
            except (TypeError, ValueError):
                continue
        return cleaned

    @staticmethod
    def mean(values: list[float]) -> float | None:
        if not values:
            return None
        return round(sum(values) / len(values), 4)

    @staticmethod
    def total(values: list[float]) -> float | None:
        if not values:
            return None
        return round(sum(values), 4)

    @classmethod
    def empty_features(cls, location=None) -> dict:
        location = location or DEFAULT_COORDINATES
        return {
            'weather_temperature_c_mean_90d': None,
            'weather_humidity_pct_mean_90d': None,
            'weather_precipitation_mm_total_90d': None,
            'weather_soil_temperature_c_mean_90d': None,
            'weather_days_observed_90d': 0,
            'weather_location_label': location['label'],
        }
