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
  Sparkles,
  Package,
  Loader2,
  Clock,
  Eye
} from 'lucide-react';
import type { Request } from '@/types';

// Get item summary for job cards
function getItemSummary(request: Request): string {
  const itemCount = request.item_count || 1;
  if (itemCount === 1) {
    const productType = request.product_type || 'Unknown';
    return `${productType.charAt(0).toUpperCase() + productType.slice(1)} - ${request.quality || 'N/A'}`;
  }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Premium Gradient Header */}
      <header className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Hammer className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black">My Tasks</h1>
                <p className="text-sm text-white/80">{profile?.full_name} | Production Floor</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={signOut}
              className="min-h-[56px] py-4 px-4 gap-2 text-white hover:bg-white/20 hover:text-white font-semibold"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Stats Overview - High Contrast Cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-8">
          {/* Assigned to Me */}
          <Card
            className="border-0 shadow-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-200 group"
            onClick={() => navigate('/requests?status=assigned')}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl bg-white/20 flex items-center justify-center">
                  <Inbox className="h-5 w-5 sm:h-7 sm:w-7" />
                </div>
                <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-3xl sm:text-5xl font-black mt-2 sm:mt-4">
                {statsLoading ? '...' : stats?.assigned || 0}
              </p>
              <p className="text-sm sm:text-base font-bold text-white/80 mt-1">New Tasks</p>
            </CardContent>
          </Card>

          {/* In Progress */}
          <Card
            className="border-0 shadow-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-200 group"
            onClick={() => navigate('/requests?status=in_production')}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl bg-white/20 flex items-center justify-center">
                  <Hammer className="h-5 w-5 sm:h-7 sm:w-7" />
                </div>
                <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-3xl sm:text-5xl font-black mt-2 sm:mt-4">
                {statsLoading ? '...' : stats?.in_progress || 0}
              </p>
              <p className="text-sm sm:text-base font-bold text-white/80 mt-1">In Progress</p>
            </CardContent>
          </Card>

          {/* Completed */}
          <Card
            className="border-0 shadow-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-200 group"
            onClick={() => navigate('/requests?status=ready')}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl bg-white/20 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 sm:h-7 sm:w-7" />
                </div>
                <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-3xl sm:text-5xl font-black mt-2 sm:mt-4">
                {statsLoading ? '...' : stats?.completed || 0}
              </p>
              <p className="text-sm sm:text-base font-bold text-white/80 mt-1">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Job Cards Section - New Tasks */}
        {(assignedTasks.length > 0 || assignedLoading) && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Inbox className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">New Tasks - Ready to Start</h2>
            </div>

            {assignedLoading ? (
              <Card className="border-0 bg-white/10 backdrop-blur-sm">
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignedTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="border-0 shadow-xl bg-white/10 backdrop-blur-sm overflow-hidden hover:bg-white/15 transition-colors cursor-pointer"
                    onClick={() => navigate(`/requests/${task.id}`)}
                  >
                    <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500" />
                    <CardContent className="p-5">
                      {/* Job Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <code className="text-lg font-mono font-bold text-blue-400">
                            {task.request_number}
                          </code>
                          <p className="text-white font-semibold mt-1">{task.client_project_name}</p>
                        </div>
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-500/30 text-blue-300 border border-blue-400/30">
                          NEW
                        </span>
                      </div>

                      {/* Key Details - Only What Matters */}
                      <div className="space-y-3 mb-5">
                        <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                          <Package className="h-5 w-5 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide">Product</p>
                            <p className="text-white font-bold">{getItemSummary(task)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-slate-400 uppercase tracking-wide">Size</p>
                            <p className="text-white font-bold text-sm">{task.sample_size || 'N/A'}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-slate-400 uppercase tracking-wide">Quantity</p>
                            <p className="text-white font-bold text-sm">{task.quantity || 1} pcs</p>
                          </div>
                        </div>
                      </div>

                      {/* View Details Button - Forces maker to read specs first */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/requests/${task.id}`);
                        }}
                        className="w-full min-h-[64px] text-lg font-bold gap-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02]"
                      >
                        <Eye className="h-5 w-5" />
                        VIEW DETAILS
                        <ArrowRight className="h-5 w-5" />
                      </Button>

                      {/* Hint text */}
                      <p className="text-xs text-slate-400 text-center mt-3">
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
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-amber-600 flex items-center justify-center">
                <Hammer className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">In Progress - Working On</h2>
            </div>

            {inProgressLoading ? (
              <Card className="border-0 bg-white/10 backdrop-blur-sm">
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-400 mx-auto" />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inProgressTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="border-0 shadow-xl bg-white/10 backdrop-blur-sm overflow-hidden hover:bg-white/15 transition-colors cursor-pointer"
                    onClick={() => navigate(`/requests/${task.id}`)}
                  >
                    <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-500" />
                    <CardContent className="p-5">
                      {/* Job Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <code className="text-lg font-mono font-bold text-amber-400">
                            {task.request_number}
                          </code>
                          <p className="text-white font-semibold mt-1">{task.client_project_name}</p>
                        </div>
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/30 text-amber-300 border border-amber-400/30 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          IN PROGRESS
                        </span>
                      </div>

                      {/* Key Details */}
                      <div className="space-y-3 mb-5">
                        <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                          <Package className="h-5 w-5 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide">Product</p>
                            <p className="text-white font-bold">{getItemSummary(task)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-slate-400 uppercase tracking-wide">Size</p>
                            <p className="text-white font-bold text-sm">{task.sample_size || 'N/A'}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-slate-400 uppercase tracking-wide">Quantity</p>
                            <p className="text-white font-bold text-sm">{task.quantity || 1} pcs</p>
                          </div>
                        </div>
                      </div>

                      {/* View Details Button */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/requests/${task.id}`);
                        }}
                        className="w-full min-h-[64px] text-lg font-bold gap-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/30 transition-all hover:scale-[1.02]"
                      >
                        <Eye className="h-5 w-5" />
                        VIEW DETAILS
                        <ArrowRight className="h-5 w-5" />
                      </Button>

                      {/* Hint text */}
                      <p className="text-xs text-slate-400 text-center mt-3">
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
          <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="h-10 w-10 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">All Caught Up!</h3>
              <p className="text-slate-400 text-lg mb-6">
                You have no tasks assigned. Great work!
              </p>
              <Button
                onClick={() => navigate('/requests')}
                className="min-h-[56px] px-8 text-lg font-bold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
              >
                View All Tasks
              </Button>
            </CardContent>
          </Card>
        )}

        {/* View All Tasks Button */}
        <div className="mt-8">
          <Button
            onClick={() => navigate('/requests')}
            className="w-full min-h-[64px] text-lg font-bold gap-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm"
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
