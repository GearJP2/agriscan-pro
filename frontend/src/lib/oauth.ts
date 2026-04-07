/**
 * OAuth utility functions for handling authentication flows
 * Supports Google OAuth 2.0 and other OAuth providers
 */

import API_BASE_URL from '@/config/api';
import { jwtDecode } from 'jwt-decode';

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface GoogleAuthResponse {
  code?: string;
  error?: string;
  state?: string;
}

/**
 * Store auth tokens in localStorage
 * @param tokens - OAuth token response
 */
export const storeAuthTokens = (tokens: OAuthTokenResponse): void => {
  localStorage.setItem('access_token', tokens.access_token);
  if (tokens.refresh_token) {
    localStorage.setItem('refresh_token', tokens.refresh_token);
  }
  localStorage.setItem('token_expires_at', (Date.now() + tokens.expires_in * 1000).toString());
};

/**
 * Retrieve access token from storage
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem('access_token');
};

/**
 * Retrieve refresh token from storage
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem('refresh_token');
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (): boolean => {
  const expiresAt = localStorage.getItem('token_expires_at');
  if (!expiresAt) return true;
  return Date.now() > parseInt(expiresAt);
};

/**
 * Decode JWT token to extract user info
 */
export const decodeToken = (token: string): Record<string, any> => {
  try {
    return jwtDecode(token);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return {};
  }
};

/**
 * Clear all auth tokens from storage
 */
export const clearAuthTokens = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('token_expires_at');
};

/**
 * Generate Google OAuth authorization URL
 * @param state - CSRF protection state parameter (should be random)
 */
export const generateGoogleAuthURL = (state: string): string => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const redirectUri = `${window.location.origin}/auth/google/callback`;
  
  if (!clientId) {
    throw new Error('Google Client ID not configured. See setup guide.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state: state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

/**
 * Generate random state parameter for CSRF protection
 */
export const generateRandomState = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Exchange authorization code for tokens via backend
 */
export const exchangeAuthCode = async (code: string, state: string): Promise<OAuthTokenResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts/google-callback/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Authentication failed');
    }

    const tokens: OAuthTokenResponse = await response.json();
    return tokens;
  } catch (error) {
    console.error('Token exchange failed:', error);
    throw error;
  }
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (): Promise<OAuthTokenResponse> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    return {
      access_token: data.access,
      expires_in: 3600, // 1 hour default
      token_type: 'Bearer',
    };
  } catch (error) {
    console.error('Refresh token failed:', error);
    clearAuthTokens();
    throw error;
  }
};

/**
 * Initialize Google OAuth flow
 * Stores state in sessionStorage and redirects to Google
 */
export const initGoogleOAuth = (): void => {
  try {
    const state = generateRandomState();
    sessionStorage.setItem('oauth_state', state);
    const authURL = generateGoogleAuthURL(state);
    window.location.href = authURL;
  } catch (error) {
    console.error('Failed to initialize Google OAuth:', error);
    alert('Google authentication is not configured. Please contact support.');
  }
};

/**
 * Verify CSRF state parameter
 */
export const verifyState = (returnedState: string): boolean => {
  const storedState = sessionStorage.getItem('oauth_state');
  return storedState === returnedState;
};

/**
 * Handle OAuth callback from redirect
 * Returns tokens or null if error
 */
export const handleOAuthCallback = async (
  code: string,
  state: string
): Promise<OAuthTokenResponse | null> => {
  try {
    // Verify CSRF state
    if (!verifyState(state)) {
      throw new Error('Invalid state parameter - CSRF attack detected');
    }

    // Exchange code for tokens
    const tokens = await exchangeAuthCode(code, state);

    // Store tokens
    storeAuthTokens(tokens);

    // Clear temporary state
    sessionStorage.removeItem('oauth_state');

    return tokens;
  } catch (error) {
    console.error('OAuth callback failed:', error);
    sessionStorage.removeItem('oauth_state');
    return null;
  }
};

/**
 * Configure axios interceptor to handle token refresh
 * Should be called during app initialization
 */
export const setupOAuthInterceptor = (axiosInstance: any): void => {
  axiosInstance.interceptors.response.use(
    (response: any) => response,
    async (error: any) => {
      const originalRequest = error.config;

      // If 401 and we have a refresh token, try to refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const tokens = await refreshAccessToken();
          storeAuthTokens(tokens);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          clearAuthTokens();
          window.location.href = '/auth/login';
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );
};
