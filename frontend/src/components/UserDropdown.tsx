import { Link, useNavigate } from "react-router-dom";
import {
  User as UserIcon,
  Settings,
  FolderOpen,
  Bell,
  Users,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { USER_ROLE_WEIGHT } from "@/types/user";
import { useUnreadCount } from "@/features/notifications/hooks/useNotifications";

const UserDropdown = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const canManageUsers = role === "admin";
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count || 0;

  const handleLogout = () => {
    navigate("/");
    setTimeout(() => {
      void logout();
    }, 0);
  };

  const menuItems = [
    { to: "/profile", label: "My Profile", icon: UserIcon },
    { to: "/settings", label: "Settings", icon: Settings },
    { to: "/activity", label: "Activity", icon: FolderOpen },
    { to: "/notifications", label: "Notification", icon: Bell },
    ...(USER_ROLE_WEIGHT[(role as keyof typeof USER_ROLE_WEIGHT) || "guest"] >= USER_ROLE_WEIGHT.researcher
      ? [{ to: "/users", label: "Users", icon: Users }]
      : []),
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center border-2 border-background z-10 px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src="" alt={user?.name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {user?.name?.charAt(0) || "U"}
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
              {user?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="text-sm font-semibold text-foreground">
              {user?.name || "Your name"}
            </p>
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
                <div className="flex items-center gap-3 flex-1">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{item.label}</span>
                  {item.label === "Notification" && unreadCount > 0 && (
                    <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                {item.label !== "Notification" || unreadCount === 0 ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                ) : null}
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
