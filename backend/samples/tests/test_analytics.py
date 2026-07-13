from django.contrib.auth import get_user_model
from django.conf import settings
from django.test import override_settings
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
import requests
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import Mock, patch

from ..models import ExternalDataCache, MycotoxinResult, Sample
from ..services.llm_summary_service import LLMSummaryService
from ..services.nasa_power_service import DEFAULT_COORDINATES, NasaPowerService
from ..tasks import prune_expired_nasa_power_cache
from core.celery import app as celery_app

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

    def test_select_location_prefers_explicit_province(self):
        location = NasaPowerService._select_location({'province': 'Narathiwat'})

        self.assertEqual(location['label'], 'Narathiwat')
        self.assertEqual(location['latitude'], 6.4254)
        self.assertEqual(location['longitude'], 101.8253)

    def test_select_location_uses_most_common_filtered_province(self):
        Sample.objects.create(
            sample_id='A-003', region='North', province='Chiang Mai',
            vegetation_variety='rice', status='completed', collection_date='2026-04-22',
        )

        location = NasaPowerService._select_location({'region': 'North'})

        self.assertEqual(location['label'], 'Chiang Mai')
        self.assertEqual(location['latitude'], 18.7883)
        self.assertEqual(location['longitude'], 98.9853)

    def test_select_location_uses_default_coordinates_without_samples(self):
        Sample.objects.all().delete()

        self.assertEqual(NasaPowerService._select_location({}), DEFAULT_COORDINATES)

    def test_environmental_correlation_returns_502_on_request_exception(self):
        url = reverse('sample-analytics-environmental-correlation')

        with patch(
            'samples.services.nasa_power_service.requests.get',
            side_effect=requests.RequestException('boom'),
        ):
            response = self.client.get(url, {'province': 'Bangkok'})

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(
            response.data,
            {
                'source': 'NASA POWER',
                'data': [],
                'requires_nasa_power': True,
                'message': 'NASA POWER environmental data is temporarily unavailable.',
            },
        )

    def test_environmental_correlation_rejects_invalid_payloads_without_caching(self):
        url = reverse('sample-analytics-environmental-correlation')
        invalid_payloads = [
            {'properties': {}},
            {
                'properties': {
                    'parameter': {
                        'T2M': {},
                        'RH2M': {},
                        'PRECTOTCORR': {},
                        'TS': {},
                    },
                },
            },
        ]

        for payload in invalid_payloads:
            mock_response = Mock()
            mock_response.json.return_value = payload
            mock_response.raise_for_status.return_value = None

            with self.subTest(payload=payload), patch(
                'samples.services.nasa_power_service.requests.get',
                side_effect=[mock_response, mock_response],
            ) as mock_get:
                first_response = self.client.get(url, {'province': 'Bangkok'})
                second_response = self.client.get(url, {'province': 'Bangkok'})

                self.assertEqual(first_response.status_code, status.HTTP_502_BAD_GATEWAY)
                self.assertEqual(second_response.status_code, status.HTTP_502_BAD_GATEWAY)
                self.assertEqual(first_response.data['source'], 'NASA POWER')
                self.assertEqual(first_response.data['message'], 'NASA POWER environmental data is temporarily unavailable.')
                self.assertTrue(first_response.data['requires_nasa_power'])
                self.assertEqual(mock_get.call_count, 2)
                self.assertFalse(ExternalDataCache.objects.filter(source='NASA_POWER').exists())

    def test_nasa_cache_read_ignores_but_does_not_delete_expired_payload(self):
        cache = ExternalDataCache.objects.create(
            source='NASA_POWER',
            cache_key='expired-nasa-cache',
            payload={'stale': True},
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        self.assertIsNone(NasaPowerService._get_cached_payload(cache.cache_key))
        self.assertTrue(ExternalDataCache.objects.filter(pk=cache.pk).exists())

    def test_prune_expired_nasa_power_cache_task(self):
        expired_nasa = ExternalDataCache.objects.create(
            source='NASA_POWER',
            cache_key='expired-nasa-cache',
            payload={},
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        fresh_nasa = ExternalDataCache.objects.create(
            source='NASA_POWER',
            cache_key='fresh-nasa-cache',
            payload={},
            expires_at=timezone.now() + timedelta(minutes=1),
        )
        expired_other = ExternalDataCache.objects.create(
            source='OTHER',
            cache_key='expired-other-cache',
            payload={},
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        self.assertEqual(prune_expired_nasa_power_cache.run(), 1)
        self.assertFalse(ExternalDataCache.objects.filter(pk=expired_nasa.pk).exists())
        self.assertTrue(ExternalDataCache.objects.filter(pk=fresh_nasa.pk).exists())
        self.assertTrue(ExternalDataCache.objects.filter(pk=expired_other.pk).exists())

    def test_nasa_cache_prune_task_is_registered_and_scheduled(self):
        task_name = 'samples.tasks.prune_expired_nasa_power_cache'

        self.assertEqual(prune_expired_nasa_power_cache.name, task_name)
        self.assertIn(task_name, celery_app.tasks)
        self.assertEqual(settings.CELERY_BEAT_SCHEDULE['prune-expired-nasa-power-cache']['task'], task_name)

    def test_threshold_simulation_returns_400_for_invalid_overrides(self):
        url = reverse('sample-analytics-threshold-simulation')

        response = self.client.post(url, {'overrides': ['AFB1']}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'overrides must be a dictionary')

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

    def test_parse_risk_drivers_falls_back_to_line_parsing_for_prose(self):
        content = '\n'.join([
            '1. Elevated humidity around stored maize lots',
            '2. Delayed drying after harvest in the north',
            '- Informal storage handling for smallholder batches',
            '* Inconsistent screening before distribution',
        ])

        result = LLMSummaryService._parse_risk_drivers(content)

        self.assertEqual(
            result,
            [
                'Elevated humidity around stored maize lots',
                'Delayed drying after harvest in the north',
                'Informal storage handling for smallholder batches',
                'Inconsistent screening before distribution',
            ],
        )
