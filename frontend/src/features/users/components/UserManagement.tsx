import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, UserCheck, UserX, Search, Shield, ChevronDown, Activity, Info, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import StatsCard from "@/components/StatsCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  UserRole,
  UserStatus,
  USER_ROLE_LABELS,
  USER_ROLE_COLORS,
  USER_ROLE_WEIGHT,
  USER_STATUS_COLORS,
} from "@/types/user";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";
import { userAPI } from "@/lib/api";
import { logger } from "@/lib/logger";

type BackendUser = {
  id: string | number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  date_joined?: string;
  created_at?: string;
  online_status?: "online" | "offline";
  department?: string;
  last_active?: string;
};

const getInitials = (name: string) => {
  if (!name) return "??";
  const parts = name.split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const mapBackendUserToFrontendUser = (user: BackendUser): User => ({
  ...user,
  id: String(user.id),
  status: user.is_active ? "active" : "inactive",
  created_at: user.created_at || user.date_joined || new Date().toISOString(),
  date_joined: user.date_joined
    ? new Date(user.date_joined).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—",
  online_status: user.online_status || "offline",
});

const UserManagement = () => {
  const { role: currentUserRole, isInitializing, user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [pendingStatusUser, setPendingStatusUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const currentUserWeight = USER_ROLE_WEIGHT[currentUserRole] || 0;

  const usersQuery = useQuery({
    queryKey: ["users"],
    enabled: !isInitializing,
    queryFn: async () => {
      const data = await userAPI.getUsers();
      const mappedUsers: User[] = Array.isArray(data)
        ? data.map((user) => mapBackendUserToFrontendUser(user as BackendUser))
        : [];

      logger.info("users.fetch.success", { count: mappedUsers.length });
      return mappedUsers;
    },
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const isLoading = isInitializing || usersQuery.isLoading;

  useEffect(() => {
    if (usersQuery.error) {
      logger.error("users.fetch.failed", usersQuery.error);
      toast({
        title: "Error loading users",
        description:
          usersQuery.error instanceof Error
            ? usersQuery.error.message
            : "Unknown error occurred",
        variant: "destructive",
      });
    }
  }, [usersQuery.error]);

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      userAPI.updateUser(id, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      userAPI.updateUser(id, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {

      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      inactive: users.filter((u) => u.status === "inactive").length,
      admins: users.filter((u) => u.role === "admin").length,
    };
  }, [users]);

  // Removed strict page block so all staff can view the page. Action controls are still protected by role weights.

  const handleRoleChange = async () => {
    if (!selectedUser) return;

    try {
      await updateRoleMutation.mutateAsync({
        id: selectedUser.id,
        role: newRole,
      });

      toast({
        title: "Role Updated",
        description: `${selectedUser.name}'s role has been changed to ${USER_ROLE_LABELS[newRole]}.`,
      });

      logger.info("users.role_updated", {
        userId: selectedUser.id,
        newRole,
      });
    } catch (error) {
      logger.error("users.role_update_failed", error, {
        userId: selectedUser.id,
        newRole,
      });

      toast({
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not change user role.",
        variant: "destructive",
      });
    } finally {
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const handleStatusToggle = async (user: User) => {
    const newStatus: UserStatus =
      user.status === "active" ? "inactive" : "active";
    const newIsActive = newStatus === "active";

    try {
      await updateStatusMutation.mutateAsync({
        id: user.id,
        isActive: newIsActive,
      });

      toast({
        title: "Status Updated",
        description: `${user.name} is now ${newStatus}.`,
      });

      logger.info("users.status_updated", {
        userId: user.id,
        isActive: newIsActive,
      });
    } catch (error) {
      logger.error("users.status_update_failed", error, {
        userId: user.id,
        isActive: newIsActive,
      });

      toast({
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not change user status.",
        variant: "destructive",
      });
    }
  };

  const openStatusDialog = (user: User) => {
    setPendingStatusUser(user);
    setIsStatusDialogOpen(true);
  };

  const handleStatusConfirm = async () => {
    if (!pendingStatusUser) return;
    await handleStatusToggle(pendingStatusUser);
    setIsStatusDialogOpen(false);
    setPendingStatusUser(null);
  };

  const openRoleDialog = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setIsRoleDialogOpen(true);
  };

  const availableRoles: UserRole[] = [
    "guest",
    "user",
    "research_assistant",
    "researcher",
    "head_researcher",
    "admin",
  ];

  const allowedRolesToAssign = availableRoles.filter(
    (role) => USER_ROLE_WEIGHT[role] <= currentUserWeight,
  );

  const UserSkeleton = () => (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i} className="border-b border-gfs-maroon/10 dark:border-white/5">
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full bg-gfs-maroon/10 dark:bg-slate-800" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 bg-gfs-maroon/10 dark:bg-slate-800" />
                <Skeleton className="h-3 w-40 bg-gfs-maroon/10 dark:bg-slate-800" />
              </div>
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-4 w-48 bg-gfs-maroon/10 dark:bg-slate-800" /></TableCell>
          <TableCell><Skeleton className="h-6 w-20 rounded-full bg-gfs-maroon/10 dark:bg-slate-800" /></TableCell>
          <TableCell><Skeleton className="h-9 w-32 rounded-full bg-gfs-maroon/10 dark:bg-slate-800" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24 bg-gfs-maroon/10 dark:bg-slate-800" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-9 w-32 ml-auto rounded-full bg-gfs-maroon/10 dark:bg-slate-800" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  return (
    <div className="w-full flex-1 bg-gfs-canvas text-gfs-text-primary coe-gfs transition-colors duration-300 font-sans">
      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gfs-maroon dark:text-gfs-gold mb-2">
              <Shield className="h-4 w-4" />
              <span>Access & Security Directory · Thammasat CoE-GFS</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gfs-maroon dark:text-white tracking-tight">
              User Management
            </h1>
            <p className="mt-1.5 text-sm font-medium text-gfs-text-muted dark:text-slate-400 max-w-3xl">
              Manage user accounts, institutional privileges, and operational security roles across AgriScan Pro.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Users"
            value={stats.total}
            icon={Users}
            variant="default"
          />
          <StatsCard
            title="Active Users"
            value={stats.active}
            icon={UserCheck}
            variant="success"
          />
          <StatsCard
            title="Inactive Users"
            value={stats.inactive}
            icon={UserX}
            variant="danger"
          />
          <StatsCard
            title="Administrators"
            value={stats.admins}
            icon={Shield}
            variant="warning"
          />
        </div>

        <Card className="rounded-gfs-card border border-gfs-maroon/15 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 shadow-gfs-card overflow-hidden font-sans">
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row items-end">
              <div className="flex-1 w-full">
                <p className="text-xs font-bold uppercase tracking-wider text-gfs-maroon dark:text-gfs-gold mb-2 ml-1">Search Directory</p>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gfs-maroon/50 dark:text-gfs-gold/60 transition-colors group-focus-within:text-gfs-maroon" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 pl-11 pr-4 bg-gfs-canvas/50 dark:bg-slate-800/60 border border-gfs-maroon/20 dark:border-white/10 rounded-full text-xs font-medium placeholder:text-gfs-text-muted/60 text-gfs-text-primary dark:text-white focus-visible:ring-2 focus-visible:ring-gfs-gold/40 focus-visible:border-gfs-maroon transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:w-[380px]">
                <div className="w-full">
                  <p className="text-xs font-bold uppercase tracking-wider text-gfs-maroon dark:text-gfs-gold mb-2 ml-1">Role Type</p>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-11 rounded-full border border-gfs-maroon/20 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 px-4 text-xs font-bold text-gfs-text-primary dark:text-slate-200 hover:border-gfs-maroon/50 hover:bg-gfs-maroon/5 transition-all">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent className="rounded-gfs-card border border-gfs-maroon/20 shadow-gfs-modal p-1 bg-white dark:bg-slate-900 font-sans">
                      <SelectItem value="all" className="rounded-lg text-xs font-bold cursor-pointer hover:bg-gfs-maroon/5">All Roles</SelectItem>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role} className="rounded-lg text-xs font-bold cursor-pointer hover:bg-gfs-maroon/5">
                          {USER_ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full">
                  <p className="text-xs font-bold uppercase tracking-wider text-gfs-maroon dark:text-gfs-gold mb-2 ml-1">Account Status</p>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-11 rounded-full border border-gfs-maroon/20 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 px-4 text-xs font-bold text-gfs-text-primary dark:text-slate-200 hover:border-gfs-maroon/50 hover:bg-gfs-maroon/5 transition-all">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-gfs-card border border-gfs-maroon/20 shadow-gfs-modal p-1 bg-white dark:bg-slate-900 font-sans">
                      <SelectItem value="all" className="rounded-lg text-xs font-bold cursor-pointer hover:bg-gfs-maroon/5">All Statuses</SelectItem>
                      <SelectItem value="active" className="rounded-lg text-xs font-bold cursor-pointer hover:bg-gfs-maroon/5">Active</SelectItem>
                      <SelectItem value="inactive" className="rounded-lg text-xs font-bold cursor-pointer hover:bg-gfs-maroon/5">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-gfs-card border border-gfs-maroon/15 dark:border-white/10 overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-card shadow-[0_1px_0_0_hsl(var(--border)/0.5)]">
                  <TableRow className="h-12 bg-muted hover:bg-muted">
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Member Since</TableHead>
                    <TableHead className="text-right font-semibold">Promote</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <UserSkeleton />
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-20 text-center"
                      >
                        <div className="flex flex-col items-center justify-center space-y-3 opacity-50">
                          <Search className="h-12 w-12 stroke-[1] text-gfs-maroon dark:text-gfs-gold" />
                          <div className="space-y-1">
                            <p className="text-lg font-bold text-gfs-maroon dark:text-white tracking-tight">No Users Found</p>
                            <p className="text-xs font-medium text-gfs-text-muted">Try adjusting your filters or search query</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelf = String(currentUser?.id) === String(user.id);
                      const isAdminTarget = user.role === "admin";
                      const targetUserWeight = USER_ROLE_WEIGHT[user.role as UserRole] || 0;
                      const outRanksTarget = currentUserRole === "admin" || currentUserWeight >= targetUserWeight;
                      const preventEdit = isSelf || isAdminTarget || !outRanksTarget;
                      const rolesToShow = Array.from(new Set([...allowedRolesToAssign, user.role as UserRole]));

                      return (
                        <TableRow key={user.id} className="group transition-colors hover:bg-gfs-canvas/70 dark:hover:bg-white/[0.02] border-b border-gfs-maroon/10 dark:border-white/5">
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-800 shadow-sm ring-1 ring-gfs-maroon/20">
                                  <AvatarFallback className={cn(
                                    "font-bold text-xs",
                                    user.status === "active" ? "bg-gfs-maroon/10 text-gfs-maroon dark:text-gfs-gold" : "bg-muted text-muted-foreground"
                                  )}>
                                    {getInitials(user.name)}
                                  </AvatarFallback>
                                </Avatar>
                                {user.online_status === "online" && (
                                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500 shadow-sm" />
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-gfs-text-primary dark:text-white truncate">
                                    {user.name}
                                  </span>
                                  {isSelf && (
                                    <Badge variant="outline" className="text-[9px] h-4 font-bold uppercase tracking-tighter bg-gfs-maroon/5 text-gfs-maroon dark:text-gfs-gold border-gfs-maroon/20 rounded-full px-1.5">
                                      You
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs font-medium text-gfs-text-muted dark:text-slate-400 truncate">
                                  {user.email}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gfs-text-muted opacity-60">Identifier</span>
                              <code className="text-xs font-mono font-bold text-gfs-maroon dark:text-gfs-gold">ID-{user.id.toString().padStart(4, '0')}</code>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider shadow-sm", USER_ROLE_COLORS[user.role])}>
                              {USER_ROLE_LABELS[user.role]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className={cn(
                              "inline-flex items-center p-1 bg-gfs-canvas/60 dark:bg-slate-800/60 rounded-full border border-gfs-maroon/20 dark:border-white/10 transition-all duration-300",
                              preventEdit && "opacity-40 pointer-events-none grayscale"
                            )}>
                              <button
                                type="button"
                                onClick={() => !preventEdit && user.status !== "active" && openStatusDialog(user)}
                                disabled={preventEdit}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300",
                                  user.status === "active"
                                    ? "bg-white dark:bg-slate-950 shadow-sm text-gfs-maroon dark:text-gfs-gold ring-1 ring-border/20"
                                    : "text-gfs-text-muted hover:text-gfs-text-primary",
                                )}
                              >
                                <div className={cn("h-1.5 w-1.5 rounded-full", user.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-transparent")} />
                                Active
                              </button>
                              <button
                                type="button"
                                onClick={() => !preventEdit && user.status !== "inactive" && openStatusDialog(user)}
                                disabled={preventEdit}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300",
                                  user.status === "inactive"
                                    ? "bg-white dark:bg-slate-950 shadow-sm text-rose-600 ring-1 ring-border/20"
                                    : "text-gfs-text-muted hover:text-gfs-text-primary",
                                )}
                              >
                                <div className={cn("h-1.5 w-1.5 rounded-full", user.status === "inactive" ? "bg-rose-500" : "bg-transparent")} />
                                Inactive
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-semibold text-gfs-text-primary dark:text-slate-300">{user.date_joined}</span>
                              <span className="text-[9px] font-bold text-gfs-text-muted uppercase tracking-wider">Joined Date</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-2">
                              <Select
                                value={user.role}
                                disabled={preventEdit}
                                onValueChange={(value) => {
                                  setSelectedUser(user);
                                  setNewRole(value as UserRole);
                                  setIsRoleDialogOpen(true);
                                }}
                              >
                                <SelectTrigger className="w-[140px] h-9 bg-white/80 dark:bg-slate-900/80 border-gfs-maroon/20 rounded-full text-xs font-bold text-gfs-text-primary dark:text-slate-200 hover:border-gfs-maroon/50">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end" className="rounded-gfs-card border border-gfs-maroon/20 shadow-gfs-modal p-1 bg-white dark:bg-slate-900 font-sans">
                                  {rolesToShow.map((role) => (
                                    <SelectItem key={role} value={role} className="rounded-lg text-xs font-bold cursor-pointer hover:bg-gfs-maroon/5">
                                      {USER_ROLE_LABELS[role as UserRole] || role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Role Change Dialog */}
        <Dialog
          open={isRoleDialogOpen}
          onOpenChange={(open) => {
            setIsRoleDialogOpen(open);
            if (!open) {
              setSelectedUser(null);
            }
          }}
        >
          <DialogContent className="rounded-gfs-card border border-gfs-maroon/20 shadow-gfs-modal bg-white dark:bg-slate-900 font-sans">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gfs-maroon dark:text-white">Confirm Role Change</DialogTitle>
              <DialogDescription className="text-xs text-gfs-text-muted">
                {selectedUser ? (
                  <>
                    Change <strong className="text-gfs-text-primary dark:text-white">{selectedUser.name}</strong>
                    {"'s"} role to <strong className="text-gfs-maroon dark:text-gfs-gold">{USER_ROLE_LABELS[newRole]}</strong>?
                  </>
                ) : (
                  "Confirm the selected role change."
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-gfs-maroon/20 px-5 py-2 text-xs font-bold hover:bg-gfs-maroon/5 transition-colors"
                onClick={() => {
                  setIsRoleDialogOpen(false);
                  setSelectedUser(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-gfs-maroon hover:bg-gfs-maroon-hover px-5 py-2 text-xs font-bold text-white transition-colors"
                onClick={() => void handleRoleChange()}
              >
                Confirm
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Status Toggle Dialog */}
        <Dialog
          open={isStatusDialogOpen}
          onOpenChange={(open) => {
            setIsStatusDialogOpen(open);
            if (!open) setPendingStatusUser(null);
          }}
        >
          <DialogContent className="rounded-gfs-card border border-gfs-maroon/20 shadow-gfs-modal bg-white dark:bg-slate-900 font-sans">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gfs-maroon dark:text-white">
                {pendingStatusUser?.status === "active"
                  ? "Deactivate Account?"
                  : "Activate Account?"}
              </DialogTitle>
              <DialogDescription className="text-xs text-gfs-text-muted">
                {pendingStatusUser ? (
                  pendingStatusUser.status === "active" ? (
                    <>
                      <strong className="text-gfs-text-primary dark:text-white">{pendingStatusUser.name}</strong> will lose access
                      to the system immediately. You can reactivate their account
                      at any time.
                    </>
                  ) : (
                    <>
                      <strong className="text-gfs-text-primary dark:text-white">{pendingStatusUser.name}</strong> will regain full
                      access based on their current role. Make sure this is
                      intentional.
                    </>
                  )
                ) : (
                  "Confirm the status change."
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-gfs-maroon/20 px-5 py-2 text-xs font-bold hover:bg-gfs-maroon/5 transition-colors"
                onClick={() => {
                  setIsStatusDialogOpen(false);
                  setPendingStatusUser(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-bold text-white transition-colors",
                  pendingStatusUser?.status === "active"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-gfs-maroon hover:bg-gfs-maroon-hover",
                )}
                onClick={() => void handleStatusConfirm()}
              >
                {pendingStatusUser?.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default UserManagement;
