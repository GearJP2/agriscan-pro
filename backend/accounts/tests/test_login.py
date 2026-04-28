from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class LoginTests(TestCase):
    """Tests for the JWT login endpoint using cookie-backed refresh tokens."""

    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse("token_obtain_pair")
        self.refresh_cookie_name = settings.JWT_REFRESH_COOKIE_NAME
        self.user = User.objects.create_user(
            username="loginuser",
            email="login@example.com",
            name="Login User",
            password="StrongPass123!",
            role="research_assistant",
        )

    def test_login_returns_access_and_sets_refresh_cookie(self):
        """Successful login should return an access token and set the refresh cookie."""
        payload = {"username": "loginuser", "password": "StrongPass123!"}

        response = self.client.post(self.login_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("user", response.data)
        self.assertNotIn("refresh", response.data)

        self.assertIn(self.refresh_cookie_name, response.cookies)
        refresh_cookie = response.cookies[self.refresh_cookie_name]
        self.assertTrue(refresh_cookie.value)
        self.assertTrue(refresh_cookie["httponly"])

    def test_login_accepts_email_identifier(self):
        """Login should accept an email address in the username field."""
        payload = {"username": "login@example.com", "password": "StrongPass123!"}

        response = self.client.post(self.login_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["email"], "login@example.com")

    def test_login_with_wrong_password(self):
        """Login with wrong password should return 401."""
        payload = {"username": "loginuser", "password": "WrongPassword!"}

        response = self.client.post(self.login_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class LoginEdgeCaseTests(TestCase):
    """Additional edge-case tests for login."""

    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse("token_obtain_pair")

    def test_login_nonexistent_user_returns_401(self):
        """Login attempt for a user that does not exist should return 401."""
        payload = {"username": "ghost", "password": "AnyPassword1!"}

        response = self.client.post(self.login_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
