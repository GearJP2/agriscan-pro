import logging
import requests
from django.conf import settings

logger = logging.getLogger("agriscan.accounts")


class MonitorSyncService:
    """
    Handles synchronization of authorized emails to the AgriScan Monitor's
    Vercel KV (Upstash/Redis) store.
    """

    @staticmethod
    def sync_email_to_monitor(email: str) -> bool:
        """
        Adds an email to the 'allowed_emails' set in the Monitor's KV store.
        Returns True if successful, False otherwise.
        """
        url = getattr(settings, "KV_REST_API_URL", None)
        token = getattr(settings, "KV_REST_API_TOKEN", None)

        if not url or not token:
            logger.warning("Monitor sync skipped: KV credentials not configured.")
            return False

        from urllib.parse import quote

        # Upstash Redis REST API: SADD key value
        # We use a set named 'allowed_emails' to match the Monitor's expected logic
        safe_email = quote(email)
        api_url = f"{url.rstrip('/')}/sadd/allowed_emails/{safe_email}"
        headers = {"Authorization": f"Bearer {token}"}

        try:
            response = requests.post(api_url, headers=headers, timeout=5)
            if response.status_code == 200:
                logger.info("auth.monitor_kv_sync.success", extra={"email": email})
                return True
            else:
                logger.error(
                    "auth.monitor_kv_sync.failed",
                    extra={
                        "email": email,
                        "status_code": response.status_code,
                    }
                )
                return False
        except Exception as e:
            logger.error(
                "auth.monitor_kv_sync.error",
                extra={"email": email, "error": str(e)[:200]}
            )
            return False

    @staticmethod
    def remove_email_from_monitor(email: str) -> bool:
        """
        Removes an email from the 'allowed_emails' set in the Monitor's KV store.
        """
        url = getattr(settings, "KV_REST_API_URL", None)
        token = getattr(settings, "KV_REST_API_TOKEN", None)

        if not url or not token:
            return False

        from urllib.parse import quote

        safe_email = quote(email)
        api_url = f"{url.rstrip('/')}/srem/allowed_emails/{safe_email}"
        headers = {"Authorization": f"Bearer {token}"}

        try:
            response = requests.post(api_url, headers=headers, timeout=5)
            return response.status_code == 200
        except Exception:
            return False
