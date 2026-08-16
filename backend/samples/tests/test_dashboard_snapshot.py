import hashlib
import json
from contextlib import nullcontext
from datetime import datetime, timezone as dt_timezone
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command, CommandError
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from ..models import MycotoxinResult, Sample
from ..services.dashboard_payload_service import DashboardFilters, DashboardPayloadService
from ..services.dashboard_snapshot_publisher import (
    DashboardSnapshotPublisher,
    DashboardSnapshotValidationError,
)


class FakeS3Client:
    def __init__(self, fail_version=False, corrupt_head=False):
        self.calls = []
        self.objects = {}
        self.metadata = {}
        self.fail_version = fail_version
        self.corrupt_head = corrupt_head

    def put_object(self, **kwargs):
        self.calls.append(('put', kwargs['Key']))
        if self.fail_version and '/versions/' in kwargs['Key']:
            raise RuntimeError('upload failed')
        self.objects[kwargs['Key']] = kwargs['Body']
        self.metadata[kwargs['Key']] = kwargs.get('Metadata', {})

    def head_object(self, **kwargs):
        self.calls.append(('head', kwargs['Key']))
        return {
            'ContentLength': len(self.objects[kwargs['Key']]),
            'Metadata': {} if self.corrupt_head else self.metadata[kwargs['Key']],
        }


