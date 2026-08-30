import csv
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from ..models import MycotoxinResult, Sample
from ..services.prediction_dataset_service import PredictionDatasetService

User = get_user_model()


class PredictionDatasetServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='dataset_researcher',
            password='Password123',
            role='researcher',
        )
        self.sample = Sample.objects.create(
            sample_id='RIC-2026-001',
            region=' central ',
            province='bangkok',
            district='chatuchak',
            vegetation_variety='Rice',
            food_feed_type='food',
            sub_type='White Rice',
            collection_date='2026-07-02',
            status='completed',
            purpose='research',
            sample_type='market',
            processing_type='milled',
            recorded_by=self.user,
        )

    def test_build_row_creates_classification_and_regression_targets(self):
        result = MycotoxinResult.objects.create(
            sample=self.sample,
            toxin_type='AFB1',
            value=3.0,
            unit='ug_kg',
        )

        row = PredictionDatasetService.build_row(result)

        self.assertEqual(row['sample_id'], 'RIC-2026-001')
        self.assertEqual(row['toxin_type'], 'AFB1')
        self.assertEqual(row['detected'], 1)
        self.assertEqual(row['concentration_ug_kg'], 3.0)
        self.assertEqual(row['concentration_log1p'], 1.38629436)
        self.assertEqual(row['food_feed_type'], 'food')
        self.assertEqual(row['sub_type'], 'white rice')
        self.assertEqual(row['province'], 'Bangkok')
        self.assertEqual(row['collection_month'], 7)
        self.assertEqual(row['collection_quarter'], 3)
        self.assertEqual(row['collection_season_thailand'], 'rainy')
        self.assertEqual(row['usable_context'], 1)
        self.assertEqual(row['recorded_by_username'], 'dataset_researcher')

    def test_below_lod_result_is_exported_as_not_detected(self):
        result = MycotoxinResult.objects.create(
            sample=self.sample,
            toxin_type='DON',
            value=0,
            unit='ug_kg',
            is_below_lod=True,
        )

        row = PredictionDatasetService.build_row(result)

        self.assertEqual(row['detected'], 0)
        self.assertEqual(row['concentration_ug_kg'], 0.0)
        self.assertEqual(row['concentration_log1p'], 0)
        self.assertEqual(row['is_below_lod'], 1)

    def test_build_prediction_dataset_command_writes_csv(self):
        MycotoxinResult.objects.create(
            sample=self.sample,
            toxin_type='AFB1',
            value=3.0,
            unit='ug_kg',
        )
        output = StringIO()

        call_command('build_prediction_dataset', stdout=output)

        rows = list(csv.DictReader(StringIO(output.getvalue())))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['sample_id'], 'RIC-2026-001')
        self.assertEqual(rows[0]['toxin_type'], 'AFB1')
        self.assertEqual(rows[0]['detected'], '1')
