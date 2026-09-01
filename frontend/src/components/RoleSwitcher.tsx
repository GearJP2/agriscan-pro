import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE_LABELS, type UserRole } from "@/types/user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield, User, ChevronDown, Check, FlaskConical, Microscope } from "lucide-react";

const RoleSwitcher = () => {
  const { user, role, switchRole } = useAuth();

  if (!user) return null;
  if (user.role !== "admin") return null;

  const roles = [
    { value: "admin" as UserRole, label: USER_ROLE_LABELS.admin, icon: Shield },
    { value: "head_researcher" as UserRole, label: USER_ROLE_LABELS.head_researcher, icon: Microscope },
    { value: "researcher" as UserRole, label: USER_ROLE_LABELS.researcher, icon: FlaskConical },
    { value: "research_assistant" as UserRole, label: USER_ROLE_LABELS.research_assistant, icon: User },
    { value: "user" as UserRole, label: "Viewer", icon: User },
  ];

  const currentRole =
    roles.find((r) => r.value === role) || roles[0];
  const CurrentIcon = currentRole.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CurrentIcon className="h-4 w-4" />
          View as {currentRole.label}
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
              View as {r.label}
              {role === r.value && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RoleSwitcher;
