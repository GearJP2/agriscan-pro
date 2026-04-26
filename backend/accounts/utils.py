import hashlib
import secrets
import string

from django.core.cache import cache


def generate_otp(length=6):
    """Generate a cryptographically secure numeric OTP."""
    return "".join(secrets.choice(string.digits) for _ in range(length))


def hash_data(data):
    """Hash data using SHA-256."""
    return hashlib.sha256(str(data).encode("utf-8")).hexdigest()


def normalize_email(value: str) -> str:
    """Normalize user-provided email input for comparisons and lookups."""
    return str(value or "").strip().lower()


def sanitize_text(value: str) -> str:
    """Trim surrounding whitespace and strip non-printable control characters."""
    raw = str(value or "")
    sanitized = "".join(char for char in raw if char.isprintable())
    return sanitized.strip()


class RateLimiter:
    """
    Simple Redis-based rate limiter.
    """
    @staticmethod
    def is_allowed(key, max_requests, period_seconds):
        """
        Check if a request is allowed based on the rate limit.
        """
        cache_key = f"ratelimit:{key}"
        try:
            current = cache.incr(cache_key)
        except ValueError:
            # Key doesn't exist, set it with initial value and timeout
            cache.set(cache_key, 1, timeout=period_seconds)
            current = 1

        if current > max_requests:
            return False
        return True

    @staticmethod
    def get_remaining_time(key):
        """Get remaining time for the rate limit in seconds."""
        # Django's cache backend doesn't expose TTL; return None to indicate unknown
        return None
        cache_key = f"ratelimit:{key}"
        return cache.ttl(cache_key)

class AttemptLimiter:
    """
    Simple Redis-based attempt limiter (for OTP verification).
    """
    @staticmethod
    def is_allowed(key, max_attempts, period_seconds):

        """
        Record an attempt and return whether the attempt is allowed.
        """
        cache_key = f"attempts:{key}"
        attempts = cache.get(cache_key, 0)
        
        if attempts >= max_attempts:
            return False
            
        if attempts == 0:
            cache.set(cache_key, 1, timeout=period_seconds)
        else:
            cache.incr(cache_key)
            
        return True

    @staticmethod
    def reset_attempts(key):
        """Reset the attempt counter."""
        cache_key = f"attempts:{key}"
        cache.delete(cache_key)
