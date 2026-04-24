import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse

logger = logging.getLogger("agriscan.middleware")


@dataclass(frozen=True)
class RateLimitState:
    """Rate-limit metadata for the current request window."""

    identifier: str
    request_count: int
    remaining: int
    reset_after: int
    reset_at: int
    blocked: bool


class RateLimitMiddleware:
    API_PATH_PREFIX = "/api/"
    REQUESTS_PER_WINDOW = 100
    WINDOW_SECONDS = 60
    VIOLATION_TTL_SECONDS = 24 * 60 * 60

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not self._should_rate_limit(request):
            return self.get_response(request)

        try:
            rate_limit_state = self._get_rate_limit_state(request)
        except Exception:
            logger.warning(
                "ratelimit.cache_unavailable",
                extra={"path": request.path},
                exc_info=True,
            )
            return self.get_response(request)

        if rate_limit_state.blocked:
            if getattr(request.user, "is_authenticated", False):
                violation_count = self._track_violation(request.user)
                logger.warning(
                    "ratelimit.exceeded",
                    extra={
                        "user": request.user.username,
                        "path": request.path,
                        "violation_count": violation_count,
                    },
                )
            else:
                logger.warning(
                    "ratelimit.exceeded",
                    extra={"ip": rate_limit_state.identifier, "path": request.path},
                )

            response = JsonResponse(
                {
                    "error": {
                        "code": "rate_limit_exceeded",
                        "message": "Rate limit exceeded. Try again later.",
                    },
                    "status": "error",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
                status=429,
            )
            self._apply_rate_limit_headers(response, rate_limit_state, blocked=True)
            return response

        response = self.get_response(request)
        self._apply_rate_limit_headers(response, rate_limit_state, blocked=False)
        return response

    def _should_rate_limit(self, request) -> bool:
        return request.path.startswith(self.API_PATH_PREFIX) and not getattr(
            settings,
            "IS_TESTING",
            False,
        )

    def _get_rate_limit_state(self, request) -> RateLimitState:
        identifier = self._get_identifier(request)
        now = time.time()
        minute = int(now // self.WINDOW_SECONDS)
        reset_after = self._seconds_until_reset(now)
        reset_at = int(now) + reset_after

        request_key = f"rate_limit_{identifier}_{minute}"
        request_count = cache.get(request_key, 0)

        if request_count >= self.REQUESTS_PER_WINDOW:
            return RateLimitState(
                identifier=str(identifier),
                request_count=request_count,
                remaining=0,
                reset_after=reset_after,
                reset_at=reset_at,
                blocked=True,
            )

        updated_request_count = request_count + 1
        cache.set(request_key, updated_request_count, timeout=reset_after)
        remaining = max(0, self.REQUESTS_PER_WINDOW - updated_request_count)

        return RateLimitState(
            identifier=str(identifier),
            request_count=updated_request_count,
            remaining=remaining,
            reset_after=reset_after,
            reset_at=reset_at,
            blocked=False,
        )

    def _get_identifier(self, request) -> str:
        if getattr(request.user, "is_authenticated", False):
            return str(request.user.id)
        return self.get_client_ip(request)

    def _apply_rate_limit_headers(
        self,
        response,
        rate_limit_state: RateLimitState,
        *,
        blocked: bool,
    ) -> None:
        response["X-RateLimit-Limit"] = str(self.REQUESTS_PER_WINDOW)
        response["X-RateLimit-Remaining"] = str(rate_limit_state.remaining)
        response["X-RateLimit-Reset"] = str(rate_limit_state.reset_at)

        if blocked:
            response["Retry-After"] = str(rate_limit_state.reset_after)

    def _seconds_until_reset(self, now: float) -> int:
        elapsed = int(now % self.WINDOW_SECONDS)
        return max(1, self.WINDOW_SECONDS - elapsed)

    def get_client_ip(self, request) -> str:
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "unknown")

    def _track_violation(self, user) -> int:
        try:
            today = date.today().isoformat()
            violation_key = f"violations_{user.id}_{today}"
            violated_this_window_key = (
                f"violated_{user.id}_{int(time.time() // self.WINDOW_SECONDS)}"
            )

            if cache.add(
                violated_this_window_key,
                True,
                timeout=self._seconds_until_reset(time.time()),
            ):
                violations = cache.get(violation_key, 0) + 1
                cache.set(violation_key, violations, timeout=self.VIOLATION_TTL_SECONDS)
                return violations

            return cache.get(violation_key, 0)
        except Exception:
            logger.warning(
                "ratelimit.violation_tracking_unavailable",
                extra={"user": user.id},
                exc_info=True,
            )
            return 0
