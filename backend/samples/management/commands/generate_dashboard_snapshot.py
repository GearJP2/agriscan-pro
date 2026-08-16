import json
import logging
from contextlib import contextmanager

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.models import Max
from django.utils import timezone

from samples.models import Sample
from samples.services.dashboard_payload_service import DashboardFilters, DashboardPayloadService
from samples.services.dashboard_snapshot_publisher import DashboardSnapshotPublisher


logger = logging.getLogger('agriscan.samples')
ADVISORY_LOCK_ID = 648273901


@contextmanager
def dashboard_generation_lock():
    acquired = True
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_try_advisory_lock(%s)', [ADVISORY_LOCK_ID])
            acquired = cursor.fetchone()[0]
    try:
        yield acquired
    finally:
        if acquired and connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_unlock(%s)', [ADVISORY_LOCK_ID])


class Command(BaseCommand):
    help = 'Generate and optionally publish the public dashboard snapshot.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        try:
            with dashboard_generation_lock() as acquired:
                if not acquired:
                    self.stdout.write(self.style.WARNING('Dashboard snapshot generation is already running.'))
                    return
                generated_at = timezone.now()
                sections = DashboardPayloadService.build(
                    filters=DashboardFilters(),
                    include_external=True,
                )
                data_through = Sample.objects.aggregate(value=Max('updated_at'))['value'] or generated_at
                if options['dry_run']:
                    snapshot, _manifest = DashboardSnapshotPublisher.build_documents(
                        sections,
                        generated_at=generated_at,
                        data_through=data_through,
                        prefix=settings.DASHBOARD_SNAPSHOT_PREFIX,
                    )
                    self.stdout.write(json.dumps({
                        'snapshot_id': snapshot['snapshot_id'],
                        'checksum_sha256': snapshot['checksum_sha256'],
                        'bytes': len(DashboardSnapshotPublisher.serialize(snapshot)),
                    }, sort_keys=True))
                    return
                if not settings.DASHBOARD_SNAPSHOT_ENABLED:
                    raise CommandError('DASHBOARD_SNAPSHOT_ENABLED must be True to publish.')
                publisher = DashboardSnapshotPublisher()
                snapshot, _manifest = publisher.publish(
                    sections,
                    generated_at=generated_at,
                    data_through=data_through,
                )
                logger.info('dashboard_snapshot.published', extra={'snapshot_id': snapshot['snapshot_id']})
                self.stdout.write(self.style.SUCCESS(f'Published {snapshot["snapshot_id"]}'))
        except CommandError:
            raise
        except Exception as exc:
            logger.exception('dashboard_snapshot.generation_failed')
            raise CommandError(f'Dashboard snapshot generation failed: {exc}') from exc
