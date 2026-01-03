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
  AlertCircle
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
    const statusMap: Record<string, { label: string; color: string }> = {
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
      pending_approval: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
      approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700' },
      in_production: { label: 'In Production', color: 'bg-purple-100 text-purple-700' },
      dispatched: { label: 'Dispatched', color: 'bg-emerald-100 text-emerald-700' },
      received: { label: 'Received', color: 'bg-green-100 text-green-700' },
    };
    const { label, color } = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
  };

  const hasRequests = stats && stats.total > 0;
  const hasDrafts = stats && stats.drafts > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-8">
      {/* Header - Mobile Optimized */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Welcome, {profile?.full_name?.split(' ')[0]} 👋
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-gray-600 hover:text-gray-900"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
        {/* Action Buttons - Prominent placement at top */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            size="lg"
            onClick={() => navigate('/requests/new')}
            className="h-12 sm:h-11 gap-2 text-base font-semibold flex-1 sm:flex-none"
          >
            <Plus className="h-5 w-5" />
            Create New Request
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/requests')}
            className="h-11 flex-1 sm:flex-none"
          >
            View All Requests
          </Button>
        </div>
        {/* Stats Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {/* Drafts Card */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 border-l-4 border-l-gray-400 group"
            onClick={() => navigate('/requests?filter=drafts')}
          >
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Drafts</span>
                  <span className="sm:hidden">Draft</span>
                </div>
                <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl sm:text-3xl font-bold text-gray-700">
                {isLoading ? '...' : stats?.drafts || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Incomplete</p>
            </CardContent>
          </Card>

          {/* Submitted Card */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 border-l-4 border-l-blue-500 group"
            onClick={() => navigate('/requests?filter=submitted')}
          >
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                  <span className="hidden sm:inline">Submitted</span>
                  <span className="sm:hidden">Total</span>
                </div>
                <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                {isLoading ? '...' : stats?.total || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">All requests</p>
            </CardContent>
          </Card>

          {/* Pending Card */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 border-l-4 border-l-amber-500 group"
            onClick={() => navigate('/requests?status=pending')}
          >
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                  <span>Pending</span>
                </div>
                <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl sm:text-3xl font-bold text-amber-600">
                {isLoading ? '...' : stats?.pending || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">In review</p>
            </CardContent>
          </Card>

          {/* Dispatched Card */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 border-l-4 border-l-emerald-500 group"
            onClick={() => navigate('/requests?status=dispatched')}
          >
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                  <span className="hidden sm:inline">Dispatched</span>
                  <span className="sm:hidden">Sent</span>
                </div>
                <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
                {isLoading ? '...' : stats?.dispatched || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">On the way</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Section */}
        {hasRequests && recentRequests?.data && recentRequests.data.length > 0 && (
          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="pb-2 sm:pb-3 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  Recent Activity
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/requests')}
                  className="text-xs sm:text-sm h-8"
                >
                  View All
                  <ArrowRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
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
                  className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors active:bg-gray-100 ${
                    index !== recentRequests.data.length - 1 ? 'border-b' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <code className="text-sm font-mono font-semibold text-gray-900">
                        {request.request_number}
                      </code>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-gray-700 truncate font-medium">
                      {request.client_project_name || 'Untitled'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(request.created_at)}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-300 flex-shrink-0 ml-3" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!hasRequests && !isLoading && (
          <Card className="shadow-sm border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
              <div className="rounded-full bg-blue-50 p-4 sm:p-6 mb-4">
                <Package className="h-8 w-8 sm:h-12 sm:w-12 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 text-center">
                No requests yet
              </h3>
              <p className="text-sm sm:text-base text-gray-500 mb-6 text-center max-w-md">
                Get started by creating your first sample request. It only takes a minute!
              </p>
              <Button
                size="lg"
                onClick={() => navigate('/requests/new')}
                className="gap-2"
              >
                <Plus className="h-5 w-5" />
                Create Your First Request
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Draft Alert */}
        {hasDrafts && (
          <Card className="bg-amber-50 border-amber-200 shadow-sm">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900">
                  You have {stats.drafts} incomplete draft{stats.drafts > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Complete and submit them to start processing
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/requests?filter=drafts')}
                className="border-amber-300 text-amber-900 hover:bg-amber-100 flex-shrink-0"
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
