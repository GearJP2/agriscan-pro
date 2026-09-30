from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import AuditLog
from core.permissions import check_can_edit_sample
from notifications.models import Notification
from samples.constants.mycotoxin_constants import EU_THRESHOLDS
from samples.models import ExternalDataCache, MycotoxinResult, PredictionContext, Sample
from samples.serializers import PredictionContextSerializer, SampleListSerializer
from samples.services.ingestion_service import SampleIngestionService
from samples.services.prediction_weather_service import PredictionWeatherService
from samples.tasks import prune_expired_nasa_power_cache

User = get_user_model()


class DatabaseReviewTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', email='owner@example.com', role='research_assistant')
        self.other = User.objects.create_user(username='other', email='other@example.com', role='research_assistant')
        self.admin = User.objects.create_user(username='admin', email='admin@example.com', role='admin')
        self.sample = Sample.objects.create(
            sample_id='RIC-2026-001', region='Central', province='Bangkok', district='Test',
            vegetation_variety='Rice', sub_type='Rice', collection_date=date(2026, 1, 1), recorded_by=self.owner,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def upload(self, csv):
        return self.client.post(reverse('sample-bulk-import-results'), {
            'file': SimpleUploadedFile('results.csv', csv.encode(), content_type='text/csv'),
        }, format='multipart')

    def test_unauthorized_import_cannot_mutate_or_acquire_ownership(self):
        self.client.force_authenticate(self.other)
        response = self.upload(f'Sample ID,AFB1\n{self.sample.sample_id},30\n')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results_created'], 0)
        self.assertEqual(len(response.data['failed_rows']), 1)
        self.sample.refresh_from_db()
        self.assertEqual(self.sample.status, 'pending')
        self.assertIsNone(self.sample.updated_by_id)
        self.assertFalse(check_can_edit_sample(self.other, self.sample))
        self.assertFalse(self.sample.process_logs.exists())
        self.assertFalse(AuditLog.objects.exists())
        self.assertFalse(Notification.objects.exists())

    def test_unclassified_risk_is_not_safe_even_with_detected_result(self):
        MycotoxinResult.objects.create(sample=self.sample, toxin_type='UNKNOWN', value=100)
        MycotoxinResult.objects.create(sample=self.sample, toxin_type='AFB1', value=1)
        self.assertEqual(SampleListSerializer(self.sample).data['risk_level'], 'unclassified')

    def test_import_preserves_policy_flag_and_alerts_once_with_audit(self):
        self.sample.status = 'flagged'
        self.sample.save()
        result = MycotoxinResult.objects.create(sample=self.sample, toxin_type='AFB1', value=1)
        csv = f'Sample ID,AFB1\n{self.sample.sample_id},10\n'
        with patch.dict(EU_THRESHOLDS, {'AFB1': {**EU_THRESHOLDS['AFB1'], 'low': 50, 'high': 100}}):
            self.assertEqual(self.upload(csv).status_code, 200)
            result.refresh_from_db()
            self.assertEqual((result.eu_threshold_low, result.eu_threshold_high, result.risk_level), (5, 20, 'high'))
            result.save()
            self.upload(csv)
        self.sample.refresh_from_db()
        self.assertEqual(self.sample.status, 'flagged')
        self.assertFalse(self.sample.process_logs.filter(state='completed').exists())
        self.assertEqual(Notification.objects.count(), 1)
        audit = AuditLog.objects.get(model_name='MycotoxinResult')
        self.assertEqual(audit.actor_id, self.owner.pk)
        self.assertEqual(audit.changes['before']['value'], 1)
        self.assertEqual(audit.changes['after']['value'], 10)

    def test_alert_and_audit_rollback_with_result(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                SampleIngestionService._apply_results_to_sample(self.sample, [
                    {'toxin_type': 'AFB1', 'value': 30, 'unit': 'ug_kg', 'notes': ''},
                ], self.owner, None)
                raise RuntimeError('rollback')
        self.assertFalse(MycotoxinResult.objects.exists())
        self.assertFalse(Notification.objects.exists())
        self.assertFalse(AuditLog.objects.exists())

    def test_manual_result_update_records_old_and_new(self):
        url = reverse('sample-add-mycotoxin-result', kwargs={'sample_id': self.sample.sample_id})
        self.assertEqual(self.client.post(url, {'toxin_type': 'AFB1', 'value': 1}).status_code, 201)
        self.assertEqual(self.client.post(url, {'toxin_type': 'AFB1', 'value': 30}).status_code, 200)
        audit = AuditLog.objects.filter(action='update', model_name='MycotoxinResult').get()
        self.assertEqual(audit.changes['before']['value'], 1)
        self.assertEqual(audit.changes['after']['value'], 30)
        self.assertEqual(Notification.objects.count(), 1)

    def test_delete_archives_children_and_disables_notification_link(self):
        MycotoxinResult.objects.create(sample=self.sample, toxin_type='AFB1', value=30)
        self.client.force_authenticate(self.admin)
        response = self.client.delete(reverse('sample-detail', kwargs={'sample_id': self.sample.sample_id}))
        self.assertEqual(response.status_code, 204)
        audit = AuditLog.objects.get(action='delete_snapshot', model_name='Sample')
        self.assertEqual(audit.changes['mycotoxin_results'][0]['value'], 30)
        self.assertEqual(Notification.objects.get().link, '')

    def test_delete_rolls_back_if_archive_fails(self):
        self.client.force_authenticate(self.admin)
        with patch('core.audit.AuditLog.objects.create', side_effect=RuntimeError('audit unavailable')):
            with self.assertRaises(RuntimeError):
                self.client.delete(reverse('sample-detail', kwargs={'sample_id': self.sample.sample_id}))
        self.assertTrue(Sample.objects.filter(pk=self.sample.pk).exists())

    def test_email_uniqueness_is_case_insensitive_in_database(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create(username='duplicate', email='OWNER@example.com')

    def test_context_patch_merges_coordinates_and_checks_ranges(self):
        context = PredictionContext.objects.create(sample=self.sample, latitude=10, longitude=100)
        serializer = PredictionContextSerializer(context, data={'latitude': 11}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        for field, value in [('moisture_pct', 101), ('soil_ph', -1), ('latitude', None)]:
            invalid = PredictionContextSerializer(context, data={field: value}, partial=True)
            self.assertFalse(invalid.is_valid())
        with self.assertRaises(IntegrityError), transaction.atomic():
            PredictionContext.objects.filter(pk=context.pk).update(soil_ph=15)

    def test_recorder_ownership_is_stable_and_statistics_agree(self):
        self.sample.updated_by = self.other
        self.sample.save()
        self.assertTrue(check_can_edit_sample(self.owner, self.sample))
        self.assertFalse(check_can_edit_sample(self.other, self.sample))
        response = self.client.get(reverse('sample-statistics'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_samples'], 1)

    def test_taxonomy_sync_and_direct_write_constraint(self):
        self.sample.sub_type = 'Corn'
        self.sample.save(update_fields=['sub_type'])
        self.sample.refresh_from_db()
        self.assertEqual(self.sample.vegetation_variety, 'Corn')
        with self.assertRaises(IntegrityError), transaction.atomic():
            Sample.objects.filter(pk=self.sample.pk).update(vegetation_variety='Rice')

    def test_cache_namespace_and_expiry_are_enforced(self):
        expiry = timezone.now() - timedelta(days=1)
        for source in ['NASA_POWER', 'NASA_POWER_PREDICTION']:
            ExternalDataCache.objects.create(source=source, cache_key='same', payload={}, expires_at=expiry)
        self.assertEqual(prune_expired_nasa_power_cache.run(), 2)
        with patch.object(PredictionWeatherService, 'cache_key', return_value='expired'):
            ExternalDataCache.objects.create(source='NASA_POWER_PREDICTION', cache_key='expired',
                                             payload={'stale': True}, expires_at=expiry)
            result = PredictionWeatherService.get_features('Bangkok', date(2026, 1, 1), fetch_missing=False)
            self.assertNotIn('stale', result)

    def test_list_does_not_fetch_prediction_history(self):
        with self.assertNumQueries(3):
            response = self.client.get(reverse('sample-list'))
        self.assertEqual(response.status_code, 200)
