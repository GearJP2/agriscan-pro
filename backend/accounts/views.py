from rest_framework import generics, permissions
from rest_framework.response import Response
from .serializers import RegisterSerializer, UserSerializer, CustomTokenObtainPairSerializer
from .repositories import UserRepository, UserActionLogRepository
from rest_framework_simplejwt.views import TokenObtainPairView

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    # Temporarily AllowAny for easy development, typically IsAdminUser
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer
    # CreateAPIView does not need a queryset as long as we don't need to fetch objects
    # but the serializer still needs to be capable of creation.

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
        
        if old_status != updated_user.is_active:
            status_text = "Activated" if updated_user.is_active else "Deactivated"
            UserActionLogRepository.log_action(
                actor=self.request.user,
                target_user=updated_user,
                action='CHANGED_STATUS',
                details=f"{status_text} user account"
            )
