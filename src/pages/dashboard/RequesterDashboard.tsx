import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useDashboardStats, usePaginatedRequests } from '@/lib/api/requests';
import {
  FileText,
  Send,
  Clock,
  ArrowRight,
  Plus,
  Package,
  TrendingUp,
  AlertCircle,
  LogOut,
  LayoutDashboard,
  XCircle,
  PackageCheck,
  Truck,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

// Compact stat card configuration
interface StatConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  hoverColor: string;
  getValue: (stats: any) => number;
  onClick: () => void;
}

export default function RequesterDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats(profile?.id);

  // Fetch recent requests for preview
  const { data: recentRequests } = usePaginatedRequests({
    page: 1,
    pageSize: 3,
    userId: profile?.id,
    userRole: profile?.role,
  });

  // Define all 6 stat cards with their configurations
  const statCards: StatConfig[] = [
    {
      key: 'drafts',
      label: 'Drafts',
      icon: FileText,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
      hoverColor: 'group-hover:text-slate-600',
      getValue: (s) => s?.drafts || 0,
      onClick: () => navigate('/requests?filter=drafts'),
    },
    {
      key: 'submitted',
      label: 'Submitted',
      icon: Send,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      hoverColor: 'group-hover:text-indigo-600',
      getValue: (s) => s?.total || 0,
      onClick: () => navigate('/requests?filter=submitted'),
    },
    {
      key: 'inProgress',
      label: 'In Progress',
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      hoverColor: 'group-hover:text-amber-600',
      getValue: (s) => s?.inProgress || 0,
      onClick: () => navigate('/requests?status=in_progress'),
    },
    {
      key: 'dispatched',
      label: 'Dispatched',
      icon: Truck,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      hoverColor: 'group-hover:text-blue-600',
      getValue: (s) => s?.dispatched || 0,
      onClick: () => navigate('/requests?status=dispatched'),
    },
    {
      key: 'received',
      label: 'Received',
      icon: PackageCheck,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      hoverColor: 'group-hover:text-emerald-600',
      getValue: (s) => s?.received || 0,
      onClick: () => navigate('/requests?status=received'),
    },
    {
      key: 'rejected',
      label: 'Rejected',
      icon: XCircle,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      hoverColor: 'group-hover:text-rose-600',
      getValue: (s) => s?.rejected || 0,
      onClick: () => navigate('/requests?status=rejected'),
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600' },
      pending_approval: { label: 'Pending', className: 'bg-amber-50 text-amber-700' },
      approved: { label: 'Approved', className: 'bg-sky-50 text-sky-700' },
      assigned: { label: 'Assigned', className: 'bg-indigo-50 text-indigo-700' },
      in_production: { label: 'In Production', className: 'bg-violet-50 text-violet-700' },
      ready: { label: 'Ready', className: 'bg-teal-50 text-teal-700' },
      dispatched: { label: 'Dispatched', className: 'bg-blue-50 text-blue-700' },
      received: { label: 'Received', className: 'bg-emerald-50 text-emerald-700' },
      rejected: { label: 'Rejected', className: 'bg-rose-50 text-rose-700' },
    };
    const { label, className } = statusMap[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
    return <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${className}`}>{label}</span>;
  };

  const hasRequests = stats && stats.total > 0;
  const hasDrafts = stats && stats.drafts > 0;

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
                <h1 className="text-xl font-bold text-slate-900">SampleHub</h1>
                <p className="text-sm text-slate-500">
                  Welcome back, {profile?.full_name?.split(' ')[0]}
                </p>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => navigate('/requests/new')}
            className="min-h-[52px] px-6 gap-2 text-base font-semibold flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-5 w-5" />
            Create New Request
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/requests')}
            className="min-h-[48px] px-6 font-medium flex-1 sm:flex-none border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            View All Requests
          </Button>
        </div>

        {/* Stats Cards - Compact 6-card Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            const value = stat.getValue(stats);

            return (
              <Card
                key={stat.key}
                className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={stat.onClick}
              >
                <CardContent className="p-3 sm:p-4">
                  {/* Compact layout: Icon + Arrow row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className={`h-8 w-8 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                    </div>
                    <ArrowRight className={`h-3.5 w-3.5 text-slate-300 ${stat.hoverColor} transition-colors`} />
                  </div>

                  {/* Value */}
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">
                    {isLoading ? '—' : value}
                  </p>

                  {/* Label */}
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">{stat.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Activity Section */}
        {hasRequests && recentRequests?.data && recentRequests.data.length > 0 && (
          <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-indigo-600" />
                  </div>
                  Recent Activity
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/requests')}
                  className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium"
                >
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentRequests.data.map((request, index) => (
                <div
                  key={request.id}
                  onClick={() =>
                    request.status === 'draft'
                      ? navigate(`/requests/edit/${request.id}`)
                      : navigate(`/requests/${request.id}`)
                  }
                  className={`flex items-center justify-between px-4 py-4 hover:bg-slate-50 cursor-pointer transition-colors group ${
                    index !== recentRequests.data.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {request.request_number}
                      </code>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-slate-700 truncate">
                      {request.client_project_name || 'Untitled'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(request.created_at)}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all flex-shrink-0 ml-3" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!hasRequests && !isLoading && (
          <Card className="bg-white border border-slate-200 shadow-sm border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 px-4">
              <div className="rounded-xl bg-slate-100 p-5 mb-5">
                <Package className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2 text-center">
                No requests yet
              </h3>
              <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
                Get started by creating your first sample request.
              </p>
              <Button
                onClick={() => navigate('/requests/new')}
                className="min-h-[48px] px-6 gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="h-5 w-5" />
                Create Your First Request
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Draft Alert */}
        {hasDrafts && (
          <Card className="bg-amber-50 border border-amber-200 shadow-sm overflow-hidden">
            <CardContent className="flex items-center gap-4 py-4 px-4">
              <div className="p-2 rounded-lg bg-amber-100 flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900">
                  You have {stats.drafts} incomplete draft{stats.drafts > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-amber-700">
                  Complete and submit them to start processing
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => navigate('/requests?filter=drafts')}
                className="flex-shrink-0 min-h-[40px] px-4 font-medium bg-amber-600 hover:bg-amber-700 text-white"
              >
                View Drafts
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
