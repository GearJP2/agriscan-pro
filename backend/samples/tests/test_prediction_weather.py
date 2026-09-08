from datetime import date
from unittest.mock import Mock, patch

from django.test import TestCase

from ..models import ExternalDataCache
from ..services.prediction_weather_service import (
    PREDICTION_WEATHER_SOURCE,
    PredictionWeatherService,
)


class PredictionWeatherServiceTests(TestCase):
    def test_build_request_params_uses_90_day_pre_collection_window(self):
        params = PredictionWeatherService.build_request_params('Bangkok', date(2026, 7, 2))

        self.assertEqual(params['start'], '20260403')
        self.assertEqual(params['end'], '20260701')
        self.assertEqual(params['latitude'], 13.7563)
        self.assertEqual(params['longitude'], 100.5018)

    def test_build_request_params_prefers_exact_coordinates(self):
        params = PredictionWeatherService.build_request_params(
            'Bangkok',
            date(2026, 7, 2),
            latitude=14.1,
            longitude=100.2,
        )

        self.assertEqual(params['latitude'], 14.1)
        self.assertEqual(params['longitude'], 100.2)

    def test_summarize_parameter_data_returns_model_features(self):
        features = PredictionWeatherService.summarize_parameter_data(
            {
                'T2M': {'20260403': 30, '20260404': 32},
                'RH2M': {'20260403': 70, '20260404': 80},
                'PRECTOTCORR': {'20260403': 5, '20260404': 1},
                'TS': {'20260403': 31, '20260404': -999},
            },
            {'label': 'Bangkok'},
        )

        self.assertEqual(features['weather_temperature_c_mean_90d'], 31.0)
        self.assertEqual(features['weather_humidity_pct_mean_90d'], 75.0)
        self.assertEqual(features['weather_precipitation_mm_total_90d'], 6.0)
        self.assertEqual(features['weather_soil_temperature_c_mean_90d'], 31.0)
        self.assertEqual(features['weather_days_observed_90d'], 2)
        self.assertEqual(features['weather_location_label'], 'Bangkok')

    def test_get_features_stores_and_reuses_cache(self):
        payload = {
            'properties': {
                'parameter': {
                    'T2M': {'20260403': 30},
                    'RH2M': {'20260403': 70},
                    'PRECTOTCORR': {'20260403': 5},
                    'TS': {'20260403': 31},
                }
            }
        }
        response = Mock()
        response.json.return_value = payload
        response.raise_for_status.return_value = None

        with patch('samples.services.prediction_weather_service.requests.get', return_value=response) as get:
            first = PredictionWeatherService.get_features('Bangkok', date(2026, 7, 2))
            second = PredictionWeatherService.get_features('Bangkok', date(2026, 7, 2))

        self.assertEqual(first, second)
        self.assertEqual(get.call_count, 1)
        self.assertTrue(ExternalDataCache.objects.filter(source=PREDICTION_WEATHER_SOURCE).exists())
