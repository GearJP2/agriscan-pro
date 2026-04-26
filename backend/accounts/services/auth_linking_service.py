"""Business logic for authentication-provider linking and password setup."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone

from accounts.models import UserAuthProvider
from accounts.utils import normalize_email

User = get_user_model()


class AuthLinkingError(Exception):
    """Base error for account linking operations."""


class MissingGoogleIdentityError(AuthLinkingError):
    """Raised when required Google identity claims are missing."""


class EmailNotVerifiedError(AuthLinkingError):
    """Raised when a Google account email is not verified."""


class ProviderLinkConflictError(AuthLinkingError):
    """Raised when a provider identity conflicts with an existing link."""


class ProviderNotLinkedError(AuthLinkingError):
    """Raised when a user tries to disconnect an unlinked provider."""


class LastAuthMethodRemovalError(AuthLinkingError):
    """Raised when disconnecting would remove the user's last sign-in method."""


class PasswordChangeError(AuthLinkingError):
    """Raised when a password set/change request is invalid."""


@dataclass(frozen=True, slots=True)
class GoogleIdentity:
    provider_user_id: str
    email: str
    email_verified: bool
    name: str


def _build_unique_username_from_email(email: str) -> str:
    """Generate a unique username candidate from an email local-part."""
    base_username = email.split("@")[0][:150] or "googleuser"
    username = base_username
    suffix = 1

    while User.objects.filter(username=username).exclude(email=email).exists():
        candidate = f"{base_username[:140]}-{suffix}"
        username = candidate[:150]
        suffix += 1

    return username


def _parse_google_identity(user_info: dict[str, Any]) -> GoogleIdentity:
    """Normalize Google userinfo payload into an internal identity object."""
    provider_user_id = str(user_info.get("id") or "").strip()
    raw_email = str(user_info.get("email") or "").strip()

    if not provider_user_id or not raw_email:
        raise MissingGoogleIdentityError(
            "Missing required Google account identity fields."
        )

    email = normalize_email(raw_email)
    email_verified = bool(user_info.get("verified_email"))
    name = str(user_info.get("name") or email.split("@")[0]).strip() or "Google User"

    return GoogleIdentity(
        provider_user_id=provider_user_id,
        email=email,
        email_verified=email_verified,
        name=name,
    )


def _update_provider_metadata(
    provider: UserAuthProvider,
    identity: GoogleIdentity,
) -> UserAuthProvider:
    """Persist the latest provider metadata and mark the provider as recently used."""
    provider.email = identity.email
    provider.email_verified = identity.email_verified
    provider.last_used_at = timezone.now()
    provider.save(
        update_fields=["email", "email_verified", "last_used_at", "updated_at"]
    )
    return provider


def _link_google_identity_to_user(
    user: Any,
    identity: GoogleIdentity,
) -> UserAuthProvider:
    """Link a Google identity to a user while enforcing one-to-one constraints."""
    provider_type = UserAuthProvider.Provider.GOOGLE

    with transaction.atomic():
        linked_identity = (
            UserAuthProvider.objects.select_for_update()
            .select_related("user")
            .filter(provider=provider_type, provider_user_id=identity.provider_user_id)
            .first()
        )
        if linked_identity:
            if linked_identity.user_id != user.id:
                raise ProviderLinkConflictError(
                    "This Google account is already linked to another user."
                )
            return _update_provider_metadata(linked_identity, identity)

        existing_user_provider = (
            UserAuthProvider.objects.select_for_update()
            .filter(user=user, provider=provider_type)
            .first()
        )
        if existing_user_provider:
            if existing_user_provider.provider_user_id != identity.provider_user_id:
                raise ProviderLinkConflictError(
                    "A different Google account is already linked to this account."
                )
            return _update_provider_metadata(existing_user_provider, identity)

        created = UserAuthProvider.objects.create(
            user=user,
            provider=provider_type,
            provider_user_id=identity.provider_user_id,
            email=identity.email,
            email_verified=identity.email_verified,
            last_used_at=timezone.now(),
        )
        return created


def resolve_user_for_google_sign_in(user_info: dict[str, Any]) -> Any:
    """
    Resolve the local user for a Google login.

    Rules:
    - Existing provider link wins.
    - Auto-link by email requires Google's `verified_email=true`.
    - New account creation also requires verified email.
    """
    identity = _parse_google_identity(user_info)
    provider_type = UserAuthProvider.Provider.GOOGLE

    existing_provider = (
        UserAuthProvider.objects.select_related("user")
        .filter(provider=provider_type, provider_user_id=identity.provider_user_id)
        .first()
    )
    if existing_provider:
        _update_provider_metadata(existing_provider, identity)
        return existing_provider.user

    if not identity.email_verified:
        raise EmailNotVerifiedError("Google email must be verified to continue.")

    existing_user = User.objects.filter(email__iexact=identity.email).first()
    if existing_user:
        _link_google_identity_to_user(existing_user, identity)
        return existing_user

    username = _build_unique_username_from_email(identity.email)
    user = User.objects.create_user(
        username=username,
        email=identity.email,
        name=identity.name,
        is_active=True,
    )
    user.set_unusable_password()
    user.save(update_fields=["password"])
    _link_google_identity_to_user(user, identity)
    return user


def link_google_identity_to_authenticated_user(user: Any, user_info: dict[str, Any]) -> None:
    """Explicitly connect a Google provider to an already authenticated user."""
    identity = _parse_google_identity(user_info)

    if not identity.email_verified:
        raise EmailNotVerifiedError(
            "Google email must be verified before linking."
        )

    if normalize_email(user.email) != identity.email:
        raise ProviderLinkConflictError(
            "Google account email must match your current account email."
        )

    _link_google_identity_to_user(user, identity)


def disconnect_provider_for_user(user: Any, provider: str) -> None:
    """Disconnect an auth provider if the user will still have another login method."""
    provider_record = UserAuthProvider.objects.filter(
        user=user, provider=provider
    ).first()
    if not provider_record:
        raise ProviderNotLinkedError("Provider is not linked to this account.")

    remaining_provider_count = user.auth_providers.exclude(pk=provider_record.pk).count()
    if remaining_provider_count == 0 and not user.has_usable_password():
        raise LastAuthMethodRemovalError(
            "Cannot disconnect your last sign-in method. Set a password first."
        )

    provider_record.delete()


def set_or_change_password_for_user(
    user: Any,
    *,
    new_password: str,
    current_password: str = "",
) -> bool:
    """
    Set or change a user's password.

    Returns True when the user already had a usable password (change flow),
    and False when this is the first password setup.
    """
    had_usable_password = user.has_usable_password()

    if had_usable_password:
        if not current_password:
            raise PasswordChangeError("Current password is required.")
        if not user.check_password(current_password):
            raise PasswordChangeError("Current password is incorrect.")

    if not new_password:
        raise PasswordChangeError("New password is required.")

    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        raise PasswordChangeError(" ".join(exc.messages)) from exc

    user.set_password(new_password)
    user.save(update_fields=["password"])
    return had_usable_password
