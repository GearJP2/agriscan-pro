from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ..models import MycotoxinResult, Sample
from ..services.test_data_service import TEST_PREFIX, TestDataService
from ._mixins import SampleTestMixin


class TestDataServiceTests(SampleTestMixin, TestCase):
    """Smoke tests for the TestDataService logic."""

    def test_generate_samples_creates_correct_count_and_split(self):
        """Service should create 30 samples with a 20/10 risk split."""
        result = TestDataService.generate_test_samples(user=self.admin_user)

        self.assertEqual(result['created'], 30)
        self.assertEqual(result['positive'], 20)
        self.assertEqual(result['negative'], 10)
        self.assertEqual(len(result['sample_ids']), 30)

        self.assertEqual(Sample.objects.filter(sample_id__startswith=TEST_PREFIX).count(), 30)

        positive_count = MycotoxinResult.objects.filter(
            sample__sample_id__startswith=TEST_PREFIX,
            risk_level__in=['high', 'critical'],
        ).count()
        negative_count = MycotoxinResult.objects.filter(
            sample__sample_id__startswith=TEST_PREFIX,
            risk_level='safe',
        ).count()

        self.assertEqual(positive_count, 20)
        self.assertEqual(negative_count, 10)

    def test_generate_is_deterministic_with_same_seed(self):
        """Repeated generation with the same seed should produce identical IDs."""
        result1 = TestDataService.generate_test_samples(user=self.admin_user, seed=99)
        TestDataService.delete_test_samples(user=self.admin_user)
        result2 = TestDataService.generate_test_samples(user=self.admin_user, seed=99)

        self.assertEqual(result1['sample_ids'], result2['sample_ids'])

    def test_delete_samples_only_removes_prefixed_rows(self):
        """Deletion should target ONLY sample_ids starting with TEST-."""
        real_id = 'REAL-001'
        Sample.objects.create(**{**self.sample_data, 'sample_id': real_id}, updated_by=self.user)

        TestDataService.generate_test_samples(user=self.admin_user)
        self.assertEqual(Sample.objects.count(), 31)

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
        self.assertEqual(response.data['created'], 30)

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
        self.assertEqual(response.data['deleted'], 30)

    def test_audit_logs_created(self):
        """Both actions should record entries in the AuditLog table."""
        from core.models import AuditLog
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin_user)

        admin_client.post(reverse('sample-generate-test-data'), {}, format='json')
        admin_client.post(reverse('sample-delete-test-data'), {}, format='json')

        self.assertTrue(AuditLog.objects.filter(action='generate_test_data').exists())
        self.assertTrue(AuditLog.objects.filter(action='delete_test_data').exists())
