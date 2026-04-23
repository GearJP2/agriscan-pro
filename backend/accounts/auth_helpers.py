"""Authentication helper utilities for cookie-backed JWT and OAuth state."""

from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.core.cache import cache
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

logger = logging.getLogger("agriscan.accounts")

OAUTH_STATE_CACHE_PREFIX = "google_oauth_state"
DEFAULT_OAUTH_STATE_TTL_SECONDS = 300
USER_SECURITY_FIELD_ROLES = {"admin"}
USER_DIRECTORY_VIEW_ROLES = {"admin", "head_researcher", "researcher", "research_assistant"}

ROLE_WEIGHTS = {
    "guest": 0,
    "user": 1,
    "research_assistant": 2,
    "researcher": 3,
    "head_researcher": 4,
    "admin": 5,
}

def build_user_payload(user: Any) -> dict[str, Any]:
    """Return a stable user payload for auth responses."""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "is_active": user.is_active,
    }


def can_manage_user_security_fields(user: Any) -> bool:
    """Return whether the actor has generic admin security field privileges."""
    if not user or not getattr(user, "is_authenticated", False):
        return False

    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True

    return getattr(user, "role", None) in USER_SECURITY_FIELD_ROLES


def can_manage_target_in_hierarchy(actor: Any, target_user: Any, new_role: str | None = None) -> bool:
    """Check if actor can modify the target user based on role weights."""
    if not actor or not target_user:
        return False
        
    actor_weight = ROLE_WEIGHTS.get(getattr(actor, "role", "guest"), 0)
    target_weight = ROLE_WEIGHTS.get(getattr(target_user, "role", "guest"), 0)
    
    # Admins can do anything
    if can_manage_user_security_fields(actor):
        return True
        
    # Can't edit admins if you aren't one
    if getattr(target_user, "role", None) == "admin":
        return False

    # Actor must be equal or higher rank than the target's current rank
    if actor_weight < target_weight:
        return False
        
    # If proposing a new role, the new role cannot be higher than actor's rank
    if new_role and ROLE_WEIGHTS.get(new_role, 0) > actor_weight:
        return False
        
    return True


def can_view_user_directory(user: Any) -> bool:
    """Return whether the actor can view the full user directory."""
    if not user or not getattr(user, "is_authenticated", False):
        return False

    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True

    return getattr(user, "role", None) in USER_DIRECTORY_VIEW_ROLES


def can_access_user_record(actor: Any, target_user: Any) -> bool:
    """Return whether the actor can access a specific user record."""
    if not actor or not getattr(actor, "is_authenticated", False) or not target_user:
        return False

    if can_view_user_directory(actor):
        return True

    return getattr(actor, "id", None) == getattr(target_user, "id", None)


def blacklist_refresh_token(refresh_token: Any) -> bool:
    """Blacklist a single refresh token if possible."""
    if not refresh_token:
        return False

    try:
        refresh_token.blacklist()
        return True
    except AttributeError:
        return False


def blacklist_all_user_tokens(user: Any) -> int:
    """Blacklist every outstanding token for a user and return the count."""
    if not user:
        return 0

    blacklisted_count = 0
    for outstanding_token in OutstandingToken.objects.filter(user=user):  # type: ignore[attr-defined]
        _, created = BlacklistedToken.objects.get_or_create(token=outstanding_token)  # type: ignore[attr-defined]
        if created:
            blacklisted_count += 1

    return blacklisted_count


def get_refresh_cookie_name() -> str:
    """Return the configured refresh-token cookie name."""
    return getattr(settings, "JWT_REFRESH_COOKIE_NAME", "refresh_token")


def get_refresh_cookie_max_age() -> int:
    """Return the configured refresh-token cookie max age in seconds."""
    return int(getattr(settings, "JWT_REFRESH_COOKIE_MAX_AGE", 7 * 24 * 60 * 60))


def get_refresh_cookie_path() -> str:
    """Return the configured refresh-token cookie path."""
    return getattr(settings, "JWT_REFRESH_COOKIE_PATH", "/api/accounts/")


def get_refresh_cookie_samesite() -> str:
    """Return the configured SameSite policy for the refresh cookie."""
    return getattr(settings, "JWT_REFRESH_COOKIE_SAMESITE", "Lax")


def get_refresh_cookie_secure() -> bool:
    """Return whether the refresh cookie should be marked Secure."""
    return bool(getattr(settings, "JWT_REFRESH_COOKIE_SECURE", not settings.DEBUG))


def should_set_httponly_refresh_cookie() -> bool:
    """Return whether refresh tokens should be written to httpOnly cookies."""
    return bool(getattr(settings, "JWT_USE_HTTPONLY_REFRESH_COOKIE", True))


def set_refresh_cookie(response: Any, refresh_token: str) -> None:
    """Attach the refresh token to the response as an httpOnly cookie."""
    if not should_set_httponly_refresh_cookie():
        return

    response.set_cookie(
        key=get_refresh_cookie_name(),
        value=refresh_token,
        max_age=get_refresh_cookie_max_age(),
        httponly=True,
        secure=get_refresh_cookie_secure(),
        samesite=get_refresh_cookie_samesite(),
        path=get_refresh_cookie_path(),
    )


def clear_refresh_cookie(response: Any) -> None:
    """Remove the refresh-token cookie from the client."""
    response.delete_cookie(
        key=get_refresh_cookie_name(),
        path=get_refresh_cookie_path(),
        samesite=get_refresh_cookie_samesite(),
    )


def get_refresh_token_from_request(request: Any) -> str | None:
    """Read a refresh token from the request body first, then cookies."""
    request_data = getattr(request, "data", None)
    if isinstance(request_data, dict):
        body_token = request_data.get("refresh")
        if body_token:
            return body_token

    cookie_token = request.COOKIES.get(get_refresh_cookie_name())
    if cookie_token:
        return cookie_token

    return None


def get_oauth_state_ttl_seconds() -> int:
    """Return the configured cache TTL for OAuth state values."""
    return int(
        getattr(
            settings,
            "GOOGLE_OAUTH_STATE_TTL_SECONDS",
            DEFAULT_OAUTH_STATE_TTL_SECONDS,
        )
    )


def _oauth_state_cache_key(state: str) -> str:
    """Build a cache key for a Google OAuth state token."""
    return f"{OAUTH_STATE_CACHE_PREFIX}:{state}"


def store_oauth_state(state: str) -> None:
    """Store an OAuth state token in cache with a short TTL."""
    cache.set(
        _oauth_state_cache_key(state), True, timeout=get_oauth_state_ttl_seconds()
    )


def validate_and_consume_oauth_state(state: str) -> bool:
    """Validate an OAuth state token and invalidate it after first use."""
    cache_key = _oauth_state_cache_key(state)
    is_valid = bool(cache.get(cache_key))
    if is_valid:
        cache.delete(cache_key)
    else:
        logger.warning("auth.oauth_state.invalid", extra={"state": state})
    return is_valid
