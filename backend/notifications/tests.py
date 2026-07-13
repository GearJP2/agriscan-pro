from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from django.contrib.auth import get_user_model
from samples.models import Sample, MycotoxinResult
from notifications.models import Notification
from notifications.services import NotificationService

User = get_user_model()


class NotificationServiceTest(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username="researcher1@example.com",
            email="researcher1@example.com",
            password="testpass",
            role="researcher",
            is_active=True,
        )
        self.user2 = User.objects.create_user(
            username="admin@example.com",
            email="admin@example.com",
            password="testpass",
            role="admin",
            is_active=True,
        )
        self.user3 = User.objects.create_user(
            username="assistant@example.com",
            email="assistant@example.com",
            password="testpass",
            role="research_assistant",
            is_active=True,
        )

    def test_dispatch_single(self):
        notif = NotificationService.dispatch(
            recipient=self.user1,
            notification_type="system",
            title="Test",
            message="Msg",
        )
        self.assertEqual(notif.recipient, self.user1)
        self.assertEqual(Notification.objects.count(), 1)

    def test_dispatch_to_role(self):
        # Dispatch to 'researcher'.
        # Since 'admin' has a higher weight than 'researcher', user2 also gets it.
        # 'research_assistant' has a lower weight, so user3 won't get it.
        created = NotificationService.dispatch_to_role(
            role="researcher",
            notification_type="system",
            title="Broadcast",
            message="Msg",
        )
        self.assertEqual(len(created), 2)
        recipients = [n.recipient for n in created]
        self.assertIn(self.user1, recipients)
        self.assertIn(self.user2, recipients)
        self.assertNotIn(self.user3, recipients)


class NotificationSignalTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="researcher@example.com",
            email="researcher@example.com",
            password="testpass",
            role="researcher",
            is_active=True,
        )
        self.sample = Sample.objects.create(
            sample_id="SMP-1",
            region="North",
            vegetation_variety="Corn",
            collection_date="2026-01-01",
        )

    def test_risk_alert_created_on_critical_result(self):
        # Create a critical result
        MycotoxinResult.objects.create(
            sample=self.sample,
            toxin_type="AFB1",
            value=10.0,
            eu_threshold_low=2.0,
            eu_threshold_high=4.0,
        )
        # Should trigger a notification
        notifs = Notification.objects.filter(recipient=self.user)
        self.assertEqual(notifs.count(), 1)
        self.assertEqual(notifs.first().notification_type, "risk_alert")

    def test_risk_alert_not_created_on_safe_result(self):
        MycotoxinResult.objects.create(
            sample=self.sample,
            toxin_type="DON",
            value=0.5,
            eu_threshold_low=2.0,
            eu_threshold_high=4.0,
        )
        # Safe result, should not trigger
        notifs = Notification.objects.filter(recipient=self.user)
        self.assertEqual(notifs.count(), 0)


class NotificationViewSetTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="user@example.com",
            email="user@example.com",
            password="testpass",
            role="user",
        )
        self.other_user = User.objects.create_user(
            username="other@example.com",
            email="other@example.com",
            password="testpass",
            role="user",
        )
        self.client.force_authenticate(user=self.user)

        self.notif1 = NotificationService.dispatch(
            recipient=self.user,
            notification_type="system",
            title="T1",
            message="M1",
        )
        self.notif2 = NotificationService.dispatch(
            recipient=self.user,
            notification_type="system",
            title="T2",
            message="M2",
        )
        self.other_notif = NotificationService.dispatch(
            recipient=self.other_user,
            notification_type="system",
            title="Other",
            message="Other Msg",
        )

    def test_list_isolates_data(self):
        url = reverse("notification-list")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # No global pagination configured, so it returns a list
        self.assertEqual(len(resp.data), 2)

    def test_list_unauthenticated_rejected(self):
        self.client.force_authenticate(user=None)
        url = reverse("notification-list")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unread_count(self):
        url = reverse("notification-unread-count")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 2)

    def test_mark_read(self):
        url = reverse("notification-mark-read", kwargs={"pk": self.notif1.pk})
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["is_read"])

        # Count should decrease
        url_count = reverse("notification-unread-count")
        resp_count = self.client.get(url_count)
        self.assertEqual(resp_count.data["count"], 1)

    def test_mark_all_read(self):
        url = reverse("notification-mark-all-read")
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["updated"], 2)

        # Count should be 0
        url_count = reverse("notification-unread-count")
        resp_count = self.client.get(url_count)
        self.assertEqual(resp_count.data["count"], 0)
