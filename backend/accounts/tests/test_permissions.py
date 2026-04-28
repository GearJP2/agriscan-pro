from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


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
