from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import User


class UserDeletionTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="admin_boss", email="admin@test.com", password="password123"
        )
        self.target_user = User.objects.create_user(
            username="target_user", email="target@test.com", password="password123", role="user"
        )
        self.url = reverse("user-detail", kwargs={"pk": self.target_user.pk})

    @patch("core.task_dispatcher.dispatch_task")
    def test_delete_active_user_fails(self, mock_dispatch):
        """Verify that deleting an active user is blocked and no sync is called."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(any("must be deactivated" in str(msg) for msg in response.data.values()))
        self.assertTrue(User.objects.filter(pk=self.target_user.pk).exists())
        mock_dispatch.assert_not_called()

    @patch("core.task_dispatcher.dispatch_task")
    def test_delete_deactivated_user_success(self, mock_dispatch):
        """Verify successful deletion of deactivated user and sync trigger."""
        from accounts.tasks import remove_user_from_monitor_task, remove_user_from_monitor

        self.target_user.is_active = False
        self.target_user.save()

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.target_user.pk).exists())
        mock_dispatch.assert_called_once_with(
            remove_user_from_monitor_task, remove_user_from_monitor, self.target_user.email
        )

    def test_delete_self_is_blocked(self):
        """Verify that an admin cannot delete their own account."""
        self.client.force_authenticate(user=self.admin_user)
        self_url = reverse("user-detail", kwargs={"pk": self.admin_user.pk})

        self.admin_user.is_active = False
        self.admin_user.save()

        response = self.client.delete(self_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_admin_cannot_delete(self):
        """Verify that non-admins are blocked from deleting users."""
        other_user = User.objects.create_user(
            username="researcher_user", email="other@test.com", password="password123", role="researcher"
        )
        self.target_user.is_active = False
        self.target_user.save()

        self.client.force_authenticate(user=other_user)
        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
