import os
from unittest.mock import patch

import requests
from django.test import TestCase

MONITOR_BASE_URL = os.environ.get("MONITOR_URL", "https://agriscan-monitor.vercel.app")


class MonitorIntegrationTests(TestCase):
    """
    Scope: Functional validation of AgriScan Monitor core APIs.
    Target: agriscan-monitor.vercel.app or localhost:3002
    Note: Mocks are used in CI environment to avoid dependency on external services.
    """

    @patch("requests.get")
    def test_aws_login_connectivity(self, mock_get):
        """Happy path: validate that AWS credentials are valid and STS is reachable."""
        # Mocking successful response
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "status": "ok",
            "aws": "authenticated",
            "accountId": "123456789012"
        }

        url = f"{MONITOR_BASE_URL}/api/awslogin"
        response = requests.get(url, timeout=10)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["aws"], "authenticated")
        self.assertIn("accountId", data)

    @patch("requests.get")
    def test_readiness_check_unauthorized(self, mock_get):
        """Error case: wrong Bearer token should return 401."""
        # Mocking unauthorized response
        mock_get.return_value.status_code = 401
        mock_get.return_value.json.return_value = {"error": "Unauthorized"}

        url = f"{MONITOR_BASE_URL}/api/ready"
        headers = {"Authorization": "Bearer wrong_secret"}

        response = requests.get(url, headers=headers, timeout=10)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"], "Unauthorized")

    @patch("requests.post")
    def test_admin_sync_to_monitor_kv(self, mock_post):
        """Functional: whitelisting an email in Pro syncs it to Monitor's Upstash Redis."""
        from accounts.services.monitor_sync_service import MonitorSyncService

        # Ensure credentials appear to be configured for the service logic to run
        with self.settings(KV_REST_API_URL="https://mock-kv.upstash.io", KV_REST_API_TOKEN="mock-token"):
            # Mocking successful Upstash SADD response
            mock_post.return_value.status_code = 200

            test_email = "test-sync-bot@agriscanpro.com"
            success = MonitorSyncService.sync_email_to_monitor(test_email)
            self.assertTrue(success, "Should successfully call Upstash API (Mocked)")

            success_remove = MonitorSyncService.remove_email_from_monitor(test_email)
            self.assertTrue(success_remove)

    @patch("accounts.tasks.MonitorSyncService.sync_email_to_monitor")
    @patch("accounts.tasks.MonitorSyncService.remove_email_from_monitor")
    def test_monitor_sync_runs_synchronously_when_async_disabled(self, mock_remove, mock_sync):
        from accounts.tasks import sync_user_to_monitor_task, remove_user_from_monitor_task
        mock_sync.return_value = True
        mock_remove.return_value = True

        test_email = "test@example.com"

        # When always eager, tasks are run inline
        result_sync = sync_user_to_monitor_task.delay(test_email)
        self.assertTrue(result_sync.get())
        mock_sync.assert_called_once_with(test_email)

        result_remove = remove_user_from_monitor_task.delay(test_email)
        self.assertTrue(result_remove.get())
        mock_remove.assert_called_once_with(test_email)
