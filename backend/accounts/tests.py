from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import EmailChangeRequest, PasswordResetOTP
from .oauth import validate_google_oauth_config

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


class UserSecurityFieldPermissionTests(TestCase):
    """Tests for the Week 1 role/status permission gate."""

    def setUp(self):
        self.url_name = "user-detail"
        self.staff_user = User.objects.create_user(
            username="staffuser",
            email="staff@example.com",
            name="Staff User",
            password="StrongPass123!",
            role="admin",
            is_staff=True,
        )
        self.researcher_user = User.objects.create_user(
            username="researcher",
            email="researcher@example.com",
            name="Researcher User",
            password="StrongPass123!",
            role="researcher",
        )
        self.head_researcher_user = User.objects.create_user(
            username="headresearcher",
            email="headresearcher@example.com",
            name="Head Researcher User",
            password="StrongPass123!",
            role="head_researcher",
        )
        self.peer_researcher_user = User.objects.create_user(
            username="peerresearcher",
            email="peerresearcher@example.com",
            name="Peer Researcher User",
            password="StrongPass123!",
            role="researcher",
        )
        self.admin_target = User.objects.create_user(
            username="admintarget",
            email="admintarget@example.com",
            name="Admin Target",
            password="StrongPass123!",
            role="admin",
            is_staff=True,
        )
        self.target_user = User.objects.create_user(
            username="targetuser",
            email="target@example.com",
            name="Target User",
            password="StrongPass123!",
            role="user",
        )

    def test_researcher_can_change_lower_rank_users_role(self):
        """Researchers can change roles for lower-rank non-admin users."""
        client = APIClient()
        client.force_authenticate(user=self.researcher_user)

        response = client.patch(
            reverse(self.url_name, kwargs={"pk": self.target_user.pk}),
            {"role": "research_assistant"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.role, "research_assistant")

    def test_staff_can_change_another_users_role(self):
        """Staff users should be allowed to change another user's role."""
        client = APIClient()
        client.force_authenticate(user=self.staff_user)

        response = client.patch(
            reverse(self.url_name, kwargs={"pk": self.target_user.pk}),
            {"role": "research_assistant"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.role, "research_assistant")

    def test_researcher_can_change_lower_rank_account_status(self):
        """Researchers can update account status for lower-rank non-admin users."""
        client = APIClient()
        client.force_authenticate(user=self.researcher_user)

        response = client.patch(
            reverse(self.url_name, kwargs={"pk": self.target_user.pk}),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.target_user.refresh_from_db()
        self.assertFalse(self.target_user.is_active)

    def test_staff_can_change_account_status(self):
        """Staff users should be allowed to activate/deactivate accounts."""
        client = APIClient()
        client.force_authenticate(user=self.staff_user)

        response = client.patch(
            reverse(self.url_name, kwargs={"pk": self.target_user.pk}),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.target_user.refresh_from_db()
        self.assertFalse(self.target_user.is_active)

    def test_head_researcher_can_change_peer_researcher_role(self):
        """Head researchers can manage equal-rank or lower non-admin users."""
        client = APIClient()
        client.force_authenticate(user=self.head_researcher_user)

        response = client.patch(
            reverse(self.url_name, kwargs={"pk": self.peer_researcher_user.pk}),
            {"role": "research_assistant"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.peer_researcher_user.refresh_from_db()
        self.assertEqual(self.peer_researcher_user.role, "research_assistant")

    def test_researcher_cannot_change_admin_account(self):
        """Researchers cannot manage admin targets."""
        client = APIClient()
        client.force_authenticate(user=self.researcher_user)

        response = client.patch(
            reverse(self.url_name, kwargs={"pk": self.admin_target.pk}),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.admin_target.refresh_from_db()
        self.assertTrue(self.admin_target.is_active)

    def test_researcher_cannot_delete_user_account(self):
        """Only admin users can delete accounts."""
        client = APIClient()
        client.force_authenticate(user=self.researcher_user)

        response = client.delete(
            reverse(self.url_name, kwargs={"pk": self.target_user.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(pk=self.target_user.pk).exists())


class UserAccessPermissionTests(TestCase):
    """Tests for generic user endpoint access restrictions."""

    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="staffviewer",
            email="staffviewer@example.com",
            name="Staff Viewer",
            password="StrongPass123!",
            role="admin",
            is_staff=True,
        )
        self.regular_user = User.objects.create_user(
            username="regularuser",
            email="regular@example.com",
            name="Regular User",
            password="StrongPass123!",
            role="user",
        )
        self.researcher_user = User.objects.create_user(
            username="researcherviewer",
            email="researcherviewer@example.com",
            name="Researcher Viewer",
            password="StrongPass123!",
            role="researcher",
        )
        self.head_researcher_user = User.objects.create_user(
            username="headview",
            email="headview@example.com",
            name="Head Viewer",
            password="StrongPass123!",
            role="head_researcher",
        )
        self.research_assistant_user = User.objects.create_user(
            username="assistantviewer",
            email="assistantviewer@example.com",
            name="Assistant Viewer",
            password="StrongPass123!",
            role="research_assistant",
        )
        self.other_user = User.objects.create_user(
            username="otheruser",
            email="other@example.com",
            name="Other User",
            password="StrongPass123!",
            role="user",
        )

    def test_non_staff_cannot_list_users(self):
        """Non-staff users should not be able to view the full user directory."""
        client = APIClient()
        client.force_authenticate(user=self.regular_user)

        response = client.get(reverse("user-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_research_assistant_cannot_list_users(self):
        """Research assistants should not be able to view the full user directory."""
        client = APIClient()
        client.force_authenticate(user=self.research_assistant_user)

        response = client.get(reverse("user-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_researcher_can_list_users(self):
        """Researchers should be able to view the full user directory."""
        client = APIClient()
        client.force_authenticate(user=self.researcher_user)

        response = client.get(reverse("user-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_head_researcher_can_list_users(self):
        """Head researchers should be able to view the full user directory."""
        client = APIClient()
        client.force_authenticate(user=self.head_researcher_user)

        response = client.get(reverse("user-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_staff_can_retrieve_own_user_record(self):
        """A user should still be able to fetch their own user record."""
        client = APIClient()
        client.force_authenticate(user=self.regular_user)

        response = client.get(
            reverse("user-detail", kwargs={"pk": self.regular_user.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.regular_user.id)

    def test_non_staff_cannot_retrieve_another_user_record(self):
        """A user must not be able to fetch another user's record."""
        client = APIClient()
        client.force_authenticate(user=self.regular_user)

        response = client.get(reverse("user-detail", kwargs={"pk": self.other_user.pk}))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_research_assistant_cannot_retrieve_another_user_record(self):
        """Research assistants should not be able to fetch other users' records."""
        client = APIClient()
        client.force_authenticate(user=self.research_assistant_user)

        response = client.get(reverse("user-detail", kwargs={"pk": self.other_user.pk}))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_head_researcher_can_retrieve_another_user_record(self):
        """Head researchers should be able to fetch other users' records."""
        client = APIClient()
        client.force_authenticate(user=self.head_researcher_user)

        response = client.get(reverse("user-detail", kwargs={"pk": self.other_user.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.other_user.id)

    def test_non_staff_cannot_update_another_users_name(self):
        """A user must not be able to update another user's generic account fields."""
        client = APIClient()
        client.force_authenticate(user=self.regular_user)

        response = client.patch(
            reverse("user-detail", kwargs={"pk": self.other_user.pk}),
            {"name": "Tampered Name"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.other_user.refresh_from_db()
        self.assertEqual(self.other_user.name, "Other User")

    def test_generic_user_endpoint_does_not_allow_email_change(self):
        """Generic user updates should not bypass the email verification flow."""
        client = APIClient()
        client.force_authenticate(user=self.regular_user)

        response = client.patch(
            reverse("user-detail", kwargs={"pk": self.regular_user.pk}),
            {"email": "changed@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.regular_user.refresh_from_db()
        self.assertEqual(self.regular_user.email, "regular@example.com")

    def test_staff_can_list_users(self):
        """Staff users should still be able to access the user directory."""
        client = APIClient()
        client.force_authenticate(user=self.staff_user)

        response = client.get(reverse("user-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class PasswordResetSecurityTests(TestCase):
    """Tests for OTP invalidation and password reset hardening."""

    def setUp(self):
        self.client = APIClient()
        self.request_url = reverse("password-reset-request")
        self.confirm_url = reverse("password-reset-confirm")
        self.user = User.objects.create_user(
            username="otpuser",
            email="otp@example.com",
            name="OTP User",
            password="StrongPass123!",
            role="user",
        )

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
            "email": "googleuser@example.com",
            "name": "Google User",
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
            "email": "singleuse@example.com",
            "name": "Single Use",
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
            "email": "inactivegoogle@example.com",
            "name": "Inactive Google User",
        }

        response = self.client.post(
            self.google_callback_url,
            {"code": "valid-code", "state": valid_state},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn("access_token", response.data)
        self.assertNotIn(self.refresh_cookie_name, response.cookies)


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


class AuthorizationTests(TestCase):
    """Tests verifying that protected endpoints enforce authentication."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="authuser",
            email="auth@example.com",
            name="Auth User",
            password="StrongPass123!",
            role="research_assistant",
        )

    def test_protected_endpoint_requires_auth(self):
        """Calling a protected endpoint without credentials should return 401."""
        url = reverse("sample-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_endpoint_allows_authenticated_user(self):
        """An authenticated sample-access role should receive 200."""
        self.client.force_authenticate(user=self.user)
        url = reverse("sample-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)


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
