import { FlaskConical } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import RoleSwitcher from './RoleSwitcher';
import ThemeToggle from './ThemeToggle';
import UserDropdown from './UserDropdown';
import LoginModal from './LoginModal';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { USER_ROLE_WEIGHT } from '@/types/user';

const Header = () => {
  const { isAdmin, isAuthenticated, user, role } = useAuth();
  const location = useLocation();

  const canSwitchRole = user && USER_ROLE_WEIGHT[user.role as keyof typeof USER_ROLE_WEIGHT] >= USER_ROLE_WEIGHT['research_assistant'];

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm pt-4 pb-2">
      <div className="container relative flex h-16 items-center justify-between">
        {/* Logo - Absolute left or flex */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
            <FlaskConical className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="hidden lg:block">
            <h1 className="text-lg font-bold text-foreground">SafeFood</h1>
            <p className="text-xs text-muted-foreground">Mycotoxin Tracking System</p>
          </div>
        </div>

        {/* Centered Pill Navigation */}
        <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 rounded-full bg-secondary/30 backdrop-blur-md px-2 py-1.5 shadow-sm border border-border/50">
          {[
            { to: '/', label: 'Homepage', minWeight: 0 },
            { to: '/dashboard', label: 'Dashboard', minWeight: 0 },
            { to: '/samples', label: 'Sample List', minWeight: 0 },
            { to: '/prediction', label: 'Prediction', minWeight: 0 },
            { to: '/doc', label: 'Documentation', minWeight: 0 },
            { to: '/users', label: 'Users', minWeight: USER_ROLE_WEIGHT['research_assistant'] },
          ]
            .filter((link) => {
              const currentWeight = isAuthenticated ? USER_ROLE_WEIGHT[role as keyof typeof USER_ROLE_WEIGHT] : 0;
              return currentWeight >= link.minWeight;
            })
            .map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${location.pathname === link.to
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
              >
                {link.label}
              </Link>
            ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              {canSwitchRole && <RoleSwitcher />}
              <UserDropdown />
            </>
          ) : (
            <LoginModal />
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
