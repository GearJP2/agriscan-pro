import { useState, useMemo, useEffect } from "react";
import { Users, UserCheck, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [pendingStatusUser, setPendingStatusUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentUserWeight = USER_ROLE_WEIGHT[currentUserRole] || 0;
  const canManageUsers = currentUserRole === "admin";

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await userAPI.getUsers();
      const mappedUsers: User[] = Array.isArray(data)
        ? data.map((user) => mapBackendUserToFrontendUser(user as BackendUser))
        : [];

      setUsers(mappedUsers);
      logger.info("users.fetch.success", { count: mappedUsers.length });
    } catch (error) {
      logger.error("users.fetch.failed", error);
      toast({
        title: "Error loading users",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isInitializing) {
      void fetchUsers();
    }
  }, [isInitializing]);

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
      await userAPI.updateUser(selectedUser.id, { role: newRole });

      setUsers((prev) =>
        prev.map((user) =>
          user.id === selectedUser.id ? { ...user, role: newRole } : user,
        ),
      );

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
      await userAPI.updateUser(user.id, { is_active: newIsActive });

      setUsers((prev) =>
        prev.map((existingUser) =>
          existingUser.id === user.id
            ? { ...existingUser, status: newStatus }
            : existingUser,
        ),
      );

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

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            User Management
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Users
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {stats.total}
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Users
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {stats.active}
                  </p>
                </div>
                <div className="rounded-lg bg-success/10 p-3 text-success">
                  <UserCheck className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Inactive Users
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {stats.inactive}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-muted-foreground">
                  <UserX className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Administrators
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {stats.admins}
                  </p>
                </div>
                <div className="rounded-lg bg-danger/10 p-3 text-danger">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              <div className="flex-1">
                <Input
                  placeholder="Search users by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:w-[320px]">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {availableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {USER_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Member Since</TableHead>
                    <TableHead className="text-right">Promote</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelf = String(currentUser?.id) === String(user.id);
                      const isAdminTarget = user.role === "admin";
                      const targetUserWeight = USER_ROLE_WEIGHT[user.role as UserRole] || 0;
                      // Admins can manage anyone (except themselves)
                      // Non-admins can manage users with EQUAL or LOWER ranks, but never admins
                      const outRanksTarget = currentUserRole === "admin" || currentUserWeight >= targetUserWeight;
                      const preventEdit = isSelf || isAdminTarget || !outRanksTarget;
                      const rolesToShow = Array.from(new Set([...allowedRolesToAssign, user.role as UserRole]));

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.name} {isSelf && <span className="text-xs text-muted-foreground ml-2">(You)</span>}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge className={USER_ROLE_COLORS[user.role]}>
                              {USER_ROLE_LABELS[user.role]}
                            </Badge>
                          </TableCell>
                          {/* Status — pill toggle */}
                          <TableCell>
                            <div className={cn("inline-flex items-center p-1 bg-secondary/40 rounded-lg border border-border/50 backdrop-blur-sm", preventEdit && "opacity-50 pointer-events-none")}>
                            <button
                              type="button"
                              onClick={() => !preventEdit && user.status !== "active" && openStatusDialog(user)}
                              disabled={preventEdit}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300",
                                user.status === "active"
                                  ? "bg-primary shadow-md text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                              )}
                            >
                              <UserCheck className="h-4 w-4" />
                              Active
                            </button>
                            <button
                              type="button"
                              onClick={() => !preventEdit && user.status !== "inactive" && openStatusDialog(user)}
                              disabled={preventEdit}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300",
                                user.status === "inactive"
                                  ? "bg-primary shadow-md text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                              )}
                            >
                              <UserX className="h-4 w-4" />
                              Inactive
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>{user.date_joined}</TableCell>
                        {/* Promote — role selector */}
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <Select
                              value={user.role}
                              disabled={preventEdit}
                              onValueChange={(value) => {
                                setSelectedUser(user);
                                setNewRole(value as UserRole);
                                setIsRoleDialogOpen(true);
                              }}
                            >
                              <SelectTrigger className="w-[190px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent align="end">
                                {rolesToShow.map((role) => (
                                  <SelectItem key={role} value={role}>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Role Change</DialogTitle>
              <DialogDescription>
                {selectedUser ? (
                  <>
                    Change <strong>{selectedUser.name}</strong>
                    {"'s"} role to <strong>{USER_ROLE_LABELS[newRole]}</strong>?
                  </>
                ) : (
                  "Confirm the selected role change."
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
                onClick={() => {
                  setIsRoleDialogOpen(false);
                  setSelectedUser(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {pendingStatusUser?.status === "active"
                  ? "Deactivate Account?"
                  : "Activate Account?"}
              </DialogTitle>
              <DialogDescription>
                {pendingStatusUser ? (
                  pendingStatusUser.status === "active" ? (
                    <>
                      <strong>{pendingStatusUser.name}</strong> will lose access
                      to the system immediately. You can reactivate their account
                      at any time.
                    </>
                  ) : (
                    <>
                      <strong>{pendingStatusUser.name}</strong> will regain full
                      access based on their current role. Make sure this is
                      intentional.
                    </>
                  )
                ) : (
                  "Confirm the status change."
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
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
                  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white",
                  pendingStatusUser?.status === "active"
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-primary hover:bg-primary/90",
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
