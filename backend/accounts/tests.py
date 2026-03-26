from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()


class UserCreationTests(TestCase):
    """Tests for the user registration endpoint and model creation."""

    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')

    def test_create_user_with_valid_data(self):
        """Registering with valid data should create a user and return 201."""
        payload = {
            'username': 'testuser',
            'email': 'test@example.com',
            'name': 'Test User',
            'password': 'StrongPass123!',
            'verify_password': 'StrongPass123!',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='testuser').exists())

    def test_create_user_password_mismatch(self):
        """Mismatched passwords should return 400."""
        payload = {
            'username': 'testuser',
            'email': 'test@example.com',
            'name': 'Test User',
            'password': 'StrongPass123!',
            'verify_password': 'DifferentPass456!',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginTests(TestCase):
    """Tests for the JWT login endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse('token_obtain_pair')
        self.user = User.objects.create_user(
            username='loginuser',
            email='login@example.com',
            name='Login User',
            password='StrongPass123!',
        )

    def test_login_returns_access_and_refresh_tokens(self):
        """Successful login should return both access and refresh tokens."""
        payload = {'username': 'loginuser', 'password': 'StrongPass123!'}
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_with_wrong_password(self):
        """Login with wrong password should return 401."""
        payload = {'username': 'loginuser', 'password': 'WrongPassword!'}
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TokenRefreshTests(TestCase):
    """Tests for token refresh and rotation."""

    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse('token_obtain_pair')
        self.refresh_url = reverse('token_refresh')
        self.user = User.objects.create_user(
            username='refreshuser',
            email='refresh@example.com',
            name='Refresh User',
            password='StrongPass123!',
        )
        # Obtain initial tokens
        response = self.client.post(
            self.login_url,
            {'username': 'refreshuser', 'password': 'StrongPass123!'},
            format='json',
        )
        self.refresh_token = response.data['refresh']

    def test_refresh_returns_new_access_token(self):
        """A valid refresh token should return a new access token."""
        response = self.client.post(
            self.refresh_url,
            {'refresh': self.refresh_token},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_invalid_refresh_token_rejected(self):
        """An invalid/garbage refresh token should return 401."""
        response = self.client.post(
            self.refresh_url,
            {'refresh': 'not.a.valid.token'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_old_refresh_token_blacklisted_after_rotation(self):
        """After rotation the original refresh token must be rejected (blacklisted)."""
        # First refresh — issues a new access token and rotates the refresh token
        first_response = self.client.post(
            self.refresh_url,
            {'refresh': self.refresh_token},
            format='json',
        )
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)

        # Reusing the original (now rotated) refresh token must be rejected
        second_response = self.client.post(
            self.refresh_url,
            {'refresh': self.refresh_token},
            format='json',
        )
        self.assertEqual(second_response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserCreationEdgeCaseTests(TestCase):
    """Additional edge-case tests for user registration."""

    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        User.objects.create_user(
            username='existing',
            email='existing@example.com',
            name='Existing User',
            password='StrongPass123!',
        )

    def test_register_duplicate_username_returns_400(self):
        """Registering with an already-taken username should return 400."""
        payload = {
            'username': 'existing',
            'email': 'new@example.com',
            'name': 'New User',
            'password': 'StrongPass123!',
            'verify_password': 'StrongPass123!',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_required_fields_returns_400(self):
        """Submitting an empty payload should return 400."""
        response = self.client.post(self.register_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginEdgeCaseTests(TestCase):
    """Additional edge-case tests for login."""

    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse('token_obtain_pair')

    def test_login_nonexistent_user_returns_401(self):
        """Login attempt for a user that does not exist should return 401."""
        payload = {'username': 'ghost', 'password': 'AnyPassword1!'}
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AuthorizationTests(TestCase):
    """Tests verifying that protected endpoints enforce authentication."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='authuser',
            email='auth@example.com',
            name='Auth User',
            password='StrongPass123!',
        )

    def test_protected_endpoint_requires_auth(self):
        """Calling a protected endpoint without credentials should return 401."""
        url = reverse('sample-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_endpoint_allows_authenticated_user(self):
        """An authenticated user should receive 200 from a protected list endpoint."""
        self.client.force_authenticate(user=self.user)
        url = reverse('sample-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
