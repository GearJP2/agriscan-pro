from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ..models import ProcessLog, Sample
from ._mixins import SampleTestMixin


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
        url = reverse('sample-list')
        self.client.post(url, self.sample_data, format='json')
        sample = Sample.objects.get(sample_id='TEST-001')
        self.assertTrue(
            ProcessLog.objects.filter(sample=sample, state='registered').exists()
        )
