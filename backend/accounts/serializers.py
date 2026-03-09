from rest_framework import serializers
from .models import User
from .repositories import UserRepository

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'name', 'role', 'is_active', 'date_joined')

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
