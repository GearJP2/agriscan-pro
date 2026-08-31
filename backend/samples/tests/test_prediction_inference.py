from datetime import date
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from io import StringIO

from ..models import PredictionContext, PredictionEstimate, Sample
from ..services.prediction_inference_service import (
    PredictionInferenceService,
    PredictionModelUnavailable,
)

User = get_user_model()


class PredictionInferenceServiceTests(TestCase):
    def test_payload_to_dataset_row_derives_seasonal_context(self):
        row = PredictionInferenceService.payload_to_dataset_row({
            'food_feed_type': 'food',
            'sub_type': 'White Rice',
            'region': 'Central',
            'province': 'bangkok',
            'district': 'chatuchak',
            'collection_date': date(2026, 7, 2),
            'purpose': 'research',
            'sample_type': 'market',
            'processing_type': 'milled',
        })

        self.assertEqual(row['sub_type'], 'white rice')
        self.assertEqual(row['province'], 'Bangkok')
        self.assertEqual(row['collection_month'], 7)
        self.assertEqual(row['collection_quarter'], 3)
        self.assertEqual(row['collection_season_thailand'], 'rainy')
        self.assertEqual(row['weather_days_observed_90d'], 0)

    def test_payload_to_dataset_row_can_include_weather_features(self):
        weather = {
            'weather_temperature_c_mean_90d': 30.1,
            'weather_humidity_pct_mean_90d': 75.5,
            'weather_precipitation_mm_total_90d': 220.0,
            'weather_soil_temperature_c_mean_90d': 31.2,
            'weather_days_observed_90d': 90,
            'weather_location_label': 'Bangkok',
        }

        with patch(
            'samples.services.prediction_inference_service.PredictionWeatherService.get_features',
            return_value=weather,
        ):
            row = PredictionInferenceService.payload_to_dataset_row({
                'food_feed_type': 'food',
                'sub_type': 'White Rice',
                'province': 'Bangkok',
                'collection_date': date(2026, 7, 2),
            }, include_weather=True)

        self.assertEqual(row['weather_temperature_c_mean_90d'], 30.1)
        self.assertEqual(row['weather_days_observed_90d'], 90)

    def test_feature_provenance_summarizes_context_and_weather(self):
        summary = PredictionInferenceService.summarize_feature_provenance({
            'commodity': 'white rice',
            'province': 'Bangkok',
            'district': 'Chatuchak',
            'collection_month': 7,
            'collection_season_thailand': 'rainy',
            'context_location_type': 'farm',
            'context_has_exact_coordinates': 1,
            'context_harvest_month': 6,
            'context_sowing_month': '',
            'context_moisture_pct': 12.5,
            'context_soil_ph': '',
            'context_crop_variety': 'rd43',
            'context_crop_season': '',
            'context_soil_type': 'clay',
            'context_storage_duration_days': 14,
            'context_has_crop_rotation': 1,
            'context_has_fertiliser_details': 0,
            'context_has_fungicide_details': 1,
            'weather_days_observed_90d': 90,
            'weather_location_label': '13.7563,100.5018',
        })

        self.assertEqual(summary['commodity'], 'white rice')
        self.assertEqual(summary['locationPrecision'], 'exact_coordinates')
        self.assertEqual(summary['optionalContextSignalsFilled'], 9)
        self.assertEqual(summary['optionalContextSignalsTotal'], 13)
        self.assertEqual(summary['weatherDaysObserved90d'], 90)

    def test_sample_to_payload_uses_registered_sample_fields(self):
        sample = Sample(
            sample_id='RIC-2026-001',
            region='Central',
            province='Bangkok',
            district='Chatuchak',
            vegetation_variety='Rice',
            food_feed_type='food',
            sub_type='White Rice',
            collection_date=date(2026, 7, 2),
            purpose='research',
            sample_type='market',
            processing_type='milled',
        )

        payload = PredictionInferenceService.sample_to_payload(sample)

        self.assertEqual(payload['food_feed_type'], 'food')
        self.assertEqual(payload['sub_type'], 'White Rice')
        self.assertEqual(payload['province'], 'Bangkok')
        self.assertEqual(payload['collection_date'], date(2026, 7, 2))

    def test_sample_to_payload_includes_prediction_context(self):
        sample = Sample.objects.create(
            sample_id='RIC-2026-CTX',
            region='Central',
            province='Bangkok',
            district='Chatuchak',
            vegetation_variety='White Rice',
            food_feed_type='food',
            sub_type='White Rice',
            collection_date='2026-07-02',
            status='completed',
        )
        PredictionContext.objects.create(
            sample=sample,
            latitude=13.7563,
            longitude=100.5018,
            location_type='farm',
            harvest_date='2026-06-15',
            moisture_pct=12.5,
            soil_ph=6.4,
        )

        payload = PredictionInferenceService.sample_to_payload(sample)

        self.assertEqual(payload['latitude'], 13.7563)
        self.assertEqual(payload['longitude'], 100.5018)
        self.assertEqual(payload['location_type'], 'farm')
        self.assertEqual(str(payload['harvest_date']), '2026-06-15')
        self.assertEqual(payload['moisture_pct'], 12.5)

    def test_model_status_reports_latest_publish_state(self):
        with TemporaryDirectory() as tmp_dir:
            version_dir = Path(tmp_dir) / 'v20260831010101'
            version_dir.mkdir(parents=True)
            (version_dir / 'metadata.json').write_text(json.dumps({
                'version': 'v20260831010101',
                'created_at': '2026-08-31T01:01:01+00:00',
                'model_family': 'baseline',
                'trained_models': [
                    {
                        'toxin_type': 'AFB1',
                        'published': True,
                        'measured': 100,
                        'detected': 40,
                        'usable_context': 90,
                        'classification_metrics': {'f1': 0.7},
                    },
                    {
                        'toxin_type': 'DON',
                        'published': False,
                        'measured': 90,
                        'detected': 35,
                        'usable_context': 85,
                        'classification_metrics': {'f1': 0.5},
                    },
                ],
                'skipped_targets': [{'toxin_type': 'OTA'}],
            }), encoding='utf-8')

            status_data = PredictionInferenceService.get_model_status(artifacts_dir=tmp_dir)

        self.assertEqual(status_data['status'], 'published')
        self.assertEqual(status_data['latest']['version'], 'v20260831010101')
        self.assertEqual(status_data['latest']['trainedTargets'], 2)
        self.assertEqual(status_data['latest']['publishedTargets'], 1)
        self.assertEqual(status_data['latest']['skippedTargets'], 1)
        self.assertEqual(status_data['latest']['skippedTargetDetails'][0]['toxinType'], 'OTA')

    def test_model_status_reports_skipped_target_reasons(self):
        summary = PredictionInferenceService.summarize_skipped_target({
            'toxin_type': 'OTA',
            'eligible': False,
            'measured': 20,
            'detected': 5,
            'below_lod_or_zero': 15,
            'usable_context': 10,
            'min_detected': 30,
            'min_below_lod_or_zero': 30,
            'min_usable_context': 60,
        })

        self.assertEqual(summary['toxinType'], 'OTA')
        self.assertIn('Not enough detected examples', summary['reasons'])
        self.assertIn('Not enough below-LOD or zero examples', summary['reasons'])
        self.assertIn('Not enough usable sample context', summary['reasons'])

    def test_estimate_requires_published_models(self):
        with TemporaryDirectory() as tmp_dir:
            version_dir = Path(tmp_dir) / 'v20260831010101'
            version_dir.mkdir(parents=True)
            (version_dir / 'metadata.json').write_text(json.dumps({
                'version': 'v20260831010101',
                'trained_models': [{'toxin_type': 'AFB1', 'published': False}],
            }), encoding='utf-8')

            with self.assertRaises(PredictionModelUnavailable):
                PredictionInferenceService.estimate({
                    'food_feed_type': 'food',
                    'sub_type': 'White Rice',
                    'province': 'Bangkok',
                    'collection_date': date(2026, 7, 2),
                }, artifacts_dir=tmp_dir)

    def test_inspect_prediction_models_command_reports_review_decision(self):
        with TemporaryDirectory() as tmp_dir:
            version_dir = Path(tmp_dir) / 'v20260831010101'
            version_dir.mkdir()
            (version_dir / 'metadata.json').write_text(json.dumps({
                'version': 'v20260831010101',
                'created_at': '2026-08-31T01:01:01+00:00',
                'model_family': 'baseline',
                'training_config': {'include_weather': True},
                'trained_models': [
                    {
                        'toxin_type': 'AFB1',
                        'published': False,
                        'measured': 100,
                        'detected': 40,
                        'usable_context': 90,
                        'classification_metrics': {'f1': 0.7, 'roc_auc': 0.8},
                    },
                    {
                        'toxin_type': 'DON',
                        'published': False,
                        'measured': 90,
                        'detected': 35,
                        'usable_context': 85,
                        'classification_metrics': {'f1': 0.4, 'roc_auc': 0.65},
                    },
                ],
            }), encoding='utf-8')
            output = StringIO()

            call_command(
                'inspect_prediction_models',
                output_dir=tmp_dir,
                stdout=output,
            )

        command_output = output.getvalue()
        self.assertIn('Weather features: included', command_output)
        self.assertIn('AFB1', command_output)
        self.assertIn('review publish', command_output)
        self.assertIn('hold: low f1', command_output)

    def test_publish_prediction_models_requires_metric_guardrails_unless_forced(self):
        with TemporaryDirectory() as tmp_dir:
            version_dir = Path(tmp_dir) / 'v20260831010101'
            version_dir.mkdir()
            metadata_path = version_dir / 'metadata.json'
            metadata_path.write_text(json.dumps({
                'version': 'v20260831010101',
                'trained_models': [
                    {
                        'toxin_type': 'DON',
                        'published': False,
                        'classification_metrics': {'f1': 0.4, 'roc_auc': 0.7},
                    },
                ],
            }), encoding='utf-8')

            with self.assertRaises(CommandError):
                call_command(
                    'publish_prediction_models',
                    output_dir=tmp_dir,
                    version='v20260831010101',
                    toxins='DON',
                )

            call_command(
                'publish_prediction_models',
                output_dir=tmp_dir,
                version='v20260831010101',
                toxins='DON',
                force=True,
            )

            metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
            self.assertTrue(metadata['trained_models'][0]['published'])


class PredictionEstimateEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.researcher = User.objects.create_user(
            username='prediction_researcher',
            password='Password123',
            role='researcher',
        )
        self.admin = User.objects.create_user(
            username='prediction_admin',
            password='Password123',
            role='admin',
        )
        self.assistant = User.objects.create_user(
            username='prediction_assistant',
            password='Password123',
            role='research_assistant',
        )
        self.payload = {
            'food_feed_type': 'food',
            'sub_type': 'White Rice',
            'province': 'Bangkok',
            'collection_date': '2026-07-02',
            'region': 'Central',
            'district': 'Chatuchak',
            'purpose': 'research',
            'sample_type': 'market',
            'processing_type': 'milled',
        }
        self.sample = Sample.objects.create(
            sample_id='RIC-2026-001',
            region='Central',
            province='Bangkok',
            district='Chatuchak',
            vegetation_variety='White Rice',
            food_feed_type='food',
            sub_type='White Rice',
            collection_date='2026-07-02',
            status='completed',
            purpose='research',
            sample_type='market',
            processing_type='milled',
        )

    def test_prediction_estimate_requires_research_role(self):
        self.client.force_authenticate(user=self.assistant)

        response = self.client.post(
            reverse('sample-prediction-estimate'),
            self.payload,
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(BASE_DIR=Path('/tmp/agriscan-no-prediction-artifacts'))
    def test_prediction_estimate_returns_503_without_artifacts(self):
        self.client.force_authenticate(user=self.researcher)

        response = self.client.post(
            reverse('sample-prediction-estimate'),
            self.payload,
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('detail', response.data)

    def test_prediction_estimate_sample_uses_registered_sample(self):
        self.client.force_authenticate(user=self.researcher)
        expected = {
            'modelVersion': 'v-test',
            'modelFamily': 'baseline',
            'usesWeatherFeatures': False,
            'predictions': [],
            'warning': 'Research estimate only.',
        }

        with patch('samples.views.PredictionInferenceService.estimate', return_value=expected) as estimate:
            response = self.client.post(
                reverse('sample-prediction-estimate-sample', kwargs={'sample_id': self.sample.sample_id}),
                {},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, expected)
        payload = estimate.call_args.args[0]
        self.assertEqual(payload['sub_type'], 'White Rice')
        self.assertEqual(payload['province'], 'Bangkok')
        estimate_record = PredictionEstimate.objects.get(sample=self.sample)
        self.assertEqual(estimate_record.model_version, 'v-test')
        self.assertEqual(estimate_record.requested_by, self.researcher)
        self.assertEqual(estimate_record.input_payload['collection_date'], '2026-07-02')

    def test_prediction_history_returns_recent_sample_estimates(self):
        self.client.force_authenticate(user=self.researcher)
        PredictionEstimate.objects.create(
            sample=self.sample,
            requested_by=self.researcher,
            model_version='v-test',
            model_family='baseline',
            input_payload={'sample_id': self.sample.sample_id},
            predictions_payload=[{'toxinType': 'AFB1', 'detectionProbability': 0.8}],
            warning='Research estimate only.',
        )

        response = self.client.get(
            reverse('sample-prediction-history', kwargs={'sample_id': self.sample.sample_id})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['model_version'], 'v-test')
        self.assertEqual(response.data[0]['sample_id'], self.sample.sample_id)

    def test_prediction_batch_estimate_scores_registered_samples_and_reports_missing_ids(self):
        self.client.force_authenticate(user=self.researcher)
        expected = {
            'modelVersion': 'v-test',
            'modelFamily': 'baseline',
            'usesWeatherFeatures': False,
            'predictions': [
                {'toxinType': 'AFB1', 'detectionProbability': 0.8},
            ],
            'warning': 'Research estimate only.',
        }

        with patch('samples.views.PredictionInferenceService.estimate', return_value=expected):
            response = self.client.post(
                reverse('sample-prediction-batch-estimate'),
                {'sample_ids': [self.sample.sample_id, 'MISSING-001']},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['requested'], 2)
        self.assertEqual(response.data['completed'], 1)
        self.assertEqual(response.data['failed'], 1)
        self.assertEqual(response.data['results'][0]['sampleId'], self.sample.sample_id)
        self.assertEqual(response.data['errors'][0]['sampleId'], 'MISSING-001')
        self.assertEqual(PredictionEstimate.objects.filter(sample=self.sample).count(), 1)

    def test_prediction_batch_estimate_deduplicates_sample_ids(self):
        self.client.force_authenticate(user=self.researcher)
        expected = {
            'modelVersion': 'v-test',
            'modelFamily': 'baseline',
            'usesWeatherFeatures': False,
            'predictions': [],
            'warning': 'Research estimate only.',
        }

        with patch('samples.views.PredictionInferenceService.estimate', return_value=expected) as estimate:
            response = self.client.post(
                reverse('sample-prediction-batch-estimate'),
                {'sample_ids': [self.sample.sample_id, self.sample.sample_id]},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['requested'], 1)
        self.assertEqual(response.data['completed'], 1)
        self.assertEqual(estimate.call_count, 1)

    def test_prediction_estimate_rejects_out_of_range_coordinates(self):
        self.client.force_authenticate(user=self.researcher)
        payload = {
            **self.payload,
            'latitude': 13.7563,
            'longitude': 200,
        }

        response = self.client.post(
            reverse('sample-prediction-estimate'),
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('longitude', response.data)

    def test_prediction_status_requires_research_role(self):
        self.client.force_authenticate(user=self.assistant)

        response = self.client.get(reverse('sample-prediction-status'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(BASE_DIR=Path('/tmp/agriscan-no-prediction-artifacts'))
    def test_prediction_status_returns_not_trained_without_artifacts(self):
        self.client.force_authenticate(user=self.researcher)

        response = self.client.get(reverse('sample-prediction-status'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'not_trained')

    def test_prediction_publish_requires_admin_role(self):
        self.client.force_authenticate(user=self.researcher)

        response = self.client.post(
            reverse('sample-prediction-publish'),
            {'version': 'latest', 'toxins': ['AFB1']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_prediction_publish_endpoint_publishes_selected_models(self):
        with TemporaryDirectory() as tmp_dir:
            artifacts_dir = Path(tmp_dir) / 'prediction_artifacts'
            version_dir = artifacts_dir / 'v20260831010101'
            version_dir.mkdir()
            metadata_path = version_dir / 'metadata.json'
            metadata_path.write_text(json.dumps({
                'version': 'v20260831010101',
                'created_at': '2026-08-31T01:01:01+00:00',
                'model_family': 'baseline',
                'trained_models': [
                    {
                        'toxin_type': 'AFB1',
                        'published': False,
                        'measured': 100,
                        'detected': 40,
                        'usable_context': 90,
                        'classification_metrics': {'f1': 0.7, 'roc_auc': 0.8},
                    },
                ],
            }), encoding='utf-8')
            self.client.force_authenticate(user=self.admin)

            with override_settings(BASE_DIR=Path(tmp_dir)):
                response = self.client.post(
                    reverse('sample-prediction-publish'),
                    {
                        'version': 'v20260831010101',
                        'toxins': ['AFB1'],
                    },
                    format='json',
                )

            metadata = json.loads(metadata_path.read_text(encoding='utf-8'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated'], 1)
        self.assertEqual(response.data['publishedToxins'], ['AFB1'])
        self.assertTrue(metadata['trained_models'][0]['published'])

    def test_prediction_publish_endpoint_rejects_low_metric_model(self):
        with TemporaryDirectory() as tmp_dir:
            artifacts_dir = Path(tmp_dir) / 'prediction_artifacts'
            version_dir = artifacts_dir / 'v20260831010101'
            version_dir.mkdir()
            (version_dir / 'metadata.json').write_text(json.dumps({
                'version': 'v20260831010101',
                'trained_models': [
                    {
                        'toxin_type': 'DON',
                        'published': False,
                        'classification_metrics': {'f1': 0.3, 'roc_auc': 0.7},
                    },
                ],
            }), encoding='utf-8')
            self.client.force_authenticate(user=self.admin)

            with override_settings(BASE_DIR=Path(tmp_dir)):
                response = self.client.post(
                    reverse('sample-prediction-publish'),
                    {
                        'version': 'v20260831010101',
                        'toxins': ['DON'],
                    },
                    format='json',
                )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Metric guardrails failed', response.data['detail'])

    def test_prediction_context_can_be_saved_and_read(self):
        self.client.force_authenticate(user=self.researcher)
        url = reverse('sample-prediction-context', kwargs={'sample_id': self.sample.sample_id})

        response = self.client.put(url, {
            'latitude': 13.7563,
            'longitude': 100.5018,
            'location_type': 'farm',
            'harvest_date': '2026-06-15',
            'crop_variety': 'RD43',
            'storage_duration_days': 14,
            'moisture_pct': 12.5,
            'soil_ph': 6.4,
        }, format='json')
        read_response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(read_response.data['location_type'], 'farm')
        self.assertEqual(read_response.data['crop_variety'], 'RD43')

    def test_prediction_context_rejects_out_of_range_coordinates(self):
        self.client.force_authenticate(user=self.researcher)
        url = reverse('sample-prediction-context', kwargs={'sample_id': self.sample.sample_id})

        response = self.client.patch(url, {
            'latitude': 120,
            'longitude': 100.5018,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('latitude', response.data)

    def test_prediction_estimate_accepts_extended_context_fields(self):
        self.client.force_authenticate(user=self.researcher)
        payload = {
            **self.payload,
            'latitude': 13.7563,
            'longitude': 100.5018,
            'location_type': 'farm',
            'crop_rotation': 'rice-bean',
            'fertiliser_details': 'organic nitrogen applied',
            'fungicide_details': 'none',
        }

        with patch('samples.views.PredictionInferenceService.estimate', return_value={'predictions': []}) as estimate:
            response = self.client.post(
                reverse('sample-prediction-estimate'),
                payload,
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        validated_payload = estimate.call_args.args[0]
        self.assertEqual(validated_payload['crop_rotation'], 'rice-bean')
        self.assertEqual(validated_payload['fertiliser_details'], 'organic nitrogen applied')
        self.assertEqual(validated_payload['fungicide_details'], 'none')
