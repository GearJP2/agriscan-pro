import datetime
import logging
import os
from collections.abc import Mapping, MutableMapping
from typing import Any, cast

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .auth_helpers import (
    blacklist_all_user_tokens,
    blacklist_refresh_token,
    can_access_user_record,
    can_manage_target_in_hierarchy,
    can_manage_user_security_fields,
    can_view_user_directory,
    clear_refresh_cookie,
    get_refresh_token_from_request,
    set_refresh_cookie,
    should_set_httponly_refresh_cookie,
)
from .models import EmailChangeRequest, PasswordResetOTP
from .repositories import UserActionLogRepository, UserRepository
from .serializers import (
    CustomTokenObtainPairSerializer,
    EmailChangeConfirmSerializer,
    PasswordResetRequestSerializer,
    PasswordResetSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .utils import AttemptLimiter, RateLimiter, generate_otp

logger = logging.getLogger("agriscan.accounts")


def _get_mapping_value(mapping: object, key: str, default: Any = None) -> Any:
    """Safely read a value from request/response payload-like objects."""
    if isinstance(mapping, Mapping):
        return mapping.get(key, default)
    return default


def _pop_mutable_mapping_value(
    mapping: object,
    key: str,
    default: Any = None,
) -> Any:
    """Safely pop a value from mutable payload-like objects."""
    if isinstance(mapping, MutableMapping):
        return mapping.pop(key, default)
    return default


class CustomTokenObtainPairView(TokenObtainPairView):
    """Issue an access token in the response and store the refresh token in an httpOnly cookie."""

    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        request_data = cast(object, getattr(request, "data", None))
        username = _get_mapping_value(request_data, "username") or _get_mapping_value(
            request_data,
            "email",
            "unknown",
        )

        if response.status_code != status.HTTP_200_OK:
            logger.warning(
                "user.login.failed",
                extra={"username": username, "reason": "invalid_credentials"},
            )
            return response

        response_data = cast(object, getattr(response, "data", None))
        refresh_token = _get_mapping_value(response_data, "refresh")
        if refresh_token and should_set_httponly_refresh_cookie():
            _pop_mutable_mapping_value(response_data, "refresh", None)
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
            raise AuthenticationFailed("Refresh token missing.")

        serializer = self.get_serializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise AuthenticationFailed(str(exc)) from exc

        response_data = cast(object, dict(serializer.validated_data))

        rotated_refresh_token = _get_mapping_value(response_data, "refresh")
        if rotated_refresh_token:
            if should_set_httponly_refresh_cookie():
                _pop_mutable_mapping_value(response_data, "refresh", None)
            set_refresh_cookie(
                response := Response(
                    cast(dict[str, Any], response_data),
                    status=status.HTTP_200_OK,
                ),
                rotated_refresh_token,
            )
        else:
            response = Response(
                cast(dict[str, Any], response_data),
                status=status.HTTP_200_OK,
            )
            set_refresh_cookie(response, refresh_token)

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
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        logger.info(
            "user.registered",
            extra={"email": user.email, "user_id": str(user.id)},
        )


class UserListView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_queryset(self):
        if not can_view_user_directory(self.request.user):
            raise PermissionDenied("Only staff users can view the user directory.")
        return UserRepository.get_all_users()


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

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

        # Remove the target_user != request.user block for strict admin check, as it's now covered by the hierarchy check.
        # But wait, can users update their own status/role?
        # The frontend blocks self-editing (`preventEdit = isSelf`).
        # To be safe, the backend should also block self-editing of `is_active` and `role`.
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
        if not can_manage_user_security_fields(request.user):
            raise PermissionDenied("Only staff users can delete user accounts.")
        return super().destroy(request, *args, **kwargs)


class RequestOTPView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = UserRepository.get_user_by_email(email)
        if not user:
            return Response(
                {"detail": "If your email is registered, you will receive an OTP."},
                status=status.HTTP_200_OK,
            )

        if not RateLimiter.is_allowed(
            f"otp_request:{user.id}",
            max_requests=3,
            period_seconds=3600,
        ):
            return Response(
                {"detail": "Too many requests. Please try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        otp_code = generate_otp()
        PasswordResetOTP.objects.filter(user=user, used=False).update(used=True)
        PasswordResetOTP.objects.create(
            user=user,
            otp_hash=PasswordResetOTP.hash_otp(otp_code),
            expiry=timezone.now() + datetime.timedelta(minutes=10),
        )

        send_mail(
            "Your AgriScan Pro OTP",
            f"Your OTP for password reset is: {otp_code}. It will expire in 10 minutes.",
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )

        logger.info("user.password_reset_otp_sent", extra={"email": email})
        return Response(
            {"detail": "OTP sent to your email."},
            status=status.HTTP_200_OK,
        )


class ResetPasswordOTPView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        otp_code = serializer.validated_data["otp_code"]
        new_password = serializer.validated_data["new_password"]

        user = UserRepository.get_user_by_email(email)
        if not user:
            return Response(
                {"detail": "Invalid request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not AttemptLimiter.is_allowed(
            f"otp_verify:{user.id}",
            max_attempts=5,
            period_seconds=3600,
        ):
            return Response(
                {"detail": "Too many failed attempts. OTP has been invalidated."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        otp_hash = PasswordResetOTP.hash_otp(otp_code)
        otp_obj = (
            PasswordResetOTP.objects.filter(
                user=user,
                otp_hash=otp_hash,
                used=False,
            )
            .order_by("-created_at")
            .first()
        )

        if not otp_obj or not otp_obj.is_valid():
            return Response(
                {"detail": "Invalid or expired OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()

        otp_obj.used = True
        otp_obj.save(update_fields=["used"])
        PasswordResetOTP.objects.filter(user=user, used=False).exclude(
            pk=otp_obj.pk
        ).update(used=True)

        blacklisted_count = blacklist_all_user_tokens(user)
        AttemptLimiter.reset_attempts(f"otp_verify:{user.id}")

        logger.info(
            "user.password_reset_success",
            extra={"email": email, "blacklisted_tokens": blacklisted_count},
        )
        return Response(
            {"detail": "Password reset successful."},
            status=status.HTTP_200_OK,
        )


class ProfileUpdateView(generics.UpdateAPIView):
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

        new_email = request.data.get("email")
        if new_email and new_email != instance.email:
            EmailChangeRequest.objects.filter(user=instance).delete()

            req = EmailChangeRequest.objects.create(
                user=instance,
                new_email=new_email,
                expiry=timezone.now() + datetime.timedelta(hours=24),
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
    permission_classes = (permissions.AllowAny,)
    serializer_class = EmailChangeConfirmSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]

        req = EmailChangeRequest.objects.filter(token=token).first()

        if not req or not req.is_valid():
            return Response(
                {"detail": "Invalid or expired token."},
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
                {"detail": "This email address is already in use."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                user.email = req.new_email
                user.save(update_fields=["email"])
                req.delete()
        except IntegrityError:
            return Response(
                {"detail": "This email address is already in use."},
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
