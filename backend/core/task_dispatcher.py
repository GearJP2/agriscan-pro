"""
core/task_dispatcher.py
~~~~~~~~~~~~~~~~~~~~~~~
Central helper for dispatching tasks in either async (Celery) or sync mode.

Usage
-----
from core.task_dispatcher import dispatch_task

dispatch_task(
    my_celery_task,          # the @shared_task object (for async path)
    my_sync_function,        # plain callable (for sync path)
    arg1, arg2,              # positional args forwarded to both paths
    kwarg=value,             # keyword args forwarded to both paths
)

When ``ASYNC_TASKS_ENABLED=False`` (default), ``sync_func`` is called directly
in the current request/process.  No broker connection is needed.

When ``ASYNC_TASKS_ENABLED=True``, ``task.delay()`` is called and the result
(an AsyncResult) is returned.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from django.conf import settings
from django.db import transaction

logger = logging.getLogger("agriscan.tasks")


def async_tasks_enabled() -> bool:
    """Return True when async task processing via Celery is enabled."""
    return bool(getattr(settings, "ASYNC_TASKS_ENABLED", False))


def dispatch_task(
    task: Any,
    sync_func: Callable[..., Any] | None = None,
    /,
    *args: Any,
    on_commit: bool = True,
    **kwargs: Any,
) -> Any:
    """Dispatch a task either asynchronously (Celery) or synchronously.

    Args:
        task:      The Celery ``@shared_task`` object.
        sync_func: Plain callable that carries the same logic, called when
                   async tasks are disabled. Defaults to ``task.run`` or ``task`` if omitted.
        *args:     Positional arguments forwarded to whichever path is chosen.
        on_commit: If True (default) and called within an active atomic database
                   transaction, defer task execution until the transaction commits.
        **kwargs:  Keyword arguments forwarded to whichever path is chosen.

    Returns:
        * None when deferred via ``transaction.on_commit``.
        * An ``AsyncResult`` when async tasks are enabled and executed immediately.
        * The return value of ``sync_func`` when running synchronously and immediately.
    """
    def _execute() -> Any:
        if async_tasks_enabled():
            logger.info(
                "task.dispatched.async",
                extra={"task": getattr(task, "name", repr(task))},
            )
            return task.delay(*args, **kwargs)

        target_sync = sync_func if sync_func is not None else getattr(task, "run", task)
        logger.info(
            "task.dispatched.sync",
            extra={"task": getattr(target_sync, "__name__", repr(target_sync))},
        )
        return target_sync(*args, **kwargs)

    if on_commit:
        connection = transaction.get_connection()
        if connection.in_atomic_block:
            logger.debug(
                "task.dispatched.deferred_on_commit",
                extra={"task": getattr(task, "name", repr(task))},
            )
            transaction.on_commit(_execute)
            return None

    return _execute()
