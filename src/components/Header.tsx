import { FlaskConical } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import RoleSwitcher from './RoleSwitcher';
import ThemeToggle from './ThemeToggle';
import UserDropdown from './UserDropdown';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

const Header = () => {
  const { isAdmin } = useAuth();
  const location = useLocation();

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
            { to: '/', label: 'Homepage', adminOnly: false },
            { to: '/dashboard', label: 'Dashboard', adminOnly: false },
            { to: '/samples', label: 'Sample List', adminOnly: false },
            { to: '/prediction', label: 'Prediction', adminOnly: false },
            { to: '/doc', label: 'Documentation', adminOnly: false },
            { to: '/users', label: 'Users', adminOnly: true },
          ]
            .filter((link) => !link.adminOnly || isAdmin)
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
          <Badge variant={isAdmin ? 'default' : 'secondary'} className="hidden sm:flex">
            {isAdmin ? 'Full Access' : 'View Only'}
          </Badge>
          <RoleSwitcher />
          <UserDropdown />
        </div>
      </div>
    </header>
  );
};

export default Header;
