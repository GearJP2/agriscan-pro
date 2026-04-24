/**
 * In-memory access token storage.
 *
 * This module intentionally does not persist tokens in localStorage/sessionStorage.
 * The refresh token is expected to live in a secure httpOnly cookie managed by the backend.
 */

let accessToken: string | null = null;
const AUTH_SESSION_HINT_KEY = "agriscan.auth_session_hint";

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

/**
 * Returns the current in-memory access token.
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Sets the current in-memory access token.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Legacy compatibility helper.
 * Stores only the access token and ignores the refresh token.
 */
export function setTokens(access: string, _refresh?: string): void {
  accessToken = access;
}

/**
 * Refresh tokens are no longer accessible from JavaScript.
 * They are stored in an httpOnly cookie on the backend.
 */
export function getRefreshToken(): null {
  return null;
}

/**
 * Clears the in-memory access token.
 */
export function clearAccessToken(): void {
  accessToken = null;
}

/**
 * Legacy compatibility helper.
 * Clears the in-memory access token.
 */
export function clearTokens(): void {
  accessToken = null;
}

/**
 * Stores a non-sensitive browser hint that a refresh cookie may exist.
 * This avoids guaranteed 401 refresh attempts on first-load for logged-out users.
 */
export function setSessionHint(): void {
  getBrowserStorage()?.setItem(AUTH_SESSION_HINT_KEY, "1");
}

/**
 * Returns whether the browser has recently seen an authenticated session.
 */
export function hasSessionHint(): boolean {
  return getBrowserStorage()?.getItem(AUTH_SESSION_HINT_KEY) === "1";
}

/**
 * Clears the browser session hint.
 */
export function clearSessionHint(): void {
  getBrowserStorage()?.removeItem(AUTH_SESSION_HINT_KEY);
}
