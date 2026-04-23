from django.urls import path

from .oauth import google_auth_url, google_oauth_callback
from .views import (
    ConfirmEmailChangeView,
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    LogoutView,
    ProfileUpdateView,
    RegisterView,
    RequestOTPView,
    ResetPasswordOTPView,
    UserDetailView,
    UserListView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("login/refresh/", CustomTokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("users/", UserListView.as_view(), name="user-list"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="user-detail"),
    path("profile/", ProfileUpdateView.as_view(), name="profile-update"),
    path(
        "password-reset/request/",
        RequestOTPView.as_view(),
        name="password-reset-request",
    ),
    path(
        "password-reset/confirm/",
        ResetPasswordOTPView.as_view(),
        name="password-reset-confirm",
    ),
    path(
        "email-change/confirm/",
        ConfirmEmailChangeView.as_view(),
        name="email-change-confirm",
    ),
    path("google-auth/", google_auth_url, name="google-auth-url"),
    path("google-callback/", google_oauth_callback, name="google-oauth-callback"),
]
