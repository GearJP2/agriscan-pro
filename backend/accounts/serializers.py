from typing import Any

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .auth_helpers import can_manage_user_security_fields
from .models import User, UserAuthProvider
from .repositories import UserRepository
from .utils import normalize_email, sanitize_text


def _reject_unsafe_secret(value: str, *, field_name: str) -> str:
    secret = str(value or "")
    if "\x00" in secret:
        raise serializers.ValidationError(
            {field_name: "This field contains invalid characters."}
        )
    if secret != secret.strip():
        raise serializers.ValidationError(
            {field_name: "Leading or trailing whitespace is not allowed."}
        )
    return secret


def _validate_required_clean_text(value: str, *, field_name: str) -> str:
    cleaned = sanitize_text(value)
    if not cleaned:
        raise serializers.ValidationError({field_name: "This field may not be blank."})
    return cleaned


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT login serializer with custom user claims."""

    username = serializers.CharField(write_only=True, required=False)
    email = serializers.EmailField(write_only=True, required=False)

    def get_fields(self) -> dict[str, serializers.Field]:
        fields = super().get_fields()
        username_field = fields.get("username")
        if username_field is not None:
            username_field.required = False
        fields["email"] = serializers.EmailField(write_only=True, required=False)
        return fields

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["email"] = user.email
        token["role"] = user.role
        token["monitor_allowed"] = getattr(user, "can_access_monitor", False)
        return token

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        login_identifier = attrs.get("username") or attrs.get("email")

        if login_identifier:
            attrs = attrs.copy()
            attrs["username"] = str(login_identifier)

            if "@" in str(login_identifier):
                user = User.objects.filter(email__iexact=login_identifier).first()
                if user is not None:
                    attrs["username"] = user.username

        data = dict[str, Any](super().validate(attrs))
        user = self.user
        if user is None:
            raise serializers.ValidationError("Authentication failed.")

        user_payload: dict[str, Any] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "is_active": user.is_active,
        }
        data["user"] = user_payload
        return data


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user management endpoints."""

    class Meta:
        model = User
        fields = ("id", "username", "email", "name", "role", "is_active", "date_joined")
        read_only_fields = ("username", "email", "date_joined")

    def _actor_can_manage_security_fields(self) -> bool:
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        return can_manage_user_security_fields(actor)

    def validate_role(self, value):
        if not self.instance:
            return value

        request = self.context.get("request")
        actor = getattr(request, "user", None)

        if value == self.instance.role:
            return value

        from .auth_helpers import can_manage_target_in_hierarchy
        if not can_manage_target_in_hierarchy(actor, self.instance, value):
            raise serializers.ValidationError("You do not have permission to assign this role.")

        if actor and self.instance.id == actor.id:
            raise serializers.ValidationError("You cannot change your own role.")

        return value

    def validate_is_active(self, value):
        if not self.instance:
            return value

        request = self.context.get("request")
        actor = getattr(request, "user", None)

        if value == self.instance.is_active:
            return value

        from .auth_helpers import can_manage_target_in_hierarchy
        if not can_manage_target_in_hierarchy(actor, self.instance):
            raise serializers.ValidationError("You do not have permission to change account status.")

        if actor and self.instance.id == actor.id and value is False:
            raise serializers.ValidationError("You cannot deactivate your own account.")

        return value


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    verify_password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ("username", "email", "name", "password", "verify_password")
        extra_kwargs = {
            "email": {
                "error_messages": {
                    "unique": "This email is already in use or invalid."
                }
            },
            "username": {
                "error_messages": {
                    "unique": "This username is already taken."
                }
            }
        }

    def validate(self, attrs):
        attrs = attrs.copy()
        attrs["username"] = _validate_required_clean_text(
            attrs.get("username", ""),
            field_name="username",
        )
        attrs["name"] = _validate_required_clean_text(
            attrs.get("name", ""),
            field_name="name",
        )
        attrs["email"] = normalize_email(attrs.get("email", ""))
        attrs["password"] = _reject_unsafe_secret(
            attrs.get("password", ""),
            field_name="password",
        )
        attrs["verify_password"] = _reject_unsafe_secret(
            attrs.get("verify_password", ""),
            field_name="verify_password",
        )

        if attrs["password"] != attrs["verify_password"]:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )

        # Enforce Django password validators (MinimumLength, CommonPassword, etc.)
        try:
            validate_password(attrs["password"], user=None)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})

        return attrs

    def create(self, validated_data):
        validated_data.pop("verify_password")
        email = validated_data["email"]
        # Check if email is in INITIAL_ADMIN_EMAILS whitelist
        is_whitelisted = User.is_whitelisted_admin(email)
        role = "admin" if is_whitelisted else "user"
        user = UserRepository.create_user(
            username=validated_data["username"],
            email=email,
            name=validated_data["name"],
            password=validated_data["password"],
            role=role,
            is_active=True,
        )
        if is_whitelisted:
            from .tasks import sync_user_to_monitor_task
            sync_user_to_monitor_task.delay(email)
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return normalize_email(value)


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=8, trim_whitespace=False)
    confirm_password = serializers.CharField(min_length=8, trim_whitespace=False)

    def validate_email(self, value):
        return normalize_email(value)

    def validate_otp_code(self, value):
        normalized = sanitize_text(value)
        if not normalized.isdigit() or len(normalized) != 6:
            raise serializers.ValidationError("OTP code must be a 6-digit number.")
        return normalized

    def validate(self, attrs):
        attrs = attrs.copy()
        attrs["new_password"] = _reject_unsafe_secret(
            attrs.get("new_password", ""),
            field_name="new_password",
        )
        attrs["confirm_password"] = _reject_unsafe_secret(
            attrs.get("confirm_password", ""),
            field_name="confirm_password",
        )

        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )

        # Enforce Django password validators
        try:
            validate_password(attrs["new_password"], user=None)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})

        return attrs


