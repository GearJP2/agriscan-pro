import datetime
import logging
import os

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import EmailChangeRequest, PasswordResetOTP
from .repositories import UserRepository, UserActionLogRepository
from .serializers import (
    CustomTokenObtainPairSerializer,
    EmailChangeConfirmSerializer,
    PasswordResetRequestSerializer,
    PasswordResetSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .utils import generate_otp, RateLimiter, AttemptLimiter

logger = logging.getLogger('agriscan.accounts')


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            email = request.data.get('email', 'unknown')
            logger.info('user.login.success', extra={'email': email})
        else:
            email = request.data.get('email', 'unknown')
            logger.warning('user.login.failed', extra={'email': email, 'reason': 'invalid_credentials'})
        return response

class RegisterView(generics.CreateAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        logger.info('user.registered', extra={'email': user.email, 'user_id': str(user.id)})

class UserListView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_queryset(self):
        return UserRepository.get_all_users()

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_queryset(self):
        return UserRepository.get_all_users()

    def perform_update(self, serializer):
        user = self.get_object()
        old_role = user.role
        old_status = user.is_active
        updated_user = serializer.save()
        if old_role != updated_user.role:
            UserActionLogRepository.log_action(actor=self.request.user, target_user=updated_user, action='CHANGED_ROLE', details=f"Changed role from '{old_role}' to '{updated_user.role}'")
        if old_status != updated_user.is_active:
            status_text = "Activated" if updated_user.is_active else "Deactivated"
            UserActionLogRepository.log_action(actor=self.request.user, target_user=updated_user, action='CHANGED_STATUS', details=f"{status_text} user account")


class RequestOTPView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = UserRepository.get_user_by_email(email)
        if not user:
            # Return 200 even if user not found to prevent user enumeration
            return Response({"detail": "If your email is registered, you will receive an OTP."}, status=status.HTTP_200_OK)

        # Rate Limiting: Max 3 OTP requests per hour per user
        if not RateLimiter.is_allowed(f"otp_request:{user.id}", max_requests=3, period_seconds=3600):
            return Response({"detail": "Too many requests. Please try again later."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Generate and store OTP
        otp_code = generate_otp()
        PasswordResetOTP.objects.create(
            user=user,
            otp_hash=PasswordResetOTP.hash_otp(otp_code),
            expiry=timezone.now() + datetime.timedelta(minutes=10)
        )

        # Send Email
        send_mail(
            'Your AgriScan Pro OTP',
            f'Your OTP for password reset is: {otp_code}. It will expire in 10 minutes.',
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )

        logger.info('user.password_reset_otp_sent', extra={'email': email})
        return Response({"detail": "OTP sent to your email."}, status=status.HTTP_200_OK)

class ResetPasswordOTPView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        otp_code = serializer.validated_data['otp_code']
        new_password = serializer.validated_data['new_password']

        user = UserRepository.get_user_by_email(email)
        if not user:
            return Response({"detail": "Invalid request."}, status=status.HTTP_400_BAD_REQUEST)

        # Attempt Limiting: Max 5 verification attempts per user
        if not AttemptLimiter.is_allowed(f"otp_verify:{user.id}", max_attempts=5, period_seconds=3600):
            return Response({"detail": "Too many failed attempts. OTP has been invalidated."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Verify OTP
        otp_hash = PasswordResetOTP.hash_otp(otp_code)
        otp_obj = PasswordResetOTP.objects.filter(user=user, otp_hash=otp_hash, used=False).order_by('-created_at').first()

        if not otp_obj or not otp_obj.is_valid():
            return Response({"detail": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)

        # Update Password
        user.set_password(new_password)
        user.save()

        # Mark OTP as used
        otp_obj.used = True
        otp_obj.save()

        # Blacklist existing tokens (invalidate all sessions)
        tokens = OutstandingToken.objects.filter(user=user)
        for outstanding_token in tokens:
            BlacklistedToken.objects.get_or_create(token=outstanding_token)

        AttemptLimiter.reset_attempts(f"otp_verify:{user.id}")
        logger.info('user.password_reset_success', extra={'email': email})
        return Response({"detail": "Password reset successful."}, status=status.HTTP_200_OK)

class ProfileUpdateView(generics.UpdateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = ProfileUpdateSerializer

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        new_email = request.data.get('email')
        if new_email and new_email != instance.email:
            # Invalidate any previously pending email change requests before creating a new one.
            # Without this, multiple valid verification links could exist simultaneously.
            EmailChangeRequest.objects.filter(user=instance).delete()

            req = EmailChangeRequest.objects.create(
                user=instance,
                new_email=new_email,
                expiry=timezone.now() + datetime.timedelta(hours=24)
            )

            # Use FRONTEND_URL env var to avoid crash when CORS_ALLOW_ALL_ORIGINS=True in dev
            frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
            verification_url = f"{frontend_url}/verify-email?token={req.token}"

            send_mail(
                'Verify your new email - AgriScan Pro',
                f'Click the link to verify your new email: {verification_url}',
                settings.DEFAULT_FROM_EMAIL,
                [new_email],
                fail_silently=False,
            )

            # Save name change immediately if provided alongside the email change
            if 'name' in serializer.validated_data:
                instance.name = serializer.validated_data['name']
                instance.save()

            logger.info('user.email_change_requested', extra={'user': instance.email, 'new_email': new_email})
            return Response({
                "detail": "Verification email sent to new address. Please confirm to finalize the change."
            }, status=status.HTTP_202_ACCEPTED)

        self.perform_update(serializer)
        logger.info('user.profile_updated', extra={'user': instance.email, 'fields': list(serializer.validated_data.keys())})
        return Response(serializer.data)

class ConfirmEmailChangeView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = EmailChangeConfirmSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data['token']

        req = EmailChangeRequest.objects.filter(token=token).first()

        if not req or not req.is_valid():
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

        user = req.user
        old_email = user.email
        user.email = req.new_email
        user.save()

        # Invalidate all existing sessions after email change for security
        tokens = OutstandingToken.objects.filter(user=user)
        for outstanding_token in tokens:
            BlacklistedToken.objects.get_or_create(token=outstanding_token)

        req.delete()

        logger.info('user.email_updated', extra={'user': user.username, 'old': old_email, 'new': user.email})
        return Response({"detail": f"Email successfully updated to {user.email}"}, status=status.HTTP_200_OK)
