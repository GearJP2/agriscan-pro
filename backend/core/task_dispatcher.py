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

logger = logging.getLogger("agriscan.tasks")


def async_tasks_enabled() -> bool:
    """Return True when async task processing via Celery is enabled."""
    return bool(getattr(settings, "ASYNC_TASKS_ENABLED", False))


def dispatch_task(
    task: Any,
    sync_func: Callable[..., Any],
    /,
    *args: Any,
    **kwargs: Any,
) -> Any:
    """Dispatch a task either asynchronously (Celery) or synchronously.

    Args:
        task:      The Celery ``@shared_task`` object.
        sync_func: Plain callable that carries the same logic, called when
                   async tasks are disabled.
        *args:     Positional arguments forwarded to whichever path is chosen.
        **kwargs:  Keyword arguments forwarded to whichever path is chosen.

    Returns:
        * An ``AsyncResult`` when async tasks are enabled.
        * The return value of ``sync_func`` when running synchronously.
    """
    if async_tasks_enabled():
        logger.info(
            "task.dispatched.async",
            extra={"task": getattr(task, "name", repr(task))},
        )
        return task.delay(*args, **kwargs)

    logger.info(
        "task.dispatched.sync",
        extra={"task": getattr(sync_func, "__name__", repr(sync_func))},
    )
    return sync_func(*args, **kwargs)
