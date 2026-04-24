"""Google OAuth 2.0 integration with server-side state validation."""

from __future__ import annotations

import logging
import os
import secrets
from typing import Any
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .auth_helpers import (
    build_user_payload,
    set_refresh_cookie,
    store_oauth_state,
    validate_and_consume_oauth_state,
)

logger = logging.getLogger("agriscan.accounts")
User = get_user_model()


class GoogleOAuthConfig:
    """Google OAuth 2.0 configuration."""

    CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    REDIRECT_URI = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:5173/auth/google/callback",
    )
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


def validate_google_oauth_config(
    *,
    client_id: str,
    client_secret: str,
    debug: bool,
    is_testing: bool,
) -> None:
    """Require Google OAuth credentials outside debug and test environments."""
    if debug or is_testing:
        return

    missing_settings = []
    if not client_id:
        missing_settings.append("GOOGLE_CLIENT_ID")
    if not client_secret:
        missing_settings.append("GOOGLE_CLIENT_SECRET")

    if missing_settings:
        raise ImproperlyConfigured(
            "Missing required Google OAuth settings: "
            + ", ".join(missing_settings)
        )


validate_google_oauth_config(
    client_id=GoogleOAuthConfig.CLIENT_ID,
    client_secret=GoogleOAuthConfig.CLIENT_SECRET,
    debug=settings.DEBUG,
    is_testing=bool(getattr(settings, "IS_TESTING", False)),
)


def _access_token_lifetime_seconds() -> int:
    """Return the configured JWT access-token lifetime in seconds."""
    lifetime = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
    return int(lifetime.total_seconds())


def get_google_token(code: str) -> dict[str, Any] | None:
    """Exchange an authorization code for Google tokens."""
    try:
        payload = {
            "code": code,
            "client_id": GoogleOAuthConfig.CLIENT_ID,
            "client_secret": GoogleOAuthConfig.CLIENT_SECRET,
            "redirect_uri": GoogleOAuthConfig.REDIRECT_URI,
            "grant_type": "authorization_code",
        }

        response = requests.post(
            GoogleOAuthConfig.TOKEN_URL,
            data=payload,
            timeout=10,
        )

        if response.status_code != status.HTTP_200_OK:
            logger.warning(
                "auth.google.token_exchange_failed",
                extra={"status_code": response.status_code, "response": response.text},
            )
            return None

        return response.json()
    except requests.RequestException as exc:
        logger.error(
            "auth.google.token_exchange_request_failed",
            exc_info=True,
            extra={"error": str(exc)},
        )
        return None


def get_google_user_info(access_token: str) -> dict[str, Any] | None:
    """Fetch Google user information using a Google access token."""
    try:
        response = requests.get(
            GoogleOAuthConfig.USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )

        if response.status_code != status.HTTP_200_OK:
            logger.warning(
                "auth.google.user_info_failed",
                extra={"status_code": response.status_code, "response": response.text},
            )
            return None

        return response.json()
    except requests.RequestException as exc:
        logger.error(
            "auth.google.user_info_request_failed",
            exc_info=True,
            extra={"error": str(exc)},
        )
        return None


def _build_unique_username_from_email(email: str) -> str:
    """Generate a unique username for a Google-authenticated user."""
    base_username = email.split("@")[0][:150] or "googleuser"
    username = base_username
    suffix = 1

    while User.objects.filter(username=username).exclude(email=email).exists():
        candidate = f"{base_username[:140]}-{suffix}"
        username = candidate[:150]
        suffix += 1

    return username


def get_or_create_user_from_google(user_info: dict[str, Any]) -> Any | None:
    """Get or create a local user record from Google user information."""
    try:
        email = user_info.get("email")
        if not email:
            return None

        name = user_info.get("name") or email.split("@")[0]
        username = _build_unique_username_from_email(email)

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": username,
                "name": name,
                "is_active": True,
            },
        )

        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])
            logger.info(
                "auth.google.user_created",
                extra={"email": email, "username": user.username},
            )

        return user
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "auth.google.user_get_or_create_failed",
            exc_info=True,
            extra={"error": str(exc)},
        )
        return None


@api_view(["POST"])
@permission_classes([AllowAny])
def google_oauth_callback(request):
    """
    Exchange a Google auth code for an application JWT session.

    Expected body:
    {
        "code": "...",
        "state": "..."
    }
    """
    try:
        code = request.data.get("code")
        state = request.data.get("state")

        if not code or not state:
            return Response(
                {"detail": "Missing code or state parameter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not validate_and_consume_oauth_state(state):
            return Response(
                {"detail": "Invalid or expired OAuth state."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        google_tokens = get_google_token(code)
        if not google_tokens:
            return Response(
                {"detail": "Failed to exchange authorization code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        google_access_token = google_tokens.get("access_token")
        if not google_access_token:
            return Response(
                {"detail": "Google did not return an access token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_info = get_google_user_info(google_access_token)
        if not user_info:
            return Response(
                {"detail": "Failed to fetch user information."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = get_or_create_user_from_google(user_info)
        if not user:
            return Response(
                {"detail": "Failed to create user account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_active:
            logger.warning(
                "auth.google.inactive_user_rejected",
                extra={"user_id": user.id, "email": user.email},
            )
            return Response(
                {"detail": "This account is inactive."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "access_token": str(refresh.access_token),
                "expires_in": _access_token_lifetime_seconds(),
                "token_type": "Bearer",
                "user": build_user_payload(user),
            },
            status=status.HTTP_200_OK,
        )
        set_refresh_cookie(response, str(refresh))

        logger.info(
            "auth.google.callback_success",
            extra={"user_id": user.id, "email": user.email},
        )
        return response
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "auth.google.callback_unhandled_error",
            exc_info=True,
            extra={"error": str(exc)},
        )
        return Response(
            {"detail": "Authentication failed."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def google_auth_url(request):
    """Return a Google authorization URL with a server-stored state token."""
    try:
        state = secrets.token_urlsafe(32)
        store_oauth_state(state)

        params = {
            "client_id": GoogleOAuthConfig.CLIENT_ID,
            "redirect_uri": GoogleOAuthConfig.REDIRECT_URI,
            "response_type": "code",
            "scope": "openid profile email",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

        return Response(
            {"auth_url": auth_url, "state": state},
            status=status.HTTP_200_OK,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "auth.google.auth_url_failed",
            exc_info=True,
            extra={"error": str(exc)},
        )
        return Response(
            {"detail": "Failed to generate authentication URL."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
