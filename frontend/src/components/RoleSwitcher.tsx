import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Shield, User, ChevronDown, Check } from 'lucide-react';

const RoleSwitcher = () => {
  const { role, switchRole } = useAuth();

  const roles: { value: UserRole; label: string; icon: typeof Shield }[] = [
    { value: 'admin', label: 'Admin', icon: Shield },
    { value: 'user', label: 'Viewer', icon: User },
  ];

  const currentRole = roles.find(r => r.value === role) || roles[0];
  const CurrentIcon = currentRole.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CurrentIcon className="h-4 w-4" />
          {currentRole.label}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {roles.map((r) => {
          const Icon = r.icon;
          return (
            <DropdownMenuItem 
              key={r.value} 
              onClick={() => switchRole(r.value)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {r.label}
              {role === r.value && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RoleSwitcher;
