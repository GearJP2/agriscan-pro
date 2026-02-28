export type UserRole = 'user' | 'researcher' | 'research_assistant' | 'head_researcher' | 'admin';

export type UserStatus = 'active' | 'inactive';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  created_at: string;
  last_active?: string;
  online_status: 'online' | 'offline';
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  user: 'User',
  researcher: 'Researcher',
  research_assistant: 'Research Assistant',
  head_researcher: 'Head Researcher',
  admin: 'Admin',
};

export const USER_ROLE_COLORS: Record<UserRole, string> = {
  user: 'bg-secondary text-secondary-foreground',
  researcher: 'bg-info/20 text-info',
  research_assistant: 'bg-warning/20 text-warning-foreground',
  head_researcher: 'bg-primary/20 text-primary',
  admin: 'bg-danger/20 text-danger',
};

export const USER_STATUS_COLORS: Record<UserStatus, string> = {
  active: 'bg-success/20 text-success',
  inactive: 'bg-muted text-muted-foreground',
};
