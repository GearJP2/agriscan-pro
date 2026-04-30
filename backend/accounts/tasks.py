from celery import shared_task
import logging
from .services.monitor_sync_service import MonitorSyncService

logger = logging.getLogger("agriscan.accounts")


# ─── Sync (plain function) implementations ────────────────────────────────────
# These can be called directly (sync mode) or via the Celery wrappers below.


def sync_user_to_monitor(email: str) -> bool:
    """
    Sync an authorised email to the AgriScan Monitor KV store.

    Returns True on success, False otherwise.  Safe to call directly when
    ASYNC_TASKS_ENABLED=False (no broker required).
    """
    logger.info("auth.monitor_sync.started", extra={"email": email})
    success = MonitorSyncService.sync_email_to_monitor(email)
    if not success:
        logger.error("auth.monitor_sync.failed", extra={"email": email})
    return success


def remove_user_from_monitor(email: str) -> bool:
    """
    Remove an email from the AgriScan Monitor KV store.

    Safe to call directly when ASYNC_TASKS_ENABLED=False.
    """
    logger.info("auth.monitor_remove.started", extra={"email": email})
    return MonitorSyncService.remove_email_from_monitor(email)


# ─── Celery task wrappers ─────────────────────────────────────────────────────
# These are thin wrappers around the sync functions above.
# When CELERY_TASK_ALWAYS_EAGER=True they run inline anyway.


@shared_task(name="accounts.tasks.sync_user_to_monitor")
def sync_user_to_monitor_task(email: str) -> bool:
    """Background task to sync an authorised email to the Monitor KV store."""
    return sync_user_to_monitor(email)


@shared_task(name="accounts.tasks.remove_user_from_monitor")
def remove_user_from_monitor_task(email: str) -> bool:
    """Background task to remove an email from the Monitor KV store."""
    return remove_user_from_monitor(email)
