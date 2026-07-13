from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status

from ..models import MycotoxinResult, ProcessLog, Sample
from ._mixins import SampleTestMixin


class SampleFilteringTests(SampleTestMixin, TestCase):
    """Tests for sample filtering capabilities."""

    def setUp(self):
        super().setUp()
        Sample.objects.create(
            sample_id='FILTER-001', region='North', province='Chiang Mai',
            district='Mueang', vegetation_variety='Rice',
            collection_date='2026-01-10', status='pending', updated_by=self.user,
        )
        Sample.objects.create(
            sample_id='FILTER-002', region='South', province='Songkhla',
            district='Hat Yai', vegetation_variety='Corn',
            collection_date='2026-02-20', status='completed', updated_by=self.user,
        )

    def _get_results(self, response_data):
        """Extract results from response data, handling both paginated and unpaginated responses."""
        if isinstance(response_data, dict) and 'results' in response_data:
            return response_data['results']
        return response_data

    def test_filter_by_status(self):
        """Filtering by status should return only matching samples."""
        url = reverse('sample-list')
        response = self.client.get(url, {'status': 'completed'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response.data)
        sample_ids = [s['sample_id'] for s in results]
        self.assertIn('FILTER-002', sample_ids)
        self.assertNotIn('FILTER-001', sample_ids)

    def test_filter_by_region(self):
        """Filtering by region should return only matching samples."""
        url = reverse('sample-list')
        response = self.client.get(url, {'region': 'North'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response.data)
        sample_ids = [s['sample_id'] for s in results]
        self.assertIn('FILTER-001', sample_ids)
        self.assertNotIn('FILTER-002', sample_ids)

    def test_filter_by_province(self):
        """Filtering by province should return only matching samples."""
        url = reverse('sample-list')
        response = self.client.get(url, {'province': 'Songkhla'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response.data)
        sample_ids = [s['sample_id'] for s in results]
        self.assertIn('FILTER-002', sample_ids)
        self.assertNotIn('FILTER-001', sample_ids)

    def test_filter_by_vegetation(self):
        """Filtering by vegetation should return only matching samples."""
        url = reverse('sample-list')
        response = self.client.get(url, {'vegetation': 'Corn'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response.data)
        sample_ids = [s['sample_id'] for s in results]
        self.assertIn('FILTER-002', sample_ids)
        self.assertNotIn('FILTER-001', sample_ids)

    def test_filter_by_date_range(self):
        """Filtering by date_from/date_to should return only in-range samples."""
        url = reverse('sample-list')
        response = self.client.get(url, {'date_from': '2026-02-01', 'date_to': '2026-03-01'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response.data)
        sample_ids = [s['sample_id'] for s in results]
        self.assertIn('FILTER-002', sample_ids)
        self.assertNotIn('FILTER-001', sample_ids)

    def test_filter_by_multiple_statuses(self):
        """Comma-separated status values should return samples matching any."""
        url = reverse('sample-list')
        response = self.client.get(url, {'status': 'pending,completed'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response.data)
        returned_statuses = {s['status'] for s in results}
        self.assertTrue(returned_statuses.issubset({'pending', 'completed'}))
        self.assertGreaterEqual(len(results), 2)

    def test_filter_by_sample_type(self):
        """Filtering by sample_type should return only matching samples."""
        field_sample = Sample.objects.get(sample_id='FILTER-001')
        field_sample.sample_type = 'field'
        field_sample.save()

        market_sample = Sample.objects.get(sample_id='FILTER-002')
        market_sample.sample_type = 'market'
        market_sample.save()

        url = reverse('sample-list')

        # Single type filter
        response = self.client.get(url, {'sample_type': 'field'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [s['sample_id'] for s in self._get_results(response.data)]
        self.assertIn('FILTER-001', ids)
        self.assertNotIn('FILTER-002', ids)

        # Multiple types filter
        response = self.client.get(url, {'sample_type': 'field,market'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [s['sample_id'] for s in self._get_results(response.data)]
        self.assertIn('FILTER-001', ids)
        self.assertIn('FILTER-002', ids)

    def test_search_by_sample_id(self):
        """Search query should find samples matching the sample_id."""
        url = reverse('sample-list')
        response = self.client.get(url, {'search': 'FILTER-001'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response.data)
        sample_ids = [s['sample_id'] for s in results]
        self.assertIn('FILTER-001', sample_ids)

    def test_list_endpoint_avoids_n_plus_one_queries(self):
        """Sample list should stay bounded thanks to select_related/prefetch_related."""
        for index in range(3, 8):
            sample = Sample.objects.create(
                sample_id=f'FILTER-00{index}',
                region='Central',
                province='Bangkok',
                district='Chatuchak',
                vegetation_variety='Rice',
                collection_date='2026-02-01',
                status='completed',
                updated_by=self.user,
            )
            ProcessLog.objects.create(
                sample=sample,
                state='completed',
                notes='Completed',
                conducted_by=self.user.username,
            )
            MycotoxinResult.objects.create(
                sample=sample,
                toxin_type='AFB1',
                value=5,
                unit='ug_kg',
            )

        url = reverse('sample-list')
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(
            len(queries),
            6,
            msg=f"Expected bounded query count, saw {len(queries)} queries.",
        )

    def test_ordering_by_collection_date_desc(self):
        """Default ordering should place the most recent collection_date first."""
        url = reverse('sample-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response.data)
        if len(results) >= 2:
            dates = [r['collection_date'] for r in results]
            self.assertGreaterEqual(dates[0], dates[-1])
