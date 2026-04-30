"""Google OAuth 2.0 integration with server-side state validation."""

from __future__ import annotations

import base64
import hashlib
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
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .auth_helpers import (
    build_user_payload,
    set_refresh_cookie,
    store_oauth_state,
    validate_and_consume_oauth_state,
)
from .services.auth_linking_service import (
    AuthLinkingError,
    resolve_user_for_google_sign_in,
    link_google_identity_to_authenticated_user,
)

logger = logging.getLogger("agriscan.accounts")
User = get_user_model()
OAUTH_INTENT_LOGIN = "login"
OAUTH_INTENT_LINK = "link"


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


def _require_google_oauth_config() -> Response | None:
    """Return a 503 response when Google OAuth is unavailable, else None."""
    try:
        validate_google_oauth_config(
            client_id=GoogleOAuthConfig.CLIENT_ID,
            client_secret=GoogleOAuthConfig.CLIENT_SECRET,
            debug=settings.DEBUG,
            is_testing=bool(getattr(settings, "IS_TESTING", False)),
        )
    except ImproperlyConfigured as exc:
        logger.warning(
            "auth.google.not_configured",
            extra={"error": str(exc)},
        )
        return Response(
            {"detail": "Google OAuth is not configured."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return None


def _access_token_lifetime_seconds() -> int:
    """Return the configured JWT access-token lifetime in seconds."""
    lifetime = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
    return int(lifetime.total_seconds())


def get_google_token(code: str, code_verifier: str | None = None) -> dict[str, Any] | None:
    """Exchange an authorization code for Google tokens, supporting PKCE."""
    try:
        payload = {
            "code": code,
            "client_id": GoogleOAuthConfig.CLIENT_ID,
            "client_secret": GoogleOAuthConfig.CLIENT_SECRET,
            "redirect_uri": GoogleOAuthConfig.REDIRECT_URI,
            "grant_type": "authorization_code",
        }

        if code_verifier:
            payload["code_verifier"] = code_verifier

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


def _build_google_oauth_url(
    *,
    state: str,
    code_challenge: str | None,
    code_challenge_method: str,
) -> str:
    """Build a Google OAuth URL with optional PKCE challenge params."""
    params = {
        "client_id": GoogleOAuthConfig.CLIENT_ID,
        "redirect_uri": GoogleOAuthConfig.REDIRECT_URI,
        "response_type": "code",
        "scope": "openid profile email",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }

    if code_challenge:
        params["code_challenge"] = code_challenge
        params["code_challenge_method"] = code_challenge_method

    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


def _issue_login_response(
    user: Any,
    *,
    flow: str,
    detail: str | None = None,
) -> Response:
    """Issue app JWT response payload and set refresh cookie."""
    refresh = RefreshToken.for_user(user)
    payload: dict[str, Any] = {
        "access_token": str(refresh.access_token),
        "expires_in": _access_token_lifetime_seconds(),
        "token_type": "Bearer",
        "user": build_user_payload(user),
        "flow": flow,
    }
    if detail:
        payload["detail"] = detail

    response = Response(payload, status=status.HTTP_200_OK)
    set_refresh_cookie(response, str(refresh))
    return response


def _bad_request(detail: str) -> Response:
    """Return a 400 response with a uniform shape."""
    return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)


def _verify_pkce_verifier(verifier: str | None, challenge: str, method: str) -> bool:
    """Verify the code_verifier against the stored code_challenge."""
    if not verifier:
        return False

    if method == "plain":
        return secrets.compare_digest(verifier, challenge)

    if method == "S256":
        try:
            digest = hashlib.sha256(verifier.encode("ascii")).digest()
            # Google/RFC 7636 uses base64url without padding
            computed = base64.urlsafe_b64encode(digest).decode("ascii").replace("=", "")
            return secrets.compare_digest(computed, challenge)
        except Exception:
            return False

    return False


def _extract_callback_inputs(request) -> tuple[str, str, str | None] | Response:
    """Pull the required code/state and optional code_verifier from the request."""
    code = request.data.get("code")
    state = request.data.get("state")
    code_verifier = request.data.get("code_verifier")
    if not code or not state:
        return _bad_request("Missing code or state parameter.")
    return code, state, code_verifier


def _consume_oauth_state(state: str) -> dict | Response:
    """Validate and one-time-consume the OAuth state."""
    state_data = validate_and_consume_oauth_state(state)
    if state_data is None:
        return _bad_request("Invalid or expired OAuth state.")
    return state_data


def _fetch_google_user_info(code: str, code_verifier: str | None) -> dict | Response:
    """Exchange the auth code for tokens and fetch the user's Google profile."""
    google_tokens = get_google_token(code, code_verifier=code_verifier)
    if not google_tokens:
        return _bad_request("Failed to exchange authorization code.")

    access_token = google_tokens.get("access_token")
    if not access_token:
        return _bad_request("Google did not return an access token.")

    user_info = get_google_user_info(access_token)
    if not user_info:
        return _bad_request("Failed to fetch user information.")
    return user_info


def _resolve_user_for_intent(
    state_data: dict, user_info: dict
) -> tuple[Any, str, str | None] | Response:
    """Return (user, flow, detail) for the requested intent, or a 400 Response."""
    intent = state_data.get("intent", OAUTH_INTENT_LOGIN)

    if intent == OAUTH_INTENT_LINK:
        user = User.objects.filter(id=state_data.get("link_user_id")).first()
        if not user:
            return _bad_request("Linking session expired. Please try again.")
        try:
            link_google_identity_to_authenticated_user(user, user_info)
        except AuthLinkingError as exc:
            return _bad_request(str(exc))
        return user, OAUTH_INTENT_LINK, "Google account linked successfully."

    try:
        user = resolve_user_for_google_sign_in(user_info)
    except AuthLinkingError as exc:
        return _bad_request(str(exc))
    return user, OAUTH_INTENT_LOGIN, None


def _reject_inactive(user) -> Response | None:
    """Return 403 if the resolved user has been deactivated."""
    if user.is_active:
        return None
    logger.warning(
        "auth.google.inactive_user_rejected",
        extra={"user_id": user.id, "email": user.email},
    )
    return Response(
        {"detail": "This account is inactive."},
        status=status.HTTP_403_FORBIDDEN,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def google_oauth_callback(request):
    """Exchange a Google auth code for an application JWT session."""
    try:
        config_error = _require_google_oauth_config()
        if config_error is not None:
            return config_error

        inputs = _extract_callback_inputs(request)
        if isinstance(inputs, Response):
            return inputs
        code, state, code_verifier = inputs

        state_data = _consume_oauth_state(state)
        if isinstance(state_data, Response):
            return state_data

        # PKCE Enforcement
        expected_challenge = state_data.get("code_challenge")
        if expected_challenge:
            method = state_data.get("code_challenge_method", "S256")
            if not code_verifier:
                return _bad_request("PKCE verifier is required for this session.")
            if not _verify_pkce_verifier(code_verifier, expected_challenge, method):
                return _bad_request("Invalid PKCE verifier.")

        user_info = _fetch_google_user_info(code, code_verifier)
        if isinstance(user_info, Response):
            return user_info

        resolved = _resolve_user_for_intent(state_data, user_info)
        if isinstance(resolved, Response):
            return resolved
        user, flow, detail = resolved

        inactive_response = _reject_inactive(user)
        if inactive_response is not None:
            return inactive_response

        logger.info(
            "auth.google.callback_success",
            extra={"user_id": user.id, "email": user.email, "flow": flow},
        )
        return _issue_login_response(user, flow=flow, detail=detail)
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
        config_error = _require_google_oauth_config()
        if config_error is not None:
            return config_error

        code_challenge = request.query_params.get("code_challenge")
        code_challenge_method = request.query_params.get(
            "code_challenge_method", "S256"
        )

        state = secrets.token_urlsafe(32)
        store_oauth_state(
            state,
            {
                "intent": OAUTH_INTENT_LOGIN,
                "code_challenge": code_challenge,
                "code_challenge_method": code_challenge_method,
            },
        )
        auth_url = _build_google_oauth_url(
            state=state,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
        )

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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def google_connect_auth_url(request):
    """Return a Google auth URL that links Google to the current account."""
    try:
        config_error = _require_google_oauth_config()
        if config_error is not None:
            return config_error

        code_challenge = request.query_params.get("code_challenge")
        code_challenge_method = request.query_params.get(
            "code_challenge_method", "S256"
        )
        state = secrets.token_urlsafe(32)

        store_oauth_state(
            state,
            {
                "intent": OAUTH_INTENT_LINK,
                "link_user_id": request.user.id,
                "code_challenge": code_challenge,
                "code_challenge_method": code_challenge_method,
            },
        )

        auth_url = _build_google_oauth_url(
            state=state,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
        )

        return Response(
            {"auth_url": auth_url, "state": state},
            status=status.HTTP_200_OK,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "auth.google.connect_auth_url_failed",
            exc_info=True,
            extra={"error": str(exc)},
        )
        return Response(
            {"detail": "Failed to generate Google linking URL."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
