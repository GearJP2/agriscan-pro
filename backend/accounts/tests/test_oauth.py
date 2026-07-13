from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ..models import UserAuthProvider
from ..oauth import validate_google_oauth_config
from ._helpers import extract_error_text

User = get_user_model()


class GoogleOAuthTests(TestCase):
    """Tests for server-side Google OAuth state validation."""

    def setUp(self):
        self.client = APIClient()
        self.google_auth_url = reverse("google-auth-url")
        self.google_callback_url = reverse("google-oauth-callback")
        self.refresh_cookie_name = settings.JWT_REFRESH_COOKIE_NAME
        cache.clear()

    def test_google_auth_url_returns_state_and_stores_it(self):
        """The auth-url endpoint should return a state and store it in cache."""
        response = self.client.get(self.google_auth_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("auth_url", response.data)
        self.assertIn("state", response.data)

        cache_key = f"google_oauth_state:{response.data['state']}"
        self.assertTrue(cache.get(cache_key))

    def test_google_callback_rejects_invalid_state(self):
        """Callback must reject unknown or expired state values."""
        response = self.client.post(
            self.google_callback_url,
            {"code": "fake-code", "state": "invalid-state"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("accounts.oauth.get_google_user_info")
    @patch("accounts.oauth.get_google_token")
    def test_google_callback_sets_refresh_cookie_and_returns_access(
        self,
        mock_get_google_token,
        mock_get_google_user_info,
    ):
        """Successful callback should set refresh cookie and return access token."""
        auth_response = self.client.get(self.google_auth_url)
        valid_state = auth_response.data["state"]

        mock_get_google_token.return_value = {"access_token": "google-access-token"}
        mock_get_google_user_info.return_value = {
            "id": "google-sub-1",
            "email": "googleuser@example.com",
            "name": "Google User",
            "verified_email": True,
        }

        response = self.client.post(
            self.google_callback_url,
            {"code": "valid-code", "state": valid_state},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", response.data)
        self.assertIn("user", response.data)
        self.assertNotIn("refresh_token", response.data)

        self.assertIn(self.refresh_cookie_name, response.cookies)
        self.assertTrue(response.cookies[self.refresh_cookie_name].value)

    @patch("accounts.oauth.get_google_user_info")
    @patch("accounts.oauth.get_google_token")
    def test_google_callback_with_pkce_verifier(
        self,
        mock_get_google_token,
        mock_get_google_user_info,
    ):
        """Callback should accept and pass code_verifier to token exchange."""
        auth_response = self.client.get(
            f"{self.google_auth_url}?code_challenge="
            "iMnq5o6zALKXGivsnlom_0F5_WYda32GHkxlV7mq7hQ&"
            "code_challenge_method=S256"
        )
        valid_state = auth_response.data["state"]

        mock_get_google_token.return_value = {"access_token": "google-access-token"}
        mock_get_google_user_info.return_value = {
            "id": "google-sub-pkce",
            "email": "pkceuser@example.com",
            "name": "PKCE User",
            "verified_email": True,
        }

        response = self.client.post(
            self.google_callback_url,
            {
                "code": "valid-code",
                "state": valid_state,
                "code_verifier": "verifier",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_get_google_token.assert_called_once_with(
            "valid-code", code_verifier="verifier"
        )

    @patch("accounts.oauth.get_google_user_info")
    @patch("accounts.oauth.get_google_token")
    def test_google_callback_consumes_state_after_success(
        self,
        mock_get_google_token,
        mock_get_google_user_info,
    ):
        """A state token should be single-use and rejected after first success."""
        auth_response = self.client.get(self.google_auth_url)
        valid_state = auth_response.data["state"]

        mock_get_google_token.return_value = {"access_token": "google-access-token"}
        mock_get_google_user_info.return_value = {
            "id": "google-sub-single-use",
            "email": "singleuse@example.com",
            "name": "Single Use",
            "verified_email": True,
        }

        first_response = self.client.post(
            self.google_callback_url,
            {"code": "valid-code", "state": valid_state},
            format="json",
        )
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)

        second_response = self.client.post(
            self.google_callback_url,
            {"code": "another-code", "state": valid_state},
            format="json",
        )
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("accounts.oauth.get_google_user_info")
    @patch("accounts.oauth.get_google_token")
    def test_google_callback_rejects_inactive_user(
        self,
        mock_get_google_token,
        mock_get_google_user_info,
    ):
        """Inactive Google-linked users must not receive application tokens."""
        User.objects.create_user(
            username="inactivegoogle",
            email="inactivegoogle@example.com",
            name="Inactive Google User",
            password="StrongPass123!",
            role="user",
            is_active=False,
        )
        auth_response = self.client.get(self.google_auth_url)
        valid_state = auth_response.data["state"]

        mock_get_google_token.return_value = {"access_token": "google-access-token"}
        mock_get_google_user_info.return_value = {
            "id": "google-sub-inactive",
            "email": "inactivegoogle@example.com",
            "name": "Inactive Google User",
            "verified_email": True,
        }

        response = self.client.post(
            self.google_callback_url,
            {"code": "valid-code", "state": valid_state},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn("access_token", response.data)
        self.assertNotIn(self.refresh_cookie_name, response.cookies)


class OAuthLinkingAndProviderManagementTests(TestCase):
    """Tests for provider linking, provider management, and password setup."""

    def setUp(self):
        self.client = APIClient()
        self.google_auth_url = reverse("google-auth-url")
        self.google_connect_auth_url = reverse("google-connect-auth-url")
        self.google_callback_url = reverse("google-oauth-callback")
        self.auth_provider_list_url = reverse("auth-provider-list")
        self.google_disconnect_url = reverse("google-provider-disconnect")
        self.password_set_url = reverse("password-set")
        cache.clear()

    @patch("accounts.oauth.get_google_user_info")
    @patch("accounts.oauth.get_google_token")
    def test_google_sign_in_auto_links_existing_verified_email_user(
        self,
        mock_get_google_token,
        mock_get_google_user_info,
    ):
        """Verified Google email should auto-link to an existing local account."""
        existing_user = User.objects.create_user(
            username="existinglocal",
            email="existinglocal@example.com",
            name="Existing Local",
            password="StrongPass123!",
            role="user",
        )

        auth_response = self.client.get(self.google_auth_url)
        valid_state = auth_response.data["state"]
        mock_get_google_token.return_value = {"access_token": "google-access-token"}
        mock_get_google_user_info.return_value = {
            "id": "google-sub-existing",
            "email": "existinglocal@example.com",
            "name": "Existing Local",
            "verified_email": True,
        }

        response = self.client.post(
            self.google_callback_url,
            {"code": "valid-code", "state": valid_state},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["id"], existing_user.id)
        self.assertEqual(response.data["flow"], "login")
        self.assertTrue(
            UserAuthProvider.objects.filter(
                user=existing_user,
                provider=UserAuthProvider.Provider.GOOGLE,
                provider_user_id="google-sub-existing",
            ).exists()
        )

    @patch("accounts.oauth.get_google_user_info")
    @patch("accounts.oauth.get_google_token")
    def test_google_sign_in_rejects_unverified_email(
        self,
        mock_get_google_token,
        mock_get_google_user_info,
    ):
        """Google sign-in should fail when email is not verified."""
        auth_response = self.client.get(self.google_auth_url)
        valid_state = auth_response.data["state"]
        mock_get_google_token.return_value = {"access_token": "google-access-token"}
        mock_get_google_user_info.return_value = {
            "id": "google-sub-unverified",
            "email": "unverified@example.com",
            "name": "Unverified User",
            "verified_email": False,
        }

        response = self.client.post(
            self.google_callback_url,
            {"code": "valid-code", "state": valid_state},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("verified", str(response.data.get("detail", "")).lower())

    def test_google_connect_start_requires_authentication(self):
        """Authenticated session is required to start provider-link flow."""
        response = self.client.get(self.google_connect_auth_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("accounts.oauth.get_google_user_info")
    @patch("accounts.oauth.get_google_token")
    def test_google_connect_flow_links_provider_to_current_user(
        self,
        mock_get_google_token,
        mock_get_google_user_info,
    ):
        """Authenticated users should be able to connect Google from settings."""
        user = User.objects.create_user(
            username="linkuser",
            email="linkuser@example.com",
            name="Link User",
            password="StrongPass123!",
            role="user",
        )
        self.client.force_authenticate(user=user)

        start_response = self.client.get(self.google_connect_auth_url)
        self.assertEqual(start_response.status_code, status.HTTP_200_OK)
        valid_state = start_response.data["state"]

        mock_get_google_token.return_value = {"access_token": "google-access-token"}
        mock_get_google_user_info.return_value = {
            "id": "google-sub-link",
            "email": "linkuser@example.com",
            "name": "Link User",
            "verified_email": True,
        }

        callback_response = self.client.post(
            self.google_callback_url,
            {"code": "valid-code", "state": valid_state},
            format="json",
        )

        self.assertEqual(callback_response.status_code, status.HTTP_200_OK)
        self.assertEqual(callback_response.data["flow"], "link")
        self.assertEqual(callback_response.data["user"]["id"], user.id)
        self.assertTrue(
            UserAuthProvider.objects.filter(
                user=user,
                provider=UserAuthProvider.Provider.GOOGLE,
                provider_user_id="google-sub-link",
            ).exists()
        )

    def test_auth_provider_list_reports_password_and_provider_state(self):
        """Provider summary endpoint should expose has_password and linked providers."""
        user = User.objects.create_user(
            username="provideruser",
            email="provideruser@example.com",
            name="Provider User",
            password="StrongPass123!",
            role="user",
        )
        UserAuthProvider.objects.create(
            user=user,
            provider=UserAuthProvider.Provider.GOOGLE,
            provider_user_id="google-sub-provider",
            email=user.email,
            email_verified=True,
        )
        self.client.force_authenticate(user=user)

        response = self.client.get(self.auth_provider_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_password"])
        self.assertEqual(len(response.data["providers"]), 1)
        self.assertEqual(response.data["providers"][0]["provider"], "google")

    def test_disconnect_last_provider_without_password_is_blocked(self):
        """OAuth-only users must set a password before removing their last provider."""
        user = User.objects.create_user(
            username="oauthonly",
            email="oauthonly@example.com",
            name="OAuth Only",
            role="user",
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
        UserAuthProvider.objects.create(
            user=user,
            provider=UserAuthProvider.Provider.GOOGLE,
            provider_user_id="google-sub-oauth-only",
            email=user.email,
            email_verified=True,
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(self.google_disconnect_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("last sign-in method", extract_error_text(response))

    def test_oauth_only_user_can_set_password_then_disconnect_google(self):
        """OAuth-only users can set password first, then disconnect Google."""
        user = User.objects.create_user(
            username="setpassword",
            email="setpassword@example.com",
            name="Set Password User",
            role="user",
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
        UserAuthProvider.objects.create(
            user=user,
            provider=UserAuthProvider.Provider.GOOGLE,
            provider_user_id="google-sub-set-password",
            email=user.email,
            email_verified=True,
        )
        self.client.force_authenticate(user=user)

        password_response = self.client.post(
            self.password_set_url,
            {
                "new_password": "Q7v$N3m!p2Lx",
                "confirm_password": "Q7v$N3m!p2Lx",
            },
            format="json",
        )
        self.assertEqual(password_response.status_code, status.HTTP_200_OK)

        disconnect_response = self.client.post(
            self.google_disconnect_url, {}, format="json"
        )
        self.assertEqual(disconnect_response.status_code, status.HTTP_200_OK)

        user.refresh_from_db()
        self.assertTrue(user.has_usable_password())
        self.assertFalse(
            UserAuthProvider.objects.filter(
                user=user, provider=UserAuthProvider.Provider.GOOGLE
            ).exists()
        )

    def test_password_change_requires_current_password_for_existing_password(self):
        """Changing existing password should require current_password."""
        user = User.objects.create_user(
            username="changepass",
            email="changepass@example.com",
            name="Change Password User",
            password="StrongPass123!",
            role="user",
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(
            self.password_set_url,
            {
                "new_password": "Q7v$N3m!p2Lx",
                "confirm_password": "Q7v$N3m!p2Lx",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Current password", extract_error_text(response))


class GoogleOAuthConfigValidationTests(SimpleTestCase):
    """Tests for Google OAuth environment validation."""

    def test_allows_missing_credentials_in_debug(self):
        """Debug mode should allow missing OAuth credentials."""
        validate_google_oauth_config(
            client_id="",
            client_secret="",
            debug=True,
            is_testing=False,
        )

    def test_allows_missing_credentials_while_testing(self):
        """Tests should be able to import OAuth code without real credentials."""
        validate_google_oauth_config(
            client_id="",
            client_secret="",
            debug=False,
            is_testing=True,
        )

    def test_rejects_missing_credentials_in_production(self):
        """Production should fail fast when OAuth credentials are missing."""
        with self.assertRaises(ImproperlyConfigured):
            validate_google_oauth_config(
                client_id="",
                client_secret="",
                debug=False,
                is_testing=False,
            )

    @override_settings(DEBUG=False, IS_TESTING=False)
    @patch("accounts.oauth.GoogleOAuthConfig.CLIENT_ID", "")
    @patch("accounts.oauth.GoogleOAuthConfig.CLIENT_SECRET", "")
    def test_google_auth_endpoint_returns_503_when_oauth_unconfigured(self):
        """Missing Google OAuth config must not prevent app startup."""
        response = self.client.get(reverse("google-auth-url"))

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["detail"], "Google OAuth is not configured.")
