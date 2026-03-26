/**
 * Secure in-memory token storage.
 *
 * Tokens are kept in module-scoped variables instead of localStorage.
 * This eliminates the XSS attack vector where malicious scripts read
 * localStorage to steal JWT tokens.
 *
 * Trade-off: tokens are lost on page refresh, so the user must re-authenticate
 * (or we silently refresh using the refresh token stored here).
 *
 * Migration note: on first load we check localStorage for tokens left by the
 * previous implementation, migrate them into memory, then delete them from
 * localStorage so they are no longer exposed.
 */

let accessToken: string | null = null;
let refreshToken: string | null = null;

/**
 * Migrate tokens that were previously stored in localStorage (from the old
 * implementation) into secure in-memory storage and remove them from
 * localStorage.
 */
export function migrateFromLocalStorage(): void {
  const storedAccess = localStorage.getItem('access_token');
  const storedRefresh = localStorage.getItem('refresh_token');

  if (storedAccess) {
    accessToken = storedAccess;
    localStorage.removeItem('access_token');
  }
  if (storedRefresh) {
    refreshToken = storedRefresh;
    localStorage.removeItem('refresh_token');
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  // Also clear any leftover localStorage entries (belt-and-suspenders)
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}
