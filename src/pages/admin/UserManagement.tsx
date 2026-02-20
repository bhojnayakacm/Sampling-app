import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAllUsers, useUpdateUserRole, useDeleteUser } from '@/lib/api/users';
import type { Profile } from '@/types';
import { toast } from 'sonner';
import {
  Trash2,
  UserPlus,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  Search,
  Shield,
  Users,
  Mail,
  Phone,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserManagementSkeleton } from '@/components/skeletons';

// ============================================================
// CONSTANTS
// ============================================================

const ROLE_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
}> = {
  admin: {
    label: 'Admin',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'A',
  },
  coordinator: {
    label: 'Coordinator',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: 'C',
  },
  requester: {
    label: 'Requester',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'R',
  },
  maker: {
    label: 'Maker',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'M',
  },
  dispatcher: {
    label: 'Dispatcher',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'D',
  },
};

const DEPARTMENTS = ['sales', 'marketing', 'logistics'];

type RoleFilter = 'all' | 'requester' | 'coordinator' | 'maker' | 'dispatcher' | 'admin';

// ============================================================
// SUB-COMPONENTS
// ============================================================

interface RoleBadgeProps {
  role: string;
  size?: 'sm' | 'md';
}

function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.requester;
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full border',
        config.color, config.bg, config.border,
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      )}
    >
      {config.label}
    </span>
  );
}

interface AvatarInitialsProps {
  name: string;
  role: string;
}

function AvatarInitials({ name, role }: AvatarInitialsProps) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.requester;
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm shrink-0',
        config.bg, config.color
      )}
    >
      {initials}
    </div>
  );
}

// ============================================================
// CREATE USER FORM TYPES
// ============================================================

interface CreateUserForm {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: string;
  department: string;
}

// Role change pending state - when user selects "requester" and we need a department
interface PendingRoleChange {
  userId: string;
  userName: string;
  currentRole: string;
  newRole: string;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function UserManagement() {
  const { profile, signOut, session } = useAuth();
  const navigate = useNavigate();
  const { data: users, isLoading, refetch } = useAllUsers();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);

