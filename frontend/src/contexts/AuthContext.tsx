import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

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
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const decoded: TokenPayload = jwtDecode(token);
          if (decoded.exp * 1000 < Date.now()) {
            logout();
            return;
          }

          const userRes = await fetch(`http://localhost:8000/api/accounts/users/${decoded.user_id}/`, {
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
        } catch (e) {
          logout();
        }
      }
    };
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch('http://localhost:8000/api/accounts/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid username or password');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);

      const decoded: TokenPayload = jwtDecode(data.access);

      const userRes = await fetch(`http://localhost:8000/api/accounts/users/${decoded.user_id}/`, {
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

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
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
    <AuthContext.Provider value={{ user: currentUser, role, isAdmin, isAuthenticated, login, logout, switchRole, setUserName }}>
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
