import hashlib
import uuid
from typing import cast

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


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
    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("head_researcher", "Head Researcher"),
        ("researcher", "Researcher"),
        ("research_assistant", "Research Assistant"),
        ("user", "User"),
        ("guest", "Guest"),
    )
    name = models.CharField(_("Full Name"), max_length=255)
    email = models.EmailField(_("Email Address"), unique=True)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default="user")

    # We'll use email for logging in as well as username, but username is still required by AbstractUser
    # We can keep the default username field from AbstractUser as unique=True, which is the default.

    objects = CustomUserManager()


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
    def hash_otp(otp_code):
        return hashlib.sha256(otp_code.encode()).hexdigest()

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


