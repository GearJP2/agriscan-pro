from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class UserCreationTests(TestCase):
    """Tests for the user registration endpoint and model creation."""

    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse("register")

    def test_create_user_with_valid_data(self):
        """Registering with valid data should create a user and return 201."""
        payload = {
            "username": "testuser",
            "email": "test@example.com",
            "name": "Test User",
            "password": "StrongPass123!",
            "verify_password": "StrongPass123!",
        }

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="testuser").exists())

    def test_create_user_password_mismatch(self):
        """Mismatched passwords should return 400."""
        payload = {
            "username": "testuser",
            "email": "test@example.com",
            "name": "Test User",
            "password": "StrongPass123!",
            "verify_password": "DifferentPass456!",
        }

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserCreationEdgeCaseTests(TestCase):
    """Additional edge-case tests for user registration."""

    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse("register")
        User.objects.create_user(
            username="existing",
            email="existing@example.com",
            name="Existing User",
            password="StrongPass123!",
        )

    def test_register_duplicate_username_returns_400(self):
        """Registering with an already-taken username should return 400."""
        payload = {
            "username": "existing",
            "email": "new@example.com",
            "name": "New User",
            "password": "StrongPass123!",
            "verify_password": "StrongPass123!",
        }

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_required_fields_returns_400(self):
        """Submitting an empty payload should return 400."""
        response = self.client.post(self.register_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_normalizes_email_and_trims_text_fields(self):
        """Registration should normalize email and strip surrounding whitespace."""
        payload = {
            "username": "  newuser  ",
            "email": "  NEW@Example.COM  ",
            "name": "  New User  ",
            "password": "StrongPass123!",
            "verify_password": "StrongPass123!",
        }

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(email="new@example.com")
        self.assertEqual(created.username, "newuser")
        self.assertEqual(created.name, "New User")

    def test_register_rejects_blank_username_after_sanitization(self):
        """Usernames that become blank after sanitization should be rejected."""
        payload = {
            "username": "\x00   \x00",
            "email": "blankuser@example.com",
            "name": "Valid Name",
            "password": "StrongPass123!",
            "verify_password": "StrongPass123!",
        }

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", str(response.data))


class UserErrorHandlingTests(TestCase):
    """Tests for error handling in user endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            name="Test User",
            password="StrongPass123!",
            role="research_assistant",
        )
        self.client.force_authenticate(user=self.user)

    def test_login_wrong_password_returns_error_envelope(self):
        """Login with wrong password should return 401 with consistent error format."""
        url = reverse("token_obtain_pair")
        response = self.client.post(
            url,
            {"username": "testuser", "password": "WrongPassword123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)
        self.assertIn("code", response.data["error"])
        self.assertEqual(response.data["status"], "error")
        self.assertIn("timestamp", response.data)

    def test_get_nonexistent_user_returns_404(self):
        """Getting a non-existent user should return 404 with consistent error format."""
        url = reverse("user-detail", kwargs={"pk": 99999})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("error", response.data)
        self.assertIn("code", response.data["error"])
        self.assertEqual(response.data["status"], "error")
        self.assertIn("timestamp", response.data)
