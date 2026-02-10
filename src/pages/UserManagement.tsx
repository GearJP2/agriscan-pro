import { useState, useMemo } from 'react';
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

import { mockUsers } from '@/data/mockUsers';
import { User, UserRole, UserStatus, USER_ROLE_LABELS, USER_ROLE_COLORS, USER_STATUS_COLORS } from '@/types/user';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';

const UserManagement = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('user');

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
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

  // Redirect non-admins - must be after all hooks
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleRoleChange = () => {
    if (!selectedUser) return;

    setUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id ? { ...u, role: newRole } : u
      )
    );

    toast({
      title: 'Role Updated',
      description: `${selectedUser.name}'s role has been changed to ${USER_ROLE_LABELS[newRole]}.`,
    });

    setIsRoleDialogOpen(false);
    setSelectedUser(null);
  };

  const handleStatusToggle = (user: User) => {
    const newStatus: UserStatus = user.status === 'active' ? 'inactive' : 'active';
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, status: newStatus } : u
      )
    );

    toast({
      title: 'Status Updated',
      description: `${user.name} is now ${newStatus}.`,
    });
  };

  const openRoleDialog = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setIsRoleDialogOpen(true);
  };

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Name</TableHead>
                  <TableHead className="text-center">Email</TableHead>
                  <TableHead className="text-center">Role</TableHead>
                  {/* <TableHead className="text-center">Online Status</TableHead> */}
                  <TableHead className="text-center">Account Status</TableHead>
                  {/* <TableHead className="text-center">Last Online</TableHead> */}
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-center">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground text-center">{user.email}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={USER_ROLE_COLORS[user.role]}>
                        {USER_ROLE_LABELS[user.role]}
                      </Badge>
                    </TableCell>
                    {/* <TableCell className="text-center">
                      <Badge className={user.online_status === 'online' ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}>
                        {user.online_status === 'online' ? 'Online' : 'Offline'}
                      </Badge>
                    </TableCell> */}
                    <TableCell className="text-center">
                      <div className="inline-flex items-center p-1 bg-muted/50 rounded-lg border border-border/50">
                        <button
                          onClick={() => user.status !== 'active' && handleStatusToggle(user)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${user.status === 'active'
                            ? 'bg-background shadow-sm text-foreground ring-1 ring-border/50'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Active
                        </button>
                        <button
                          onClick={() => user.status === 'active' && handleStatusToggle(user)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${user.status === 'inactive'
                            ? 'bg-background shadow-sm text-foreground ring-1 ring-border/50'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Inactive
                        </button>
                      </div>
                    </TableCell>
                    {/* <TableCell className="text-center text-muted-foreground">
                      {user.last_active || '-'}
                    </TableCell> */}
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRoleDialog(user)}
                      >
                        Change Role
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="researcher">Researcher</SelectItem>
                <SelectItem value="research_assistant">Research Assistant</SelectItem>
                <SelectItem value="head_researcher">Head Researcher</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
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