  // Create User Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: '',
    department: '',
  });

  // Role Change Modal (for requester department prompt)
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [roleChangeDepartment, setRoleChangeDepartment] = useState('');

  // ============================================================
  // FILTERING & SEARCH
  // ============================================================

  const filteredUsers = useMemo(() => {
    if (!users) return [];

    let result = users;

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter);
    }

    // Search by name or email
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
      );
    }

    return result;
  }, [users, roleFilter, searchQuery]);

  // Role counts for filter tabs
  const roleCounts = useMemo(() => {
    if (!users) return { all: 0, requester: 0, coordinator: 0, maker: 0, dispatcher: 0, admin: 0 };
    return {
      all: users.length,
      requester: users.filter((u) => u.role === 'requester').length,
      coordinator: users.filter((u) => u.role === 'coordinator').length,
      maker: users.filter((u) => u.role === 'maker').length,
      dispatcher: users.filter((u) => u.role === 'dispatcher').length,
      admin: users.filter((u) => u.role === 'admin').length,
    };
  }, [users]);

  // ============================================================
  // ROLE CHANGE HANDLERS
  // ============================================================

  const initiateRoleChange = (user: Profile, newRole: string) => {
    if (newRole === user.role) return; // No change

    if (newRole === 'requester') {
      // Scenario A: Changing TO requester -> prompt for department
      setPendingRoleChange({
        userId: user.id,
        userName: user.full_name,
        currentRole: user.role,
        newRole,
      });
      setRoleChangeDepartment('');
    } else {
      // Scenario B: Changing to any other role -> auto-clear department
      executeRoleChange(user.id, newRole, null);
    }
  };

  const executeRoleChange = async (userId: string, newRole: string, department: string | null) => {
    try {
      await updateRole.mutateAsync({ userId, newRole, department });
      toast.success(
        <div>
          <p className="font-semibold">Role updated</p>
          <p className="text-sm">
            Changed to {ROLE_CONFIG[newRole]?.label || newRole}
            {department ? ` (${department})` : ''}
          </p>
        </div>
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    }
  };

  const confirmRoleChange = async () => {
    if (!pendingRoleChange) return;

    if (!roleChangeDepartment) {
      toast.error('Please select a department');
      return;
    }

    await executeRoleChange(
      pendingRoleChange.userId,
      pendingRoleChange.newRole,
      roleChangeDepartment
    );
    setPendingRoleChange(null);
    setRoleChangeDepartment('');
  };

  // ============================================================
  // DELETE HANDLERS
  // ============================================================

  const handleDeleteClick = (userId: string, userName: string) => {
    if (userId === profile?.id) {
      toast.error('You cannot delete your own account');
      return;
    }
    setUserToDelete({ id: userId, name: userName });
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser.mutateAsync(userToDelete.id);
      toast.success('User deleted successfully');
      setUserToDelete(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
      setUserToDelete(null);
    }
  };

  // ============================================================
  // CREATE USER HANDLERS
  // ============================================================

  const resetCreateForm = () => {
    setCreateForm({ email: '', password: '', full_name: '', phone: '', role: '', department: '' });
    setShowPassword(false);
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password || !createForm.full_name || !createForm.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (createForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (createForm.role === 'requester' && !createForm.department) {
      toast.error('Department is required for requesters');
      return;
    }

    if (createForm.phone && !/^\d{10}$/.test(createForm.phone)) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }

    setCreating(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          email: createForm.email,
          password: createForm.password,
          full_name: createForm.full_name,
          phone: createForm.phone || null,
          role: createForm.role,
          department: createForm.role === 'requester' ? createForm.department : null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create user');

      toast.success(`User ${createForm.email} created as ${ROLE_CONFIG[createForm.role]?.label || createForm.role}`);
      setCreateModalOpen(false);
      resetCreateForm();
      refetch();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (isLoading) {
    return <UserManagementSkeleton />;
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="gap-2 text-slate-600"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900">User Management</h1>
                  <p className="text-xs text-slate-500 hidden sm:block">{users?.length || 0} users total</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => setCreateModalOpen(true)}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                size="sm"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Create User</span>
                <span className="sm:hidden">Add</span>
              </Button>
              <Button variant="outline" size="sm" onClick={signOut} className="hidden sm:flex">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search + Filters Bar */}
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white border-slate-200"
            />
          </div>

          {/* Role Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'requester', label: 'Requesters' },
                { key: 'coordinator', label: 'Coordinators' },
                { key: 'maker', label: 'Makers' },
                { key: 'dispatcher', label: 'Dispatchers' },
                { key: 'admin', label: 'Admins' },
              ] as { key: RoleFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRoleFilter(tab.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                  roleFilter === tab.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                    roleFilter === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {roleCounts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
            {filteredUsers.length === users?.length
              ? `${filteredUsers.length} users`
              : `${filteredUsers.length} of ${users?.length} users`
            }
          </p>
        </div>

        {/* Empty State */}
        {filteredUsers.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-700 mb-1">No users found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery ? 'Try a different search term' : 'No users match the selected filter'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Card className="border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-slate-500">User</th>
                        <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-slate-500">Contact</th>
                        <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-slate-500">Department</th>
                        <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-slate-500">Role</th>
                        <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-slate-500">Change Role</th>
                        <th className="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wider text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((user) => (
                        <tr
                          key={user.id}
                          className={cn(
                            'hover:bg-slate-50/70 transition-colors',
                            user.id === profile?.id && 'bg-indigo-50/30'
                          )}
                        >
                          {/* User: Avatar + Name */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <AvatarInitials name={user.full_name} role={user.role} />
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">
                                  {user.full_name}
                                  {user.id === profile?.id && (
                                    <span className="text-xs font-normal text-indigo-500 ml-1.5">(You)</span>
                                  )}
                                </p>
                                <p className="text-sm text-slate-500 truncate flex items-center gap-1">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  {user.email || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="py-3 px-4">
                            {user.phone ? (
                              <span className="text-sm text-slate-600 flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                                {user.phone}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">--</span>
                            )}
                          </td>

                          {/* Department */}
                          <td className="py-3 px-4">
                            {user.department ? (
                              <span className="inline-flex items-center gap-1 text-sm text-slate-700 capitalize">
                                <Building2 className="h-3 w-3 text-slate-400" />
                                {user.department}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">--</span>
                            )}
                          </td>

                          {/* Current Role */}
                          <td className="py-3 px-4">
                            <RoleBadge role={user.role} />
                          </td>

                          {/* Change Role */}
                          <td className="py-3 px-4">
                            <Select
                              value={user.role}
                              onValueChange={(value) => initiateRoleChange(user, value)}
                              disabled={updateRole.isPending || user.id === profile?.id}
                            >
                              <SelectTrigger className="w-[140px] h-9 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="requester">Requester</SelectItem>
                                <SelectItem value="maker">Maker</SelectItem>
                                <SelectItem value="dispatcher">Dispatcher</SelectItem>
                                <SelectItem value="coordinator">Coordinator</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(user.id, user.full_name)}
                              disabled={deleteUser.isPending || user.id === profile?.id}
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredUsers.map((user) => (
                <Card
                  key={user.id}
                  className={cn(
                    'border-slate-200 overflow-hidden',
                    user.id === profile?.id && 'ring-1 ring-indigo-200'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header: Avatar + Name + Role Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarInitials name={user.full_name} role={user.role} />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {user.full_name}
                              {user.id === profile?.id && (
                                <span className="text-xs font-normal text-indigo-500 ml-1">(You)</span>
                              )}
                            </p>
                            <p className="text-sm text-slate-500 truncate">{user.email || 'N/A'}</p>
                          </div>
                        </div>
                        <RoleBadge role={user.role} size="sm" />
                      </div>

                      {/* Info Row */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {user.phone}
                          </span>
                        )}
                        {user.department && (
                          <span className="flex items-center gap-1 capitalize">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            {user.department}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                        <div className="flex-1">
                          <Select
                            value={user.role}
                            onValueChange={(value) => initiateRoleChange(user, value)}
                            disabled={updateRole.isPending || user.id === profile?.id}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <span className="text-slate-500 mr-1">Role:</span>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="requester">Requester</SelectItem>
                              <SelectItem value="maker">Maker</SelectItem>
                              <SelectItem value="dispatcher">Dispatcher</SelectItem>
                              <SelectItem value="coordinator">Coordinator</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(user.id, user.full_name)}
                          disabled={deleteUser.isPending || user.id === profile?.id}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>

      {/* ============================================================ */}
      {/* MODAL: Assign Department (when changing TO Requester) */}
      {/* ============================================================ */}
      <Dialog
        open={!!pendingRoleChange}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRoleChange(null);
            setRoleChangeDepartment('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              Assign Department
            </DialogTitle>
            <DialogDescription>
              You're changing <strong>{pendingRoleChange?.userName}</strong> from{' '}
              <strong>{ROLE_CONFIG[pendingRoleChange?.currentRole || '']?.label}</strong> to{' '}
              <strong>Requester</strong>. Requesters need a department assignment.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="role-change-dept" className="text-slate-700 font-semibold">
              Department *
            </Label>
            <Select
              value={roleChangeDepartment}
              onValueChange={setRoleChangeDepartment}
            >
              <SelectTrigger className="mt-1.5 h-11">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept} className="capitalize">
                    {dept.charAt(0).toUpperCase() + dept.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingRoleChange(null);
                setRoleChangeDepartment('');
              }}
              disabled={updateRole.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRoleChange}
              disabled={updateRole.isPending || !roleChangeDepartment}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {updateRole.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Confirm Role Change'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL: Create User */}
      {/* ============================================================ */}
      <Dialog
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-indigo-600" />
              </div>
              Create New User
            </DialogTitle>
            <DialogDescription>
              Create a new account. The user will be able to log in immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name" className="text-slate-700 font-semibold">Full Name *</Label>
              <Input
                id="create-name"
                placeholder="Enter full name"
                value={createForm.full_name}
                onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-email" className="text-slate-700 font-semibold">Email *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="user@company.com"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-password" className="text-slate-700 font-semibold">Password *</Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-phone" className="text-slate-700 font-semibold">Phone Number</Label>
              <Input
                id="create-phone"
                type="tel"
                placeholder="10-digit number (optional)"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                maxLength={10}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-role" className="text-slate-700 font-semibold">Role *</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) => setCreateForm({ ...createForm, role: value, department: '' })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requester">Requester</SelectItem>
                  <SelectItem value="maker">Maker</SelectItem>
                  <SelectItem value="dispatcher">Dispatcher</SelectItem>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department - Only for Requesters */}
            {createForm.role === 'requester' && (
              <div className="space-y-2">
                <Label htmlFor="create-department" className="text-slate-700 font-semibold">Department *</Label>
                <Select
                  value={createForm.department}
                  onValueChange={(value) => setCreateForm({ ...createForm, department: value })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept} className="capitalize">
                        {dept.charAt(0).toUpperCase() + dept.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateModalOpen(false);
                resetCreateForm();
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={creating}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: Delete Confirmation */}
      {/* ============================================================ */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user <strong>{userToDelete?.name}</strong> and all their
              associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
