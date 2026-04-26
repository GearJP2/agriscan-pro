import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { jwtDecode } from "jwt-decode";

import {
  fetchCurrentUser,
  login as loginRequest,
  logoutSession,
  refreshSession,
  type AuthenticatedUser,
} from "@/lib/authApi";
import {
  clearAccessToken,
  clearSessionHint,
  getAccessToken,
  hasSessionHint,
  setAccessToken,
  setSessionHint,
} from "@/lib/tokenStorage";
import type { UserRole } from "@/types/user";

interface TokenPayload {
  user_id: string | number;
  exp: number;
}

interface AuthContextType {
  user: AuthenticatedUser | null;
  role: UserRole | "guest";
  isAdmin: boolean;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithToken: (
    accessToken: string,
    user?: AuthenticatedUser,
  ) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  setUserName: (name: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isTokenExpired(token: string): boolean {
  try {
    const decoded: TokenPayload = jwtDecode(token);
    return decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [role, setRole] = useState<UserRole | "guest">("guest");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const isAdmin =
    isAuthenticated && (role === "admin" || role === "head_researcher");

  const clearLocalUserState = useCallback(() => {
    setUser(null);
    setRole("guest");
    setIsAuthenticated(false);
  }, []);

  const clearAuthState = useCallback(() => {
    clearAccessToken();
    clearSessionHint();
    clearLocalUserState();
  }, [clearLocalUserState]);

  const applyAuthenticatedUser = useCallback((nextUser: AuthenticatedUser) => {
    setUser(nextUser);
    setRole(nextUser.role);
    setIsAuthenticated(true);
  }, []);

  const hydrateSession = useCallback(
    async (accessToken: string, knownUser?: AuthenticatedUser) => {
      setAccessToken(accessToken);
      setSessionHint();

      if (knownUser) {
        applyAuthenticatedUser(knownUser);
        return;
      }

      const decoded: TokenPayload = jwtDecode(accessToken);
      const fetchedUser = await fetchCurrentUser(accessToken, decoded.user_id);
      applyAuthenticatedUser(fetchedUser);
    },
    [applyAuthenticatedUser],
  );

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const existingToken = getAccessToken();

        if (existingToken && !isTokenExpired(existingToken)) {
          await hydrateSession(existingToken);
        } else {
          clearAccessToken();

          if (!hasSessionHint()) {
            if (isMounted) {
              clearLocalUserState();
            }
            return;
          }

          const refreshed = await refreshSession();
          await hydrateSession(refreshed.access);
        }
      } catch {
        if (isMounted) {
          clearAuthState();
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [clearAuthState, clearLocalUserState, hydrateSession]);

  useEffect(() => {
    const handleAuthFailure = () => {
      clearAuthState();
    };

    window.addEventListener("agriscan:auth-failure", handleAuthFailure);
    return () => {
      window.removeEventListener("agriscan:auth-failure", handleAuthFailure);
    };
  }, [clearAuthState]);

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await loginRequest(username, password);
      await hydrateSession(response.access, response.user);
    },
    [hydrateSession],
  );

  const loginWithToken = useCallback(
    async (accessToken: string, authenticatedUser?: AuthenticatedUser) => {
      await hydrateSession(accessToken, authenticatedUser);
    },
    [hydrateSession],
  );

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } catch {
      // Always clear local auth state even if the server-side logout fails.
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  const switchRole = useCallback((nextRole: UserRole) => {
    setRole(nextRole);
  }, []);

  const setUserName = useCallback((name: string) => {
    setUser((currentUser) =>
      currentUser
        ? {
            ...currentUser,
            name,
          }
        : currentUser,
    );
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = getAccessToken();

    if (currentToken && !isTokenExpired(currentToken)) {
      await hydrateSession(currentToken);
      return;
    }

    clearAccessToken();
    if (!hasSessionHint()) {
      clearLocalUserState();
      return;
    }

    const refreshed = await refreshSession();
    await hydrateSession(refreshed.access);
  }, [clearLocalUserState, hydrateSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isAuthenticated,
        isInitializing,
        login,
        loginWithToken,
        logout,
        switchRole,
        setUserName,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
