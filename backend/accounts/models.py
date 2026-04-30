import hashlib
import hmac
import uuid
from typing import cast

from django.conf import settings
from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


from .constants import ROLE_CHOICES, USER_ROLE_WEIGHTS


class CustomUserManager(UserManager):
    def create_user(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_active", True)
        return super().create_user(username, email, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", "admin")
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    ROLE_CHOICES = ROLE_CHOICES
    name = models.CharField(_("Full Name"), max_length=255)
    email = models.EmailField(_("Email Address"), unique=True)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default="user")

    # We'll use email for logging in as well as username, but username is still required by AbstractUser
    # We can keep the default username field from AbstractUser as unique=True, which is the default.

    objects = CustomUserManager()

    USER_ROLE_WEIGHTS = USER_ROLE_WEIGHTS

    @property
    def role_weight(self) -> int:
        """Return the numerical priority of the user's current role."""
        return self.USER_ROLE_WEIGHTS.get(self.role, 0)

    @property
    def can_access_monitor(self) -> bool:
        """Check if user role weight meets the requirement for Monitor access."""
        min_role = getattr(settings, "MONITOR_ACCESS_MIN_ROLE", "research_assistant")
        required_weight = self.USER_ROLE_WEIGHTS.get(min_role, 40)
        return self.role_weight >= required_weight

    @staticmethod
    def is_whitelisted_admin(email: str) -> bool:
        """Checks if a given email is whitelisted for automatic Admin role."""
        if not email:
            return False

        initial_admins = getattr(settings, "INITIAL_ADMIN_EMAILS", [])
        return email.lower() in [e.lower() for e in initial_admins]


class UserAuthProvider(models.Model):
    class Provider(models.TextChoices):
        GOOGLE = "google", "Google"

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="auth_providers"
    )
    provider = models.CharField(max_length=32, choices=Provider.choices)
    provider_user_id = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    email_verified = models.BooleanField(default=False)
    linked_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "provider_user_id"],
                name="uq_provider_external_identity",
            ),
            models.UniqueConstraint(
                fields=["user", "provider"],
                name="uq_user_provider",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "provider"]),
            models.Index(fields=["provider", "email"]),
        ]

    def mark_used(self):
        self.last_used_at = timezone.now()
        self.save(update_fields=["last_used_at", "updated_at"])

    def __str__(self):
        return f"{self.user_id}:{self.provider}"


class UserActionLog(models.Model):
    actor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="actions_performed"
    )
    target_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="actions_received"
    )
    action = models.CharField(max_length=50)
    details = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.actor} performed {self.action} on {self.target_user} at {self.timestamp}"


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="password_otps"
    )
    otp_hash = models.CharField(max_length=64)
    expiry = models.DateTimeField()
    used = models.BooleanField(default=False)  # pyright: ignore[reportArgumentType]
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def hash_otp(otp_code: str) -> str:
        key = settings.SECRET_KEY.encode("utf-8")
        return hmac.new(key, otp_code.encode("utf-8"), digestmod=hashlib.sha256).hexdigest()

    def is_valid(self):
        return bool(not self.used and self.expiry > timezone.now())

    def __str__(self):
        user = cast(User, cast(object, self.user))
        return f"OTP for {user.email} (Expires: {self.expiry})"


class EmailChangeRequest(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="email_change_requests"
    )
    new_email = models.EmailField()
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    expiry = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self):
        return bool(self.expiry > timezone.now())

    def __str__(self):
        user = cast(User, cast(object, self.user))
        return f"Email change to {self.new_email} for {user.email}"
