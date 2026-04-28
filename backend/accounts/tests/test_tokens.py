from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class TokenRefreshTests(TestCase):
    """Tests for refresh rotation through the cookie-backed flow."""

    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse("token_obtain_pair")
        self.refresh_url = reverse("token_refresh")
        self.refresh_cookie_name = settings.JWT_REFRESH_COOKIE_NAME
        self.user = User.objects.create_user(
            username="refreshuser",
            email="refresh@example.com",
            name="Refresh User",
            password="StrongPass123!",
            role="research_assistant",
        )
        login_response = self.client.post(
            self.login_url,
            {"username": "refreshuser", "password": "StrongPass123!"},
            format="json",
        )
        self.initial_refresh_token = login_response.cookies[
            self.refresh_cookie_name
        ].value

    def test_refresh_returns_new_access_token_using_cookie(self):
        """A valid refresh cookie should return a new access token."""
        response = self.client.post(self.refresh_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertIn(self.refresh_cookie_name, response.cookies)
        self.assertNotEqual(
            response.cookies[self.refresh_cookie_name].value,
            self.initial_refresh_token,
        )

    def test_body_only_refresh_token_rejected(self):
        """The refresh endpoint should reject body tokens without a cookie."""
        client = APIClient()
        response = client.post(
            self.refresh_url,
            {"refresh": self.initial_refresh_token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_refresh_cookie_rejected(self):
        """An invalid refresh cookie should return 401."""
        client = APIClient()
        client.cookies[self.refresh_cookie_name] = "not.a.valid.token"
        response = client.post(self.refresh_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("Authentication failed.", str(response.data))

    def test_missing_refresh_token_rejected(self):
        """A refresh request without cookie or body token should return 401."""
        client = APIClient()
        response = client.post(self.refresh_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_old_refresh_token_blacklisted_after_rotation(self):
        """After rotation, reusing the original refresh token must be rejected."""
        first_response = self.client.post(self.refresh_url, {}, format="json")
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)

        second_client = APIClient()
        second_client.cookies[self.refresh_cookie_name] = self.initial_refresh_token
        second_response = second_client.post(self.refresh_url, {}, format="json")

        self.assertEqual(second_response.status_code, status.HTTP_401_UNAUTHORIZED)


class LogoutTests(TestCase):
    """Tests for cookie-backed logout."""

    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse("token_obtain_pair")
        self.logout_url = reverse("logout")
        self.refresh_url = reverse("token_refresh")
        self.refresh_cookie_name = settings.JWT_REFRESH_COOKIE_NAME
        self.user = User.objects.create_user(
            username="logoutuser",
            email="logout@example.com",
            name="Logout User",
            password="StrongPass123!",
            role="research_assistant",
        )
        self.client.post(
            self.login_url,
            {"username": "logoutuser", "password": "StrongPass123!"},
            format="json",
        )

    def test_logout_clears_refresh_cookie(self):
        """Logout should clear the refresh cookie on the response."""
        response = self.client.post(self.logout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(self.refresh_cookie_name, response.cookies)
        cleared_cookie = response.cookies[self.refresh_cookie_name]
        self.assertEqual(cleared_cookie.value, "")

    def test_logout_prevents_follow_up_refresh(self):
        """After logout, the client should no longer be able to refresh."""
        self.client.post(self.logout_url, {}, format="json")
        refresh_response = self.client.post(self.refresh_url, {}, format="json")

        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)
