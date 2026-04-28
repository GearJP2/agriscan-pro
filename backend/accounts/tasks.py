from celery import shared_task
import logging
from .services.monitor_sync_service import MonitorSyncService

logger = logging.getLogger("agriscan.accounts")

@shared_task(name="accounts.tasks.sync_user_to_monitor")
def sync_user_to_monitor_task(email: str):
    """
    Background task to sync an authorized email to the AgriScan Monitor KV store.
    """
    logger.info("auth.monitor_sync.started", extra={"email": email})
    success = MonitorSyncService.sync_email_to_monitor(email)
    if not success:
        # In a real production app, we might want to schedule a retry here
        logger.error("auth.monitor_sync.failed", extra={"email": email})
    return success

@shared_task(name="accounts.tasks.remove_user_from_monitor")
def remove_user_from_monitor_task(email: str):
    """
    Background task to remove an email from the AgriScan Monitor KV store.
    """
    return MonitorSyncService.remove_email_from_monitor(email)
