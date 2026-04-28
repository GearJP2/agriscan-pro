from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ..models import EmailChangeRequest

User = get_user_model()


class EmailChangeSecurityTests(TestCase):
    """Tests for email verification and confirmation hardening."""

    def setUp(self):
        self.client = APIClient()
        self.profile_url = reverse("profile-update")
        self.confirm_url = reverse("email-change-confirm")
        self.user = User.objects.create_user(
            username="emailuser",
            email="emailuser@example.com",
            name="Email User",
            password="StrongPass123!",
            role="user",
        )
        self.other_user = User.objects.create_user(
            username="takenemail",
            email="taken@example.com",
            name="Taken Email",
            password="StrongPass123!",
            role="user",
        )
        self.client.force_authenticate(user=self.user)

    def test_profile_email_change_creates_verification_request(self):
        """Profile email changes should create a verification request instead of updating immediately."""
        response = self.client.patch(
            self.profile_url,
            {
                "email": "pending@example.com",
                "current_password": "StrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "emailuser@example.com")
        self.assertEqual(len(mail.outbox), 1)

    def test_email_change_confirmation_rejects_duplicate_email(self):
        """Confirming an email change should fail cleanly when the target email is already taken."""
        response = self.client.patch(
            self.profile_url,
            {
                "email": "pending@example.com",
                "current_password": "StrongPass123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        request_record = EmailChangeRequest.objects.get(user=self.user)
        request_record.new_email = self.other_user.email
        request_record.save(update_fields=["new_email"])

        confirm_response = self.client.post(
            self.confirm_url,
            {"token": str(request_record.token)},
            format="json",
        )

        self.assertEqual(confirm_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "emailuser@example.com")

    def test_email_change_confirmation_uses_generic_failure_message(self):
        """Invalid-token and duplicate-email outcomes should expose the same error detail."""
        invalid_token_response = self.client.post(
            self.confirm_url,
            {"token": "00000000-0000-0000-0000-000000000000"},
            format="json",
        )
        self.assertEqual(invalid_token_response.status_code, status.HTTP_400_BAD_REQUEST)

        create_response = self.client.patch(
            self.profile_url,
            {
                "email": "pending2@example.com",
                "current_password": "StrongPass123!",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_202_ACCEPTED)

        request_record = EmailChangeRequest.objects.get(user=self.user)
        request_record.new_email = self.other_user.email
        request_record.save(update_fields=["new_email"])

        duplicate_response = self.client.post(
            self.confirm_url,
            {"token": str(request_record.token)},
            format="json",
        )

        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            invalid_token_response.data.get("detail"),
            duplicate_response.data.get("detail"),
        )
