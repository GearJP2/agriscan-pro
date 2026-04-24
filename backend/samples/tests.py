from django.test import TestCase
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import MycotoxinResult, ProcessLog, Sample

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
            role='research_assistant',
        )
        self.admin_user = User.objects.create_user(
            username='sampleadmin',
            email='sampleadmin@example.com',
            name='Sample Admin',
            password='StrongPass123!',
            role='admin',
            is_staff=True,
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

    def test_non_admin_cannot_delete_sample(self):
        """Deleting a sample should require admin permissions."""
        Sample.objects.create(**self.sample_data, updated_by=self.user)
        url = reverse('sample-detail', kwargs={'sample_id': 'TEST-001'})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Sample.objects.filter(sample_id='TEST-001').exists())

    def test_admin_can_delete_sample(self):
        """Admins should be able to delete samples."""
        Sample.objects.create(**self.sample_data, updated_by=self.user)
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin_user)
        url = reverse('sample-detail', kwargs={'sample_id': 'TEST-001'})
        response = admin_client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Sample.objects.filter(sample_id='TEST-001').exists())

    def test_create_without_sample_id_auto_generates_sequential_id(self):
        """When sample_id is omitted, API should generate SAM-YYYY-XXX sequential IDs."""
        url = reverse('sample-list')
        payload = {k: v for k, v in self.sample_data.items() if k != 'sample_id'}

        first = self.client.post(url, payload, format='json')
        second = self.client.post(url, payload, format='json')

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertTrue(first.data['sample_id'].startswith('SAM-2026-'))
        self.assertEqual(first.data['sample_id'], 'SAM-2026-001')
        self.assertEqual(second.data['sample_id'], 'SAM-2026-002')


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
                name='Aflatoxin B1',
                intensity=5,
                dangerous=False,
                threshold=4.0,
                unit='ppb',
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

    def test_update_nonexistent_sample_returns_404(self):
        """PATCH on a sample_id that does not exist should return 404."""
        url = reverse('sample-detail', kwargs={'sample_id': 'DOES-NOT-EXIST'})
        response = self.client.patch(url, {'status': 'in_progress'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_nonexistent_sample_returns_404(self):
        """Admins should receive 404 when deleting a sample_id that does not exist."""
        url = reverse('sample-detail', kwargs={'sample_id': 'DOES-NOT-EXIST'})
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin_user)
        response = admin_client.delete(url)
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

    def test_statistics_high_risk_count_with_dangerous_result(self):
        """high_risk should count samples that have at least one dangerous=True result."""
        from .models import MycotoxinResult
        flagged_sample = Sample.objects.get(sample_id='STAT-002')
        MycotoxinResult.objects.create(
            sample=flagged_sample,
            name='Aflatoxin B1',
            intensity=9,
            dangerous=True,
            threshold=4.0,
            unit='ppb',
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

    def test_add_process_log_to_nonexistent_sample_returns_404(self):
        """POSTing a process log to a sample_id that does not exist should return 404."""
        url = reverse('sample-add-process-log', kwargs={'sample_id': 'NO-SUCH-SAMPLE'})
        payload = {'state': 'preparing', 'conducted_by': 'Lab Tech'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


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

    def test_add_mycotoxin_result_intensity_high_lab_value_returns_201(self):
        """Intensity value > 10 is a valid real lab concentration and must be accepted."""
        payload = {**self.valid_payload, 'intensity': 11}
        response = self.client.post(self.mycotoxin_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_add_mycotoxin_result_intensity_zero_returns_201(self):
        """Intensity value of 0 (not detected) is valid and must be accepted."""
        payload = {**self.valid_payload, 'intensity': 0}
        response = self.client.post(self.mycotoxin_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_add_mycotoxin_result_intensity_negative_returns_400(self):
        """Negative intensity value must be rejected with 400."""
        payload = {**self.valid_payload, 'intensity': -1}
        response = self.client.post(self.mycotoxin_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_mycotoxin_result_to_nonexistent_sample_returns_404(self):
        """POSTing a mycotoxin result to a sample_id that does not exist should return 404."""
        url = reverse('sample-add-mycotoxin-result', kwargs={'sample_id': 'NO-SUCH-SAMPLE'})
        response = self.client.post(url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_risk_level_safe_with_no_results(self):
        """A sample with no mycotoxin results should have risk_level='safe'."""
        url = reverse('sample-list')
        response = self.client.get(url)
        results = response.data if not isinstance(response.data, dict) else response.data.get('results', [])
        sample_entry = next((s for s in results if s['sample_id'] == self.sample.sample_id), None)
        self.assertIsNotNone(sample_entry)
        self.assertEqual(sample_entry['risk_level'], 'safe')

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

    def test_risk_level_medium_with_intensity_7(self):
        """A sample with max intensity >= 7 and dangerous=False should have risk_level='medium'."""
        from .models import MycotoxinResult
        MycotoxinResult.objects.create(
            sample=self.sample,
            name='Fumonisin B1',
            intensity=7,
            dangerous=False,
            threshold=4.0,
            unit='ppb',
        )
        url = reverse('sample-list')
        response = self.client.get(url)
        results = response.data if not isinstance(response.data, dict) else response.data.get('results', [])
        sample_entry = next((s for s in results if s['sample_id'] == self.sample.sample_id), None)
        self.assertIsNotNone(sample_entry)
        self.assertEqual(sample_entry['risk_level'], 'medium')

    def test_risk_level_low_with_intensity_4(self):
        """A sample with max intensity in [4, 6] and dangerous=False should have risk_level='low'."""
        from .models import MycotoxinResult
        MycotoxinResult.objects.create(
            sample=self.sample,
            name='Deoxynivalenol',
            intensity=4,
            dangerous=False,
            threshold=4.0,
            unit='ppb',
        )
        url = reverse('sample-list')
        response = self.client.get(url)
        results = response.data if not isinstance(response.data, dict) else response.data.get('results', [])
        sample_entry = next((s for s in results if s['sample_id'] == self.sample.sample_id), None)
        self.assertIsNotNone(sample_entry)
        self.assertEqual(sample_entry['risk_level'], 'low')


class BulkImportResultsTests(SampleTestMixin, TestCase):
    """Tests for bulk_import_results CSV action."""

    def setUp(self):
        super().setUp()
        self.sample = Sample.objects.create(**self.sample_data, updated_by=self.user)

    def test_bulk_import_results_matches_sample_id_and_creates_results(self):
        """CSV rows with matching sample_id should create mycotoxin results and complete the sample."""
        url = reverse('sample-bulk-import-results')
        csv_content = (
            'Sample ID,AFB1,DON\n'
            f'{self.sample.sample_id},7,900\n'
        )
        upload = SimpleUploadedFile('results.csv', csv_content.encode('utf-8'), content_type='text/csv')

        response = self.client.post(url, {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['matched_samples'], 1)
        self.assertEqual(response.data['results_created'], 2)
        self.assertEqual(response.data['unmatched_sample_ids'], [])

        sample = Sample.objects.get(sample_id=self.sample.sample_id)
        self.assertEqual(sample.status, 'completed')
        self.assertEqual(sample.mycotoxin_results.count(), 2)

    def test_bulk_import_results_reports_unmatched_sample_ids(self):
        """CSV rows for missing sample_id should be reported in unmatched_sample_ids."""
        url = reverse('sample-bulk-import-results')
        csv_content = 'sample_id,AFB1\nNOT-FOUND-001,4\n'
        upload = SimpleUploadedFile('results_missing.csv', csv_content.encode('utf-8'), content_type='text/csv')

        response = self.client.post(url, {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['matched_samples'], 0)
        self.assertIn('NOT-FOUND-001', response.data['unmatched_sample_ids'])

    def test_bulk_import_results_accepts_sampleid_header_variant(self):
        """Importer should match sample rows when header is SampleID from Excel exports."""
        url = reverse('sample-bulk-import-results')
        csv_content = (
            'SampleID,Aflatoxin B1\n'
            f'{self.sample.sample_id},6.5\n'
        )
        upload = SimpleUploadedFile('results_sampleid.csv', csv_content.encode('utf-8'), content_type='text/csv')

        response = self.client.post(url, {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['matched_samples'], 1)
        self.assertEqual(response.data['results_created'], 1)

    def test_bulk_import_results_two_row_header_excel_style(self):
        """Importer should parse files converted from Excel with grouped headers and 'Final Conc.' second header row."""
        url = reverse('sample-bulk-import-results')
        csv_content = (
            ',Sample,Aflatoxin B1 Results,DON Results,FB1 Results,OTA Results,T2 Results,ZEA Results\n'
            'Name,Acq. Date-Time,Final Conc.,Final Conc.,Final Conc.,Final Conc.,Final Conc.,Final Conc.\n'
            f'{self.sample.sample_id},3/13/2026 11:46,1.2,15.6,4.8,2.4,2.4,13.1\n'
        )
        upload = SimpleUploadedFile('results_two_header_rows.csv', csv_content.encode('utf-8'), content_type='text/csv')

        response = self.client.post(url, {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['matched_samples'], 1)
        self.assertGreaterEqual(response.data['results_created'], 6)

    def test_bulk_import_results_matches_when_numeric_segment_has_no_leading_zero(self):
        """Importer should match IDs even when file omits leading zeros (e.g. 073 vs 73)."""
        self.sample.sample_id = 'SAM-2026-073'
        self.sample.save(update_fields=['sample_id'])

        url = reverse('sample-bulk-import-results')
        csv_content = 'Sample ID,AFB1\nSAM-2026-73,6.0\n'
        upload = SimpleUploadedFile('results_leading_zero.csv', csv_content.encode('utf-8'), content_type='text/csv')

        response = self.client.post(url, {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['matched_samples'], 1)
        self.assertEqual(response.data['results_created'], 1)

    def test_bulk_import_results_prefers_sample_id_over_datetime_candidate(self):
        """When both sample ID and datetime-like candidates exist, importer must choose sample ID."""
        self.sample.sample_id = 'SAM-2026-115'
        self.sample.save(update_fields=['sample_id'])

        url = reverse('sample-bulk-import-results')
        csv_content = (
            'Sample,,DON Results\n'
            'Name,Acq. Date-Time,Final Conc.\n'
            'SAM-2026-115,3/13/26 11:00,15.60\n'
        )
        upload = SimpleUploadedFile('results_prefer_sample_id.csv', csv_content.encode('utf-8'), content_type='text/csv')

        response = self.client.post(url, {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['matched_samples'], 1)
        self.assertEqual(response.data['results_created'], 1)

    def test_bulk_import_results_new_layout_first_two_columns(self):
        """New lab layout: col A sample ID, col B analyzed datetime, col C+ toxin columns by header name."""
        self.sample.sample_id = 'SAM-2026-001'
        self.sample.save(update_fields=['sample_id'])

        url = reverse('sample-bulk-import-results')
        csv_content = (
            'Sample,,Aflatoxin B1 Results,Deoxynivalenol Results,Fumonisin B1 Results\n'
            'SAM-2026-001,3/13/2026 11:46,1.209438974,0,4.838378203\n'
        )
        upload = SimpleUploadedFile('results_new_layout.csv', csv_content.encode('utf-8'), content_type='text/csv')

        response = self.client.post(url, {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['matched_samples'], 1)
        self.assertGreaterEqual(response.data['results_created'], 3)

        sample = Sample.objects.get(sample_id='SAM-2026-001')
        self.assertTrue(sample.mycotoxin_results.filter(name='Aflatoxin B1').exists())
        self.assertTrue(sample.mycotoxin_results.filter(name='Deoxynivalenol').exists())
        self.assertTrue(sample.process_logs.filter(notes__icontains='Analyzed at: 3/13/2026 11:46').exists())


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


class SampleErrorHandlingTests(SampleTestMixin, TestCase):
    """Tests for error handling and custom exception responses."""

    def test_get_nonexistent_sample_returns_404_with_error_envelope(self):
        """Getting a non-existent sample should return 404 with consistent error format."""
        url = reverse('sample-detail', kwargs={'sample_id': 'NONEXISTENT'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error', response.data)
        self.assertIn('code', response.data['error'])
        self.assertIn('message', response.data['error'])
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('timestamp', response.data)

    def test_create_sample_missing_required_fields_returns_400_with_details(self):
        """Creating a sample with missing required fields should return 400 with field details."""
        url = reverse('sample-list')
        invalid_data = {'sample_id': 'TEST-002'}  # Missing many required fields
        response = self.client.post(url, invalid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('code', response.data['error'])
        self.assertEqual(response.data['error']['message'], 'Validation failed.')
        self.assertIn('details', response.data['error'])
        self.assertEqual(response.data['status'], 'error')

    def test_bulk_create_duplicate_sample_id_returns_409(self):
        """Bulk creating a sample with existing sample_id should return 409."""
        # Create first sample
        Sample.objects.create(**self.sample_data, updated_by=self.user)

        # Try to bulk create with the same sample_id - reuse sample_data to ensure all fields are valid
        url = reverse('sample-bulk-create')
        bulk_data = [self.sample_data.copy()]  # Use same data with same sample_id
        bulk_data[0]['collection_date'] = '2026-01-20'  # Just change the date

        response = self.client.post(url, bulk_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error']['code'], 'sample_already_exists')
        self.assertEqual(response.data['status'], 'error')
