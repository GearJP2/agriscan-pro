from django.test import TestCase
from django.urls import reverse
from rest_framework import status

from ..models import MycotoxinResult, Sample
from ..serializers import MycotoxinResultSerializer
from ._mixins import SampleTestMixin


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
            'toxin_type': 'AFB1',
            'value': 25.0,
            'unit': 'ug_kg',
        }

    def test_add_mycotoxin_result_returns_201(self):
        """Adding a valid mycotoxin result should return 201."""
        response = self.client.post(self.mycotoxin_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Aflatoxin B1')
        self.assertEqual(response.data['toxin_type'], 'AFB1')
        self.assertEqual(response.data['value'], 25.0)
        self.assertEqual(response.data['risk_level'], 'critical')
        self.assertEqual(response.data['eu_threshold_low'], 5)
        self.assertEqual(response.data['eu_threshold_high'], 20)

    def test_add_mycotoxin_result_duplicate_toxin_updates_existing(self):
        """Adding the same toxin twice should update the existing result."""
        first = self.client.post(self.mycotoxin_url, self.valid_payload, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        payload = {**self.valid_payload, 'value': 4.0, 'notes': 'Retest'}
        response = self.client.post(self.mycotoxin_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['toxin_type'], 'AFB1')
        self.assertEqual(response.data['value'], 4.0)
        self.assertEqual(response.data['risk_level'], 'detected')
        self.assertEqual(self.sample.mycotoxin_results.count(), 1)

    def test_add_mycotoxin_result_legacy_alias_payload_returns_201(self):
        """Legacy name/intensity payloads should map to toxin_type/value during transition."""
        payload = {
            'name': 'Aflatoxin B1',
            'intensity': 11,
            'dangerous': False,
            'threshold': 4.0,
            'unit': 'ppb',
        }
        response = self.client.post(self.mycotoxin_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['toxin_type'], 'AFB1')
        self.assertEqual(response.data['value'], 11)
        self.assertEqual(response.data['intensity'], 11)

    def test_add_mycotoxin_result_value_zero_returns_201(self):
        """Value of 0 (not detected) is valid and should calculate safe risk."""
        payload = {**self.valid_payload, 'value': 0}
        response = self.client.post(self.mycotoxin_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['risk_level'], 'safe')

    def test_mycotoxin_result_save_honors_update_fields(self):
        """Derived fields should only be saved when their inputs are saved."""
        result = MycotoxinResult.objects.create(
            sample=self.sample,
            toxin_type='AFB1',
            value=25.0,
            unit='ug_kg',
        )

        result.value = 0.0
        result.notes = 'Notes-only edit'
        result.save(update_fields=['notes'])
        result.refresh_from_db()
        self.assertEqual(result.value, 25.0)
        self.assertEqual(result.risk_level, 'critical')
        self.assertEqual(result.notes, 'Notes-only edit')

        result.value = 4.0
        result.save(update_fields=['value'])
        result.refresh_from_db()
        self.assertEqual(result.value, 4.0)
        self.assertEqual(result.risk_level, 'detected')

    def test_unknown_toxin_result_is_flagged_and_unclassified(self):
        """Unknown migrated toxins should be visible but excluded from risk scoring."""
        result = MycotoxinResult.objects.create(
            sample=self.sample,
            toxin_type='UNKNOWN',
            value=25.0,
            unit='ug_kg',
        )
        response = MycotoxinResultSerializer(result).data
        self.assertEqual(response['risk_level'], 'unclassified')
        self.assertTrue(response['is_flagged'])

    def test_add_mycotoxin_result_value_negative_returns_400(self):
        """Negative value must be rejected with 400."""
        payload = {**self.valid_payload, 'value': -1}
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

    def test_risk_level_high_with_high_result(self):
        """A sample with high/critical toxin risk should report risk_level='high'."""
        MycotoxinResult.objects.create(
            sample=self.sample,
            toxin_type='AFB1',
            value=25,
            unit='ug_kg',
        )
        url = reverse('sample-list')
        response = self.client.get(url)
        results = response.data if not isinstance(response.data, dict) else response.data.get('results', [])
        sample_entry = next((s for s in results if s['sample_id'] == self.sample.sample_id), None)
        self.assertIsNotNone(sample_entry)
        self.assertEqual(sample_entry['risk_level'], 'high')

    def test_risk_level_low_with_detected_result(self):
        """A sample with detected below-threshold toxin result should report risk_level='low'."""
        MycotoxinResult.objects.create(
            sample=self.sample,
            toxin_type='AFB1',
            value=4,
            unit='ug_kg',
        )
        url = reverse('sample-list')
        response = self.client.get(url)
        results = response.data if not isinstance(response.data, dict) else response.data.get('results', [])
        sample_entry = next((s for s in results if s['sample_id'] == self.sample.sample_id), None)
        self.assertIsNotNone(sample_entry)
        self.assertEqual(sample_entry['risk_level'], 'low')

    def test_risk_level_safe_with_zero_result(self):
        """A sample with a zero toxin result should report risk_level='safe'."""
        MycotoxinResult.objects.create(
            sample=self.sample,
            toxin_type='AFB1',
            value=0,
            unit='ug_kg',
        )
        url = reverse('sample-list')
        response = self.client.get(url)
        results = response.data if not isinstance(response.data, dict) else response.data.get('results', [])
        sample_entry = next((s for s in results if s['sample_id'] == self.sample.sample_id), None)
        self.assertIsNotNone(sample_entry)
        self.assertEqual(sample_entry['risk_level'], 'safe')
