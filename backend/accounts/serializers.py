from typing import Any

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .auth_helpers import can_manage_user_security_fields
from .models import User
from .repositories import UserRepository


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
    password = serializers.CharField(write_only=True)
    verify_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("username", "email", "name", "password", "verify_password")

    def validate(self, attrs):
        if attrs["password"] != attrs["verify_password"]:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("verify_password")
        return UserRepository.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            name=validated_data["name"],
            password=validated_data["password"],
            is_active=True,
        )


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField(min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        return attrs


class ProfileUpdateSerializer(serializers.ModelSerializer):
    current_password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ("name", "email", "current_password")
        extra_kwargs = {
            "email": {"required": False},
            "name": {"required": False},
        }

    def validate(self, attrs):
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
