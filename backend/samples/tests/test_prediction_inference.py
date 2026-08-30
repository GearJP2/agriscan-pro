from datetime import date
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

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
