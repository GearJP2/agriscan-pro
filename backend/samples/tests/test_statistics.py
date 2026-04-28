from django.test import TestCase
from django.urls import reverse
from rest_framework import status

from ..models import MycotoxinResult, Sample
from ._mixins import SampleTestMixin


class SampleStatisticsTests(SampleTestMixin, TestCase):
    """Tests for the /statistics/ and /recent_alerts/ custom actions."""

    def setUp(self):
        super().setUp()
        Sample.objects.create(
            sample_id='STAT-001', region='Central', province='Bangkok',
            district='Chatuchak', vegetation_variety='Rice',
            collection_date='2026-01-01', status='completed', updated_by=self.user,
        )
        Sample.objects.create(
            sample_id='STAT-002', region='North', province='Chiang Mai',
            district='Mueang', vegetation_variety='Corn',
            collection_date='2026-01-02', status='flagged', updated_by=self.user,
        )
        Sample.objects.create(
            sample_id='STAT-003', region='South', province='Songkhla',
            district='Hat Yai', vegetation_variety='Cassava',
            collection_date='2026-01-03', status='pending', updated_by=self.user,
        )

    def test_statistics_endpoint_returns_expected_keys(self):
        """Statistics endpoint must include total, completed, flagged, pending, high_risk."""
        url = reverse('sample-statistics')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for key in ('total_samples', 'completed', 'flagged', 'pending', 'high_risk'):
            self.assertIn(key, response.data)

    def test_statistics_counts_reflect_sample_status(self):
        """Statistics counts should match the actual sample states in the DB."""
        url = reverse('sample-statistics')
        response = self.client.get(url)
        self.assertEqual(response.data['total_samples'], 3)
        self.assertEqual(response.data['completed'], 1)
        self.assertEqual(response.data['flagged'], 1)
        self.assertEqual(response.data['pending'], 1)

    def test_statistics_high_risk_count_with_high_result(self):
        """high_risk should count samples that have at least one high/critical result."""
        flagged_sample = Sample.objects.get(sample_id='STAT-002')
        MycotoxinResult.objects.create(
            sample=flagged_sample,
            toxin_type='AFB1',
            value=25,
            unit='ug_kg',
        )
        url = reverse('sample-statistics')
        response = self.client.get(url)
        self.assertEqual(response.data['high_risk'], 1)

    def test_recent_alerts_returns_only_flagged_samples(self):
        """recent_alerts should only include samples with status='flagged'."""
        url = reverse('sample-recent-alerts')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for item in response.data:
            self.assertEqual(item['status'], 'flagged')

    def test_recent_alerts_limited_to_ten(self):
        """recent_alerts must return at most 10 samples."""
        for i in range(12):
            Sample.objects.create(
                sample_id=f'ALERT-{i:03d}', region='East', province='Chanthaburi',
                district='Mueang', vegetation_variety='Rice',
                collection_date='2026-01-05', status='flagged', updated_by=self.user,
            )
        url = reverse('sample-recent-alerts')
        response = self.client.get(url)
        self.assertLessEqual(len(response.data), 10)
