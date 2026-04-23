import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE_LABELS, type UserRole } from "@/types/user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield, User, ChevronDown, Check } from "lucide-react";

const RoleSwitcher = () => {
  const { user, role, switchRole } = useAuth();

  if (!user) return null;

  const originalRole = user.role;
  const originalLabel =
    USER_ROLE_LABELS[originalRole as keyof typeof USER_ROLE_LABELS] || "Admin";

  const roles = [
    { value: originalRole, label: originalLabel, icon: Shield },
    { value: "user" as UserRole, label: "Viewer", icon: User },
  ];

  const uniqueRoles = originalRole === "user" ? [roles[1]] : roles;

  const currentRole =
    uniqueRoles.find((r) => r.value === role) || uniqueRoles[0];
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
