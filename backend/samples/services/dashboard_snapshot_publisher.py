import hashlib
import json
from datetime import timedelta

import boto3
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone


SCHEMA_VERSION = 1
FORBIDDEN_FIELDS = {
    'sample_id', 'user_id', 'username', 'email', 'collector', 'collected_by',
    'updated_by', 'notes', 'additional_info', 'audit_records', 'process_logs',
    'raw_samples', 'raw_results',
}
REQUIRED_SECTIONS = {
    'filter_options', 'overview', 'regional', 'commodities', 'toxins', 'heatmap',
    'co_contamination', 'public_health', 'environmental',
}


class DashboardSnapshotValidationError(ValueError):
    pass


class DashboardSnapshotPublisher:
    VERSION_CACHE_CONTROL = 'public,max-age=31536000,immutable'
    MANIFEST_CACHE_CONTROL = 'public,max-age=60,stale-while-revalidate=300'

    def __init__(self, *, client=None, bucket=None, prefix=None):
        self.client = client or boto3.client('s3', region_name=settings.AWS_S3_REGION_NAME)
        self.bucket = bucket if bucket is not None else settings.DASHBOARD_SNAPSHOT_BUCKET
        self.prefix = (prefix if prefix is not None else settings.DASHBOARD_SNAPSHOT_PREFIX).strip('/')

    @staticmethod
    def serialize(value):
        def normalize(item):
            if isinstance(item, float) and item.is_integer():
                return int(item)
            if isinstance(item, dict):
                return {key: normalize(child) for key, child in item.items()}
            if isinstance(item, list):
                return [normalize(child) for child in item]
            return item

        return json.dumps(
            normalize(value), sort_keys=True, separators=(',', ':'), ensure_ascii=False
        ).encode('utf-8')

    @classmethod
    def validate_sections(cls, sections):
        if not isinstance(sections, dict) or set(sections) != REQUIRED_SECTIONS:
            raise DashboardSnapshotValidationError('Snapshot sections do not match schema v1.')

        def visit(value, path='sections'):
            if isinstance(value, dict):
                for key, child in value.items():
                    if key.lower() in FORBIDDEN_FIELDS:
                        raise DashboardSnapshotValidationError(f'Forbidden public field at {path}.{key}.')
                    visit(child, f'{path}.{key}')
            elif isinstance(value, list):
                for index, child in enumerate(value):
                    visit(child, f'{path}[{index}]')

        visit(sections)

    @classmethod
    def build_documents(cls, sections, *, generated_at=None, data_through=None, prefix='dashboard-data'):
        cls.validate_sections(sections)
        generated_at = generated_at or timezone.now()
        data_through = data_through or generated_at
        expires_at = generated_at + timedelta(hours=2)
        checksum = hashlib.sha256(cls.serialize(sections)).hexdigest()
        timestamp = generated_at.strftime('%Y-%m-%dT%H-%M-%SZ')
        snapshot_id = f'{timestamp}-{checksum[:12]}'
        snapshot = {
            'schema_version': SCHEMA_VERSION,
            'snapshot_id': snapshot_id,
            'generated_at': generated_at.isoformat().replace('+00:00', 'Z'),
            'data_through': data_through.isoformat().replace('+00:00', 'Z'),
            'expires_at': expires_at.isoformat().replace('+00:00', 'Z'),
            'checksum_sha256': checksum,
            'sections': sections,
        }
        manifest = {
            'schema_version': SCHEMA_VERSION,
            'snapshot_id': snapshot_id,
            'generated_at': snapshot['generated_at'],
            'expires_at': snapshot['expires_at'],
            'snapshot_url': f'/{prefix}/versions/{snapshot_id}.json',
            'checksum_sha256': checksum,
        }
        return snapshot, manifest

    def publish(self, sections, *, generated_at=None, data_through=None):
        if not self.bucket:
            raise ImproperlyConfigured('DASHBOARD_SNAPSHOT_BUCKET is required.')
        snapshot, manifest = self.build_documents(
            sections,
            generated_at=generated_at,
            data_through=data_through,
            prefix=self.prefix,
        )
        version_key = f'{self.prefix}/versions/{snapshot["snapshot_id"]}.json'
        manifest_key = f'{self.prefix}/manifest.json'
        snapshot_body = self.serialize(snapshot)
        self.client.put_object(
            Bucket=self.bucket,
            Key=version_key,
            Body=snapshot_body,
            ContentType='application/json',
            CacheControl=self.VERSION_CACHE_CONTROL,
            Metadata={'checksum-sha256': snapshot['checksum_sha256']},
        )
        uploaded = self.client.head_object(Bucket=self.bucket, Key=version_key)
        if uploaded.get('ContentLength') != len(snapshot_body):
            raise RuntimeError('Uploaded dashboard snapshot size does not match.')
        if uploaded.get('Metadata', {}).get('checksum-sha256') != snapshot['checksum_sha256']:
            raise RuntimeError('Uploaded dashboard snapshot checksum metadata does not match.')
        self.client.put_object(
            Bucket=self.bucket,
            Key=manifest_key,
            Body=self.serialize(manifest),
            ContentType='application/json',
            CacheControl=self.MANIFEST_CACHE_CONTROL,
        )
        return snapshot, manifest
