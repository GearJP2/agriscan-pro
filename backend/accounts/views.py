import datetime
import logging
import os
from typing import Any, cast

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import (
    AuthenticationFailed,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from core.permissions import IsAdmin, IsAdminOrResearchRole

from .auth_helpers import (
    blacklist_all_user_tokens,
    blacklist_refresh_token,
    can_access_user_record,
    can_manage_target_in_hierarchy,
    clear_refresh_cookie,
    get_refresh_token_from_request,
    set_refresh_cookie,
    should_set_httponly_refresh_cookie,
)
from .models import EmailChangeRequest, PasswordResetOTP, UserAuthProvider
from .repositories import UserActionLogRepository, UserRepository
from .serializers import (
    AuthProviderSummarySerializer,
    CustomTokenObtainPairSerializer,
    EmailChangeConfirmSerializer,
    PasswordResetRequestSerializer,
    PasswordResetSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    SetPasswordSerializer,
    UserSerializer,
    UserAuthProviderSerializer,
)
from .services.auth_linking_service import (
    LastAuthMethodRemovalError,
    PasswordChangeError,
    ProviderNotLinkedError,
    disconnect_provider_for_user,
    set_or_change_password_for_user,
)
from .utils import (
    AttemptLimiter,
    RateLimiter,
    generate_otp,
    hash_data,
    normalize_email,
)

logger = logging.getLogger("agriscan.accounts")

# ─── Tunable constants ────────────────────────────────────────────────────────
MAX_OTP_REQUESTS = 3
OTP_REQUEST_PERIOD_SEC = 3600
MAX_OTP_VERIFY_ATTEMPTS = 5
OTP_VERIFY_PERIOD_SEC = 3600
OTP_EXPIRY_MINUTES = 10
EMAIL_CHANGE_EXPIRY_HOURS = 24
PASSWORD_RESET_REQUEST_ACCEPTED_MESSAGE = (
    "If your email is registered, you will receive an OTP."
)
INVALID_RESET_CONFIRMATION_MESSAGE = "Invalid or expired OTP."
AUTHENTICATION_FAILED_MESSAGE = "Authentication failed."
TOO_MANY_RESET_ATTEMPTS_MESSAGE = "Too many requests. Please try again later."
EMAIL_CHANGE_CONFIRMATION_FAILED_MESSAGE = "Unable to complete email change request."


def _get_request_fingerprint(request) -> str:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    client_ip = (forwarded_for.split(",")[0] if forwarded_for else request.META.get("REMOTE_ADDR", "")).strip()
    user_agent = request.META.get("HTTP_USER_AGENT", "")
    return hash_data(f"{client_ip}|{user_agent}")


class CustomTokenObtainPairView(TokenObtainPairView):
    """Issue an access token in the response and store the refresh token in an httpOnly cookie."""

    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        username = request.data.get("username") or request.data.get("email", "unknown")

        if response.status_code != status.HTTP_200_OK:
            logger.warning(
                "user.login.failed",
                extra={"username": username, "reason": "invalid_credentials"},
            )
            return response

        response_data = cast(dict[str, Any], response.data)
        refresh_token = response_data.get("refresh")
        if refresh_token and should_set_httponly_refresh_cookie():
            response_data.pop("refresh", None)
            set_refresh_cookie(response, refresh_token)

        logger.info("user.login.success", extra={"username": username})
        return response


class CustomTokenRefreshView(generics.GenericAPIView):
    """Rotate refresh tokens using the httpOnly refresh cookie when available."""

    permission_classes = (permissions.AllowAny,)
    serializer_class = TokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        refresh_token = get_refresh_token_from_request(request)
        if not refresh_token:
            raise AuthenticationFailed(AUTHENTICATION_FAILED_MESSAGE)

        serializer = self.get_serializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise AuthenticationFailed(AUTHENTICATION_FAILED_MESSAGE) from exc

        response_data = cast(dict[str, Any], dict(serializer.validated_data))
        rotated_refresh_token = response_data.get("refresh")
        if not rotated_refresh_token:
            raise AuthenticationFailed(AUTHENTICATION_FAILED_MESSAGE)

        if should_set_httponly_refresh_cookie():
            response_data.pop("refresh", None)

        response = Response(
            cast(dict[str, Any], response_data),
            status=status.HTTP_200_OK,
        )
        set_refresh_cookie(response, cast(str, rotated_refresh_token))

        logger.info("user.token_refreshed")
        return response


class LogoutView(generics.GenericAPIView):
    """Invalidate the current refresh token cookie and clear it from the client."""

    permission_classes = (permissions.AllowAny,)

    def post(self, request, *args, **kwargs):
        refresh_token_value = get_refresh_token_from_request(request)

        if refresh_token_value:
            try:
                refresh_token = RefreshToken(
                    cast(Any, refresh_token_value), verify=False
                )
                blacklist_refresh_token(refresh_token)
            except Exception:
                logger.warning("user.logout.invalid_refresh_token")

        response = Response(
            {"detail": "Logged out successfully."},
            status=status.HTTP_200_OK,
        )
        clear_refresh_cookie(response)
        logger.info("user.logout.success")
        return response


class RegisterView(generics.CreateAPIView):
    """Create a new user account (public endpoint)."""

    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        logger.info(
            "user.registered",
            extra={"email": user.email, "user_id": str(user.id)},
        )


class UserListView(generics.ListAPIView):
    """List all users.  Restricted to admins and research-role users."""

    permission_classes = (permissions.IsAuthenticated, IsAdminOrResearchRole)
    serializer_class = UserSerializer

    def get_queryset(self):
        return UserRepository.get_all_users()


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a single user.

    Retrieval and updates are allowed for the user themselves or a sufficiently
    privileged admin.  Deletion is admin-only.
    """

    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [permissions.IsAuthenticated(), IsAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        return UserRepository.get_all_users()

    def get_object(self):
        user = super().get_object()
        if not can_access_user_record(self.request.user, user):
            raise PermissionDenied("You do not have permission to access this user.")
        return user

    def update(self, request, *args, **kwargs):
        target_user = self.get_object()
        sensitive_fields = {"role", "is_active"}
        requested_sensitive_fields = sensitive_fields & set(request.data.keys())

        if "email" in request.data:
            raise PermissionDenied(
                "Email changes must be completed through the profile verification flow."
            )

        if requested_sensitive_fields:
            new_role = request.data.get("role")
            if not can_manage_target_in_hierarchy(request.user, target_user, new_role):
                raise PermissionDenied(
                    "You do not have permission to modify this user's rank or status hierarchy."
                )

        # Block self-modification of privileged fields.
        if target_user == request.user and requested_sensitive_fields:
            raise PermissionDenied("You cannot modify your own role or account status.")

        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        user = self.get_object()
        old_role = user.role
        old_status = user.is_active
        updated_user = serializer.save()

        if old_role != updated_user.role:
            UserActionLogRepository.log_action(
                actor=self.request.user,
                target_user=updated_user,
                action="CHANGED_ROLE",
                details=(f"Changed role from '{old_role}' to '{updated_user.role}'"),
            )

        if old_status != updated_user.is_active:
            status_text = "Activated" if updated_user.is_active else "Deactivated"
            UserActionLogRepository.log_action(
                actor=self.request.user,
                target_user=updated_user,
                action="CHANGED_STATUS",
                details=f"{status_text} user account",
            )

    def destroy(self, request, *args, **kwargs):
        """
        Enforce deactivation before deletion and sync with Monitor infrastructure.
        Only allowed for Admin-level users.
        """
        instance = self.get_object()

        # Guard: Prevent self-deletion to avoid accidental system lockout
        if instance == request.user:
            raise PermissionDenied("You cannot delete your own account.")

        # Guard: Account must be explicitly deactivated first to prevent accidental loss
        if instance.is_active:
            raise ValidationError(
                {"detail": "User account must be deactivated before it can be deleted."}
            )

        # Log the deletion for audit trails
        logger.info(
            "user.deleted",
            extra={
                "actor": request.user.username,
                "target": instance.email,
                "user_id": str(instance.id)
            }
        )

        # Offload Monitor access removal to Celery background task
        from .tasks import remove_user_from_monitor_task
        remove_user_from_monitor_task.delay(instance.email)

        return super().destroy(request, *args, **kwargs)


class RequestOTPView(generics.GenericAPIView):
    """Send a one-time password to the user's registered email for password reset."""

    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = normalize_email(serializer.validated_data["email"])
        request_key = f"otp_request:{_get_request_fingerprint(request)}"

        if not RateLimiter.is_allowed(
            request_key,
            max_requests=MAX_OTP_REQUESTS,
            period_seconds=OTP_REQUEST_PERIOD_SEC,
        ):
            return Response(
                {"detail": "Too many requests. Please try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = UserRepository.get_user_by_email(email)
        if user:
            otp_code = generate_otp()
            PasswordResetOTP.objects.filter(user=user, used=False).update(used=True)
            PasswordResetOTP.objects.create(
                user=user,
                otp_hash=PasswordResetOTP.hash_otp(otp_code),
                expiry=timezone.now() + datetime.timedelta(minutes=OTP_EXPIRY_MINUTES),
            )

            try:
                send_mail(
                    "Your AgriScan Pro OTP",
                    f"Your OTP for password reset is: {otp_code}. It will expire in {OTP_EXPIRY_MINUTES} minutes.",
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=False,
                )
            except Exception:
                logger.error("email_send_failed", exc_info=True)

            logger.info("user.password_reset_otp_sent", extra={"email": email})

        return Response(
            {"detail": PASSWORD_RESET_REQUEST_ACCEPTED_MESSAGE},
            status=status.HTTP_200_OK,
        )


class ResetPasswordOTPView(generics.GenericAPIView):
    """Verify an OTP and reset the user's password."""

    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetSerializer

    @staticmethod
    def _throttle_or_invalidate(verify_key: str, user) -> Response | None:
        """Return 429 when the OTP attempt budget is exhausted."""
        if AttemptLimiter.is_allowed(
            verify_key,
            max_attempts=MAX_OTP_VERIFY_ATTEMPTS,
            period_seconds=OTP_VERIFY_PERIOD_SEC,
        ):
            return None
        if user:
            PasswordResetOTP.objects.filter(user=user, used=False).update(used=True)
        return Response(
            {"detail": TOO_MANY_RESET_ATTEMPTS_MESSAGE},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    @staticmethod
    def _resolve_valid_otp(user, otp_code: str):
        """Return the live OTP row, or a generic 400 Response when none matches."""
        provided_hash = PasswordResetOTP.hash_otp(otp_code)
        otp_obj = (
            PasswordResetOTP.objects.filter(
                user=user,
                otp_hash=provided_hash,
                used=False,
            )
            .order_by("-created_at")
            .first()
        )
        if not otp_obj or not otp_obj.is_valid():
            return Response(
                {"detail": INVALID_RESET_CONFIRMATION_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return otp_obj

    @staticmethod
    def _apply_password_change(
        user,
        new_password: str,
        otp_obj: PasswordResetOTP,
        verify_key: str,
    ) -> int:
        """Persist the new password, invalidate sibling OTPs, blacklist tokens."""
        user.set_password(new_password)
        user.save()

        otp_obj.used = True
        otp_obj.save(update_fields=["used"])
        PasswordResetOTP.objects.filter(user=user, used=False).exclude(
            pk=otp_obj.pk
        ).update(used=True)

        blacklisted_count = blacklist_all_user_tokens(user)
        AttemptLimiter.reset_attempts(verify_key)
        return blacklisted_count

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = normalize_email(serializer.validated_data["email"])
        otp_code = serializer.validated_data["otp_code"]
        new_password = serializer.validated_data["new_password"]

        verify_key = f"otp_verify:{hash_data(f'{email}|{_get_request_fingerprint(request)}')}"
        user = UserRepository.get_user_by_email(email)

        throttled = self._throttle_or_invalidate(verify_key, user)
        if throttled is not None:
            return throttled

        if not user:
            return Response(
                {"detail": INVALID_RESET_CONFIRMATION_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp_obj = self._resolve_valid_otp(user, otp_code)
        if isinstance(otp_obj, Response):
            return otp_obj

        blacklisted_count = self._apply_password_change(
            user, new_password, otp_obj, verify_key,
        )

        logger.info(
            "user.password_reset_success",
            extra={"email": email, "blacklisted_tokens": blacklisted_count},
        )
        return Response(
            {"detail": "Password reset successful."},
            status=status.HTTP_200_OK,
        )


class ProfileUpdateView(generics.UpdateAPIView):
    """Let the authenticated user update their own profile (name, email).

    Email changes trigger a verification flow — the new address must be
    confirmed before it replaces the old one.
    """

    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = ProfileUpdateSerializer

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        new_email = serializer.validated_data.get("email")
        if new_email and new_email.lower() != instance.email.lower():
            EmailChangeRequest.objects.filter(user=instance).delete()

            req = EmailChangeRequest.objects.create(
                user=instance,
                new_email=new_email,
                expiry=timezone.now() + datetime.timedelta(hours=EMAIL_CHANGE_EXPIRY_HOURS),
            )

            frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
            verification_url = f"{frontend_url}/verify-email?token={req.token}"

            send_mail(
                "Verify your new email - AgriScan Pro",
                f"Click the link to verify your new email: {verification_url}",
                settings.DEFAULT_FROM_EMAIL,
                [new_email],
                fail_silently=False,
            )

            if "name" in serializer.validated_data:
                instance.name = serializer.validated_data["name"]
                instance.save(update_fields=["name"])

            logger.info(
                "user.email_change_requested",
                extra={"user": instance.email, "new_email": new_email},
            )
            return Response(
                {
                    "detail": (
                        "Verification email sent to new address. "
                        "Please confirm to finalize the change."
                    )
                },
                status=status.HTTP_202_ACCEPTED,
            )

        self.perform_update(serializer)
        logger.info(
            "user.profile_updated",
            extra={
                "user": instance.email,
                "fields": list(serializer.validated_data.keys()),
            },
        )
        return Response(serializer.data)


class ConfirmEmailChangeView(generics.GenericAPIView):
    """Finalize an email change by validating the verification token."""

    permission_classes = (permissions.AllowAny,)
    serializer_class = EmailChangeConfirmSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]

        req = EmailChangeRequest.objects.filter(token=token).first()

        if not req or not req.is_valid():
            return Response(
                {"detail": EMAIL_CHANGE_CONFIRMATION_FAILED_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = req.user
        old_email = user.email

        if (
            user.email.lower() != req.new_email.lower()
            and UserRepository.get_user_by_email(req.new_email)
        ):
            req.delete()
            return Response(
                {"detail": EMAIL_CHANGE_CONFIRMATION_FAILED_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                user.email = req.new_email
                user.save(update_fields=["email"])
                req.delete()
        except IntegrityError:
            return Response(
                {"detail": EMAIL_CHANGE_CONFIRMATION_FAILED_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST,
            )

        blacklisted_count = blacklist_all_user_tokens(user)

        logger.info(
            "user.email_updated",
            extra={
                "user": user.username,
                "old": old_email,
                "new": user.email,
                "blacklisted_tokens": blacklisted_count,
            },
        )
        return Response(
            {"detail": f"Email successfully updated to {user.email}"},
            status=status.HTTP_200_OK,
        )


class AuthProviderListView(generics.GenericAPIView):
    """Return linked authentication providers and password availability."""

    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = AuthProviderSummarySerializer

    def get(self, request):
        providers = request.user.auth_providers.order_by("provider")
        payload = {
            "has_password": request.user.has_usable_password(),
            "providers": UserAuthProviderSerializer(
                providers,
                many=True,
            ).data,
        }
        serializer = self.get_serializer(payload)
        return Response(serializer.data, status=status.HTTP_200_OK)


class GoogleProviderDisconnectView(generics.GenericAPIView):
    """Disconnect Google sign-in from the authenticated user account."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            disconnect_provider_for_user(
                request.user,
                provider=UserAuthProvider.Provider.GOOGLE,
            )
        except (ProviderNotLinkedError, LastAuthMethodRemovalError) as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        logger.info(
            "auth.provider.disconnected",
            extra={"user_id": request.user.id, "provider": "google"},
        )
        return Response(
            {"detail": "Google account disconnected."},
            status=status.HTTP_200_OK,
        )


class SetPasswordView(generics.GenericAPIView):
    """Set or change password for the authenticated account."""

    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = SetPasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            had_password = set_or_change_password_for_user(
                request.user,
                new_password=serializer.validated_data["new_password"],
                current_password=serializer.validated_data.get("current_password", ""),
            )
        except PasswordChangeError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        logger.info(
            "auth.password.updated",
            extra={
                "user_id": request.user.id,
                "had_password": had_password,
            },
        )

        # Blacklist all existing sessions and issue a fresh one for the current user
        blacklist_all_user_tokens(request.user)
        new_refresh = RefreshToken.for_user(request.user)

        response = Response(
            {
                "detail": (
                    "Password changed successfully."
                    if had_password
                    else "Password set successfully."
                )
            },
            status=status.HTTP_200_OK,
        )
        if should_set_httponly_refresh_cookie():
            set_refresh_cookie(response, str(new_refresh))

        return response
