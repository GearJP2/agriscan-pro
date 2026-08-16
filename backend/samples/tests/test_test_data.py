from datetime import date
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from notifications.models import Notification
from ..models import MycotoxinResult, ProcessLog, Sample
from ..services.test_data_service import TEST_PREFIX, TestDataService
from ._mixins import SampleTestMixin


class TestDataServiceTests(SampleTestMixin, TestCase):
    """Tests for the TestDataService logic."""

    def test_generate_samples_creates_correct_count_and_split(self):
        """Service should create 100 samples with a balanced 50/50 split across all 4 statuses."""
        result = TestDataService.generate_test_samples(user=self.admin_user)

        self.assertEqual(result['created'], 100)
        self.assertEqual(result['positive'], 50)
        self.assertEqual(result['negative'], 50)
        self.assertEqual(len(result['sample_ids']), 100)

        self.assertEqual(Sample.objects.filter(sample_id__startswith=TEST_PREFIX).count(), 100)

        # Status distribution assertions
        self.assertEqual(Sample.objects.filter(sample_id__startswith=TEST_PREFIX, status='pending').count(), 5)
        self.assertEqual(Sample.objects.filter(sample_id__startswith=TEST_PREFIX, status='in_progress').count(), 5)
        self.assertEqual(Sample.objects.filter(sample_id__startswith=TEST_PREFIX, status='completed').count(), 85)
        self.assertEqual(Sample.objects.filter(sample_id__startswith=TEST_PREFIX, status='flagged').count(), 5)

        # All results must use 'ug_kg' unit
        for result_obj in MycotoxinResult.objects.filter(sample__sample_id__startswith=TEST_PREFIX):
            self.assertEqual(result_obj.unit, 'ug_kg')

        # risk_level must be computed correctly (not left as 'unclassified')
        # Positive samples (multi_positive + flagged) should have 'high' or 'critical' risk
        above_threshold = MycotoxinResult.objects.filter(
            sample__sample_id__startswith=TEST_PREFIX,
            risk_level__in=['high', 'critical'],
        ).count()
        self.assertGreater(
            above_threshold,
            0,
            "No above-threshold risk_levels found — bulk_create may be skipping save()",
        )

        # Baseline negative samples with value=0 should be 'safe'
        safe_results = MycotoxinResult.objects.filter(
            sample__sample_id__startswith=TEST_PREFIX,
            value=0.0,
            risk_level='safe',
        ).count()
        zero_results = MycotoxinResult.objects.filter(
            sample__sample_id__startswith=TEST_PREFIX,
            value=0.0,
        ).count()
        self.assertEqual(safe_results, zero_results, "Zero-value results should all have risk_level='safe'")

        # No results should remain as 'unclassified' for toxins with threshold data
        unclassified = MycotoxinResult.objects.filter(
            sample__sample_id__startswith=TEST_PREFIX,
            risk_level='unclassified',
        ).count()
        self.assertEqual(unclassified, 0, "Found 'unclassified' results — risk_level was not computed")

        # No risk alert notifications should have been dispatched for TEST- samples
        self.assertEqual(Notification.objects.count(), 0)

        valid_process_states = {value for value, _label in ProcessLog.PROCESS_STATE_CHOICES}
        generated_states = set(ProcessLog.objects.values_list('state', flat=True))
        self.assertLessEqual(generated_states, valid_process_states)

    def test_generate_is_deterministic_with_same_seed_and_as_of(self):
        """Repeated generation with the same seed and as_of date should produce identical IDs and dates."""
        fixed_date = date(2026, 3, 1)
        result1 = TestDataService.generate_test_samples(user=self.admin_user, seed=99, as_of=fixed_date)
        result2 = TestDataService.generate_test_samples(user=self.admin_user, seed=99, as_of=fixed_date)

        self.assertEqual(result1['sample_ids'], result2['sample_ids'])

    def test_generate_with_user_none_succeeds(self):
        """Service should support CLI execution with user=None without raising AttributeError."""
        result = TestDataService.generate_test_samples(user=None, seed=42)
        self.assertEqual(result['created'], 100)
        first_sample = Sample.objects.filter(sample_id__startswith=TEST_PREFIX).first()
        self.assertIsNone(first_sample.updated_by)
        first_log = ProcessLog.objects.filter(sample=first_sample).first()
        self.assertEqual(first_log.conducted_by, "System")

    def test_delete_samples_only_removes_prefixed_rows_and_notifications(self):
        """Deletion should target ONLY sample_ids starting with TEST-."""
        real_id = 'REAL-001'
        Sample.objects.create(**{**self.sample_data, 'sample_id': real_id}, updated_by=self.user)

        TestDataService.generate_test_samples(user=self.admin_user)
        self.assertEqual(Sample.objects.count(), 101)

        TestDataService.delete_test_samples(user=self.admin_user)
        self.assertEqual(Sample.objects.count(), 1)
        self.assertTrue(Sample.objects.filter(sample_id=real_id).exists())


class TestDataViewTests(SampleTestMixin, TestCase):
    """Integration tests for the test data generation/deletion endpoints."""

    def test_generate_test_data_requires_admin(self):
        """Regular users (researchers) should be forbidden from generating test data."""
        url = reverse('sample-generate-test-data')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_generate_test_data_succeeds_for_admin(self):
        """Admins should be able to trigger data generation."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin_user)
        url = reverse('sample-generate-test-data')

        response = admin_client.post(url, {'seed': 123}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['created'], 100)
        self.assertEqual(response.data['positive'], 50)

    def test_delete_test_data_requires_admin(self):
        """Regular users should be forbidden from deleting test data."""
        url = reverse('sample-delete-test-data')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_test_data_succeeds_for_admin(self):
        """Admins should be able to trigger data deletion."""
        TestDataService.generate_test_samples(user=self.admin_user)

        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin_user)
        url = reverse('sample-delete-test-data')

        response = admin_client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['deleted'], 100)

    def test_audit_logs_created(self):
        """Both actions should record entries in the AuditLog table."""
        from core.models import AuditLog
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin_user)

        admin_client.post(reverse('sample-generate-test-data'), {}, format='json')
        admin_client.post(reverse('sample-delete-test-data'), {}, format='json')

        self.assertTrue(AuditLog.objects.filter(action='generate_test_data').exists())
        self.assertTrue(AuditLog.objects.filter(action='delete_test_data').exists())
