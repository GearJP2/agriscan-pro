import { FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';
import RoleSwitcher from './RoleSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

const Header = () => {
  const { isAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
            <FlaskConical className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">SafeFood</h1>
            <p className="text-xs text-muted-foreground">Mycotoxin Tracking System</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link
            to="/"
            className="transition-colors hover:text-foreground/80 text-foreground"
          >
            Homepage
          </Link>
          <Link
            to="/dashboard"
            className="transition-colors hover:text-foreground/80 text-muted-foreground"
          >
            Dashboard
          </Link>
          <Link
            to="/samples"
            className="transition-colors hover:text-foreground/80 text-muted-foreground"
          >
            Sample List
          </Link>
          <Link
            to="/prediction"
            className="transition-colors hover:text-foreground/80 text-muted-foreground"
          >
            Prediction
          </Link>
          <Link
            to="/doc"
            className="transition-colors hover:text-foreground/80 text-muted-foreground"
          >
            Doc
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Badge variant={isAdmin ? 'default' : 'secondary'} className="hidden sm:flex">
            {isAdmin ? 'Full Access' : 'View Only'}
          </Badge>
          <RoleSwitcher />
        </div>
      </div>
    </header>
  );
};

export default Header;
