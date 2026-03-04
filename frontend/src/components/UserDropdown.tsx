import { Link, useNavigate } from 'react-router-dom';
import { User as UserIcon, Settings, FolderOpen, Bell, Users, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const UserDropdown = () => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/');
    setTimeout(() => {
      logout();
    }, 0);
  };

  const menuItems = [
    { to: '/profile', label: 'My Profile', icon: UserIcon },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/activity', label: 'Activity', icon: FolderOpen },
    { to: '/notifications', label: 'Notification', icon: Bell },
    ...(isAdmin ? [{ to: '/users', label: 'Users', icon: Users }] : []),
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src="" alt={user?.name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        {/* User Info Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarImage src="" alt={user?.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg">
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="text-sm font-semibold text-foreground">{user?.name || 'Your name'}</p>
            <p className="text-xs text-muted-foreground">yourname@gmail.com</p>
          </div>
        </div>

        {/* Menu Items */}
        <DropdownMenuGroup className="p-2">
          {menuItems.map((item) => (
            <DropdownMenuItem key={item.to} asChild className="cursor-pointer">
              <Link
                to={item.to}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-md hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{item.label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <hr className="border-t border-gray-200 dark:border-gray-700 mx-2 my-2" />

        {/* Logout */}
        <div className="p-2">
          <DropdownMenuItem
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer text-danger hover:bg-danger/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">Log Out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropdown;
