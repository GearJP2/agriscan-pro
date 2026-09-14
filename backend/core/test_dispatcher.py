from unittest.mock import MagicMock, patch

from django.db import transaction
from django.test import SimpleTestCase, TestCase, override_settings

from core.task_dispatcher import async_tasks_enabled, dispatch_task


class TaskDispatcherTests(SimpleTestCase):
    def test_async_tasks_enabled_helper(self):
        with override_settings(ASYNC_TASKS_ENABLED=True):
            self.assertTrue(async_tasks_enabled())

        with override_settings(ASYNC_TASKS_ENABLED=False):
            self.assertFalse(async_tasks_enabled())

    @patch("core.task_dispatcher.async_tasks_enabled")
    def test_dispatch_task_sync_mode(self, mock_enabled):
        """When async tasks are disabled, dispatch_task calls the sync function directly."""
        mock_enabled.return_value = False

        task_mock = MagicMock()
        sync_func_mock = MagicMock()
        sync_func_mock.return_value = "sync_result"

        result = dispatch_task(task_mock, sync_func_mock, "arg1", kwarg="value")

        self.assertEqual(result, "sync_result")
        sync_func_mock.assert_called_once_with("arg1", kwarg="value")
        task_mock.delay.assert_not_called()

    @patch("core.task_dispatcher.async_tasks_enabled")
    def test_dispatch_task_async_mode(self, mock_enabled):
        """When async tasks are enabled, dispatch_task calls task.delay()."""
        mock_enabled.return_value = True

        task_mock = MagicMock()
        task_mock.delay.return_value = "async_result"
        sync_func_mock = MagicMock()

        result = dispatch_task(task_mock, sync_func_mock, "arg2", key="val")

        self.assertEqual(result, "async_result")
        task_mock.delay.assert_called_once_with("arg2", key="val")
        sync_func_mock.assert_not_called()

    def test_celery_import_no_redis_required(self):
        """
        Verify that importing the celery app doesn't crash when Redis is disabled.
        This validates that our fallback memory:// broker configuration works.
        """
        with override_settings(ASYNC_TASKS_ENABLED=False, REDIS_URL=""):
            # If celery connects to redis on import, this would fail.
            # But memory:// broker makes it safe.
            from core.celery import app
            self.assertTrue(app.conf.task_always_eager)
            self.assertEqual(app.conf.broker_url, "memory://")


class TaskDispatcherTransactionTests(TestCase):
    """Tests for transaction.on_commit decoupling in task_dispatcher."""

    @patch("core.task_dispatcher.async_tasks_enabled")
    def test_dispatch_task_in_transaction_defers_to_commit(self, mock_enabled):
        """When in an atomic block, dispatch_task defers execution until commit."""
        mock_enabled.return_value = False
        sync_func_mock = MagicMock()
        task_mock = MagicMock()

        with self.captureOnCommitCallbacks(execute=True):
            with transaction.atomic():
                result = dispatch_task(task_mock, sync_func_mock, "foo")
                # When deferred, dispatch_task returns None and has not yet executed
                self.assertIsNone(result)
                sync_func_mock.assert_not_called()

        # After commit, callback runs
        sync_func_mock.assert_called_once_with("foo")

    @patch("core.task_dispatcher.async_tasks_enabled")
    def test_dispatch_task_in_transaction_skipped_on_rollback(self, mock_enabled):
        """When a transaction rolls back, deferred task is never executed."""
        mock_enabled.return_value = False
        sync_func_mock = MagicMock()
        task_mock = MagicMock()

        with self.captureOnCommitCallbacks(execute=True):
            try:
                with transaction.atomic():
                    dispatch_task(task_mock, sync_func_mock, "bar")
                    raise RuntimeError("simulated rollback")
            except RuntimeError:
                pass

        sync_func_mock.assert_not_called()

    @patch("core.task_dispatcher.async_tasks_enabled")
    def test_dispatch_task_with_on_commit_false_runs_immediately(self, mock_enabled):
        """When on_commit=False, task runs immediately even inside an atomic block."""
        mock_enabled.return_value = False
        sync_func_mock = MagicMock(return_value="immediate")
        task_mock = MagicMock()

        with transaction.atomic():
            result = dispatch_task(task_mock, sync_func_mock, "baz", on_commit=False)
            self.assertEqual(result, "immediate")
            sync_func_mock.assert_called_once_with("baz")

    @patch("core.task_dispatcher.async_tasks_enabled")
    def test_dispatch_task_sync_func_fallback_to_task_run(self, mock_enabled):
        """When sync_func is None, dispatch_task falls back to task.run."""
        mock_enabled.return_value = False
        task_mock = MagicMock()
        task_mock.run.return_value = "fallback_result"

        result = dispatch_task(task_mock, None, "arg", on_commit=False)
        self.assertEqual(result, "fallback_result")
        task_mock.run.assert_called_once_with("arg")
