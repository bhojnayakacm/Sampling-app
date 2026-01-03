import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useDashboardStats, usePaginatedRequests } from '@/lib/api/requests';
import {
  FileText,
  Send,
  Clock,
  CheckCircle,
  ArrowRight,
  Plus,
  Package,
  TrendingUp,
  AlertCircle,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; bgColor: string; textColor: string }> = {
      draft: { label: 'Draft', bgColor: 'bg-slate-100', textColor: 'text-slate-700' },
      pending_approval: { label: 'Pending', bgColor: 'bg-amber-100', textColor: 'text-amber-700' },
      approved: { label: 'Approved', bgColor: 'bg-sky-100', textColor: 'text-sky-700' },
      in_production: { label: 'In Production', bgColor: 'bg-violet-100', textColor: 'text-violet-700' },
      dispatched: { label: 'Dispatched', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700' },
      received: { label: 'Received', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    };
    const { label, bgColor, textColor } = statusMap[status] || { label: status, bgColor: 'bg-slate-100', textColor: 'text-slate-700' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${bgColor} ${textColor}`}>{label}</span>;
  };

  const hasRequests = stats && stats.total > 0;
  const hasDrafts = stats && stats.drafts > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100">
      {/* Premium Gradient Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-300" />
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">SampleHub</h1>
              </div>
              <p className="text-sm text-indigo-100 mt-0.5">
                Welcome back, {profile?.full_name?.split(' ')[0]}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-white/90 hover:text-white hover:bg-white/10 gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
        {/* Action Buttons - FORCED HEIGHT with min-h and py */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Button
            onClick={() => navigate('/requests/new')}
            className="min-h-[60px] py-5 px-6 gap-3 text-base font-bold flex-1 sm:flex-none bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
          >
            <Plus className="h-5 w-5" />
            Create New Request
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/requests')}
            className="min-h-[56px] py-4 px-6 font-semibold flex-1 sm:flex-none border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200"
          >
            View All Requests
          </Button>
        </div>

        {/* Stats Cards - Premium Design */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Drafts Card */}
          <Card
            className="cursor-pointer group bg-white/80 backdrop-blur-sm border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            onClick={() => navigate('/requests?filter=drafts')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pb-2 sm:pb-3 relative">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors">
                    <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                  </div>
                  <span>Drafts</span>
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0 text-slate-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 relative">
              <p className="text-2xl sm:text-3xl font-bold text-slate-800">
                {isLoading ? '...' : stats?.drafts || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Incomplete</p>
            </CardContent>
          </Card>

          {/* Submitted Card */}
          <Card
            className="cursor-pointer group bg-white/80 backdrop-blur-sm border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            onClick={() => navigate('/requests?filter=submitted')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pb-2 sm:pb-3 relative">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-100 group-hover:bg-indigo-200 transition-colors">
                    <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600" />
                  </div>
                  <span>Submitted</span>
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0 text-indigo-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 relative">
              <p className="text-2xl sm:text-3xl font-bold text-indigo-600">
                {isLoading ? '...' : stats?.total || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">All requests</p>
            </CardContent>
          </Card>

          {/* Pending Card */}
          <Card
            className="cursor-pointer group bg-white/80 backdrop-blur-sm border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            onClick={() => navigate('/requests?status=pending')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-amber-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pb-2 sm:pb-3 relative">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100 group-hover:bg-amber-200 transition-colors">
                    <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
                  </div>
                  <span>Pending</span>
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0 text-amber-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 relative">
              <p className="text-2xl sm:text-3xl font-bold text-amber-600">
                {isLoading ? '...' : stats?.pending || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">In review</p>
            </CardContent>
          </Card>

          {/* Dispatched Card */}
          <Card
            className="cursor-pointer group bg-white/80 backdrop-blur-sm border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            onClick={() => navigate('/requests?status=dispatched')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pb-2 sm:pb-3 relative">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 transition-colors">
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
                  </div>
                  <span>Dispatched</span>
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0 text-emerald-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 relative">
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
                {isLoading ? '...' : stats?.dispatched || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">On the way</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Section - Premium */}
        {hasRequests && recentRequests?.data && recentRequests.data.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-100">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
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
                  className={`flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-transparent cursor-pointer transition-all duration-200 group ${
                    index !== recentRequests.data.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1">
                      <code className="text-sm font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {request.request_number}
                      </code>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm font-medium text-slate-700 truncate">
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

        {/* Empty State - Premium */}
        {!hasRequests && !isLoading && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg border-2 border-dashed border-indigo-200">
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
              <div className="rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 p-5 sm:p-6 mb-5 shadow-inner">
                <Package className="h-10 w-10 sm:h-14 sm:w-14 text-indigo-600" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2 text-center">
                No requests yet
              </h3>
              <p className="text-sm sm:text-base text-slate-500 mb-8 text-center max-w-md">
                Get started by creating your first sample request. It only takes a minute!
              </p>
              <Button
                onClick={() => navigate('/requests/new')}
                className="min-h-[56px] py-4 px-8 gap-2 font-bold text-base bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/25"
              >
                <Plus className="h-5 w-5" />
                Create Your First Request
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Draft Alert - Premium */}
        {hasDrafts && (
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-0 shadow-md overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-400" />
            <CardContent className="flex items-start gap-4 py-4 pl-5">
              <div className="p-2 rounded-lg bg-amber-100 flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  You have {stats.drafts} incomplete draft{stats.drafts > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Complete and submit them to start processing
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => navigate('/requests?filter=drafts')}
                className="flex-shrink-0 min-h-[44px] px-4 font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
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
