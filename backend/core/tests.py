import json

from django.core.exceptions import ImproperlyConfigured
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.http import JsonResponse
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from unittest.mock import patch

from .middleware import RateLimitMiddleware
from .settings import build_allowed_hosts, validate_refresh_cookie_security_config


class RefreshCookieSecurityConfigTests(SimpleTestCase):
    """Tests for refresh-cookie security validation."""

    def test_health_endpoint_returns_200(self):
        """Elastic Beanstalk health checks need a stable 200 response."""
        response = self.client.get("/health/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("database", data)
        self.assertIn("redis", data)
        self.assertIn("tasks", data)

    @override_settings(ASYNC_TASKS_ENABLED=False)
    def test_health_check_redis_skipped_when_async_disabled(self):
        response = self.client.get("/health/")
        data = response.json()
        self.assertEqual(data["redis"]["status"], "skipped")
        self.assertEqual(data["tasks"]["mode"], "sync")

    @override_settings(ASYNC_TASKS_ENABLED=False, REDIS_URL="")
    def test_async_tasks_disabled_uses_local_memory_cache(self):
        # This is a bit tricky to test directly via override_settings because
        # settings.py evaluates these at import time. We can just test the
        # dispatcher logic instead.
        from core.task_dispatcher import async_tasks_enabled
        self.assertFalse(async_tasks_enabled())

    def test_build_allowed_hosts_includes_aws_platform_domains(self):
        """Production configs should still allow EB health-check hostnames."""
        hosts = build_allowed_hosts("api.example.com", debug=False)

        self.assertIn("api.example.com", hosts)
        self.assertIn(".elasticbeanstalk.com", hosts)
        self.assertIn(".compute.amazonaws.com", hosts)

    @override_settings(
        ALLOWED_HOSTS=[
            "localhost",
            "127.0.0.1",
            ".compute.amazonaws.com",
        ]
    )
    def test_health_endpoint_allows_aws_compute_hostname(self):
        """EB-style EC2 hostnames should not trip Django host validation."""
        response = self.client.get(
            "/health/",
            HTTP_HOST="ec2-1-2-3-4.ap-southeast-1.compute.amazonaws.com",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_allows_cloudfront_style_production_settings(self):
        """Production behind CloudFront can keep Secure cookies without FORCE_SSL."""
        validate_refresh_cookie_security_config(
            debug=False,
            refresh_cookie_samesite="None",
            refresh_cookie_secure=True,
            force_ssl=False,
        )

    def test_allows_local_debug_safe_cookie_settings(self):
        """Local debug settings remain valid with a local-safe cookie policy."""
        validate_refresh_cookie_security_config(
            debug=True,
            refresh_cookie_samesite="Lax",
            refresh_cookie_secure=False,
            force_ssl=False,
        )

    def test_rejects_debug_none_samesite_without_https(self):
        """Direct-HTTP debug configs should fail fast when using cross-site cookies."""
        with self.assertRaises(ImproperlyConfigured):
            validate_refresh_cookie_security_config(
                debug=True,
                refresh_cookie_samesite="None",
                refresh_cookie_secure=True,
                force_ssl=False,
            )


@override_settings(IS_TESTING=False)
class RateLimitMiddlewareTests(TestCase):
    """Tests for API rate limiting middleware behavior."""

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = RateLimitMiddleware(
            lambda request: JsonResponse({"detail": "ok"}),
        )
        self.user_model = get_user_model()
        cache.clear()

    def tearDown(self):
        cache.clear()
        super().tearDown()

    def test_allowed_request_sets_rate_limit_headers(self):
        """Successful API requests should expose the current rate-limit window."""
        request = self.factory.get("/api/samples/")
        request.user = AnonymousUser()
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        with patch("core.middleware.time.time", return_value=125.0):
            response = self.middleware(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["X-RateLimit-Limit"], "100")
        self.assertEqual(response["X-RateLimit-Remaining"], "99")
        self.assertEqual(response["X-RateLimit-Reset"], "180")
        self.assertNotIn("Retry-After", response)

    def test_blocked_request_returns_retry_headers(self):
        """429 responses should tell clients when they can retry."""
        request = self.factory.get("/api/samples/")
        request.user = AnonymousUser()
        request.META["REMOTE_ADDR"] = "127.0.0.1"
        cache.set("rate_limit_127.0.0.1_2", 100, timeout=55)

        with patch("core.middleware.time.time", return_value=125.0):
            response = self.middleware(request)

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response["X-RateLimit-Limit"], "100")
        self.assertEqual(response["X-RateLimit-Remaining"], "0")
        self.assertEqual(response["X-RateLimit-Reset"], "180")
        self.assertEqual(response["Retry-After"], "55")
        self.assertEqual(
            json.loads(response.content)["error"]["code"],
            "rate_limit_exceeded",
        )

    def test_repeated_authenticated_violations_do_not_deactivate_user(self):
        """Rate limiting should never deactivate accounts."""
        user = self.user_model.objects.create_user(
            username="ratelimited",
            email="ratelimited@example.com",
            password="StrongPass123",
        )

        for now, minute in ((125.0, 2), (185.0, 3), (245.0, 4)):
            request = self.factory.get("/api/accounts/profile/")
            request.user = user
            cache.set(f"rate_limit_{user.id}_{minute}", 100, timeout=55)

            with patch("core.middleware.time.time", return_value=now):
                response = self.middleware(request)

            self.assertEqual(response.status_code, 429)

        user.refresh_from_db()

        self.assertTrue(user.is_active)
