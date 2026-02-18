import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useMakerStats, usePaginatedRequests } from '@/lib/api/requests';
import {
  Inbox,
  Hammer,
  CheckCircle,
  ArrowRight,
  LogOut,
  Package,
  Loader2,
  Clock,
  Eye,
  LayoutDashboard
} from 'lucide-react';
import type { Request } from '@/types';

// Get item summary for job cards
function getItemSummary(request: Request): string {
  const itemCount = request.item_count || 0;
  if (itemCount === 1 && request.items && request.items.length > 0) {
    const item = request.items[0];
    const productType = item.product_type || 'Unknown';
    return `${productType.charAt(0).toUpperCase() + productType.slice(1)} - ${item.quality_custom || item.quality || 'N/A'}`;
  }
  if (itemCount <= 1) return '1 Product';
  return `${itemCount} Products`;
}

export default function MakerDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useMakerStats(profile?.id);

  // Fetch assigned and in-progress tasks for display
  const { data: assignedResult, isLoading: assignedLoading } = usePaginatedRequests({
    page: 1,
    pageSize: 10,
    status: 'assigned',
    userId: profile?.id,
    userRole: 'maker',
  });

  const { data: inProgressResult, isLoading: inProgressLoading } = usePaginatedRequests({
    page: 1,
    pageSize: 10,
    status: 'in_production',
    userId: profile?.id,
    userRole: 'maker',
  });

  const assignedTasks = assignedResult?.data || [];
  const inProgressTasks = inProgressResult?.data || [];

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
                <h1 className="text-xl font-bold text-slate-900">My Tasks</h1>
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
        {/* Stats Overview - Clean Cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
          {/* Assigned to Me */}
          <Card
            className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigate('/requests?status=assigned')}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Inbox className="h-5 w-5 text-blue-600" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                {statsLoading ? '...' : stats?.assigned || 0}
              </p>
              <p className="text-sm text-slate-500 mt-1">New Tasks</p>
            </CardContent>
          </Card>

          {/* In Progress */}
          <Card
            className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigate('/requests?status=in_production')}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Hammer className="h-5 w-5 text-amber-600" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                {statsLoading ? '...' : stats?.in_progress || 0}
              </p>
              <p className="text-sm text-slate-500 mt-1">In Progress</p>
            </CardContent>
          </Card>

          {/* Completed */}
          <Card
            className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigate('/requests?status=completed')}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                {statsLoading ? '...' : stats?.completed || 0}
              </p>
              <p className="text-sm text-slate-500 mt-1">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Job Cards Section - New Tasks */}
        {(assignedTasks.length > 0 || assignedLoading) && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Inbox className="h-4 w-4 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">New Tasks - Ready to Start</h2>
            </div>

            {assignedLoading ? (
              <Card className="bg-white border border-slate-200 shadow-sm">
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignedTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500"
                    onClick={() => navigate(`/requests/${task.id}`)}
                  >
                    <CardContent className="p-5">
                      {/* Job Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <code className="text-sm font-mono font-semibold text-indigo-600">
                            {task.request_number}
                          </code>
                          <p className="text-slate-900 font-medium mt-1">{task.client_contact_name}</p>
                        </div>
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                          NEW
                        </span>
                      </div>

                      {/* Key Details */}
                      <div className="space-y-3 mb-5">
                        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                          <Package className="h-5 w-5 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wide">Product</p>
                            <p className="text-slate-900 font-medium">{getItemSummary(task)}</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Items</p>
                          <p className="text-slate-900 font-medium text-sm">{task.item_count || 1}</p>
                        </div>
                      </div>

                      {/* View Details Button */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/requests/${task.id}`);
                        }}
                        size="sm"
                        className="w-full h-10 text-sm font-medium gap-2 bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                        <ArrowRight className="h-4 w-4" />
                      </Button>

                      <p className="text-xs text-slate-500 text-center mt-2">
                        Review specs before starting work
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Job Cards Section - In Progress */}
        {(inProgressTasks.length > 0 || inProgressLoading) && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Hammer className="h-4 w-4 text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">In Progress - Working On</h2>
            </div>

            {inProgressLoading ? (
              <Card className="bg-white border border-slate-200 shadow-sm">
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inProgressTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-500"
                    onClick={() => navigate(`/requests/${task.id}`)}
                  >
                    <CardContent className="p-5">
                      {/* Job Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <code className="text-sm font-mono font-semibold text-indigo-600">
                            {task.request_number}
                          </code>
                          <p className="text-slate-900 font-medium mt-1">{task.client_contact_name}</p>
                        </div>
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          IN PROGRESS
                        </span>
                      </div>

                      {/* Key Details */}
                      <div className="space-y-3 mb-5">
                        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                          <Package className="h-5 w-5 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wide">Product</p>
                            <p className="text-slate-900 font-medium">{getItemSummary(task)}</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Items</p>
                          <p className="text-slate-900 font-medium text-sm">{task.item_count || 1}</p>
                        </div>
                      </div>

                      {/* View Details Button */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/requests/${task.id}`);
                        }}
                        size="sm"
                        className="w-full h-10 text-sm font-medium gap-2 bg-amber-600 hover:bg-amber-700"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                        <ArrowRight className="h-4 w-4" />
                      </Button>

                      <p className="text-xs text-slate-500 text-center mt-2">
                        Mark as ready when complete
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!assignedLoading && !inProgressLoading && assignedTasks.length === 0 && inProgressTasks.length === 0 && (
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">All Caught Up!</h3>
              <p className="text-slate-500 mb-6">
                You have no tasks assigned. Great work!
              </p>
              <Button
                onClick={() => navigate('/requests')}
                className="min-h-[48px] px-6 bg-indigo-600 hover:bg-indigo-700"
              >
                View All Tasks
              </Button>
            </CardContent>
          </Card>
        )}

        {/* View All Tasks Button */}
        <div className="mt-8">
          <Button
            variant="outline"
            onClick={() => navigate('/requests')}
            className="w-full min-h-[52px] text-base font-medium gap-2 bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Package className="h-5 w-5" />
            View All Tasks
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </main>
    </div>
  );
}
