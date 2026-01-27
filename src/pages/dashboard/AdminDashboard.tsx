import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAllRequestsStats } from '@/lib/api/requests';
import {
  Inbox,
  Clock,
  Cog,
  ArrowRight,
  LogOut,
  Users,
  BarChart3,
  Truck,
  LayoutDashboard,
  CheckCircle,
  Package
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

          {/* Second Row Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {/* Ready */}
            <Card
              className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate('/requests?status=ready')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center">
                    <Package className="h-5 w-5 text-teal-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-teal-500 transition-colors" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? '...' : stats?.ready || 0}
                </p>
                <p className="text-sm text-slate-500 mt-1">Ready</p>
              </CardContent>
            </Card>

            {/* Received */}
            <Card
              className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate('/requests?status=received')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-green-500 transition-colors" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? '...' : stats?.received || 0}
                </p>
                <p className="text-sm text-slate-500 mt-1">Received</p>
              </CardContent>
            </Card>

            {/* Assigned */}
            <Card
              className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate('/requests?status=assigned')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Users className="h-5 w-5 text-indigo-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? '...' : stats?.assigned || 0}
                </p>
                <p className="text-sm text-slate-500 mt-1">Assigned</p>
              </CardContent>
            </Card>
          </div>
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
