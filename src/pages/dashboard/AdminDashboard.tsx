import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAllRequestsStats } from '@/lib/api/requests';
import {
  Inbox,
  Clock,
  Cog,
  Package,
  ArrowRight,
  LogOut,
  Shield,
  Users,
  Settings,
  BarChart3,
  Truck,
  LayoutDashboard
} from 'lucide-react';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useAllRequestsStats();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Clean White Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center">
                <LayoutDashboard className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-sm text-slate-500">{profile?.full_name}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={signOut}
              className="min-h-[44px] gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* System Overview Stats */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">System Overview</h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Requests */}
            <Card
              className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate('/requests')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Inbox className="h-5 w-5 text-blue-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? '...' : stats?.total || 0}
                </p>
                <p className="text-sm text-slate-500 mt-1">Total Requests</p>
              </CardContent>
            </Card>

            {/* Pending */}
            <Card
              className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate('/requests?status=pending_approval')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? '...' : stats?.pending || 0}
                </p>
                <p className="text-sm text-slate-500 mt-1">Pending</p>
              </CardContent>
            </Card>

            {/* In Production */}
            <Card
              className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate('/requests?status=in_production')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Cog className="h-5 w-5 text-violet-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-violet-500 transition-colors" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? '...' : stats?.in_production || 0}
                </p>
                <p className="text-sm text-slate-500 mt-1">In Production</p>
              </CardContent>
            </Card>

            {/* Dispatched */}
            <Card
              className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate('/requests?status=dispatched')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? '...' : stats?.dispatched || 0}
                </p>
                <p className="text-sm text-slate-500 mt-1">Dispatched</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Management Hub */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Management Section */}
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">User Management</h3>
                  <p className="text-sm text-slate-500">Manage system users and roles</p>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="h-8 w-8 rounded-md bg-blue-100 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Coordinators</p>
                    <p className="text-xs text-slate-500">Approve and manage requests</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="h-8 w-8 rounded-md bg-emerald-100 flex items-center justify-center">
                    <Cog className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Makers</p>
                    <p className="text-xs text-slate-500">Production floor staff</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="h-8 w-8 rounded-md bg-violet-100 flex items-center justify-center">
                    <Package className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Requesters</p>
                    <p className="text-xs text-slate-500">Submit sample requests</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => navigate('/admin/users')}
                className="w-full min-h-[48px] gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <Users className="h-4 w-4" />
                Manage Users
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* System Settings Section */}
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Settings className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Product Management</h3>
                  <p className="text-sm text-slate-500">Configure products and options</p>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="h-8 w-8 rounded-md bg-violet-100 flex items-center justify-center">
                    <Package className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Product Types</p>
                    <p className="text-xs text-slate-500">Marble, Tile, Terrazzo, Quartz</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="h-8 w-8 rounded-md bg-amber-100 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Quality Options</p>
                    <p className="text-xs text-slate-500">228 marble qualities available</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="h-8 w-8 rounded-md bg-teal-100 flex items-center justify-center">
                    <Settings className="h-4 w-4 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Finish & Size Options</p>
                    <p className="text-xs text-slate-500">Customize available options</p>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full min-h-[48px] gap-2 border-slate-200 text-slate-600"
                disabled
              >
                <Settings className="h-4 w-4" />
                Product Settings
                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full ml-auto">Coming Soon</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <ArrowRight className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/requests')}
              className="min-h-[52px] gap-2 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 justify-start px-4"
            >
              <Inbox className="h-5 w-5 text-indigo-500" />
              View All Requests
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/users')}
              className="min-h-[52px] gap-2 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 justify-start px-4"
            >
              <Users className="h-5 w-5 text-blue-500" />
              Manage Users
            </Button>
            <Button
              variant="outline"
              className="min-h-[52px] gap-2 bg-white border-slate-200 text-slate-400 justify-start px-4"
              disabled
            >
              <BarChart3 className="h-5 w-5" />
              View Reports
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full ml-auto">Soon</span>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
