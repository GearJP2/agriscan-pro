import os
import requests
from django.test import TestCase

# Base URL for the Monitor (defaulting to localhost for local testing)
MONITOR_BASE_URL = os.environ.get("MONITOR_URL", "http://localhost:3002")
READY_SECRET = os.environ.get("READY_SECRET", "test_ready_secret")

class MonitorIntegrationTests(TestCase):
    """
    Scope: Functional validation of AgriScan Monitor core APIs.
    Target: agriscan-monitor.vercel.app or localhost:3002
    """

    def test_aws_login_connectivity(self):
        """
        Happy Path: Validate that AWS credentials are valid and STS is reachable.
        API: GET /api/awslogin (Auth: None)
        """
        url = f"{MONITOR_BASE_URL}/api/awslogin"
        try:
            response = requests.get(url, timeout=10)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "ok")
            self.assertEqual(data["aws"], "authenticated")
            self.assertIn("accountId", data)
        except requests.exceptions.ConnectionError:
            self.fail(f"Could not connect to Monitor at {url}")

    def test_readiness_check_unauthorized(self):
        """
        Error Case: Wrong Bearer token should return 401.
        """
        url = f"{MONITOR_BASE_URL}/api/ready"
        headers = {"Authorization": "Bearer wrong_secret"}
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json()["error"], "Unauthorized")
        except requests.exceptions.ConnectionError:
            self.fail(f"Could not connect to Monitor at {url}")

    def test_admin_sync_to_monitor_kv(self):
        """
        Functional: Verify that whitelisting an email in Pro syncs it to Monitor's Upstash Redis.
        """
        from accounts.services.monitor_sync_service import MonitorSyncService
        
        test_email = "test-sync-bot@agriscanpro.com"
        
        # 1. Trigger sync
        success = MonitorSyncService.sync_email_to_monitor(test_email)
        self.assertTrue(success, "Should successfully call Upstash API")
        
        # 2. Cleanup
        MonitorSyncService.remove_email_from_monitor(test_email)
