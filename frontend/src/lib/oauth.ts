/**
 * Legacy OAuth compatibility wrappers.
 *
 * This module no longer stores tokens in browser storage.
 * Refresh tokens are managed by the backend via secure httpOnly cookies.
 * The helpers below delegate to the cookie-backed auth API so older imports
 * continue to work without reintroducing localStorage-based auth.
 */

import {
  AxiosHeaders,
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
} from "axios";
import { jwtDecode } from "jwt-decode";

import {
  beginGoogleOAuth,
  clearOAuthState,
  exchangeGoogleAuthCode,
  refreshSession,
  verifyOAuthState,
  type AuthenticatedUser,
  type GoogleOAuthCallbackResponse,
} from "@/lib/authApi";
import {
  clearAccessToken,
  getAccessToken as getStoredAccessToken,
  setAccessToken,
} from "@/lib/tokenStorage";

export interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  user?: AuthenticatedUser;
}

export interface GoogleAuthResponse {
  code?: string;
  error?: string;
  state?: string;
}

export const storeAuthTokens = (tokens: OAuthTokenResponse): void => {
  setAccessToken(tokens.access_token);
};

export const getAccessToken = (): string | null => {
  return getStoredAccessToken();
};

export const getRefreshToken = (): null => {
  return null;
};

export const isTokenExpired = (): boolean => {
  const token = getStoredAccessToken();

  if (!token) {
    return true;
  }

  try {
    const decoded = jwtDecode<{ exp?: number }>(token);
    if (!decoded.exp) {
      return true;
    }

    return decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

export const decodeToken = (token: string): Record<string, unknown> => {
  try {
    return jwtDecode<Record<string, unknown>>(token);
  } catch {
    return {};
  }
};

export const clearAuthTokens = (): void => {
  clearAccessToken();
};

export const generateRandomState = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

export const generateGoogleAuthURL = (_state: string): string => {
  throw new Error(
    "Direct Google auth URL generation is disabled. Use initGoogleOAuth() instead.",
  );
};

export const exchangeAuthCode = async (
  code: string,
  state: string,
): Promise<OAuthTokenResponse> => {
  const response = await exchangeGoogleAuthCode(code, state);
  return {
    access_token: response.access_token,
    expires_in: response.expires_in,
    token_type: response.token_type,
    user: response.user,
  };
};

export const refreshAccessToken = async (): Promise<OAuthTokenResponse> => {
  const response = await refreshSession();
  const payload: OAuthTokenResponse = {
    access_token: response.access,
    expires_in: 15 * 60,
    token_type: "Bearer",
  };

  storeAuthTokens(payload);
  return payload;
};

export const initGoogleOAuth = async (): Promise<void> => {
  const { auth_url } = await beginGoogleOAuth();
  window.location.href = auth_url;
};

export const verifyState = (returnedState: string): boolean => {
  return verifyOAuthState(returnedState);
};

export const handleOAuthCallback = async (
  code: string,
  state: string,
): Promise<OAuthTokenResponse | null> => {
  try {
    if (!verifyOAuthState(state)) {
      throw new Error("Invalid OAuth state.");
    }

    const response: GoogleOAuthCallbackResponse = await exchangeGoogleAuthCode(
      code,
      state,
    );

    const payload: OAuthTokenResponse = {
      access_token: response.access_token,
      expires_in: response.expires_in,
      token_type: response.token_type,
      user: response.user,
    };

    storeAuthTokens(payload);
    clearOAuthState();

    return payload;
  } catch {
    clearOAuthState();
    return null;
  }
};

type RetryableRequestConfig = {
  _retry?: boolean;
  headers?: AxiosHeaders;
};

export const setupOAuthInterceptor = (axiosInstance: AxiosInstance): void => {
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError & { config?: RetryableRequestConfig }) => {
      const originalRequest = error.config;

      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;

        try {
          const refreshed = await refreshAccessToken();
          originalRequest.headers =
            originalRequest.headers ?? new AxiosHeaders();
          originalRequest.headers.set(
            "Authorization",
            `Bearer ${refreshed.access_token}`,
          );
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          clearAuthTokens();
          window.location.href = "/";
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    },
  );
};
