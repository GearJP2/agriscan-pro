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

    def test_notify_sample_risk_changes_groups_multiple_elevated_toxins(self):
        """Multiple elevated toxins on one sample emit exactly 1 grouped alert per researcher."""
        from notifications.services import notify_sample_risk_changes

        res1 = MycotoxinResult(
            sample=self.sample, toxin_type="AFB1", value=10.0,
            eu_threshold_low=2.0, eu_threshold_high=4.0, risk_level="critical", unit="ug_kg",
        )
        res2 = MycotoxinResult(
            sample=self.sample, toxin_type="DON", value=1500.0,
            eu_threshold_low=500.0, eu_threshold_high=1000.0, risk_level="high", unit="ug_kg",
        )
        res3 = MycotoxinResult(
            sample=self.sample, toxin_type="OTA", value=8.0,
            eu_threshold_low=3.0, eu_threshold_high=5.0, risk_level="critical", unit="ug_kg",
        )

        Notification.objects.all().delete()
        created = notify_sample_risk_changes(
            self.sample,
            [(res1, None), (res2, None), (res3, None)],
        )

        self.assertEqual(len(created), 1)
        notif = Notification.objects.get(recipient=self.user)
        self.assertEqual(notif.notification_type, "risk_alert")
        self.assertIn("Critical Mycotoxins Detected (3 Toxins)", notif.title)
        self.assertIn("tested elevated for 3 toxins", notif.message)
        self.assertIn("AFB1", notif.message)
        self.assertIn("DON", notif.message)
        self.assertIn("OTA", notif.message)
        self.assertEqual(notif.metadata["toxin_count"], 3)
        self.assertEqual(notif.metadata["risk_level"], "critical")
        self.assertEqual(notif.link, f"/samples/{self.sample.id}")

    def test_notify_sample_risk_changes_single_elevated_toxin_matches_single_format(self):
        """A single elevated toxin emits standard single-toxin notification."""
        from notifications.services import notify_sample_risk_changes

        res = MycotoxinResult(
            sample=self.sample, toxin_type="AFB1", value=10.0,
            eu_threshold_low=2.0, eu_threshold_high=4.0, risk_level="critical", unit="ug_kg",
        )

        Notification.objects.all().delete()
        notify_sample_risk_changes(self.sample, [(res, None)])

        notif = Notification.objects.get(recipient=self.user)
        self.assertEqual(notif.title, "Risk Alert: Critical Mycotoxin Detected")
        self.assertIn("tested critical for AFB1", notif.message)
        self.assertEqual(notif.metadata["toxin_type"], "AFB1")

    def test_notify_sample_risk_changes_ignores_safe_and_test_samples(self):
        """Safe results and test samples never generate notifications."""
        from notifications.services import notify_sample_risk_changes

        safe_res = MycotoxinResult(
            sample=self.sample, toxin_type="DON", value=0.5,
            risk_level="low", unit="ug_kg",
        )
        Notification.objects.all().delete()
        notify_sample_risk_changes(self.sample, [(safe_res, None)])
        self.assertFalse(Notification.objects.exists())

        test_sample = Sample.objects.create(
            sample_id="TEST-SMP-99", region="North", vegetation_variety="Corn", collection_date="2026-01-01",
        )
        crit_res = MycotoxinResult(
            sample=test_sample, toxin_type="AFB1", value=50.0,
            risk_level="critical", unit="ug_kg",
        )
        notify_sample_risk_changes(test_sample, [(crit_res, None)])
        self.assertFalse(Notification.objects.exists())


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
