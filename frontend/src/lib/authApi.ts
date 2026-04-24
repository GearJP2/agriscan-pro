import API_BASE_URL from '@/config/api';
import { logger } from '@/lib/logger';
import type { UserRole } from '@/types/user';

export interface AuthenticatedUser {
  id: string | number;
  username: string;
  email: string;
  name: string;
  role: UserRole | 'guest';
  is_active: boolean;
}

export interface LoginResponse {
  access: string;
  user: AuthenticatedUser;
}

export interface RefreshResponse {
  access: string;
}

export interface GoogleOAuthStartResponse {
  auth_url: string;
  state: string;
}

export interface GoogleOAuthCallbackResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  user: AuthenticatedUser;
}

interface ApiErrorEnvelope {
  error?: {
    message?: string;
    details?: Record<string, unknown>;
  };
  detail?: string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

function flattenValidationDetails(details: Record<string, unknown>): string {
  return Object.entries(details)
    .map(([field, value]) => {
      const message = Array.isArray(value) ? value.join(' ') : String(value);
      return `${field}: ${message}`;
    })
    .join('; ');
}

async function parseApiError(response: Response, fallbackMessage: string): Promise<Error> {
  try {
    const data = (await response.json()) as ApiErrorEnvelope;

    if (data?.error?.details && typeof data.error.details === 'object') {
      const detailsMessage = flattenValidationDetails(data.error.details);
      return new Error(detailsMessage || data.error.message || fallbackMessage);
    }

    return new Error(
      data?.error?.message ||
      data?.detail ||
      fallbackMessage
    );
  } catch {
    return new Error(fallbackMessage);
  }
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw await parseApiError(response, fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/accounts/login/`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });

  return parseJsonResponse<LoginResponse>(response, 'Invalid username or password.');
}

export async function refreshSession(): Promise<RefreshResponse> {
  const response = await fetch(`${API_BASE_URL}/accounts/login/refresh/`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({}),
  });

  return parseJsonResponse<RefreshResponse>(response, 'Unable to refresh session.');
}

export async function logoutSession(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts/logout/`, {
      method: 'POST',
      headers: JSON_HEADERS,
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw await parseApiError(response, 'Unable to log out.');
    }
  } catch (error) {
    logger.warn('auth.logout.failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    throw error;
  }
}

export async function fetchCurrentUser(accessToken: string, userId: string | number): Promise<AuthenticatedUser> {
  const response = await fetch(`${API_BASE_URL}/accounts/users/${userId}/`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

  return parseJsonResponse<AuthenticatedUser>(response, 'Failed to fetch user details.');
}

export async function beginGoogleOAuth(): Promise<GoogleOAuthStartResponse> {
  const response = await fetch(`${API_BASE_URL}/accounts/google-auth/`, {
    method: 'GET',
    credentials: 'include',
  });

  return parseJsonResponse<GoogleOAuthStartResponse>(
    response,
    'Failed to initialize Google authentication.'
  );
}

export async function exchangeGoogleAuthCode(
  code: string,
  state: string,
): Promise<GoogleOAuthCallbackResponse> {
  const response = await fetch(`${API_BASE_URL}/accounts/google-callback/`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({ code, state }),
  });

  return parseJsonResponse<GoogleOAuthCallbackResponse>(
    response,
    'Google authentication failed.',
  );
}
