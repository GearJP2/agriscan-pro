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
        <Button
          variant="outline"
          className="h-9 rounded-full border border-gfs-maroon/20 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 px-3.5 text-xs font-bold text-gfs-text-primary dark:text-slate-200 hover:border-gfs-maroon/50 hover:bg-gfs-maroon/5 gap-2 transition-all"
        >
          <CurrentIcon className="h-3.5 w-3.5 text-gfs-maroon dark:text-gfs-gold" />
          <span>View as {currentRole.label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[100000] min-w-[200px] rounded-gfs-card border border-gfs-maroon/20 dark:border-white/10 shadow-gfs-modal bg-white dark:bg-slate-900 font-sans p-1.5"
      >
        {roles.map((r) => {
          const Icon = r.icon;
          return (
            <DropdownMenuItem
              key={r.value}
              onClick={() => switchRole(r.value)}
              className="gap-2.5 rounded-lg text-xs font-bold text-gfs-text-primary dark:text-slate-200 hover:bg-gfs-maroon/10 dark:hover:bg-white/10 cursor-pointer transition-colors py-2 px-3"
            >
              <Icon className="h-4 w-4 text-gfs-maroon dark:text-gfs-gold" />
              <span>View as {r.label}</span>
              {role === r.value && <Check className="h-4 w-4 ml-auto text-gfs-maroon dark:text-gfs-gold" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RoleSwitcher;
