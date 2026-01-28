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
  User,
  BarChart3,
  Truck,
  LayoutDashboard,
  CheckCircle,
  Package,
  PackageCheck,
} from 'lucide-react';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useAllRequestsStats();

  // Full production lifecycle stat cards
  const statCards = [
    { key: 'total', label: 'Total', icon: Inbox, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', value: stats?.total || 0, status: null },
    { key: 'pending', label: 'Pending', icon: Clock, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', value: stats?.pending || 0, status: 'pending_approval' },
    { key: 'approved', label: 'Approved', icon: CheckCircle, iconBg: 'bg-sky-50', iconColor: 'text-sky-600', value: stats?.approved || 0, status: 'approved' },
    { key: 'assigned', label: 'Assigned', icon: User, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', value: stats?.assigned || 0, status: 'assigned' },
    { key: 'in_production', label: 'Production', icon: Cog, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', value: stats?.in_production || 0, status: 'in_production' },
    { key: 'ready', label: 'Ready', icon: Package, iconBg: 'bg-teal-50', iconColor: 'text-teal-600', value: stats?.ready || 0, status: 'ready' },
    { key: 'dispatched', label: 'Dispatched', icon: Truck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', value: stats?.dispatched || 0, status: 'dispatched' },
    { key: 'received', label: 'Received', icon: PackageCheck, iconBg: 'bg-green-50', iconColor: 'text-green-600', value: stats?.received || 0, status: 'received' },
  ];

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

          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.key}
                  className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(card.status ? `/requests?status=${card.status}` : '/requests')}
                >
                  <CardContent className="p-3">
                    <div className={`h-8 w-8 rounded-lg ${card.iconBg} flex items-center justify-center mb-2`}>
                      <Icon className={`h-4 w-4 ${card.iconColor}`} />
                    </div>
                    <p className="text-xl font-bold text-slate-900 leading-none">
                      {isLoading ? '...' : card.value}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{card.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <ArrowRight className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
