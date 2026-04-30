import hashlib
import base64
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


def generate_pkce_challenge(verifier: str) -> str:
    """Generate an S256 PKCE challenge from a verifier."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").replace("=", "")


class OAuthPKCESecurityTests(TestCase):
    """Tests for OAuth PKCE enforcement and validation."""

    def setUp(self):
        self.client = APIClient()
        self.auth_url_endpoint = reverse("google-auth-url")
        self.callback_url = reverse("google-oauth-callback")
        cache.clear()

    @patch("accounts.oauth.get_google_user_info")
    @patch("accounts.oauth.get_google_token")
    def test_callback_enforces_verifier_when_challenge_present(
        self, mock_get_google_token, mock_get_google_user_info
    ):
        """Callback must reject the request if code_verifier is missing but challenge was set."""
        # 1. Start flow with PKCE
        auth_res = self.client.get(f"{self.auth_url_endpoint}?code_challenge=some-challenge")
        state = auth_res.data["state"]

        # 2. Attempt callback WITHOUT verifier
        response = self.client.post(
            self.callback_url,
            {"code": "valid-code", "state": state},
            format="json"
        )

        # Should be rejected BEFORE calling Google
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("PKCE verifier is required", str(response.data.get("detail", "")))
        mock_get_google_token.assert_not_called()

    @patch("accounts.oauth.get_google_user_info")
    @patch("accounts.oauth.get_google_token")
    def test_callback_rejects_mismatched_verifier(
        self, mock_get_google_token, mock_get_google_user_info
    ):
        """Callback must reject the request if code_verifier does not match stored challenge."""
        verifier = "correct-verifier-long-enough-for-entropy-1234567890"
        challenge = generate_pkce_challenge(verifier)

        # 1. Start flow with valid challenge
        auth_res = self.client.get(f"{self.auth_url_endpoint}?code_challenge={challenge}")
        state = auth_res.data["state"]

        # 2. Attempt callback with WRONG verifier
        response = self.client.post(
            self.callback_url,
            {
                "code": "valid-code",
                "state": state,
                "code_verifier": "wrong-verifier"
            },
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid PKCE verifier", str(response.data.get("detail", "")))
        mock_get_google_token.assert_not_called()

    @patch("accounts.oauth.get_google_user_info")
    @patch("accounts.oauth.get_google_token")
    def test_callback_allows_valid_pkce(
        self, mock_get_google_token, mock_get_google_user_info
    ):
        """Callback should proceed when verifier matches the stored challenge."""
        verifier = "valid-verifier-secret-1234567890-abcdefghij"
        challenge = generate_pkce_challenge(verifier)

        # 1. Start flow
        auth_res = self.client.get(f"{self.auth_url_endpoint}?code_challenge={challenge}")
        state = auth_res.data["state"]

        # 2. Mock Google responses
        mock_get_google_token.return_value = {"access_token": "token"}
        mock_get_google_user_info.return_value = {
            "id": "123", "email": "user@example.com", "verified_email": True
        }

        # 3. Attempt callback with CORRECT verifier
        response = self.client.post(
            self.callback_url,
            {
                "code": "valid-code",
                "state": state,
                "code_verifier": verifier
            },
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_get_google_token.assert_called_once_with("valid-code", code_verifier=verifier)
