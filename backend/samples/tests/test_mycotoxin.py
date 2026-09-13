from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status

from ..constants import mycotoxin_constants as toxins
from ..models import MycotoxinResult, Sample
from ..serializers import MycotoxinResultSerializer
from ._mixins import SampleTestMixin

User = get_user_model()


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

    def test_registry_tracks_active_choices_and_keeps_historical_results_readable(self):
        original = self.client.get(reverse('sample-mycotoxin-registry'))
        self.assertEqual(original.status_code, 200)
        self.assertEqual(original.data['AFB1']['defaultThreshold'], 5)
        self.assertIsNone(original.data['TRY']['defaultThreshold'])

        MycotoxinResult.objects.create(sample=self.sample, toxin_type='AFB1', value=25)
        with patch.object(toxins, 'TOXIN_CHOICES', [('NEW', 'New analyte')]), patch.object(
            toxins, 'VALID_TOXINS', {'NEW'}
        ):
            catalog = self.client.get(reverse('sample-mycotoxin-registry'))
            self.assertEqual(set(catalog.data), {'NEW'})
            self.assertTrue(catalog.data['NEW']['isUncertain'])
            self.assertIsNone(catalog.data['NEW']['defaultThreshold'])
            self.assertEqual(toxins.resolve_toxin_type('New analyte'), 'NEW')
            self.assertIsNone(toxins.resolve_toxin_type('aflatoxinb1'))
            detail = self.client.get(reverse('sample-detail', kwargs={'sample_id': self.sample.sample_id}))
            self.assertEqual(detail.status_code, 200)
            self.assertEqual(detail.data['mycotoxin_results'][0]['toxin_type'], 'AFB1')
        with patch.object(toxins, 'TOXIN_CHOICES', []):
            self.assertEqual(self.client.get(reverse('sample-mycotoxin-registry')).data, {})

    def test_alias_resolution_prioritizes_specific_longer_substrings(self):
        self.assertEqual(toxins.resolve_toxin_type('sample_15adon_ppb'), '15ADON')
        self.assertEqual(toxins.resolve_toxin_type('my_sample_3adon_level'), '3ADON')
        self.assertEqual(toxins.resolve_toxin_type('sample_don_ppb'), 'DON')

    def test_unclassified_toxins_snapshot_none_threshold_and_are_not_above_threshold(self):
        result = MycotoxinResult.objects.create(sample=self.sample, toxin_type='AFG1', value=10.0)
        self.assertEqual(result.risk_level, 'unclassified')
        self.assertIsNone(result.eu_threshold_low)
        self.assertIsNone(result.eu_threshold_high)
        from ..services.dashboard_payload_service import DashboardPayloadService
        self.assertFalse(DashboardPayloadService._is_above(result, 'Rice', {}))

    def test_get_risk_level_handles_partial_threshold_data_safely(self):
        with patch.object(toxins, 'EU_THRESHOLDS', {'PARTIAL': {'low': 10, 'has_data': True, 'unit': 'ug/kg'}}):
            self.assertEqual(toxins.get_risk_level('PARTIAL', 5), 'detected')
            self.assertEqual(toxins.get_risk_level('PARTIAL', 15), 'high')
            self.assertEqual(toxins.get_risk_level('PARTIAL', None), 'unclassified')

    def test_mycotoxin_registry_accessible_without_authentication(self):
        self.client.logout()
        response = self.client.get(reverse('sample-mycotoxin-registry'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('AFB1', response.data)

    def test_removed_toxin_aliases_are_rejected_and_do_not_convert_to_other_toxins(self):
        new_valid = set(toxins.VALID_TOXINS) - {'15ADON', '3ADON'}
        new_choices = [(c, l) for c, l in toxins.TOXIN_CHOICES if c not in {'15ADON', '3ADON'}]
        with patch.object(toxins, 'VALID_TOXINS', new_valid), patch.object(toxins, 'TOXIN_CHOICES', new_choices):
            # 15ADON and its variants must be rejected, not converted to DON
            self.assertIsNone(toxins.resolve_toxin_type('15ADON'))
            self.assertIsNone(toxins.resolve_toxin_type('15ADON (ug/kg)'))
            self.assertIsNone(toxins.resolve_toxin_type('15-Acetyl-Deoxynivalenol'))
            self.assertIsNone(toxins.resolve_toxin_type('sample_15adon_ppb'))
            # 3ADON and its variants must also be rejected
            self.assertIsNone(toxins.resolve_toxin_type('3ADON'))
            self.assertIsNone(toxins.resolve_toxin_type('3ADON (ppb)'))
            # Still-valid DON must still resolve correctly
            self.assertEqual(toxins.resolve_toxin_type('DON'), 'DON')
            self.assertEqual(toxins.resolve_toxin_type('DON (ug/kg)'), 'DON')
            self.assertEqual(toxins.resolve_toxin_type('Deoxynivalenol'), 'DON')

    def test_can_record_results_serialized_for_legacy_samples_with_updated_by(self):
        # self.sample was created with updated_by=self.user, but without recorded_by or collected_by
        self.assertIsNone(self.sample.recorded_by)
        self.assertIsNone(self.sample.collected_by)

        # Authenticated as self.user (research_assistant, owner via updated_by)
        detail = self.client.get(reverse('sample-detail', kwargs={'sample_id': self.sample.sample_id}))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertTrue(detail.data['can_record_results'])

        sample_list = self.client.get(reverse('sample-list'))
        self.assertEqual(sample_list.status_code, status.HTTP_200_OK)
        results = sample_list.data if isinstance(sample_list.data, list) else sample_list.data.get('results', [])
        sample_item = next(s for s in results if s['sample_id'] == self.sample.sample_id)
        self.assertTrue(sample_item['can_record_results'])

        # Another research assistant should NOT have write permission
        other_assistant = User.objects.create_user(
            username='other_assistant',
            email='other@example.com',
            name='Other Assistant',
            password='StrongPass123!',
            role='research_assistant',
        )
        self.client.force_authenticate(user=other_assistant)
        detail_other = self.client.get(reverse('sample-detail', kwargs={'sample_id': self.sample.sample_id}))
        self.assertEqual(detail_other.status_code, status.HTTP_200_OK)
        self.assertFalse(detail_other.data['can_record_results'])

        # Admin user should have write permission on any sample
        self.client.force_authenticate(user=self.admin_user)
        detail_admin = self.client.get(reverse('sample-detail', kwargs={'sample_id': self.sample.sample_id}))
        self.assertEqual(detail_admin.status_code, status.HTTP_200_OK)
        self.assertTrue(detail_admin.data['can_record_results'])
