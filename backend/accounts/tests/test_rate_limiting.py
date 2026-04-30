from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class OTPRateLimitingTests(TestCase):
    """Tests for multi-key rate limiting on OTP requests."""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("password-reset-request")
        cache.clear()
        self.user = User.objects.create_user(
            username="target",
            email="target@example.com",
            password="Pass123!",
            role="user",
        )

    @patch("accounts.views.send_mail")
    def test_ip_based_rate_limiting(self, _mock_send_mail):
        """A single IP should be limited regardless of target email."""
        # Assume limit is 3 requests per hour (from views.py MAX_OTP_REQUESTS)
        for i in range(3):
            response = self.client.post(
                self.url,
                {"email": f"user{i}@example.com"},
                format="json",
                REMOTE_ADDR="1.1.1.1",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 4th request from same IP should be blocked
        response = self.client.post(
            self.url,
            {"email": "final@example.com"},
            format="json",
            REMOTE_ADDR="1.1.1.1",
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @patch("accounts.views.send_mail")
    def test_email_based_rate_limiting(self, _mock_send_mail):
        """A single email should be limited even if requests come from different IPs."""
        # This is expected to FAIL before the fix
        for i in range(3):
            response = self.client.post(
                self.url,
                {"email": self.user.email},
                format="json",
                HTTP_X_FORWARDED_FOR=f"1.1.1.{i}",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 4th request for SAME email from DIFFERENT IP should be blocked
        response = self.client.post(
            self.url,
            {"email": self.user.email},
            format="json",
            HTTP_X_FORWARDED_FOR="9.9.9.9",
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_rate_limit_message_is_generic(self):
        """Rate limit error should not vary based on account existence."""
        # Exhaust limit for IP
        for _ in range(3):
            self.client.post(self.url, {"email": "foo@bar.com"}, format="json", REMOTE_ADDR="2.2.2.2")

        # Check existing user
        known = self.client.post(self.url, {"email": self.user.email}, format="json", REMOTE_ADDR="2.2.2.2")
        # Check unknown user
        unknown = self.client.post(self.url, {"email": "unknown@example.com"}, format="json", REMOTE_ADDR="2.2.2.2")

        self.assertEqual(known.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(unknown.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(known.data["detail"], unknown.data["detail"])
