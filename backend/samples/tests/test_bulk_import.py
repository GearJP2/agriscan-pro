from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status

from ..models import MycotoxinResult, ProcessLog, Sample
from ._mixins import SampleTestMixin


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
        invalid_samples = [{'sample_id': 'BAD-001'}]
        response = self.client.post(url, invalid_samples, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_create_creates_process_log_for_each_sample(self):
        """Each bulk-created sample should have an initial process log."""
        url = reverse('sample-bulk-create')
        samples = [
            {**self.sample_data, 'sample_id': f'LOG-{i:03d}'}
            for i in range(2)
        ]
        response = self.client.post(url, samples, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProcessLog.objects.filter(state='registered').count(), 2)


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
        self.assertEqual(response.data['failed_rows'], [])

        sample = Sample.objects.get(sample_id=self.sample.sample_id)
        self.assertEqual(sample.status, 'completed')
        self.assertEqual(sample.mycotoxin_results.count(), 2)
        self.assertTrue(sample.mycotoxin_results.filter(toxin_type='AFB1').exists())
        self.assertTrue(sample.mycotoxin_results.filter(toxin_type='DON').exists())

    def test_bulk_import_results_reports_failed_rows_without_full_rollback(self):
        """A failed source row should not roll back successfully imported rows."""
        second_sample = Sample.objects.create(
            sample_id='TEST-002',
            region='Central',
            province='Bangkok',
            district='Chatuchak',
            vegetation_variety='Rice',
            collection_date='2026-01-16',
            status='pending',
            updated_by=self.user,
        )
        url = reverse('sample-bulk-import-results')
        csv_content = (
            'Sample ID,AFB1\n'
            f'{self.sample.sample_id},7\n'
            f'{second_sample.sample_id},4\n'
        )
        upload = SimpleUploadedFile(
            'results_partial_failure.csv',
            csv_content.encode('utf-8'),
            content_type='text/csv',
        )
        original_create = MycotoxinResult._default_manager.create

        def flaky_create(*args, **kwargs):
            if kwargs.get('sample') == self.sample:
                raise IntegrityError('simulated row failure')
            return original_create(*args, **kwargs)

        with patch.object(
            MycotoxinResult._default_manager,
            'create',
            side_effect=flaky_create,
        ):
            response = self.client.post(url, {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results_created'], 1)
        self.assertEqual(response.data['skipped_rows'], 1)
        self.assertEqual(len(response.data['failed_rows']), 1)
        self.assertEqual(response.data['failed_rows'][0]['sample_id'], self.sample.sample_id)
        self.assertFalse(self.sample.mycotoxin_results.exists())
        self.assertTrue(second_sample.mycotoxin_results.filter(toxin_type='AFB1').exists())

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
        self.assertTrue(
            self.sample.mycotoxin_results.filter(toxin_type='AFB1').exists()
        )

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
        upload = SimpleUploadedFile(
            'results_prefer_sample_id.csv',
            csv_content.encode('utf-8'),
            content_type='text/csv',
        )

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
        self.assertTrue(sample.mycotoxin_results.filter(toxin_type='AFB1').exists())
        self.assertTrue(sample.mycotoxin_results.filter(toxin_type='DON').exists())
        self.assertTrue(sample.process_logs.filter(notes__icontains='Analyzed at: 3/13/2026 11:46').exists())

    def test_bulk_import_results_datetime_only_row_is_skipped_not_unmatched(self):
        """Header-2 rows whose only candidate is a datetime must be skipped, not reported as unmatched."""
        self.sample.sample_id = 'SAM-2026-001'
        self.sample.save(update_fields=['sample_id'])

        url = reverse('sample-bulk-import-results')
        csv_content = (
            ',Sample,Aflatoxin B1 Results,OTA Results\n'
            'Name,Acq. Date-Time,Final Conc.,Final Conc.\n'
            'SAM-2026-001,3/13/2026 18:46,1.2,2.4\n'
        )
        upload = SimpleUploadedFile(
            'results_datetime_header.csv',
            csv_content.encode('utf-8'),
            content_type='text/csv',
        )

        response = self.client.post(url, {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['unmatched_sample_ids'], [],
            msg='Datetime-only rows must be skipped, not reported as unmatched',
        )
        self.assertEqual(response.data['matched_samples'], 1)
        self.assertGreaterEqual(response.data['results_created'], 2)
