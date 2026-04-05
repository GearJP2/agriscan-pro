"""
Google OAuth 2.0 Integration for Django
Handles OAuth token exchange and user creation/authentication
"""

import os
import secrets
from typing import Optional, Dict, Any
import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

class GoogleOAuthConfig:
    """Google OAuth 2.0 configuration"""
    CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
    CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
    REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5173/auth/google/callback')
    TOKEN_URL = 'https://oauth2.googleapis.com/token'
    USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'


def get_google_token(code: str, state: str) -> Optional[Dict[str, Any]]:
    """
    Exchange authorization code for tokens from Google
    
    Args:
        code: Authorization code from Google
        state: State parameter for CSRF validation
        
    Returns:
        Dict with tokens or None if failed
    """
    try:
        payload = {
            'code': code,
            'client_id': GoogleOAuthConfig.CLIENT_ID,
            'client_secret': GoogleOAuthConfig.CLIENT_SECRET,
            'redirect_uri': GoogleOAuthConfig.REDIRECT_URI,
            'grant_type': 'authorization_code',
        }

        response = requests.post(
            GoogleOAuthConfig.TOKEN_URL,
            data=payload,
            timeout=10
        )

        if response.status_code != 200:
            print(f"Google token exchange failed: {response.text}")
            return None

        return response.json()
    except requests.RequestException as e:
        print(f"Request failed: {e}")
        return None


def get_google_user_info(access_token: str) -> Optional[Dict[str, Any]]:
    """
    Fetch user info from Google using access token
    
    Args:
        access_token: Google access token
        
    Returns:
        Dict with user info or None if failed
    """
    try:
        headers = {'Authorization': f'Bearer {access_token}'}
        response = requests.get(
            GoogleOAuthConfig.USERINFO_URL,
            headers=headers,
            timeout=10
        )

        if response.status_code != 200:
            print(f"Failed to fetch user info: {response.text}")
            return None

        return response.json()
    except requests.RequestException as e:
        print(f"Request failed: {e}")
        return None


def get_or_create_user_from_google(user_info: Dict[str, Any]) -> Optional[User]:
    """
    Get or create user from Google user info
    
    Args:
        user_info: User info dict from Google
        
    Returns:
        User instance or None
    """
    try:
        email = user_info.get('email')
        name = user_info.get('name', email.split('@')[0] if email else 'User')
        
        if not email:
            return None

        # Try to get existing user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email.split('@')[0],
                'name': name,
                'is_active': True,
            }
        )

        if created:
            # Set unusable password for OAuth users
            user.set_unusable_password()
            user.save()
            print(f"Created new user from Google: {email}")

        return user
    except Exception as e:
        print(f"Failed to get/create user: {e}")
        return None


@api_view(['POST'])
@permission_classes([AllowAny])
def google_oauth_callback(request):
    """
    Handle Google OAuth callback
    Exchanges authorization code for tokens and authenticates user
    
    POST /accounts/google-callback/
    {
        "code": "...",
        "state": "..."
    }
    
    Returns:
    {
        "access_token": "...",
        "refresh_token": "...",
        "expires_in": 3600,
        "token_type": "Bearer"
    }
    """
    try:
        code = request.data.get('code')
        state = request.data.get('state')

        if not code or not state:
            return Response(
                {'detail': 'Missing code or state parameter'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Exchange code for tokens
        tokens = get_google_token(code, state)
        if not tokens:
            return Response(
                {'detail': 'Failed to exchange authorization code'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get user info
        access_token = tokens.get('access_token')
        user_info = get_google_user_info(access_token)
        if not user_info:
            return Response(
                {'detail': 'Failed to fetch user information'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create user
        user = get_or_create_user_from_google(user_info)
        if not user:
            return Response(
                {'detail': 'Failed to create user account'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate JWT tokens for our app
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'expires_in': 3600,  # Access token expiration (1 hour)
            'token_type': 'Bearer'
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"OAuth callback error: {e}")
        return Response(
            {'detail': 'Authentication failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def google_auth_url(request):
    """
    Get Google OAuth authorization URL
    
    GET /accounts/google-auth/
    
    Returns:
    {
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?..."
    }
    """
    try:
        state = secrets.token_urlsafe(32)
        
        # Store state in session for CSRF validation (client-side in this case)
        # In production, you might want to store this server-side
        
        params = {
            'client_id': GoogleOAuthConfig.CLIENT_ID,
            'redirect_uri': GoogleOAuthConfig.REDIRECT_URI,
            'response_type': 'code',
            'scope': 'openid profile email',
            'state': state,
            'access_type': 'offline',
            'prompt': 'consent',
        }
        
        from urllib.parse import urlencode
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        
        return Response({
            'auth_url': auth_url,
            'state': state
        }, status=status.HTTP_200_OK)
    except Exception as e:
        print(f"Failed to generate auth URL: {e}")
        return Response(
            {'detail': 'Failed to generate authentication URL'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
