import { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'user' | 'admin';

interface User {
  id: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAdmin: boolean;
  switchRole: (role: UserRole) => void;
  setUserName: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const createUser = (role: UserRole, name: string): User => ({
  id: `${role}-${Date.now()}`,
  name,
  role,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole>('admin');
  const [userName, setUserName] = useState('Admin User');

  const user = createUser(role, userName);
  const isAdmin = role === 'admin';

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    setUserName(newRole === 'admin' ? 'Admin User' : 'Viewer');
  };

  return (
    <AuthContext.Provider value={{ user, role, isAdmin, switchRole, setUserName }}>
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
