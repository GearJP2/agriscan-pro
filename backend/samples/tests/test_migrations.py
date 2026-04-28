from datetime import date

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class MycotoxinResultMigration0010Tests(TransactionTestCase):
    """Regression coverage for the legacy-result migration path."""

    migrate_from = [
        ('samples', '0009_alter_mycotoxinresult_id_alter_processlog_id_and_more'),
    ]
    migrate_to = [('samples', '0010_mycotoxin_result_risk_level')]

    def setUp(self):
        super().setUp()
        self.migrated_forward = False
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.migrate_from)
        self.old_apps = self.executor.loader.project_state(self.migrate_from).apps

    def tearDown(self):
        if not self.migrated_forward:
            self.executor.migrate(self.migrate_to)
        super().tearDown()

    def migrate_forward(self):
        self.executor.loader.build_graph()
        self.executor.migrate(self.migrate_to)
        self.migrated_forward = True
        return self.executor.loader.project_state(self.migrate_to).apps

    def create_legacy_sample(self, sample_id='MIG-001'):
        Sample = self.old_apps.get_model('samples', 'Sample')
        return Sample.objects.create(
            sample_id=sample_id,
            sequence_number=1,
            region='Central',
            province='Bangkok',
            district='Chatuchak',
            vegetation_variety='Rice',
            collection_date=date(2026, 1, 1),
            status='pending',
        )

    def test_unknown_legacy_toxin_migrates_to_unknown(self):
        """Unknown toxin names should remain reviewable, not become AFB1."""
        sample = self.create_legacy_sample()
        LegacyResult = self.old_apps.get_model('samples', 'MycotoxinResult')
        LegacyResult.objects.create(
            sample=sample,
            name='Patulin',
            intensity=200,
            dangerous=False,
            threshold=0,
            unit='ppb',
        )

        new_apps = self.migrate_forward()
        Result = new_apps.get_model('samples', 'MycotoxinResult')
        result = Result.objects.get(sample__sample_id='MIG-001')

        self.assertEqual(result.toxin_type, 'UNKNOWN')
        self.assertEqual(result.value, 200)
        self.assertEqual(result.risk_level, 'unclassified')
        self.assertIn('Patulin', result.notes)

    def test_duplicate_legacy_toxins_keep_highest_value(self):
        """Duplicate normalized toxins should collapse before the unique index."""
        sample = self.create_legacy_sample('MIG-002')
        LegacyResult = self.old_apps.get_model('samples', 'MycotoxinResult')
        LegacyResult.objects.create(
            sample=sample,
            name='Aflatoxin B1',
            intensity=5,
            dangerous=False,
            threshold=5,
            unit='ppb',
        )
        LegacyResult.objects.create(
            sample=sample,
            name='AFB1',
            intensity=20,
            dangerous=True,
            threshold=5,
            unit='ppb',
        )

        new_apps = self.migrate_forward()
        Result = new_apps.get_model('samples', 'MycotoxinResult')
        result = Result.objects.get(sample__sample_id='MIG-002')

        self.assertEqual(Result.objects.filter(sample__sample_id='MIG-002').count(), 1)
        self.assertEqual(result.toxin_type, 'AFB1')
        self.assertEqual(result.value, 20)
        self.assertEqual(result.risk_level, 'high')
