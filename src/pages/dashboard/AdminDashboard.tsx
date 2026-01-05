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
  Sparkles,
  Truck
} from 'lucide-react';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useAllRequestsStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100">
      {/* Premium Gradient Header */}
      <header className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black">Admin Dashboard</h1>
                <p className="text-sm text-slate-400">{profile?.full_name} | System Administrator</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={signOut}
              className="min-h-[56px] py-4 px-4 gap-2 text-white hover:bg-white/10 hover:text-white font-semibold"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* System Overview Stats */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">System Overview</h2>
              <p className="text-sm text-slate-500">Real-time request statistics</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Requests */}
            <Card
              className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden cursor-pointer group hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              onClick={() => navigate('/requests')}
            >
              <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Total</p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                      {isLoading ? '...' : stats?.total || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Inbox className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                  <ArrowRight className="h-3 w-3" />
                  <span>View all requests</span>
                </div>
              </CardContent>
            </Card>

            {/* Pending */}
            <Card
              className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden cursor-pointer group hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              onClick={() => navigate('/requests?status=pending_approval')}
            >
              <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Pending</p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                      {isLoading ? '...' : stats?.pending || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                  <ArrowRight className="h-3 w-3" />
                  <span>Needs attention</span>
                </div>
              </CardContent>
            </Card>

            {/* In Production */}
            <Card
              className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden cursor-pointer group hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              onClick={() => navigate('/requests?status=in_production')}
            >
              <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-500" />
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-violet-600 uppercase tracking-wide">Production</p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                      {isLoading ? '...' : stats?.in_production || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Cog className="h-6 w-6 text-violet-600" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                  <ArrowRight className="h-3 w-3" />
                  <span>Being processed</span>
                </div>
              </CardContent>
            </Card>

            {/* Dispatched */}
            <Card
              className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden cursor-pointer group hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              onClick={() => navigate('/requests?status=dispatched')}
            >
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-green-500" />
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Dispatched</p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                      {isLoading ? '...' : stats?.dispatched || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Truck className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                  <ArrowRight className="h-3 w-3" />
                  <span>Sent out</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Management Hub */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Management Section */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-blue-500" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">User Management</h3>
                  <p className="text-sm text-slate-500">Manage system users and roles</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Coordinators</p>
                      <p className="text-xs text-slate-500">Approve and manage requests</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-emerald-50/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Cog className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Makers</p>
                      <p className="text-xs text-slate-500">Production floor staff</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-violet-50/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Requesters</p>
                      <p className="text-xs text-slate-500">Submit sample requests</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => navigate('/admin/users')}
                className="w-full min-h-[56px] text-base font-bold gap-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl"
              >
                <Users className="h-5 w-5" />
                Manage Users
                <ArrowRight className="h-5 w-5" />
              </Button>
            </CardContent>
          </Card>

          {/* System Settings Section */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-500" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <Settings className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Product Management</h3>
                  <p className="text-sm text-slate-500">Configure products and options</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-violet-50/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Product Types</p>
                      <p className="text-xs text-slate-500">Marble, Tile, Terrazzo, Quartz</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-amber-50/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Quality Options</p>
                      <p className="text-xs text-slate-500">228 marble qualities available</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-teal-50/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                      <Settings className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Finish & Size Options</p>
                      <p className="text-xs text-slate-500">Customize available options</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full min-h-[56px] text-base font-bold gap-3 border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300 transition-all"
                disabled
              >
                <Settings className="h-5 w-5" />
                Product Settings
                <span className="text-xs bg-violet-100 px-2 py-0.5 rounded-full">Coming Soon</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Quick Actions</h2>
              <p className="text-sm text-slate-500">Common administrative tasks</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              onClick={() => navigate('/requests')}
              className="min-h-[64px] text-base font-bold gap-3 bg-white/80 hover:bg-white text-slate-700 border border-slate-200 shadow-md hover:shadow-lg transition-all"
            >
              <Inbox className="h-5 w-5 text-indigo-600" />
              View All Requests
            </Button>
            <Button
              onClick={() => navigate('/admin/users')}
              className="min-h-[64px] text-base font-bold gap-3 bg-white/80 hover:bg-white text-slate-700 border border-slate-200 shadow-md hover:shadow-lg transition-all"
            >
              <Users className="h-5 w-5 text-blue-600" />
              Manage Users
            </Button>
            <Button
              className="min-h-[64px] text-base font-bold gap-3 bg-white/80 hover:bg-white text-slate-700 border border-slate-200 shadow-md hover:shadow-lg transition-all"
              disabled
            >
              <BarChart3 className="h-5 w-5 text-violet-600" />
              View Reports
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">Soon</span>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
