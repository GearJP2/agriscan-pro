from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from .models import Sample, MycotoxinResult

User = get_user_model()

class AnalyticsEndpointsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='analytics_user',
            password='Password123',
            role='research_assistant'
        )
        self.client.force_authenticate(user=self.user)

        self.sample1 = Sample.objects.create(
            sample_id='A-001', region='Central', province='Bangkok',
            vegetation_variety='maize', status='completed', collection_date='2026-04-20'
        )
        MycotoxinResult.objects.create(
            sample=self.sample1, toxin_type='AFB1', value=15.0, unit='ug_kg'
        )
        MycotoxinResult.objects.create(
            sample=self.sample1, toxin_type='DON', value=500.0, unit='ug_kg'
        )

        self.sample2 = Sample.objects.create(
            sample_id='A-002', region='North', province='Chiang Mai',
            vegetation_variety='rice', status='completed', collection_date='2026-04-21'
        )
        MycotoxinResult.objects.create(
            sample=self.sample2, toxin_type='AFB1', value=2.0, unit='ug_kg'
        )

    def test_overview_kpis(self):
        url = reverse('sample-analytics-overview')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('kpis', response.data)
        self.assertEqual(response.data['kpis']['total_samples'], 2)
        # Assuming AFB1 high is > 5 based on existing tests logic
        self.assertIn('provinces', response.data)
        self.assertGreaterEqual(len(response.data['provinces']), 2)

    def test_co_contamination(self):
        url = reverse('sample-analytics-co-contamination')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('intersections', response.data)
        
        # sample1 has AFB1 and DON
        self.assertEqual(response.data['toxins_per_sample']['2'], 1)
        self.assertEqual(response.data['toxins_per_sample']['1'], 1)

    def test_threshold_simulation(self):
        url = reverse('sample-analytics-threshold-simulation')
        # We override AFB1 for rice to be 1ppb (sample2 is 2ppb, so it should flag)
        payload = {
            "overrides": {
                "AFB1": { "rice": 1.0 }
            }
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_samples', response.data)
        # sample1 AFB1 > EU default, sample2 AFB1 (2.0) > override (1.0), so both above!
        self.assertEqual(response.data['above_threshold'], 2)

    def test_environmental_correlation(self):
        url = reverse('sample-analytics-environmental-correlation')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('requires_tmd_api'))
