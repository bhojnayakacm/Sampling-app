import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { Trash2, UserPlus, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';

interface CreateUserForm {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: string;
  department: string;
}

export default function UserManagement() {
  const { profile, signOut, session } = useAuth();
  const navigate = useNavigate();
  const { data: users, isLoading, refetch } = useAllUsers();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();

  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
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

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateRole.mutateAsync({ userId, newRole });
      toast.success('User role updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user role');
    }
  };

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

  const resetCreateForm = () => {
    setCreateForm({
      email: '',
      password: '',
      full_name: '',
      phone: '',
      role: '',
      department: '',
    });
    setShowPassword(false);
  };

  const handleCreateUser = async () => {
    // Validation
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

    // Validate phone if provided
    if (createForm.phone && !/^\d{10}$/.test(createForm.phone)) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }

    setCreating(true);

    try {
      // Get the Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Call the Edge Function
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

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      toast.success(`User ${createForm.email} created successfully as ${createForm.role}`);
      setCreateModalOpen(false);
      resetCreateForm();
      refetch(); // Refresh the user list
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      admin: 'destructive',
      coordinator: 'default',
      maker: 'secondary',
      requester: 'outline',
      dispatcher: 'secondary',
    };
    return <Badge variant={variants[role] || 'outline'}>{role.toUpperCase()}</Badge>;
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="default" className="bg-green-500">Active</Badge>
    ) : (
      <Badge variant="secondary" className="bg-gray-400">Inactive</Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 hidden sm:block">{profile?.full_name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-slate-900">{users?.length || 0} Users</h2>
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <UserPlus className="h-4 w-4" />
            Create User
          </Button>
        </div>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop view - Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Phone</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Department</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Current Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Change Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-900">{user.full_name}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{user.email}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{user.phone || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 capitalize">
                        {user.department || 'N/A'}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(user.is_active)}</td>
                      <td className="py-3 px-4">{getRoleBadge(user.role)}</td>
                      <td className="py-3 px-4">
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                          disabled={updateRole.isPending}
                        >
                          <SelectTrigger className="w-40">
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
                      <td className="py-3 px-4">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(user.id, user.full_name)}
                          disabled={deleteUser.isPending || user.id === profile?.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile view - Cards */}
            <div className="md:hidden space-y-4">
              {users?.map((user) => (
                <Card key={user.id} className="shadow-sm border-slate-200">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-slate-900">{user.full_name}</p>
                          <p className="text-sm text-slate-600">{user.email}</p>
                          <p className="text-sm text-slate-600">{user.phone || 'No phone'}</p>
                          {user.department && (
                            <p className="text-sm text-slate-600 capitalize">
                              Dept: {user.department}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(user.is_active)}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Current Role:</span>
                        {getRoleBadge(user.role)}
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block text-slate-700">Change Role:</label>
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                          disabled={updateRole.isPending}
                        >
                          <SelectTrigger className="w-full">
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

                      <div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => handleDeleteClick(user.id, user.full_name)}
                          disabled={deleteUser.isPending || user.id === profile?.id}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete User
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Create User Modal */}
      <Dialog open={createModalOpen} onOpenChange={(open) => {
        setCreateModalOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <UserPlus className="h-5 w-5" />
              Create New User
            </DialogTitle>
            <DialogDescription>
              Create a new Coordinator, Maker, Dispatcher, or Requester account. The user will be able to log in immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name" className="text-slate-700">Full Name *</Label>
              <Input
                id="create-name"
                placeholder="Enter full name"
                value={createForm.full_name}
                onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-email" className="text-slate-700">Email *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="user@company.com"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-password" className="text-slate-700">Password *</Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="h-10 pr-10"
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
              <Label htmlFor="create-phone" className="text-slate-700">Phone Number</Label>
              <Input
                id="create-phone"
                type="tel"
                placeholder="10-digit number (optional)"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                maxLength={10}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-role" className="text-slate-700">Role *</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) => setCreateForm({ ...createForm, role: value, department: '' })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                  <SelectItem value="maker">Maker</SelectItem>
                  <SelectItem value="dispatcher">Dispatcher</SelectItem>
                  <SelectItem value="requester">Requester</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department - Only visible for Requesters */}
            {createForm.role === 'requester' && (
              <div className="space-y-2">
                <Label htmlFor="create-department" className="text-slate-700">Department *</Label>
                <Select
                  value={createForm.department}
                  onValueChange={(value) => setCreateForm({ ...createForm, department: value })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="logistics">Logistics</SelectItem>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user <strong>{userToDelete?.name}</strong> and all their associated data.
              This action cannot be undone.
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
