from datetime import date
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ..models import Sample
from ..services.prediction_inference_service import PredictionInferenceService

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