@override_settings(DASHBOARD_SNAPSHOT_MIN_GROUP_SIZE=5)
class DashboardPayloadTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username='dashboard-user', password='test-pass', role='research_assistant'
        )
        for index in range(6):
            sample = Sample.objects.create(
                sample_id=f'PUBLIC-{index}',
                region='Central',
                province='Bangkok' if index < 5 else 'Small Province',
                district='District',
                vegetation_variety='maize',
                collection_date='2026-08-16',
                collected_by='private collector',
                updated_by=cls.user,
            )
            MycotoxinResult.objects.create(sample=sample, toxin_type='AFB1', value=10)

    def test_payload_is_deterministic_and_suppresses_small_groups(self):
        first = DashboardPayloadService.build(filters=DashboardFilters(), include_external=False)
        second = DashboardPayloadService.build(filters=DashboardFilters(), include_external=False)

        self.assertEqual(first, second)
        self.assertEqual(first['filter_options']['provinces'], [])
        self.assertEqual(first['regional']['provinces'], [])
        self.assertEqual(first['regional']['suppressed'], 2)

    def test_co_contamination_uses_highest_frequency_pair(self):
        samples = (
            [['AFB1', 'DON']] * 6
            + [['AFB1', 'OTA']] * 8
        )
        result = DashboardPayloadService._co_contamination(samples, minimum=5)
        self.assertEqual(result['summary']['mostCommonPair'], 'AFB1 + OTA')
        self.assertEqual(
            [row['toxins'] for row in result['intersections']],
            [['AFB1', 'OTA'], ['AFB1', 'DON']],
        )

    @patch(
        'samples.services.dashboard_payload_service.'
        'NasaPowerService.get_cached_environmental_correlation'
    )
    def test_snapshot_uses_only_cached_environmental_data(self, mock_cached):
        Sample.objects.get(sample_id='PUBLIC-5').delete()
        mock_cached.return_value = {'status': 'stale', 'data': {'source': 'NASA POWER'}}
        payload = DashboardPayloadService.build(
            filters=DashboardFilters(), include_external=True
        )
        self.assertEqual(payload['environmental']['status'], 'stale')
        self.assertEqual(payload['environmental']['data']['source'], 'NASA POWER')
        self.assertEqual(mock_cached.call_args.args[0]['province'], 'Bangkok')

    def test_payload_contains_no_forbidden_fields(self):
        payload = DashboardPayloadService.build(filters=DashboardFilters(), include_external=False)
        DashboardSnapshotPublisher.validate_sections(payload)
        serialized = json.dumps(payload)
        for private_value in ('PUBLIC-0', 'dashboard-user', 'private collector'):
            self.assertNotIn(private_value, serialized)

    def test_sensitive_subcounts_below_minimum_hide_the_parent_cell(self):
        MycotoxinResult.objects.filter(
            sample__sample_id__in=['PUBLIC-0', 'PUBLIC-1', 'PUBLIC-2', 'PUBLIC-3']
        ).update(value=0, risk_level='safe')
        payload = DashboardPayloadService.build(
            filters=DashboardFilters(), include_external=False
        )
        self.assertEqual(payload['overview']['kpis']['total_samples'], 0)
        self.assertEqual(payload['commodities']['distribution'], [])
        self.assertEqual(payload['regional']['regions'], [])
        self.assertEqual(payload['heatmap']['data'], [])

    def test_canonical_dashboard_endpoints_require_authentication(self):
        client = APIClient()
        dashboard_url = reverse('sample-analytics-dashboard')
        simulate_url = reverse('sample-analytics-dashboard-simulate')
        self.assertIn(client.get(dashboard_url).status_code, (401, 403))
        self.assertIn(client.post(simulate_url, {}, format='json').status_code, (401, 403))

        client.force_authenticate(self.user)
        response = client.get(dashboard_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['schema_version'], 1)
        self.assertEqual(response.data['sections']['overview']['kpis']['total_samples'], 6)

        expected = DashboardPayloadService.build(filters=DashboardFilters(), include_external=False)
        self.assertEqual(response.data['sections'], expected)

    def test_dataset_below_minimum_is_fully_suppressed(self):
        Sample.objects.filter(sample_id__in=['PUBLIC-4', 'PUBLIC-5']).delete()
        payload = DashboardPayloadService.build(filters=DashboardFilters(), include_external=False)
        self.assertEqual(payload['overview']['kpis']['total_samples'], 0)
        self.assertEqual(payload['regional']['provinces'], [])

    def test_privacy_validator_rejects_nested_forbidden_key(self):
        sections = DashboardPayloadService.build(filters=DashboardFilters(), include_external=False)
        sections['overview']['sample_id'] = 'secret'
        with self.assertRaises(DashboardSnapshotValidationError):
            DashboardSnapshotPublisher.validate_sections(sections)

    @override_settings(DASHBOARD_SNAPSHOT_BUCKET='snapshot-bucket')
    def test_version_upload_is_verified_before_manifest(self):
        fake = FakeS3Client()
        sections = DashboardPayloadService.build(filters=DashboardFilters(), include_external=False)
        DashboardSnapshotPublisher(client=fake).publish(sections)
        self.assertEqual([kind for kind, _key in fake.calls], ['put', 'head', 'put'])
        self.assertIn('/versions/', fake.calls[0][1])
        self.assertTrue(fake.calls[-1][1].endswith('/manifest.json'))

    @override_settings(DASHBOARD_SNAPSHOT_BUCKET='snapshot-bucket')
    def test_failed_version_upload_does_not_write_manifest(self):
        fake = FakeS3Client(fail_version=True)
        sections = DashboardPayloadService.build(filters=DashboardFilters(), include_external=False)
        with self.assertRaises(RuntimeError):
            DashboardSnapshotPublisher(client=fake).publish(sections)
        self.assertFalse(any(key.endswith('manifest.json') for _kind, key in fake.calls))

    @override_settings(DASHBOARD_SNAPSHOT_BUCKET='snapshot-bucket')
    def test_failed_version_verification_does_not_write_manifest(self):
        fake = FakeS3Client(corrupt_head=True)
        sections = DashboardPayloadService.build(filters=DashboardFilters(), include_external=False)
        with self.assertRaises(RuntimeError):
            DashboardSnapshotPublisher(client=fake).publish(sections)
        self.assertFalse(any(key.endswith('manifest.json') for _kind, key in fake.calls))

    def test_checksum_covers_exact_snapshot_bytes(self):
        sections = DashboardPayloadService.build(filters=DashboardFilters(), include_external=False)
        sections['environmental']['data'] = {'tiny_value': 1e-7}
        generated = datetime(2026, 8, 16, 11, 17, tzinfo=dt_timezone.utc)
        snapshot, manifest = DashboardSnapshotPublisher.build_documents(
            sections, generated_at=generated
        )
        expected = hashlib.sha256(DashboardSnapshotPublisher.serialize(snapshot)).hexdigest()
        self.assertNotIn('checksum_sha256', snapshot)
        self.assertEqual(manifest['checksum_sha256'], expected)
        self.assertTrue(snapshot['snapshot_id'].startswith('2026-08-16T11-17-00Z-'))

    @patch('samples.services.dashboard_snapshot_publisher.boto3.client')
    def test_dry_run_does_not_write_s3(self, mock_client):
        output = StringIO()
        call_command('generate_dashboard_snapshot', '--dry-run', stdout=output)
        self.assertIn('snapshot_id', output.getvalue())
        mock_client.return_value.put_object.assert_not_called()

    @patch('samples.management.commands.generate_dashboard_snapshot.DashboardPayloadService.build')
    @patch('samples.management.commands.generate_dashboard_snapshot.dashboard_generation_lock')
    def test_concurrent_generation_exits_without_building(self, mock_lock, mock_build):
        mock_lock.return_value = nullcontext(False)
        output = StringIO()
        call_command('generate_dashboard_snapshot', stdout=output)
        self.assertIn('already running', output.getvalue())
        mock_build.assert_not_called()

    @patch('samples.management.commands.generate_dashboard_snapshot.dashboard_generation_lock')
    def test_lock_connection_failure_is_reported_as_command_error(self, mock_lock):
        mock_lock.return_value.__enter__.side_effect = RuntimeError('database unavailable')
        with self.assertRaisesMessage(CommandError, 'database unavailable'):
            call_command('generate_dashboard_snapshot', '--dry-run')