class ProfileUpdateSerializer(serializers.ModelSerializer):
    current_password = serializers.CharField(
        write_only=True,
        required=False,
        trim_whitespace=False,
    )

    class Meta:
        model = User
        fields = ("name", "email", "current_password")
        extra_kwargs = {
            "email": {"required": False},
            "name": {"required": False},
        }

    def validate(self, attrs):
        attrs = attrs.copy()
        if "name" in attrs:
            attrs["name"] = _validate_required_clean_text(
                attrs["name"], field_name="name"
            )
        if "email" in attrs:
            attrs["email"] = normalize_email(attrs["email"])
        if "current_password" in attrs:
            attrs["current_password"] = _reject_unsafe_secret(
                attrs["current_password"],
                field_name="current_password",
            )

        user = self.instance
        if user is None:
            return attrs

        new_email = attrs.get("email")
        current_password = attrs.get("current_password")

        if new_email and new_email != user.email:
            if not current_password:
                raise serializers.ValidationError(
                    {"current_password": "Password is required to change email."}
                )
            if not user.check_password(current_password):
                raise serializers.ValidationError(
                    {"current_password": "Incorrect password."}
                )

        return attrs


class EmailChangeConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()


class UserAuthProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAuthProvider
        fields = (
            "provider",
            "email",
            "email_verified",
            "linked_at",
            "last_used_at",
        )
        read_only_fields = fields


class AuthProviderSummarySerializer(serializers.Serializer):
    has_password = serializers.BooleanField()
    providers = UserAuthProviderSerializer(many=True)


class SetPasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=False,
        write_only=True,
    )
    new_password = serializers.CharField(
        required=True,
        trim_whitespace=False,
        write_only=True,
    )
    confirm_password = serializers.CharField(
        required=True,
        trim_whitespace=False,
        write_only=True,
    )

    def validate(self, attrs):
        attrs = attrs.copy()
        attrs["current_password"] = _reject_unsafe_secret(
            attrs.get("current_password", ""),
            field_name="current_password",
        )
        attrs["new_password"] = _reject_unsafe_secret(
            attrs.get("new_password", ""),
            field_name="new_password",
        )
        attrs["confirm_password"] = _reject_unsafe_secret(
            attrs.get("confirm_password", ""),
            field_name="confirm_password",
        )

        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        return attrs
