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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAllUsers, useUpdateUserRole, useDeleteUser, useToggleUserActive } from '@/lib/api/users';
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
  AlertTriangle,
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
  marble_coordinator: {
    label: 'Marble Coordinator',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: 'MC',
  },
  magro_coordinator: {
    label: 'Magro Coordinator',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    icon: 'GC',
  },
  coordinator: {
    label: 'Coordinator (Legacy)',
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
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

type RoleFilter = 'all' | 'requester' | 'marble_coordinator' | 'magro_coordinator' | 'maker' | 'dispatcher' | 'admin';
type StatusFilter = 'all' | 'active' | 'inactive';

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
  inactive?: boolean;
}

function AvatarInitials({ name, role, inactive }: AvatarInitialsProps) {
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
        inactive
          ? 'bg-slate-100 text-slate-400'
          : `${config.bg} ${config.color}`
      )}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border',
        isActive
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-red-50 text-red-700 border-red-200'
      )}
    >
      {isActive ? 'Active' : 'Suspended'}
    </span>
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
  const toggleActive = useToggleUserActive();

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Hard Delete Modal
  const [userToHardDelete, setUserToHardDelete] = useState<{ id: string; name: string; email: string } | null>(null);
  const [hardDeleteEmailInput, setHardDeleteEmailInput] = useState('');

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

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter((u) => u.is_active);
    } else if (statusFilter === 'inactive') {
      result = result.filter((u) => !u.is_active);
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
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Role counts for filter tabs
  const roleCounts = useMemo(() => {
    if (!users) return { all: 0, requester: 0, marble_coordinator: 0, magro_coordinator: 0, maker: 0, dispatcher: 0, admin: 0 };
    return {
      all: users.length,
      requester: users.filter((u) => u.role === 'requester').length,
      marble_coordinator: users.filter((u) => u.role === 'marble_coordinator').length,
      magro_coordinator: users.filter((u) => u.role === 'magro_coordinator').length,
      maker: users.filter((u) => u.role === 'maker').length,
      dispatcher: users.filter((u) => u.role === 'dispatcher').length,
      admin: users.filter((u) => u.role === 'admin').length,
    };
  }, [users]);

  // Status counts
  const statusCounts = useMemo(() => {
    if (!users) return { all: 0, active: 0, inactive: 0 };
    return {
      all: users.length,
      active: users.filter((u) => u.is_active).length,
      inactive: users.filter((u) => !u.is_active).length,
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
  // TOGGLE ACTIVE/INACTIVE HANDLER
  // ============================================================

  const handleToggleActive = async (user: Profile) => {
    if (user.id === profile?.id) {
      toast.error('You cannot suspend your own account');
      return;
    }

    const newStatus = !user.is_active;
    try {
      await toggleActive.mutateAsync({ userId: user.id, isActive: newStatus });
      toast.success(
        <div>
          <p className="font-semibold">{newStatus ? 'User Activated' : 'User Suspended'}</p>
          <p className="text-sm">
            {user.full_name} is now {newStatus ? 'active' : 'suspended'}
          </p>
        </div>
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user status');
    }
  };

  // ============================================================
  // HARD DELETE HANDLERS
  // ============================================================

  const handleHardDeleteClick = (user: Profile) => {
    if (user.id === profile?.id) {
      toast.error('You cannot delete your own account');
      return;
    }
    setUserToHardDelete({
      id: user.id,
      name: user.full_name,
      email: user.email || '',
    });
    setHardDeleteEmailInput('');
  };

  const handleHardDeleteConfirm = async () => {
    if (!userToHardDelete) return;
    try {
      await deleteUser.mutateAsync(userToHardDelete.id);
      toast.success(
        <div>
          <p className="font-semibold">User permanently deleted</p>
          <p className="text-sm">{userToHardDelete.name} and all their data have been removed</p>
        </div>
      );
      setUserToHardDelete(null);
      setHardDeleteEmailInput('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
      setUserToHardDelete(null);
      setHardDeleteEmailInput('');
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
                  <p className="text-xs text-slate-500 hidden sm:block">
                    {statusCounts.active} active, {statusCounts.inactive} suspended
                  </p>
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
        {/* Search + Status Filter Row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white border-slate-200"
            />
          </div>

          {/* Status Filter */}
          <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'inactive', label: 'Suspended' },
              ] as { key: StatusFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  statusFilter === tab.key
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                {tab.label}
                <span className={cn(
                  'ml-1.5 text-xs',
                  statusFilter === tab.key ? 'text-white/70' : 'text-slate-400'
                )}>
                  {statusCounts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Role Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 mb-4">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'requester', label: 'Requesters' },
              { key: 'marble_coordinator', label: 'Marble Coord.' },
              { key: 'magro_coordinator', label: 'Magro Coord.' },
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
                {searchQuery ? 'Try a different search term' : 'No users match the selected filters'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ============================================================ */}
            {/* DESKTOP TABLE */}
            {/* ============================================================ */}
            <div className="hidden lg:block">
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
                        <th className="text-center py-3 px-4 font-semibold text-xs uppercase tracking-wider text-slate-500">Status</th>
                        <th className="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wider text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((user) => {
                        const isSelf = user.id === profile?.id;
                        const inactive = !user.is_active;

                        return (
                          <tr
                            key={user.id}
                            className={cn(
                              'transition-colors',
                              isSelf && 'bg-indigo-50/30',
                              inactive && !isSelf && 'bg-slate-50/50',
                              !inactive && 'hover:bg-slate-50/70',
                            )}
                          >
                            {/* User: Avatar + Name + Email */}
                            <td className="py-3 px-4">
                              <div className={cn('flex items-center gap-3', inactive && 'opacity-60')}>
                                <AvatarInitials name={user.full_name} role={user.role} inactive={inactive} />
                                <div className="min-w-0">
                                  <p className={cn('font-semibold truncate', inactive ? 'text-slate-500' : 'text-slate-900')}>
                                    {user.full_name}
                                    {isSelf && (
                                      <span className="text-xs font-normal text-indigo-500 ml-1.5">(You)</span>
                                    )}
                                  </p>
                                  <p className="text-sm text-slate-500 truncate flex items-center gap-1 max-w-[220px]" title={user.email || ''}>
                                    <Mail className="h-3 w-3 shrink-0" />
                                    {user.email || 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Contact */}
                            <td className="py-3 px-4">
                              <span className={cn('text-sm flex items-center gap-1', inactive ? 'text-slate-400' : 'text-slate-600')}>
                                {user.phone ? (
                                  <>
                                    <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                                    {user.phone}
                                  </>
                                ) : (
                                  <span className="text-slate-400">--</span>
                                )}
                              </span>
                            </td>

                            {/* Department */}
                            <td className="py-3 px-4">
                              {user.department ? (
                                <span className={cn(
                                  'inline-flex items-center gap-1 text-sm capitalize',
                                  inactive ? 'text-slate-400' : 'text-slate-700'
                                )}>
                                  <Building2 className="h-3 w-3 text-slate-400" />
                                  {user.department}
                                </span>
                              ) : (
                                <span className="text-sm text-slate-400">--</span>
                              )}
                            </td>

                            {/* Current Role */}
                            <td className="py-3 px-4">
                              <div className={cn(inactive && 'opacity-60')}>
                                <RoleBadge role={user.role} />
                              </div>
                            </td>

                            {/* Change Role - WIDER DROPDOWN */}
                            <td className="py-3 px-4">
                              <Select
                                value={user.role}
                                onValueChange={(value) => initiateRoleChange(user, value)}
                                disabled={updateRole.isPending || isSelf}
                              >
                                <SelectTrigger className="w-[190px] h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="requester">Requester</SelectItem>
                                  <SelectItem value="maker">Maker</SelectItem>
                                  <SelectItem value="dispatcher">Dispatcher</SelectItem>
                                  <SelectItem value="marble_coordinator">Marble Coordinator</SelectItem>
                                  <SelectItem value="magro_coordinator">Magro Coordinator</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>

                            {/* Status Toggle */}
                            <td className="py-3 px-4">
                              <div className="flex flex-col items-center gap-1">
                                <Switch
                                  checked={user.is_active}
                                  onCheckedChange={() => handleToggleActive(user)}
                                  disabled={toggleActive.isPending || isSelf}
                                  className={user.is_active ? 'bg-emerald-500' : 'bg-slate-300'}
                                />
                                <span className={cn(
                                  'text-[10px] font-medium',
                                  user.is_active ? 'text-emerald-600' : 'text-red-500'
                                )}>
                                  {user.is_active ? 'Active' : 'Suspended'}
                                </span>
                              </div>
                            </td>

                            {/* Actions - Hard Delete */}
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleHardDeleteClick(user)}
                                disabled={deleteUser.isPending || isSelf}
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                title="Permanently delete user and all their data"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* ============================================================ */}
            {/* MOBILE / TABLET CARDS */}
            {/* ============================================================ */}
            <div className="lg:hidden space-y-3">
              {filteredUsers.map((user) => {
                const isSelf = user.id === profile?.id;
                const inactive = !user.is_active;

                return (
                  <Card
                    key={user.id}
                    className={cn(
                      'border-slate-200 overflow-hidden',
                      isSelf && 'ring-1 ring-indigo-200',
                      inactive && 'border-red-100 bg-slate-50/50'
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header: Avatar + Name + Status Badge */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <AvatarInitials name={user.full_name} role={user.role} inactive={inactive} />
                            <div className="min-w-0">
                              <p className={cn(
                                'font-semibold truncate',
                                inactive ? 'text-slate-500' : 'text-slate-900'
                              )}>
                                {user.full_name}
                                {isSelf && (
                                  <span className="text-xs font-normal text-indigo-500 ml-1">(You)</span>
                                )}
                              </p>
                              <p className="text-sm text-slate-500 truncate" title={user.email || ''}>
                                {user.email || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <RoleBadge role={user.role} size="sm" />
                            <StatusBadge isActive={user.is_active} />
                          </div>
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

                        {/* Actions Row */}
                        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                          {/* Change Role */}
                          <div className="flex-1 min-w-0">
                            <Select
                              value={user.role}
                              onValueChange={(value) => initiateRoleChange(user, value)}
                              disabled={updateRole.isPending || isSelf}
                            >
                              <SelectTrigger className="h-9 text-sm w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="requester">Requester</SelectItem>
                                <SelectItem value="maker">Maker</SelectItem>
                                <SelectItem value="dispatcher">Dispatcher</SelectItem>
                                <SelectItem value="marble_coordinator">Marble Coordinator</SelectItem>
                                <SelectItem value="magro_coordinator">Magro Coordinator</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Status Toggle */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={user.is_active}
                              onCheckedChange={() => handleToggleActive(user)}
                              disabled={toggleActive.isPending || isSelf}
                              className={user.is_active ? 'bg-emerald-500' : 'bg-slate-300'}
                            />
                          </div>

                          {/* Hard Delete */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleHardDeleteClick(user)}
                            disabled={deleteUser.isPending || isSelf}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
                  <SelectItem value="marble_coordinator">Marble Coordinator</SelectItem>
                  <SelectItem value="magro_coordinator">Magro Coordinator</SelectItem>
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
      {/* DIALOG: Hard Delete Confirmation (Strict Email Verification) */}
      {/* ============================================================ */}
      <AlertDialog
        open={!!userToHardDelete}
        onOpenChange={(open) => {
          if (!open) {
            setUserToHardDelete(null);
            setHardDeleteEmailInput('');
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-[480px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              Permanently Delete User
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to permanently delete <strong className="text-slate-900">{userToHardDelete?.name}</strong>.
                This action <strong className="text-red-600">cannot be undone</strong>.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 space-y-1">
                <p className="font-semibold">This will permanently destroy:</p>
                <ul className="list-disc list-inside space-y-0.5 text-red-700">
                  <li>The user's account and profile</li>
                  <li>ALL sample requests they created</li>
                  <li>ALL request items and tracking history</li>
                  <li>ALL saved product templates</li>
                </ul>
              </div>
              <div className="pt-1">
                <p className="text-sm font-medium text-slate-700 mb-1.5">
                  Type <strong className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-900">{userToHardDelete?.email}</strong> to confirm:
                </p>
                <Input
                  value={hardDeleteEmailInput}
                  onChange={(e) => setHardDeleteEmailInput(e.target.value)}
                  placeholder="Type email address here..."
                  className="h-10 font-mono text-sm border-red-200 focus-visible:ring-red-500"
                  autoComplete="off"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setUserToHardDelete(null);
                setHardDeleteEmailInput('');
              }}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleHardDeleteConfirm}
              disabled={
                deleteUser.isPending ||
                hardDeleteEmailInput !== userToHardDelete?.email
              }
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {deleteUser.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
