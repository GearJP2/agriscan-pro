from django.test import TestCase
from django.urls import reverse
from rest_framework import status

from ..models import Sample
from ._mixins import SampleTestMixin


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
        invalid_data = {'sample_id': 'TEST-002'}
        response = self.client.post(url, invalid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('code', response.data['error'])
        self.assertEqual(response.data['error']['message'], 'Validation failed.')
        self.assertIn('details', response.data['error'])
        self.assertEqual(response.data['status'], 'error')

    def test_bulk_create_duplicate_sample_id_returns_409(self):
        """Bulk creating a sample with existing sample_id should return 409."""
        Sample.objects.create(**self.sample_data, updated_by=self.user)

        url = reverse('sample-bulk-create')
        bulk_data = [self.sample_data.copy()]
        bulk_data[0]['collection_date'] = '2026-01-20'

        response = self.client.post(url, bulk_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error']['code'], 'sample_already_exists')
        self.assertEqual(response.data['status'], 'error')
