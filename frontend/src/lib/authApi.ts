import axios from "axios";

import { apiClient, publicApiClient } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/types/user";

export interface AuthenticatedUser {
  id: string | number;
  username: string;
  email: string;
  name: string;
  role: UserRole | 'guest';
  is_active: boolean;
  is_monitor_allowed: boolean;
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

export interface LinkedAuthProvider {
  provider: string;
  email: string;
  email_verified: boolean;
  linked_at: string;
  last_used_at: string | null;
}

export interface AuthProviderSummary {
  has_password: boolean;
  providers: LinkedAuthProvider[];
}

export interface GoogleOAuthCallbackResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  user: AuthenticatedUser;
  flow?: "login" | "link";
  detail?: string;
}

export interface RegisterRequest {
  name: string;
  username: string;
  email: string;
  password: string;
  verify_password: string;
}

interface ApiErrorEnvelope extends Record<string, unknown> {
  error?: {
    message?: string;
    details?: Record<string, unknown>;
  };
  detail?: string;
}

function flattenValidationDetails(details: Record<string, unknown>): string {
  return Object.entries(details)
    .map(([field, value]) => {
      const message = Array.isArray(value) ? value.join(" ") : String(value);
      return `${field}: ${message}`;
    })
    .join("; ");
}

function flattenTopLevelApiErrors(data: ApiErrorEnvelope): string {
  return Object.entries(data)
    .filter(
      ([field]) =>
        !["error", "detail", "status", "timestamp"].includes(field),
    )
    .map(([field, value]) => {
      const message = Array.isArray(value) ? value.join(" ") : String(value);
      return `${field}: ${message}`;
    })
    .join("; ");
}

function toApiError(error: unknown, fallbackMessage: string): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error(fallbackMessage);
  }

  const responseData = error.response?.data;
  if (typeof responseData === "string" && responseData.trim()) {
    return new Error(responseData);
  }

  if (responseData && typeof responseData === "object") {
    const data = responseData as ApiErrorEnvelope;

    if (data.error?.details && typeof data.error.details === "object") {
      const detailsMessage = flattenValidationDetails(data.error.details);
      if (detailsMessage) {
        return new Error(detailsMessage);
      }
    }

    const topLevelMessage = flattenTopLevelApiErrors(data);
    if (topLevelMessage) {
      return new Error(topLevelMessage);
    }

    if (data.error?.message) {
      return new Error(data.error.message);
    }

    if (typeof data.detail === "string" && data.detail.trim()) {
      return new Error(data.detail);
    }
  }

  return new Error(error.message || fallbackMessage);
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  try {
    const response = await publicApiClient.post<LoginResponse>(
      "/accounts/login/",
      { username, password },
    );
    return response.data;
  } catch (error) {
    throw toApiError(error, "Invalid username or password.");
  }
}

export async function refreshSession(): Promise<RefreshResponse> {
  try {
    const response = await publicApiClient.post<RefreshResponse>(
      "/accounts/login/refresh/",
      {},
    );
    return response.data;
  } catch (error) {
    throw toApiError(error, "Unable to refresh session.");
  }
}

export async function logoutSession(): Promise<void> {
  try {
    await publicApiClient.post("/accounts/logout/", {});
  } catch (error) {
    const apiError = toApiError(error, "Unable to log out.");
    logger.warn("auth.logout.failed", {
      error: apiError.message,
    });
    throw apiError;
  }
}

export async function fetchCurrentUser(
  accessToken: string,
  userId: string | number,
): Promise<AuthenticatedUser> {
  try {
    const response = await apiClient.get<AuthenticatedUser>(
      `/accounts/users/${userId}/`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    throw toApiError(error, "Failed to fetch user details.");
  }
}

export async function beginGoogleOAuth(
  codeChallenge?: string,
  codeChallengeMethod: string = "S256",
): Promise<GoogleOAuthStartResponse> {
  try {
    const params = codeChallenge
      ? { code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod }
      : {};

    const response = await publicApiClient.get<GoogleOAuthStartResponse>(
      "/accounts/google-auth/",
      { params },
    );
    return response.data;
  } catch (error) {
    throw toApiError(error, "Failed to initialize Google authentication.");
  }
}

export async function beginGoogleOAuthConnect(
  codeChallenge?: string,
  codeChallengeMethod: string = "S256",
): Promise<GoogleOAuthStartResponse> {
  try {
    const params = codeChallenge
      ? { code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod }
      : {};

    const response = await apiClient.get<GoogleOAuthStartResponse>(
      "/accounts/auth-providers/google/connect/start/",
      { params },
    );
    return response.data;
  } catch (error) {
    throw toApiError(error, "Failed to initialize Google account linking.");
  }
}

export async function exchangeGoogleAuthCode(
  code: string,
  state: string,
  codeVerifier?: string,
): Promise<GoogleOAuthCallbackResponse> {
  try {
    const response = await publicApiClient.post<GoogleOAuthCallbackResponse>(
      "/accounts/google-callback/",
      { code, state, code_verifier: codeVerifier },
    );
    return response.data;
  } catch (error) {
    throw toApiError(error, "Google authentication failed.");
  }
}

export async function registerAccount(
  payload: RegisterRequest,
): Promise<void> {
  try {
    await publicApiClient.post("/accounts/register/", payload);
  } catch (error) {
    throw toApiError(error, "Registration failed.");
  }
}

export async function fetchAuthProviderSummary(): Promise<AuthProviderSummary> {
  try {
    const response = await apiClient.get<AuthProviderSummary>(
      "/accounts/auth-providers/",
    );
    return response.data;
  } catch (error) {
    throw toApiError(error, "Failed to fetch linked authentication providers.");
  }
}

export async function disconnectGoogleProvider(): Promise<void> {
  try {
    await apiClient.post("/accounts/auth-providers/google/disconnect/", {});
  } catch (error) {
    throw toApiError(error, "Failed to disconnect Google provider.");
  }
}

export async function setAccountPassword(payload: {
  new_password: string;
  confirm_password: string;
  current_password?: string;
}): Promise<void> {
  try {
    await apiClient.post("/accounts/password/set/", payload);
  } catch (error) {
    throw toApiError(error, "Failed to set account password.");
  }
}
