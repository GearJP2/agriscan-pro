from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import Sample

User = get_user_model()


class SampleTestMixin:
    """Shared setup for sample tests."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='sampleuser',
            email='sample@example.com',
            name='Sample User',
            password='StrongPass123!',
        )
        self.client.force_authenticate(user=self.user)

        self.sample_data = {
            'sample_id': 'TEST-001',
            'region': 'Central',
            'province': 'Bangkok',
            'district': 'Chatuchak',
            'vegetation_variety': 'Rice',
            'collection_date': '2026-01-15',
            'status': 'pending',
        }


class SampleCRUDTests(SampleTestMixin, TestCase):
    """Tests for basic Sample CRUD operations."""

    def test_create_sample(self):
        """Creating a sample with valid data should return 201."""
        url = reverse('sample-list')
        response = self.client.post(url, self.sample_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Sample.objects.filter(sample_id='TEST-001').exists())

    def test_list_samples(self):
        """Listing samples should return 200 and include created samples."""
        Sample.objects.create(**self.sample_data, updated_by=self.user)
        url = reverse('sample-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_retrieve_sample(self):
        """Retrieving a single sample by sample_id should return 200."""
        Sample.objects.create(**self.sample_data, updated_by=self.user)
        url = reverse('sample-detail', kwargs={'sample_id': 'TEST-001'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sample_id'], 'TEST-001')

    def test_update_sample(self):
        """Updating a sample should return 200 and persist changes."""
        Sample.objects.create(**self.sample_data, updated_by=self.user)
        url = reverse('sample-detail', kwargs={'sample_id': 'TEST-001'})
        response = self.client.patch(url, {'status': 'in_progress'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            Sample.objects.get(sample_id='TEST-001').status, 'in_progress'
        )

    def test_delete_sample(self):
        """Deleting a sample should return 204 and remove the record."""
        Sample.objects.create(**self.sample_data, updated_by=self.user)
        url = reverse('sample-detail', kwargs={'sample_id': 'TEST-001'})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Sample.objects.filter(sample_id='TEST-001').exists())


class SampleBulkImportTests(SampleTestMixin, TestCase):
    """Tests for the bulk_create endpoint."""

    def test_bulk_create_multiple_samples(self):
        """Bulk creating multiple samples should return 201."""
        url = reverse('sample-bulk-create')
        samples = [
            {**self.sample_data, 'sample_id': f'BULK-{i:03d}'}
            for i in range(3)
        ]
        response = self.client.post(url, samples, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Sample.objects.count(), 3)

    def test_bulk_create_with_invalid_data_returns_400(self):
        """Bulk creating samples with missing required fields should return 400."""
        url = reverse('sample-bulk-create')
        invalid_samples = [{'sample_id': 'BAD-001'}]  # Missing required fields
        response = self.client.post(url, invalid_samples, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_create_creates_process_log_for_each_sample(self):
        """Each bulk-created sample should have an initial process log."""
        from .models import ProcessLog
        url = reverse('sample-bulk-create')
        samples = [
            {**self.sample_data, 'sample_id': f'LOG-{i:03d}'}
            for i in range(2)
        ]
        response = self.client.post(url, samples, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProcessLog.objects.filter(state='registered').count(), 2)


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

    def test_search_by_sample_id(self):
        """Search query should find samples matching the sample_id."""
        url = reverse('sample-list')
        response = self.client.get(url, {'search': 'FILTER-001'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response.data)
        sample_ids = [s['sample_id'] for s in results]
        self.assertIn('FILTER-001', sample_ids)

    def test_ordering_by_collection_date_desc(self):
        """Default ordering should place the most recent collection_date first."""
        url = reverse('sample-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response.data)
        if len(results) >= 2:
            dates = [r['collection_date'] for r in results]
            self.assertGreaterEqual(dates[0], dates[-1])


class SampleCRUDEdgeCaseTests(SampleTestMixin, TestCase):
    """Edge-case and validation tests for Sample CRUD."""

    def test_create_sample_missing_required_field_returns_400(self):
        """Omitting a required field (region) should return 400."""
        data = dict(self.sample_data)
        data.pop('region')
        url = reverse('sample-list')
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicate_sample_id_returns_400(self):
        """Creating two samples with the same sample_id should return 400."""
        url = reverse('sample-list')
        self.client.post(url, self.sample_data, format='json')
        response = self.client.post(url, self.sample_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_nonexistent_sample_returns_404(self):
        """Requesting a sample_id that does not exist should return 404."""
        url = reverse('sample-detail', kwargs={'sample_id': 'DOES-NOT-EXIST'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_sample_auto_creates_initial_process_log(self):
        """Creating a sample through the API should auto-create a 'registered' process log."""
        from .models import ProcessLog
        url = reverse('sample-list')
        self.client.post(url, self.sample_data, format='json')
        sample = Sample.objects.get(sample_id='TEST-001')
        self.assertTrue(
            ProcessLog.objects.filter(sample=sample, state='registered').exists()
        )


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


class ProcessLogTests(SampleTestMixin, TestCase):
    """Tests for the add_process_log custom action."""

    def setUp(self):
        super().setUp()
        self.sample = Sample.objects.create(**self.sample_data, updated_by=self.user)

    def test_add_process_log_returns_201(self):
        """Adding a valid process log should return 201 with the log data."""
        url = reverse('sample-add-process-log', kwargs={'sample_id': self.sample.sample_id})
        payload = {'state': 'preparing', 'conducted_by': 'Lab Tech', 'notes': 'Started prep'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['state'], 'preparing')

    def test_add_process_log_invalid_state_returns_400(self):
        """Providing an invalid state value should return 400."""
        url = reverse('sample-add-process-log', kwargs={'sample_id': self.sample.sample_id})
        payload = {'state': 'invalid_state', 'conducted_by': 'Lab Tech'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_process_log_missing_conducted_by_returns_400(self):
        """Omitting the required conducted_by field should return 400."""
        url = reverse('sample-add-process-log', kwargs={'sample_id': self.sample.sample_id})
        payload = {'state': 'preparing'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class MycotoxinResultTests(SampleTestMixin, TestCase):
    """Tests for the add_mycotoxin_result custom action."""

    def setUp(self):
        super().setUp()
        self.sample = Sample.objects.create(**self.sample_data, updated_by=self.user)
        self.mycotoxin_url = reverse(
            'sample-add-mycotoxin-result',
            kwargs={'sample_id': self.sample.sample_id},
        )
        self.valid_payload = {
            'name': 'Aflatoxin B1',
            'intensity': 5,
            'dangerous': False,
            'threshold': 4.0,
            'unit': 'ppb',
        }

    def test_add_mycotoxin_result_returns_201(self):
        """Adding a valid mycotoxin result should return 201."""
        response = self.client.post(self.mycotoxin_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Aflatoxin B1')

    def test_add_mycotoxin_result_intensity_too_high_returns_400(self):
        """Intensity value > 10 must be rejected with 400."""
        payload = {**self.valid_payload, 'intensity': 11}
        response = self.client.post(self.mycotoxin_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_mycotoxin_result_intensity_too_low_returns_400(self):
        """Intensity value < 1 must be rejected with 400."""
        payload = {**self.valid_payload, 'intensity': 0}
        response = self.client.post(self.mycotoxin_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_risk_level_high_with_dangerous_result(self):
        """A sample with a dangerous=True result should report risk_level='high'."""
        from .models import MycotoxinResult
        MycotoxinResult.objects.create(
            sample=self.sample,
            name='Aflatoxin B1',
            intensity=9,
            dangerous=True,
            threshold=4.0,
            unit='ppb',
        )
        url = reverse('sample-list')
        response = self.client.get(url)
        results = response.data if not isinstance(response.data, dict) else response.data.get('results', [])
        sample_entry = next((s for s in results if s['sample_id'] == self.sample.sample_id), None)
        self.assertIsNotNone(sample_entry)
        self.assertEqual(sample_entry['risk_level'], 'high')


class SampleUnauthenticatedTests(TestCase):
    """Verify that unauthenticated requests are rejected."""

    def setUp(self):
        self.client = APIClient()

    def test_unauthenticated_list_returns_401(self):
        """GET /samples/ without credentials must return 401."""
        url = reverse('sample-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_create_returns_401(self):
        """POST /samples/ without credentials must return 401."""
        url = reverse('sample-list')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
