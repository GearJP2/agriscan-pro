from pathlib import Path
from tempfile import TemporaryDirectory

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
            'weather_temperature_c_mean_90d': 30.2,
            'weather_humidity_pct_mean_90d': 75.1,
            'weather_precipitation_mm_total_90d': 220.0,
            'weather_soil_temperature_c_mean_90d': 31.0,
            'weather_days_observed_90d': 90,
            'weather_location_label': 'Bangkok',
        })

        self.assertNotIn('detected', features)
        self.assertNotIn('concentration_log1p', features)
        self.assertEqual(features['region'], 'missing')
        self.assertEqual(features['province'], 'Bangkok')
        self.assertEqual(features['weather_temperature_c_mean_90d'], 30.2)
        self.assertEqual(features['weather_location_label'], 'Bangkok')
        self.assertIn('collection_month_sin', features)
        self.assertIn('collection_month_cos', features)

    def test_train_rows_saves_scaled_detection_pipeline_metadata(self):
        rows = []
        for index in range(80):
            detected = 1 if index < 40 else 0
            rows.append({
                'toxin_type': 'TRY',
                'detected': detected,
                'usable_context': 1,
                'concentration_log1p': 2.0 if detected else 0.0,
                'food_feed_type': 'food',
                'sub_type': 'rice crackers' if detected else 'white rice',
                'commodity': 'rice crackers' if detected else 'white rice',
                'region': 'Central',
                'province': 'Bangkok' if detected else 'Chiang Mai',
                'district': '',
                'collection_month': 7,
                'collection_quarter': 3,
                'collection_season_thailand': 'rainy',
                'purpose': 'research',
                'sample_type': 'market',
                'processing_type': 'milled',
                'weather_temperature_c_mean_90d': 30.0 + (index % 3),
                'weather_humidity_pct_mean_90d': 70.0 + (index % 5),
                'weather_precipitation_mm_total_90d': 200.0 + index,
                'weather_soil_temperature_c_mean_90d': 29.0 + (index % 4),
                'weather_days_observed_90d': 90,
                'weather_location_label': 'Bangkok' if detected else 'Chiang Mai',
            })

        with TemporaryDirectory() as tmp_dir:
            report = PredictionTrainingService.train_rows(
                rows,
                version_dir=Path(tmp_dir),
                version='v-test',
                config=PredictionTrainingConfig(
                    min_detected=30,
                    min_below_lod_or_zero=30,
                    min_usable_context=60,
                    include_weather=True,
                    logistic_max_iter=5000,
                ),
            )

            from joblib import load

            artifact = load(report['trained_models'][0]['artifact_path'])

        self.assertEqual(
            report['model_family'],
            'scaled_logistic_regression_detection_plus_scaled_ridge_concentration',
        )
        self.assertEqual(report['training_config']['logistic_max_iter'], 5000)
        self.assertEqual(
            report['training_config']['preprocessing'],
            'DictVectorizer plus sparse-safe StandardScaler',
        )
        self.assertIn('scale', artifact['pipeline'].named_steps)
