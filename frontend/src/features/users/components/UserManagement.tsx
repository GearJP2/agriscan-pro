import { useState, useMemo, useEffect } from 'react';
import { Users, UserPlus, Search, Shield, UserCheck, UserX } from 'lucide-react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { User, UserRole, UserStatus, USER_ROLE_LABELS, USER_ROLE_COLORS, USER_ROLE_WEIGHT, USER_STATUS_COLORS } from '@/types/user';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';

const UserManagement = () => {
  const { isAdmin, role: currentUserRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [isLoading, setIsLoading] = useState(true);

  const currentUserWeight = USER_ROLE_WEIGHT[currentUserRole] || 0;

  // Fetch users from backend
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/accounts/users/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();

      // Map Django's 'is_active' boolean to our frontend 'status' string
      const mappedUsers: User[] = data.map((u: any) => ({
        ...u,
        status: u.is_active ? 'active' : 'inactive',
        date_joined: new Date(u.date_joined).toLocaleDateString('en-GB', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        })
      }));

      setUsers(mappedUsers);
    } catch (error) {
      toast({
        title: 'Error loading users',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserWeight >= USER_ROLE_WEIGHT['research_assistant']) {
      fetchUsers();
    }
  }, [currentUserWeight]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (user.role === 'admin') return false; // Hide admins from user management completely
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.status === 'active').length,
      inactive: users.filter((u) => u.status === 'inactive').length,
      admins: users.filter((u) => u.role === 'admin').length,
    };
  }, [users]);

  // Redirect users with lower than research_assistant access
  if (currentUserWeight < USER_ROLE_WEIGHT['research_assistant']) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleRoleChange = async () => {
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8000/api/accounts/users/${selectedUser.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) throw new Error('Failed to update role');

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id ? { ...u, role: newRole } : u
        )
      );

      toast({
        title: 'Role Updated',
        description: `${selectedUser.name}'s role has been changed to ${USER_ROLE_LABELS[newRole]}.`,
      });
    } catch (err) {
      toast({
        title: 'Update failed',
        description: 'Could not change user role.',
        variant: 'destructive',
      });
    } finally {
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const handleStatusToggle = async (user: User) => {
    const newStatus: UserStatus = user.status === 'active' ? 'inactive' : 'active';
    const newIsActive = newStatus === 'active';

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8000/api/accounts/users/${user.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: newIsActive }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, status: newStatus } : u
        )
      );

      toast({
        title: 'Status Updated',
        description: `${user.name} is now ${newStatus}.`,
      });
    } catch (err) {
      toast({
        title: 'Update failed',
        description: 'Could not change user status.',
        variant: 'destructive',
      });
    }
  };

  const openRoleDialog = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setIsRoleDialogOpen(true);
  };

  const availableRoles: UserRole[] = ['user', 'research_assistant', 'researcher', 'head_researcher', 'admin'];
  const allowedRolesToAssign = availableRoles.filter(r => USER_ROLE_WEIGHT[r] <= currentUserWeight);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="mt-2 text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{stats.total}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{stats.active}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Inactive Users</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{stats.inactive}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Administrators</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{stats.admins}</p>
                </div>
                <div className="rounded-lg bg-danger/10 p-3 text-danger">
                  <Shield className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="glass-card mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="researcher">Researcher</SelectItem>
                  <SelectItem value="research_assistant">Research Assistant</SelectItem>
                  <SelectItem value="head_researcher">Head Researcher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add User
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">
              Users ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-muted-foreground text-sm font-medium">Loading users...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Name</TableHead>
                    <TableHead className="text-left">Email</TableHead>
                    <TableHead className="text-left">Role</TableHead>
                    {/* <TableHead className="text-center">Online Status</TableHead> */}
                    <TableHead className="text-left">Account Status</TableHead>
                    <TableHead className="text-left">Member Since</TableHead>
                    {/* <TableHead className="text-center">Last Online</TableHead> */}
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const canMutate = USER_ROLE_WEIGHT[user.role] <= currentUserWeight;
                    const canToggleStatus = currentUserRole === 'admin' || currentUserRole === 'head_researcher';

                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium text-left">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground text-left">{user.email}</TableCell>
                        <TableCell className="text-left">
                          <Badge className={USER_ROLE_COLORS[user.role]}>
                            {USER_ROLE_LABELS[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left">
                          {(!canMutate || !canToggleStatus) ? (
                            <div className="flex items-center">
                              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${user.status === 'active'
                                ? 'bg-success/10 text-success border-success/20'
                                : 'bg-muted text-muted-foreground border-border/50'
                                }`}>
                                {user.status === 'active' ? (
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                                  </span>
                                ) : (
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/50"></span>
                                )}
                                <span className="capitalize">{user.status}</span>
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center p-1 bg-secondary/40 rounded-lg border border-border/50 backdrop-blur-sm">
                              <button
                                onClick={() => user.status !== 'active' && handleStatusToggle(user)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${user.status === 'active'
                                  ? 'bg-primary shadow-md text-primary-foreground'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                  }`}
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                Active
                              </button>
                              <button
                                onClick={() => user.status === 'active' && handleStatusToggle(user)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${user.status === 'inactive'
                                  ? 'bg-primary shadow-md text-primary-foreground'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                  }`}
                              >
                                <UserX className="h-3.5 w-3.5" />
                                Inactive
                              </button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-left text-muted-foreground">
                          {user.date_joined || '-'}
                        </TableCell>
                        {/* <TableCell className="text-center text-muted-foreground">
                      {user.last_active || '-'}
                    </TableCell> */}
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canMutate}
                            onClick={() => openRoleDialog(user)}
                          >
                            Change Role
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Role Change Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {allowedRolesToAssign.map(userRole => (
                  <SelectItem key={userRole} value={userRole}>{USER_ROLE_LABELS[userRole]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRoleChange}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
