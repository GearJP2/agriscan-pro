from datetime import date
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ..models import PredictionContext, Sample
from ..services.prediction_inference_service import (
    PredictionInferenceService,
    PredictionModelUnavailable,
)

User = get_user_model()


class PredictionInferenceServiceTests(TestCase):
    def test_payload_to_dataset_row_derives_seasonal_context(self):
        row = PredictionInferenceService.payload_to_dataset_row({
            'food_feed_type': 'food',
            'sub_type': 'White Rice',
            'region': 'Central',
            'province': 'bangkok',
            'district': 'chatuchak',
            'collection_date': date(2026, 7, 2),
            'purpose': 'research',
            'sample_type': 'market',
            'processing_type': 'milled',
        })

        self.assertEqual(row['sub_type'], 'white rice')
        self.assertEqual(row['province'], 'Bangkok')
        self.assertEqual(row['collection_month'], 7)
        self.assertEqual(row['collection_quarter'], 3)
        self.assertEqual(row['collection_season_thailand'], 'rainy')
        self.assertEqual(row['weather_days_observed_90d'], 0)

    def test_payload_to_dataset_row_can_include_weather_features(self):
        weather = {
            'weather_temperature_c_mean_90d': 30.1,
            'weather_humidity_pct_mean_90d': 75.5,
            'weather_precipitation_mm_total_90d': 220.0,
            'weather_soil_temperature_c_mean_90d': 31.2,
            'weather_days_observed_90d': 90,
            'weather_location_label': 'Bangkok',
        }

        with patch(
            'samples.services.prediction_inference_service.PredictionWeatherService.get_features',
            return_value=weather,
        ):
            row = PredictionInferenceService.payload_to_dataset_row({
                'food_feed_type': 'food',
                'sub_type': 'White Rice',
                'province': 'Bangkok',
                'collection_date': date(2026, 7, 2),
            }, include_weather=True)

        self.assertEqual(row['weather_temperature_c_mean_90d'], 30.1)
        self.assertEqual(row['weather_days_observed_90d'], 90)

    def test_sample_to_payload_uses_registered_sample_fields(self):
        sample = Sample(
            sample_id='RIC-2026-001',
            region='Central',
            province='Bangkok',
            district='Chatuchak',
            vegetation_variety='Rice',
            food_feed_type='food',
            sub_type='White Rice',
            collection_date=date(2026, 7, 2),
            purpose='research',
            sample_type='market',
            processing_type='milled',
        )

        payload = PredictionInferenceService.sample_to_payload(sample)

        self.assertEqual(payload['food_feed_type'], 'food')
        self.assertEqual(payload['sub_type'], 'White Rice')
        self.assertEqual(payload['province'], 'Bangkok')
        self.assertEqual(payload['collection_date'], date(2026, 7, 2))

    def test_sample_to_payload_includes_prediction_context(self):
        sample = Sample.objects.create(
            sample_id='RIC-2026-CTX',
            region='Central',
            province='Bangkok',
            district='Chatuchak',
            vegetation_variety='White Rice',
            food_feed_type='food',
            sub_type='White Rice',
            collection_date='2026-07-02',
            status='completed',
        )
        PredictionContext.objects.create(
            sample=sample,
            latitude=13.7563,
            longitude=100.5018,
            location_type='farm',
            harvest_date='2026-06-15',
            moisture_pct=12.5,
            soil_ph=6.4,
        )

        payload = PredictionInferenceService.sample_to_payload(sample)

        self.assertEqual(payload['latitude'], 13.7563)
        self.assertEqual(payload['longitude'], 100.5018)
        self.assertEqual(payload['location_type'], 'farm')
        self.assertEqual(str(payload['harvest_date']), '2026-06-15')
        self.assertEqual(payload['moisture_pct'], 12.5)

    def test_model_status_reports_latest_publish_state(self):
        with TemporaryDirectory() as tmp_dir:
            version_dir = Path(tmp_dir) / 'v20260831010101'
            version_dir.mkdir()
            (version_dir / 'metadata.json').write_text(json.dumps({
                'version': 'v20260831010101',
                'created_at': '2026-08-31T01:01:01+00:00',
                'model_family': 'baseline',
                'trained_models': [
                    {
                        'toxin_type': 'AFB1',
                        'published': True,
                        'measured': 100,
                        'detected': 40,
                        'usable_context': 90,
                        'classification_metrics': {'f1': 0.7},
                    },
                    {
                        'toxin_type': 'DON',
                        'published': False,
                        'measured': 90,
                        'detected': 35,
                        'usable_context': 85,
                        'classification_metrics': {'f1': 0.5},
                    },
                ],
                'skipped_targets': [{'toxin_type': 'OTA'}],
            }), encoding='utf-8')

            status_data = PredictionInferenceService.get_model_status(artifacts_dir=tmp_dir)

        self.assertEqual(status_data['status'], 'published')
        self.assertEqual(status_data['latest']['version'], 'v20260831010101')
        self.assertEqual(status_data['latest']['trainedTargets'], 2)
        self.assertEqual(status_data['latest']['publishedTargets'], 1)
        self.assertEqual(status_data['latest']['skippedTargets'], 1)

    def test_estimate_requires_published_models(self):
        with TemporaryDirectory() as tmp_dir:
            version_dir = Path(tmp_dir) / 'v20260831010101'
            version_dir.mkdir()
            (version_dir / 'metadata.json').write_text(json.dumps({
                'version': 'v20260831010101',
                'trained_models': [{'toxin_type': 'AFB1', 'published': False}],
            }), encoding='utf-8')

            with self.assertRaises(PredictionModelUnavailable):
                PredictionInferenceService.estimate({
                    'food_feed_type': 'food',
                    'sub_type': 'White Rice',
                    'province': 'Bangkok',
                    'collection_date': date(2026, 7, 2),
                }, artifacts_dir=tmp_dir)


class PredictionEstimateEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.researcher = User.objects.create_user(
            username='prediction_researcher',
            password='Password123',
            role='researcher',
        )
        self.assistant = User.objects.create_user(
            username='prediction_assistant',
            password='Password123',
            role='research_assistant',
        )
        self.payload = {
            'food_feed_type': 'food',
            'sub_type': 'White Rice',
            'province': 'Bangkok',
            'collection_date': '2026-07-02',
            'region': 'Central',
            'district': 'Chatuchak',
            'purpose': 'research',
            'sample_type': 'market',
            'processing_type': 'milled',
        }
        self.sample = Sample.objects.create(
            sample_id='RIC-2026-001',
            region='Central',
            province='Bangkok',
            district='Chatuchak',
            vegetation_variety='White Rice',
            food_feed_type='food',
            sub_type='White Rice',
            collection_date='2026-07-02',
            status='completed',
            purpose='research',
            sample_type='market',
            processing_type='milled',
        )

    def test_prediction_estimate_requires_research_role(self):
        self.client.force_authenticate(user=self.assistant)

        response = self.client.post(
            reverse('sample-prediction-estimate'),
            self.payload,
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(BASE_DIR=Path('/tmp/agriscan-no-prediction-artifacts'))
    def test_prediction_estimate_returns_503_without_artifacts(self):
        self.client.force_authenticate(user=self.researcher)

        response = self.client.post(
            reverse('sample-prediction-estimate'),
            self.payload,
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('detail', response.data)

    def test_prediction_estimate_sample_uses_registered_sample(self):
        self.client.force_authenticate(user=self.researcher)
        expected = {
            'modelVersion': 'v-test',
            'predictions': [],
            'warning': 'Research estimate only.',
        }

        with patch('samples.views.PredictionInferenceService.estimate', return_value=expected) as estimate:
            response = self.client.post(
                reverse('sample-prediction-estimate-sample', kwargs={'sample_id': self.sample.sample_id}),
                {},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, expected)
        payload = estimate.call_args.args[0]
        self.assertEqual(payload['sub_type'], 'White Rice')
        self.assertEqual(payload['province'], 'Bangkok')

    def test_prediction_status_requires_research_role(self):
        self.client.force_authenticate(user=self.assistant)

        response = self.client.get(reverse('sample-prediction-status'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(BASE_DIR=Path('/tmp/agriscan-no-prediction-artifacts'))
    def test_prediction_status_returns_not_trained_without_artifacts(self):
        self.client.force_authenticate(user=self.researcher)

        response = self.client.get(reverse('sample-prediction-status'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'not_trained')

    def test_prediction_context_can_be_saved_and_read(self):
        self.client.force_authenticate(user=self.researcher)
        url = reverse('sample-prediction-context', kwargs={'sample_id': self.sample.sample_id})

        response = self.client.put(url, {
            'latitude': 13.7563,
            'longitude': 100.5018,
            'location_type': 'farm',
            'harvest_date': '2026-06-15',
            'crop_variety': 'RD43',
            'storage_duration_days': 14,
            'moisture_pct': 12.5,
            'soil_ph': 6.4,
        }, format='json')
        read_response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(read_response.data['location_type'], 'farm')
        self.assertEqual(read_response.data['crop_variety'], 'RD43')
