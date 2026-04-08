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
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const Header = () => {
  const { isAdmin, isAuthenticated, user, role } = useAuth();
  const location = useLocation();

  const canSwitchRole = user && USER_ROLE_WEIGHT[user.role as keyof typeof USER_ROLE_WEIGHT] >= USER_ROLE_WEIGHT['research_assistant'];

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm pt-4 pb-2">
      <div className="container flex h-16 items-center">
        {/* Left: Logo */}
        <div className="flex items-center gap-3 shrink-0 mr-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
            <FlaskConical className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="hidden lg:block">
            <h1 className="text-lg font-bold text-foreground">SafeFood</h1>
            <p className="text-xs text-muted-foreground">Mycotoxin Tracking System</p>
          </div>
        </div>

        {/* Center: Pill Navigation */}
        <nav className="flex-1 hidden md:flex items-center justify-center">
          <div className="flex items-center gap-1 rounded-full bg-secondary/30 backdrop-blur-md px-2 py-1.5 shadow-sm border border-border/50">
          {[
            { to: '/', label: 'Homepage', minWeight: 0 },
            { to: '/dashboard', label: 'Dashboard', minWeight: 0 },
            { to: '/samples', label: 'Sample List', minWeight: USER_ROLE_WEIGHT['research_assistant'] },
            { to: '/prediction', label: 'Prediction', minWeight: 0 },
            { to: '/doc', label: 'Documentation', minWeight: 0 },
            { to: '/users', label: 'Users', minWeight: USER_ROLE_WEIGHT['research_assistant'] },
          ]
            .filter((link) => {
              const currentWeight = isAuthenticated ? USER_ROLE_WEIGHT[role as keyof typeof USER_ROLE_WEIGHT] : 0;
              return currentWeight >= link.minWeight;
            })
            .map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200",
                    isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        layout="position"
                        initial={false}
                        animate={{ y: 0 }}
                        className="absolute inset-0 bg-primary rounded-full shadow-md"
                        transition={{ 
                          type: "spring", 
                          stiffness: 1000, 
                          damping: 50,
                          mass: 1
                        }}
                        style={{ zIndex: -1 }}
                      />
                    )}
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-8">
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
