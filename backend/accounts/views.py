from rest_framework import generics, permissions
from rest_framework.response import Response
from .serializers import RegisterSerializer, UserSerializer
from .models import User, UserActionLog
from django.core.cache import cache
from rest_framework_simplejwt.views import TokenObtainPairView

class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        if not username:
            return super().post(request, *args, **kwargs)
            
        cache_key = f"login_attempts_{username}"
        attempts = cache.get(cache_key, 0)
        
        if attempts >= 5:
            return Response(
                {"detail": "Too many failed login attempts. Please wait 1 minute before trying again."}, 
                status=429
            )
            
        try:
            response = super().post(request, *args, **kwargs)
            cache.delete(cache_key)
            return response
        except Exception as e:
            attempts += 1
            cache.set(cache_key, attempts, 60)
            raise e

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    # Temporarily AllowAny for easy development, typically IsAdminUser
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def perform_update(self, serializer):
        user = self.get_object()
        old_role = user.role
        old_status = user.is_active

        updated_user = serializer.save()

        # Log changes
        if old_role != updated_user.role:
            UserActionLog.objects.create(
                actor=self.request.user,
                target_user=updated_user,
                action='CHANGED_ROLE',
                details=f"Changed role from '{old_role}' to '{updated_user.role}'"
            )
        
        if old_status != updated_user.is_active:
            status_text = "Activated" if updated_user.is_active else "Deactivated"
            UserActionLog.objects.create(
                actor=self.request.user,
                target_user=updated_user,
                action='CHANGED_STATUS',
                details=f"{status_text} user account"
            )
