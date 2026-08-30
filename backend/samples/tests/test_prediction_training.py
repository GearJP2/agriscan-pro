from django.test import SimpleTestCase

from ..services.prediction_training_service import (
    PredictionTrainingConfig,
    PredictionTrainingService,
)


class PredictionTrainingServiceTests(SimpleTestCase):
    def test_assess_target_requires_balanced_labels_and_context(self):
        rows = (
            [{'toxin_type': 'AFB1', 'detected': 1, 'usable_context': 1}] * 30
            + [{'toxin_type': 'AFB1', 'detected': 0, 'usable_context': 1}] * 30
        )

        readiness = PredictionTrainingService.assess_target(
            rows,
            PredictionTrainingConfig(min_detected=30, min_below_lod_or_zero=30, min_usable_context=60),
        )

        self.assertTrue(readiness['eligible'])
        self.assertEqual(readiness['detected'], 30)
        self.assertEqual(readiness['below_lod_or_zero'], 30)

    def test_build_feature_dict_excludes_lab_targets(self):
        features = PredictionTrainingService.build_feature_dict({
            'sample_id': 'RIC-001',
            'toxin_type': 'AFB1',
            'detected': 1,
            'concentration_log1p': 2.5,
            'food_feed_type': 'food',
            'sub_type': 'white rice',
            'commodity': 'white rice',
            'region': '',
            'province': 'Bangkok',
            'district': '',
            'collection_month': 7,
            'collection_quarter': 3,
            'collection_season_thailand': 'rainy',
            'purpose': '',
            'sample_type': 'market',
            'processing_type': '',
        })

        self.assertNotIn('detected', features)
        self.assertNotIn('concentration_log1p', features)
        self.assertEqual(features['region'], 'missing')
        self.assertEqual(features['province'], 'Bangkok')
        self.assertIn('collection_month_sin', features)
        self.assertIn('collection_month_cos', features)
