import logging
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .serializers import RegisterSerializer, UserSerializer, CustomTokenObtainPairSerializer
from .repositories import UserRepository, UserActionLogRepository
from rest_framework_simplejwt.views import TokenObtainPairView

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
    # Temporarily AllowAny for easy development, typically IsAdminUser
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer
    # CreateAPIView does not need a queryset as long as we don't need to fetch objects
    # but the serializer still needs to be capable of creation.

    def perform_create(self, serializer):
        user = serializer.save()
        logger.info('user.registered', extra={'email': user.email, 'user_id': str(user.id)})

class UserListView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_queryset(self):
        # Using the Repository pattern to fetch all users instead of User.objects.all() directly
        return UserRepository.get_all_users()

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_queryset(self):
        # We still need to return a queryset for the Generic view's get_object() to work properly
        return UserRepository.get_all_users()

    def perform_update(self, serializer):
        user = self.get_object()
        old_role = user.role
        old_status = user.is_active

        updated_user = serializer.save()

        # Log changes using the Repository pattern
        if old_role != updated_user.role:
            UserActionLogRepository.log_action(
                actor=self.request.user,
                target_user=updated_user,
                action='CHANGED_ROLE',
                details=f"Changed role from '{old_role}' to '{updated_user.role}'"
            )
            logger.info('user.updated', extra={'actor': self.request.user.username, 'target': updated_user.email, 'change': 'role', 'old_value': old_role, 'new_value': updated_user.role})

        if old_status != updated_user.is_active:
            status_text = "Activated" if updated_user.is_active else "Deactivated"
            UserActionLogRepository.log_action(
                actor=self.request.user,
                target_user=updated_user,
                action='CHANGED_STATUS',
                details=f"{status_text} user account"
            )
            logger.info('user.updated', extra={'actor': self.request.user.username, 'target': updated_user.email, 'change': 'status', 'old_value': old_status, 'new_value': updated_user.is_active})
