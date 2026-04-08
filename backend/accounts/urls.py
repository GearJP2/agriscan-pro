from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, UserListView, UserDetailView, CustomTokenObtainPairView,
    RequestOTPView, ResetPasswordOTPView, ProfileUpdateView, ConfirmEmailChangeView
)
from .oauth import google_oauth_callback, google_auth_url

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    
    # Profile & Security
    path('profile/', ProfileUpdateView.as_view(), name='profile-update'),
    path('password-reset/request/', RequestOTPView.as_view(), name='password-reset-request'),
    path('password-reset/confirm/', ResetPasswordOTPView.as_view(), name='password-reset-confirm'),
    path('email-change/confirm/', ConfirmEmailChangeView.as_view(), name='email-change-confirm'),
    
    # Google OAuth routes
    path('google-auth/', google_auth_url, name='google-auth-url'),
    path('google-callback/', google_oauth_callback, name='google-oauth-callback'),
]

