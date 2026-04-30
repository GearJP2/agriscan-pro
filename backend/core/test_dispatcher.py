from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

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
