from django.contrib.auth import get_user_model
from django.test import override_settings
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import Mock, patch

from ..models import MycotoxinResult, Sample

User = get_user_model()


class AnalyticsEndpointsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='analytics_user',
            password='Password123',
            role='research_assistant',
        )
        self.client.force_authenticate(user=self.user)

        self.sample1 = Sample.objects.create(
            sample_id='A-001', region='Central', province='Bangkok',
            vegetation_variety='maize', status='completed', collection_date='2026-04-20',
        )
        MycotoxinResult.objects.create(
            sample=self.sample1, toxin_type='AFB1', value=15.0, unit='ug_kg',
        )
        MycotoxinResult.objects.create(
            sample=self.sample1, toxin_type='DON', value=500.0, unit='ug_kg',
        )

        self.sample2 = Sample.objects.create(
            sample_id='A-002', region='North', province='Chiang Mai',
            vegetation_variety='rice', status='completed', collection_date='2026-04-21',
        )
        MycotoxinResult.objects.create(
            sample=self.sample2, toxin_type='AFB1', value=2.0, unit='ug_kg',
        )

    def test_overview_kpis(self):
        url = reverse('sample-analytics-overview')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('kpis', response.data)
        self.assertEqual(response.data['kpis']['total_samples'], 2)
        self.assertEqual(response.data['kpis']['positive_pct'], 50.0)
        self.assertEqual(response.data['kpis']['detected_pct'], 100.0)
        self.assertIn('provinces', response.data)
        self.assertGreaterEqual(len(response.data['provinces']), 2)
        bangkok = next(p for p in response.data['provinces'] if p['name'] == 'Bangkok')
        self.assertEqual(bangkok['positiveCount'], 1)
        chiang_mai = next(p for p in response.data['provinces'] if p['name'] == 'Chiang Mai')
        self.assertEqual(chiang_mai['positiveCount'], 1)
        self.assertEqual(chiang_mai['aboveThresholdPct'], 0.0)

    def test_overview_filters_by_province(self):
        url = reverse('sample-analytics-overview')
        response = self.client.get(url, {'province': 'Bangkok'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['kpis']['total_samples'], 1)
        self.assertEqual(len(response.data['provinces']), 1)
        self.assertEqual(response.data['provinces'][0]['name'], 'Bangkok')

    def test_co_contamination(self):
        url = reverse('sample-analytics-co-contamination')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('intersections', response.data)

        self.assertEqual(response.data['toxins_per_sample']['2'], 1)
        self.assertEqual(response.data['toxins_per_sample']['1'], 1)

    def test_threshold_simulation(self):
        url = reverse('sample-analytics-threshold-simulation')
        payload = {
            "overrides": {
                "AFB1": {"rice": 1.0},
            },
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('kpis', response.data)
        self.assertEqual(response.data['kpis']['total_samples'], 2)
        self.assertEqual(response.data['kpis']['above_threshold_pct'], 100.0)
        self.assertTrue(
            all(province['positiveCount'] == 1 for province in response.data['provinces'])
        )

    def test_environmental_correlation(self):
        mock_payload = {
            'properties': {
                'parameter': {
                    'T2M': {'2026042000': 30.0, '2026042012': 32.0},
                    'RH2M': {'2026042000': 70.0, '2026042012': 74.0},
                    'PRECTOTCORR': {'2026042000': 0.1, '2026042012': 0.3},
                    'TS': {'2026042000': 31.0, '2026042012': 33.0},
                },
            },
        }
        mock_response = Mock()
        mock_response.json.return_value = mock_payload
        mock_response.raise_for_status.return_value = None

        url = reverse('sample-analytics-environmental-correlation')
        with patch('samples.services.nasa_power_service.requests.get', return_value=mock_response) as mock_get:
            response = self.client.get(url, {'province': 'Bangkok'})
            cached_response = self.client.get(url, {'province': 'Bangkok'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'NASA POWER')
        self.assertEqual(response.data['cache']['status'], 'miss')
        self.assertEqual(response.data['location']['label'], 'Bangkok')
        self.assertEqual(response.data['summary']['temperatureC'], 31.0)
        self.assertEqual(response.data['summary']['relativeHumidityPct'], 72.0)
        self.assertEqual(response.data['summary']['precipitationMmHour'], 0.2)
        self.assertEqual(response.data['summary']['soilTemperatureC'], 32.0)
        self.assertEqual(len(response.data['points']), 1)
        self.assertEqual(cached_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cached_response.data['cache']['status'], 'hit')
        self.assertEqual(cached_response.data['summary']['temperatureC'], 31.0)
        self.assertEqual(mock_get.call_count, 1)
        self.assertIn('T2M,RH2M,PRECTOTCORR,TS', mock_get.call_args.kwargs['params']['parameters'])

    def test_environmental_correlation_uses_requested_province_without_samples(self):
        mock_payload = {
            'properties': {
                'parameter': {
                    'T2M': {'2026042000': 30.0},
                    'RH2M': {'2026042000': 70.0},
                    'PRECTOTCORR': {'2026042000': 0.1},
                    'TS': {'2026042000': 31.0},
                },
            },
        }
        mock_response = Mock()
        mock_response.json.return_value = mock_payload
        mock_response.raise_for_status.return_value = None

        url = reverse('sample-analytics-environmental-correlation')
        with patch('samples.services.nasa_power_service.requests.get', return_value=mock_response) as mock_get:
            response = self.client.get(url, {'province': 'Narathiwat'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['location']['label'], 'Narathiwat')
        self.assertNotEqual(response.data['location']['label'], 'Thailand centroid')
        self.assertEqual(mock_get.call_args.kwargs['params']['latitude'], 6.4254)
        self.assertEqual(mock_get.call_args.kwargs['params']['longitude'], 101.8253)

    @override_settings(
        LLM_SUMMARY_ENDPOINT='',
        LLM_SUMMARY_MODEL='',
        LLM_SUMMARY_API_KEY='',
    )
    def test_public_health_summary_requires_provider_config(self):
        url = reverse('sample-analytics-public-health-summary')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @override_settings(
        LLM_SUMMARY_ENDPOINT='https://llm.example/v1/chat/completions',
        LLM_SUMMARY_MODEL='free-model',
        LLM_SUMMARY_API_KEY='test-key',
        LLM_SUMMARY_TIMEOUT_SECONDS=5,
    )
    @patch('samples.services.llm_summary_service.requests.post')
    def test_public_health_summary_uses_configured_provider(self, mock_post):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [
                {
                    'message': {
                        'content': '{"riskDrivers":["Driver one","Driver two","Driver three","Driver four"]}',
                    },
                },
            ],
        }
        mock_post.return_value = mock_response

        url = reverse('sample-analytics-public-health-summary')
        response = self.client.post(
            url,
            {
                'kpis': {'total_samples': 2},
                'affectedCommodities': [{'name': 'maize', 'pct': 50}],
                'impactedPopulations': [{'group': 'Farming communities', 'severity': 'High'}],
                'baselineRiskDrivers': ['Existing local driver'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['riskDrivers']), 4)
        mock_post.assert_called_once()
        self.assertEqual(
            mock_post.call_args.kwargs['headers']['Authorization'],
            'Bearer test-key',
        )

    @override_settings(
        LLM_SUMMARY_ENDPOINT='https://generativelanguage.googleapis.com/v1beta2/models/gem',
        LLM_SUMMARY_MODEL='gemini-2.5-flash',
        LLM_SUMMARY_API_KEY='test-key',
        LLM_SUMMARY_TIMEOUT_SECONDS=5,
    )
    @patch('samples.services.llm_summary_service.requests.post')
    def test_public_health_summary_supports_gemini_provider(self, mock_post):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'candidates': [
                {
                    'content': {
                        'parts': [
                            {
                                'text': '{"riskDrivers":["Driver one","Driver two","Driver three","Driver four"]}',
                            },
                        ],
                    },
                },
            ],
        }
        mock_post.return_value = mock_response

        url = reverse('sample-analytics-public-health-summary')
        response = self.client.post(
            url,
            {
                'kpis': {'total_samples': 2},
                'affectedCommodities': [{'name': 'maize', 'pct': 50}],
                'impactedPopulations': [{'group': 'Farming communities', 'severity': 'High'}],
                'baselineRiskDrivers': ['Existing local driver'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['riskDrivers']), 4)
        self.assertEqual(
            mock_post.call_args.args[0],
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        )
        self.assertEqual(mock_post.call_args.kwargs['headers']['x-goog-api-key'], 'test-key')
