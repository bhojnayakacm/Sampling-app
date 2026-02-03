import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  useDispatcherStats,
  useFieldBoyReadyRequests,
  useDispatcherHistory,
  useUpdateRequestStatus,
} from '@/lib/api/requests';
import TrackingDialog from '@/components/requests/TrackingDialog';
import { toast } from 'sonner';
import {
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Phone,
  User,
  Loader2,
  LogOut,
  Calendar,
  RefreshCw,
  Search,
  Clock,
  PackageCheck,
  Eye,
} from 'lucide-react';
import { formatDateTime, formatDate } from '@/lib/utils';
import type { Request } from '@/types';

// Tab type for navigation
type TabKey = 'ready' | 'today' | 'total';

export default function DispatcherDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab from URL (defaults to 'ready')
  const tabParam = searchParams.get('tab');
  const activeTab: TabKey = (tabParam === 'today' || tabParam === 'total') ? tabParam : 'ready';

  // Search query state
  const [searchQuery, setSearchQuery] = useState('');

  // Update tab via URL
  const setActiveTab = (tab: TabKey) => {
    if (tab === 'ready') {
      // Remove param for default tab (cleaner URL)
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  // Data fetching
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDispatcherStats(profile?.id);
  const { data: readyRequests, isLoading: readyLoading, refetch: refetchReady } = useFieldBoyReadyRequests();
  const { data: todayHistory, isLoading: todayLoading, refetch: refetchToday } = useDispatcherHistory(profile?.id, 'today');
  const { data: allHistory, isLoading: allLoading, refetch: refetchAll } = useDispatcherHistory(profile?.id, 'all');
  const updateStatus = useUpdateRequestStatus();

  // Dispatch confirmation dialog
  const [dispatchTarget, setDispatchTarget] = useState<Request | null>(null);
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Refreshing state
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchStats(),
        refetchReady(),
        refetchToday(),
        refetchAll(),
      ]);
      toast.success('Refreshed!');
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDispatchClick = (request: Request, e: React.MouseEvent) => {
    e.stopPropagation();
    setDispatchTarget(request);
    setDispatchNotes('');
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchTarget) return;

    try {
      await updateStatus.mutateAsync({
        requestId: dispatchTarget.id,
        status: 'dispatched',
        dispatchNotes: dispatchNotes.trim() || undefined,
      });
      toast.success(
        <div>
          <p className="font-bold">Dispatched!</p>
          <p className="text-sm">{dispatchTarget.request_number} marked as dispatched.</p>
        </div>
      );
      setDispatchTarget(null);
      setDispatchNotes('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to dispatch');
    }
  };

  const handleCardClick = (requestId: string) => {
    navigate(`/requests/${requestId}`);
  };

  // Tab configuration with active styling
  const tabCards = [
    {
      key: 'ready' as TabKey,
      label: 'Ready for Pickup',
      icon: Package,
      value: stats?.readyForPickup || 0,
      activeBg: 'bg-teal-600',
      activeText: 'text-white',
      inactiveBg: 'bg-white',
      inactiveBorder: 'border-teal-200',
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      activeIconBg: 'bg-teal-500',
      activeIconColor: 'text-white',
    },
    {
      key: 'today' as TabKey,
      label: 'Dispatched Today',
      icon: Truck,
      value: stats?.dispatchedToday || 0,
      activeBg: 'bg-emerald-600',
      activeText: 'text-white',
      inactiveBg: 'bg-white',
      inactiveBorder: 'border-emerald-200',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      activeIconBg: 'bg-emerald-500',
      activeIconColor: 'text-white',
    },
    {
      key: 'total' as TabKey,
      label: 'Total Dispatched',
      icon: CheckCircle,
      value: stats?.totalDispatched || 0,
      activeBg: 'bg-green-600',
      activeText: 'text-white',
      inactiveBg: 'bg-white',
      inactiveBorder: 'border-green-200',
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      activeIconBg: 'bg-green-500',
      activeIconColor: 'text-white',
    },
  ];

  // Deadline helper
  const getDeadlineInfo = (requiredBy: string | null) => {
    if (!requiredBy) return null;
    const now = new Date();
    const deadline = new Date(requiredBy);
    const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursLeft < 0) return { label: 'Overdue', className: 'text-red-600 bg-red-50 border-red-200' };
    if (hoursLeft <= 24) return { label: 'Due Soon', className: 'text-amber-600 bg-amber-50 border-amber-200' };
    return null;
  };

  // Status badge helper
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      dispatched: { label: 'In Transit', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      received: { label: 'Received', className: 'bg-green-50 text-green-700 border-green-200' },
      ready: { label: 'Ready', className: 'bg-teal-50 text-teal-700 border-teal-200' },
    };
    const { label, className } = statusMap[status] || { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${className}`}>
        {label}
      </span>
    );
  };

  // Filter history by search query
  const filteredHistory = useMemo(() => {
    if (activeTab !== 'total' || !searchQuery.trim()) return allHistory;
    const query = searchQuery.toLowerCase().trim();
    return (allHistory || []).filter((r) =>
      r.request_number?.toLowerCase().includes(query) ||
      r.delivery_address?.toLowerCase().includes(query) ||
      r.creator?.full_name?.toLowerCase().includes(query) ||
      r.client_contact_name?.toLowerCase().includes(query)
    );
  }, [allHistory, searchQuery, activeTab]);

  // Get current list based on active tab
  const getCurrentList = () => {
    switch (activeTab) {
      case 'ready':
        return readyRequests || [];
      case 'today':
        return todayHistory || [];
      case 'total':
        return filteredHistory || [];
      default:
        return [];
    }
  };

  const isLoading = activeTab === 'ready' ? readyLoading : activeTab === 'today' ? todayLoading : allLoading;
  const currentList = getCurrentList();
  const isHistoryTab = activeTab === 'today' || activeTab === 'total';

  // Tab-specific empty states
  const getEmptyState = () => {
    switch (activeTab) {
      case 'ready':
        return {
          icon: CheckCircle,
          title: 'All caught up!',
          subtitle: 'No samples waiting for pickup right now.',
        };
      case 'today':
        return {
          icon: Truck,
          title: 'No deliveries yet',
          subtitle: "You haven't dispatched any samples today.",
        };
      case 'total':
        return {
          icon: Package,
          title: 'No dispatch history',
          subtitle: 'Your completed deliveries will appear here.',
        };
    }
  };

  const emptyState = getEmptyState();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-teal-600 flex items-center justify-center">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">Dispatch</h1>
                <p className="text-xs text-slate-500">{profile?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-9 w-9 p-0 text-slate-500 hover:bg-slate-100"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="h-9 px-3 text-xs text-slate-500 hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-8">
        {/* ============================================ */}
        {/* INTERACTIVE TAB CARDS */}
        {/* ============================================ */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
          {tabCards.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchQuery('');
                }}
                className={`
                  relative rounded-xl border-2 transition-all duration-200 text-left
                  ${isActive
                    ? `${tab.activeBg} ${tab.activeText} border-transparent shadow-lg scale-[1.02]`
                    : `${tab.inactiveBg} ${tab.inactiveBorder} hover:border-slate-300 hover:shadow-sm`
                  }
                `}
              >
                <div className="p-2.5 sm:p-3 text-center">
                  <div
                    className={`
                      h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center mx-auto mb-1.5 sm:mb-2
                      ${isActive ? tab.activeIconBg : tab.iconBg}
                    `}
                  >
                    <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isActive ? tab.activeIconColor : tab.iconColor}`} />
                  </div>
                  <p className={`text-xl sm:text-2xl font-bold ${isActive ? 'text-white' : 'text-slate-900'}`}>
                    {statsLoading ? '–' : tab.value}
                  </p>
                  <p className={`text-[9px] sm:text-[10px] font-medium uppercase tracking-wide mt-0.5 ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                    {tab.label}
                  </p>
                </div>
                {/* Active indicator dot */}
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-white/50" />
                )}
              </button>
            );
          })}
        </div>

        {/* ============================================ */}
        {/* SEARCH BAR (Only for Total History) */}
        {/* ============================================ */}
        {activeTab === 'total' && (
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by request #, address, name..."
                className="pl-10 h-11 bg-white border-slate-200"
              />
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* SECTION HEADER */}
        {/* ============================================ */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {activeTab === 'ready' && <Package className="h-4 w-4 text-teal-600" />}
            {activeTab === 'today' && <Truck className="h-4 w-4 text-emerald-600" />}
            {activeTab === 'total' && <CheckCircle className="h-4 w-4 text-green-600" />}
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {activeTab === 'ready' && 'Ready for Pickup'}
              {activeTab === 'today' && "Today's Deliveries"}
              {activeTab === 'total' && 'Dispatch History'}
            </h2>
            {!isLoading && (
              <span className="text-xs font-medium text-slate-500">
                ({currentList.length})
              </span>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* LOADING STATE */}
        {/* ============================================ */}
        {isLoading && (
          <div className="py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
            <p className="text-sm text-slate-500 mt-3">Loading...</p>
          </div>
        )}

        {/* ============================================ */}
        {/* EMPTY STATE */}
        {/* ============================================ */}
        {!isLoading && currentList.length === 0 && (
          <div className="py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <emptyState.icon className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-700">{emptyState.title}</p>
            <p className="text-sm text-slate-500 mt-1">{emptyState.subtitle}</p>
            {activeTab === 'total' && searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="mt-4"
              >
                Clear Search
              </Button>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* REQUEST CARDS */}
        {/* ============================================ */}
        {!isLoading && currentList.length > 0 && (
          <div className="space-y-3">
            {currentList.map((request) => {
              const deadlineInfo = getDeadlineInfo(request.required_by);
              const itemCount = request.items?.length || 1;
              const displayAddress = request.delivery_address || 'No address provided';
              const dispatchedAt = (request as any)._dispatchedByMeAt;

              return (
                <Card
                  key={request.id}
                  onClick={() => handleCardClick(request.id)}
                  className="bg-white border border-slate-200 shadow-sm overflow-hidden cursor-pointer hover:border-slate-300 hover:shadow-md transition-all active:scale-[0.99]"
                >
                  <CardContent className="p-0">
                    {/* Top Row: Request Number + Track + Status/Deadline */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {request.request_number}
                        </span>
                        <span className="text-xs text-slate-400">
                          · {itemCount} item{itemCount > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Status badge for history tabs */}
                        {isHistoryTab && getStatusBadge(request.status)}
                        {/* Deadline badge for ready tab */}
                        {!isHistoryTab && deadlineInfo && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${deadlineInfo.className}`}>
                            {deadlineInfo.label}
                          </span>
                        )}
                        {/* Track button - wrapped to prevent click bubbling to card */}
                        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                          <TrackingDialog
                            request={request}
                            trigger={
                              <button
                                className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Address — PRIMARY (most prominent element) */}
                    <div className="px-4 pb-3">
                      <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <MapPin className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                        <p className="text-sm font-medium text-slate-800 leading-relaxed">
                          {displayAddress}
                        </p>
                      </div>
                    </div>

                    {/* Requester info + Contact */}
                    <div className="px-4 pb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-600 truncate">
                          {request.creator?.full_name || 'Unknown'}
                        </span>
                        {request.creator?.department && (
                          <span className="text-xs text-slate-400 capitalize hidden sm:inline">
                            · {request.creator.department}
                          </span>
                        )}
                      </div>
                      {/* Large, thumb-friendly Call button */}
                      {request.mobile_no && (
                        <a
                          href={`tel:${request.mobile_no}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 active:bg-blue-200 transition-colors shrink-0"
                        >
                          <Phone className="h-4 w-4" />
                          Call
                        </a>
                      )}
                    </div>

                    {/* Date Row - Created or Dispatched */}
                    <div className="px-4 pb-3 flex items-center gap-4 flex-wrap">
                      {/* Created date */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        <span>Created: {formatDate(request.created_at)}</span>
                      </div>
                      {/* Due date for ready tab */}
                      {!isHistoryTab && request.required_by && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="h-3 w-3" />
                          <span>Due: {formatDateTime(request.required_by)}</span>
                        </div>
                      )}
                      {/* Dispatched date for history tabs */}
                      {isHistoryTab && dispatchedAt && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                          <Truck className="h-3 w-3" />
                          <span>Dispatched: {formatDateTime(dispatchedAt)}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Button — Only for Ready tab */}
                    {!isHistoryTab && (
                      <div className="px-4 pb-4">
                        <Button
                          onClick={(e) => handleDispatchClick(request, e)}
                          disabled={updateStatus.isPending}
                          className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold gap-2 rounded-lg"
                        >
                          <Truck className="h-4 w-4" />
                          Mark as Dispatched
                        </Button>
                      </div>
                    )}

                    {/* Received indicator for history */}
                    {isHistoryTab && request.status === 'received' && (
                      <div className="px-4 pb-3">
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                          <PackageCheck className="h-4 w-4 text-green-600" />
                          <span className="text-xs font-medium text-green-700">
                            Delivered & Received
                            {request.received_by && ` by ${request.received_by}`}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* ============================================ */}
      {/* DISPATCH CONFIRMATION DIALOG */}
      {/* ============================================ */}
      <Dialog open={!!dispatchTarget} onOpenChange={(open) => { if (!open) setDispatchTarget(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-teal-700">
              <Truck className="h-5 w-5" />
              Confirm Dispatch
            </DialogTitle>
            <DialogDescription>
              Mark <strong>{dispatchTarget?.request_number}</strong> as dispatched?
            </DialogDescription>
          </DialogHeader>

          {/* Destination summary */}
          {dispatchTarget && (
            <div className="py-2">
              <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <MapPin className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {dispatchTarget.delivery_address || 'No address'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {dispatchTarget.creator?.full_name} · {dispatchTarget.client_contact_name}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600 block mb-1.5">
                  Dispatch Notes (optional)
                </label>
                <Textarea
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="e.g., Handed to reception, Tracking ID..."
                  rows={2}
                  className="text-sm border-slate-200 resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDispatchTarget(null)}
              disabled={updateStatus.isPending}
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDispatch}
              disabled={updateStatus.isPending}
              className="flex-1 sm:flex-initial bg-teal-600 hover:bg-teal-700"
            >
              {updateStatus.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <Truck className="mr-2 h-4 w-4" />
                  Confirm Dispatch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
