from django.test import TestCase
from django.urls import reverse
from rest_framework import status

from ..models import Sample
from ._mixins import SampleTestMixin


class SampleRegistrationFieldTests(SampleTestMixin, TestCase):
    def test_registration_records_account_and_received_time(self):
        payload = {
            'region': 'Central',
            'province': 'Bangkok',
            'district': 'Chatuchak',
            'food_feed_type': 'feed',
            'sub_type': 'Maize feed',
            'collection_date': '2026-08-23',
        }

        response = self.client.post(reverse('sample-list'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sample = Sample.objects.get(sample_id=response.data['sample_id'])
        self.assertEqual(sample.food_feed_type, 'feed')
        self.assertEqual(sample.sub_type, 'Maize feed')
        self.assertEqual(sample.vegetation_variety, 'Maize feed')
        self.assertEqual(sample.recorded_by, self.user)
        self.assertEqual(sample.collected_by, self.user.username)
        self.assertIsNotNone(sample.received_at)
        self.assertIsNone(sample.purpose)
        self.assertIsNone(sample.sample_type)
        self.assertIsNone(sample.processing_type)
        self.assertEqual(response.data['recorded_by'], self.user.username)
        self.assertIsNotNone(response.data['received_at'])

    def test_legacy_vegetation_payload_remains_importable(self):
        payload = dict(self.sample_data)
        payload.pop('sample_id')

        response = self.client.post(reverse('sample-list'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['food_feed_type'], 'food')
        self.assertEqual(response.data['sub_type'], payload['vegetation_variety'])
