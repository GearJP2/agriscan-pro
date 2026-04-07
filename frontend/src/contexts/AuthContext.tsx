import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import API_BASE_URL from '@/config/api';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  migrateFromLocalStorage,
} from '@/lib/tokenStorage';

export type UserRole = 'user' | 'admin' | 'researcher' | 'research_assistant' | 'head_researcher' | 'guest';

interface User {
  id: string | number;
  name: string;
  email?: string;
  role: UserRole;
  username?: string;
  is_active?: boolean;
}

interface TokenPayload {
  user_id: number;
  exp: number;
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithToken: (accessToken: string, refreshToken?: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  setUserName: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const createUser = (role: UserRole, name: string, username?: string, email?: string): User => ({
  id: `${role}-${Date.now()}`,
  name,
  role,
  username,
  email,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole>('admin');
  const [userName, setUserName] = useState('Admin User');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const isAdmin = isAuthenticated && (role === 'admin' || role === 'head_researcher');

  useEffect(() => {
    // Migrate any tokens left in localStorage by the old implementation
    migrateFromLocalStorage();

    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const decoded: TokenPayload = jwtDecode(token);
          if (decoded.exp * 1000 < Date.now()) {
            // Access token expired -- try silent refresh
            const refreshToken = getRefreshToken();
            if (refreshToken) {
              try {
                const refreshRes = await fetch(`${API_BASE_URL}/accounts/login/refresh/`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refresh: refreshToken }),
                });
                if (refreshRes.ok) {
                  const refreshData = await refreshRes.json();
                  setTokens(refreshData.access, refreshData.refresh || refreshToken);
                  // Continue with the new access token
                  const newDecoded: TokenPayload = jwtDecode(refreshData.access);
                  await fetchAndSetUser(refreshData.access, newDecoded.user_id);
                  return;
                }
              } catch {
                // Refresh failed, fall through to logout
              }
            }
            logout();
            return;
          }

          await fetchAndSetUser(token, decoded.user_id);
        } catch (e) {
          logout();
        }
      }
    };
    checkAuth();
  }, []);

  const fetchAndSetUser = async (token: string, userId: number) => {
    const userRes = await fetch(`${API_BASE_URL}/accounts/users/${userId}/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      setIsAuthenticated(true);
      setCurrentUser(userData);
      setRole(userData.role);
      setUserName(userData.name);
    } else {
      logout();
    }
  };

  const login = async (username: string, password: string) => {
    try {
      // Note: API_BASE_URL already includes the `/api` prefix (configured via env var)
      const response = await fetch(`${API_BASE_URL}/accounts/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid username or password');
      }

      const data = await response.json();

      // Store tokens in secure in-memory storage (NOT localStorage)
      setTokens(data.access, data.refresh);

      const decoded: TokenPayload = jwtDecode(data.access);

      const userRes = await fetch(`${API_BASE_URL}/accounts/users/${decoded.user_id}/`, {
        headers: {
          'Authorization': `Bearer ${data.access}`
        }
      });
      if (!userRes.ok) throw new Error('Failed to fetch user details');

      const userData = await userRes.json();

      setIsAuthenticated(true);
      setCurrentUser(userData);
      setRole(userData.role);
      setUserName(userData.name);
    } catch (error) {
      throw error;
    }
  };

  const loginWithToken = async (accessToken: string, refreshToken?: string) => {
    try {
      // Store tokens
      setTokens(accessToken, refreshToken || '');

      const decoded: TokenPayload = jwtDecode(accessToken);

      // Fetch user details
      await fetchAndSetUser(accessToken, decoded.user_id);
    } catch (error) {
      clearTokens();
      throw error;
    }
  };

  const logout = () => {
    clearTokens();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'user') {
      setUserName('Viewer');
    } else {
      setUserName(currentUser?.name || 'User');
    }
  };

  return (
    <AuthContext.Provider value={{ user: currentUser, role, isAdmin, isAuthenticated, login, loginWithToken, logout, switchRole, setUserName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
