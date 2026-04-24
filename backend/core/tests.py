from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from .settings import validate_refresh_cookie_security_config


class RefreshCookieSecurityConfigTests(SimpleTestCase):
    """Tests for refresh-cookie security validation."""

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
