from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User
from .repositories import UserRepository

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['username'] = user.username
        token['email'] = user.email
        token['role'] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data['user'] = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'name': user.name,
            'role': user.role,
            'is_active': user.is_active,
        }
        return data

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'name', 'role', 'is_active', 'date_joined')
        read_only_fields = ('is_active', 'date_joined')
        extra_kwargs = {
            'username': {'read_only': True},
        }

    def validate_role(self, value):
        user = self.context['request'].user
        # Allow Researcher and above to change roles
        # Design choice: Preventing self-promotion to stay safe, but allowing demotion/promotion of others
        if user.role not in ['admin', 'head_researcher', 'researcher']:
            raise serializers.ValidationError("You do not have permission to change roles.")
        
        # If updating self, don't allow role change (prevent accidental lockout or self-elevation)
        if self.instance and self.instance.id == user.id and value != self.instance.role:
            raise serializers.ValidationError("You cannot change your own role.")
            
        return value

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    verify_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'name', 'password', 'verify_password')

    def validate(self, attrs):
        if attrs['password'] != attrs['verify_password']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('verify_password')
        # Use the Repository instead of User.objects.create_user directly
        user = UserRepository.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            name=validated_data['name'],
            password=validated_data['password'],
            is_active=True
        )
        return user
class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField(min_length=8)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return data

class ProfileUpdateSerializer(serializers.ModelSerializer):
    current_password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ('name', 'email', 'current_password')
        extra_kwargs = {
            'email': {'required': False},
            'name': {'required': False},
        }

    def validate(self, data):
        user = self.instance
        new_email = data.get('email')
        current_password = data.get('current_password')

        if new_email and new_email != user.email:
            if not current_password:
                raise serializers.ValidationError({"current_password": "Password is required to change email."})
            if not user.check_password(current_password):
                raise serializers.ValidationError({"current_password": "Incorrect password."})
        
        return data

class EmailChangeConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()
