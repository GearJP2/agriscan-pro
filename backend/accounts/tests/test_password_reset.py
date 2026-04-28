from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ..models import PasswordResetOTP

User = get_user_model()


class PasswordResetSecurityTests(TestCase):
    """Tests for OTP invalidation and password reset hardening."""

    def setUp(self):
        self.client = APIClient()
        self.request_url = reverse("password-reset-request")
        self.confirm_url = reverse("password-reset-confirm")
        cache.clear()
        self.user = User.objects.create_user(
            username="otpuser",
            email="otp@example.com",
            name="OTP User",
            password="StrongPass123!",
            role="user",
        )

    @patch("accounts.views.send_mail")
    def test_request_returns_same_response_for_existing_and_unknown_email(self, mock_send_mail):
        """Password-reset request should not reveal whether an email exists."""
        known = self.client.post(
            self.request_url,
            {"email": self.user.email},
            format="json",
        )
        unknown = self.client.post(
            self.request_url,
            {"email": "unknown@example.com"},
            format="json",
        )

        self.assertEqual(known.status_code, status.HTTP_200_OK)
        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(known.data.get("detail"), unknown.data.get("detail"))
        self.assertEqual(mock_send_mail.call_count, 1)

    @patch("accounts.views.send_mail")
    @patch("accounts.views.generate_otp", return_value="111111")
    def test_request_normalizes_email_input(self, _mock_generate_otp, _mock_send_mail):
        """Email input should be sanitized/normalized before lookup."""
        response = self.client.post(
            self.request_url,
            {"email": "  OTP@EXAMPLE.com  "},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(PasswordResetOTP.objects.filter(user=self.user).exists())

    def test_confirm_rejects_non_numeric_otp_code(self):
        """OTP code must be strictly 6 digits."""
        response = self.client.post(
            self.confirm_url,
            {
                "email": self.user.email,
                "otp_code": "12ab34",
                "new_password": "NewStrongPass123!",
                "confirm_password": "NewStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("otp_code", str(response.data))

    def test_confirm_unknown_email_uses_generic_invalid_message(self):
        """Unknown email should return the same generic invalid OTP response."""
        response = self.client.post(
            self.confirm_url,
            {
                "email": "missing@example.com",
                "otp_code": "123456",
                "new_password": "NewStrongPass123!",
                "confirm_password": "NewStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid or expired OTP.", str(response.data))

    def test_confirm_rejects_password_with_surrounding_whitespace(self):
        """Reset-password serializer should reject ambiguous whitespace in secrets."""
        response = self.client.post(
            self.confirm_url,
            {
                "email": self.user.email,
                "otp_code": "123456",
                "new_password": " NewStrongPass123! ",
                "confirm_password": " NewStrongPass123! ",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", str(response.data))

    @patch("accounts.views.generate_otp", side_effect=["111111", "222222"])
    def test_requesting_new_otp_invalidates_previous_code(self, _mock_generate_otp):
        """Requesting a second OTP should invalidate the first unused code."""
        first_response = self.client.post(
            self.request_url,
            {"email": self.user.email},
            format="json",
        )
        second_response = self.client.post(
            self.request_url,
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)

        first_otp_hash = PasswordResetOTP.hash_otp("111111")
        second_otp_hash = PasswordResetOTP.hash_otp("222222")

        first_otp = PasswordResetOTP.objects.get(
            user=self.user,
            otp_hash=first_otp_hash,
        )
        second_otp = PasswordResetOTP.objects.get(
            user=self.user,
            otp_hash=second_otp_hash,
        )

        self.assertTrue(first_otp.used)
        self.assertFalse(second_otp.used)

    @patch("accounts.views.generate_otp", return_value="333333")
    def test_successful_reset_invalidates_other_unused_otps(self, _mock_generate_otp):
        """A successful password reset should invalidate any remaining unused OTPs."""
        self.client.post(
            self.request_url,
            {"email": self.user.email},
            format="json",
        )

        PasswordResetOTP.objects.create(
            user=self.user,
            otp_hash=PasswordResetOTP.hash_otp("444444"),
            expiry=PasswordResetOTP.objects.latest("id").expiry,
        )

        response = self.client.post(
            self.confirm_url,
            {
                "email": self.user.email,
                "otp_code": "333333",
                "new_password": "NewStrongPass123!",
                "confirm_password": "NewStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        first_otp = PasswordResetOTP.objects.get(
            user=self.user,
            otp_hash=PasswordResetOTP.hash_otp("333333"),
        )
        second_otp = PasswordResetOTP.objects.get(
            user=self.user,
            otp_hash=PasswordResetOTP.hash_otp("444444"),
        )

        self.assertTrue(first_otp.used)
        self.assertTrue(second_otp.used)
