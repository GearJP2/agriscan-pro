"""Shared test fixtures for the samples test package."""

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


class SampleTestMixin:
    """Shared setup for sample tests."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='sampleuser',
            email='sample@example.com',
            name='Sample User',
            password='StrongPass123!',
            role='research_assistant',
        )
        self.admin_user = User.objects.create_user(
            username='sampleadmin',
            email='sampleadmin@example.com',
            name='Sample Admin',
            password='StrongPass123!',
            role='admin',
            is_staff=True,
        )
        self.client.force_authenticate(user=self.user)

        self.sample_data = {
            'sample_id': 'TEST-001',
            'region': 'Central',
            'province': 'Bangkok',
            'district': 'Chatuchak',
            'vegetation_variety': 'Rice',
            'collection_date': '2026-01-15',
            'status': 'pending',
        }
