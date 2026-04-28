from django.test import TestCase
from django.urls import reverse
from rest_framework import status

from ..models import Sample
from ._mixins import SampleTestMixin


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
