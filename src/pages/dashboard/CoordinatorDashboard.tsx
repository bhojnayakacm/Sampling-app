import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import RequestToolbar from '@/components/requests/RequestToolbar';
import TrackingDialog from '@/components/requests/TrackingDialog';
import ReportsView from './coordinator/ReportsView';
import { useAuth } from '@/contexts/AuthContext';
import { useAllRequestsStats, usePaginatedRequests, useDeleteDraft } from '@/lib/api/requests';
import { toast } from 'sonner';
import {
  Inbox,
  Clock,
  Cog,
  Package,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Loader2,
  AlertCircle,
  Truck,
  CheckCircle,
  PackageCheck,
  Timer,
  Hourglass,
  User,
} from 'lucide-react';
import { RequestStatus, Priority, Request } from '@/types';
import { formatDate } from '@/lib/utils';

// ============================================================
// BUSINESS HOURS SLA CALCULATION
// ============================================================

// IST timezone offset (+5:30 from UTC)
const IST_OFFSET_MINUTES = 5 * 60 + 30;

// Working hours configuration (10:00 AM to 7:00 PM IST = 9 hours/day)
const WORK_START_HOUR = 10; // 10:00 AM
const WORK_END_HOUR = 19;   // 7:00 PM (19:00)

/**
 * Converts a Date to IST hours and minutes
 */
function toIST(date: Date): { hours: number; minutes: number; dayOfWeek: number; date: Date } {
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
  const istTime = new Date(utcTime + IST_OFFSET_MINUTES * 60000);
  return {
    hours: istTime.getHours(),
    minutes: istTime.getMinutes(),
    dayOfWeek: istTime.getDay(), // 0 = Sunday
    date: istTime,
  };
}

/**
 * Checks if a given IST day is a working day (not Sunday)
 */
function isWorkingDay(dayOfWeek: number): boolean {
  return dayOfWeek !== 0; // Sunday = 0
}

/**
 * Determines if the SLA timer should be stopped (SLA met/completed)
 * - Self Pickup: Stops at 'ready' or 'received'
 * - Other methods: Stops at 'dispatched' or 'received'
 */
function isSLACompleted(status: string, pickupResponsibility: string | null | undefined): boolean {
  const isSelfPickup = pickupResponsibility === 'self_pickup';

  if (isSelfPickup) {
    // Self Pickup: SLA is met when ready for pickup or received
    return ['ready', 'received'].includes(status);
  } else {
    // Courier/Field Boy: SLA is met when dispatched or received
    return ['dispatched', 'received'].includes(status);
  }
}

/**
 * Calculates working minutes remaining from current time to target date
 * considering only business hours (10 AM - 7 PM IST) and skipping Sundays
 */
function calculateWorkingMinutes(targetDate: string | Date): number {
  const now = new Date(); // Always use current time for real-time updates
  const target = new Date(targetDate);

  // If target is in the past, return negative working minutes
  if (target <= now) {
    return -calculateWorkingMinutesBetween(target, now);
  }

  return calculateWorkingMinutesBetween(now, target);
}

/**
 * Core function: calculates working minutes between two dates
 */
function calculateWorkingMinutesBetween(startDate: Date, endDate: Date): number {
  let totalWorkingMinutes = 0;

  // Clone start date to avoid mutation
  const current = new Date(startDate);

  // Iterate day by day
  while (current < endDate) {
    const istCurrent = toIST(current);
    const istEnd = toIST(endDate);

    // Skip Sundays entirely
    if (!isWorkingDay(istCurrent.dayOfWeek)) {
      // Move to next day at midnight
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    // Calculate working minutes for this day
    const currentHour = istCurrent.hours + istCurrent.minutes / 60;

    // Check if we're on the same day as the end date
    const isSameDay =
      istCurrent.date.toDateString() === istEnd.date.toDateString();

    if (isSameDay) {
      // Same day: calculate minutes from current time to end time (within working hours)
      const effectiveStart = Math.max(currentHour, WORK_START_HOUR);
      const endHour = istEnd.hours + istEnd.minutes / 60;
      const effectiveEnd = Math.min(endHour, WORK_END_HOUR);

      if (effectiveEnd > effectiveStart && effectiveStart < WORK_END_HOUR) {
        totalWorkingMinutes += (effectiveEnd - effectiveStart) * 60;
      }
      break; // Done
    } else {
      // Not the same day: calculate remaining work time for current day
      if (currentHour < WORK_END_HOUR) {
        const effectiveStart = Math.max(currentHour, WORK_START_HOUR);
        if (effectiveStart < WORK_END_HOUR) {
          totalWorkingMinutes += (WORK_END_HOUR - effectiveStart) * 60;
        }
      }

      // Move to next day at start of work
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }
  }

  return Math.round(totalWorkingMinutes);
}

/**
 * Formats working hours remaining into a human-readable string
 */
function formatWorkingTime(totalMinutes: number): string {
  const isOverdue = totalMinutes < 0;
  const absMinutes = Math.abs(totalMinutes);

  const hours = Math.floor(absMinutes / 60);
  const minutes = Math.round(absMinutes % 60);

  if (hours === 0) {
    return isOverdue ? `Overdue ${minutes}m` : `${minutes}m`;
  }

  if (minutes === 0) {
    return isOverdue ? `Overdue ${hours}h` : `${hours}h`;
  }

  return isOverdue ? `Overdue ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
}

/**
 * Returns SLA status and styling based on working hours remaining
 * Uses Hourglass icon for warning state (< 9 hours)
 */
function getSLAStatus(workingMinutes: number): {
  label: string;
  className: string;
  icon: React.ElementType;
  level: 'safe' | 'approaching' | 'warning' | 'overdue' | 'completed';
} {
  const workingHours = workingMinutes / 60;

  if (workingMinutes < 0) {
    return {
      label: formatWorkingTime(workingMinutes),
      className: 'bg-red-100 text-red-700 border-red-200',
      icon: AlertCircle,
      level: 'overdue',
    };
  }

  if (workingHours < 9) {
    return {
      label: formatWorkingTime(workingMinutes),
      className: 'bg-amber-100 text-amber-700 border-amber-200',
      icon: Hourglass, // Changed from AlertTriangle to Hourglass
      level: 'warning',
    };
  }

  if (workingHours <= 18) {
    return {
      label: formatWorkingTime(workingMinutes),
      className: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: Timer,
      level: 'approaching',
    };
  }

  return {
    label: formatWorkingTime(workingMinutes),
    className: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle,
    level: 'safe',
  };
}

// ============================================================
// FORMATTING HELPERS
// ============================================================

function formatCreatedDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatRequiredBy(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ============================================================
// STAT CARD CONFIG
// ============================================================

interface StatCardConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  getValue: (stats: any) => number;
  filterStatus: RequestStatus | null;
}

// ============================================================
// BADGE COMPONENTS
// ============================================================

function getStatusBadge(status: string) {
  const statusMap: Record<string, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600' },
    pending_approval: { label: 'Pending', className: 'bg-amber-50 text-amber-700' },
    approved: { label: 'Approved', className: 'bg-sky-50 text-sky-700' },
    assigned: { label: 'Assigned', className: 'bg-indigo-50 text-indigo-700' },
    in_production: { label: 'In Production', className: 'bg-violet-50 text-violet-700' },
    ready: { label: 'Ready', className: 'bg-teal-50 text-teal-700' },
    dispatched: { label: 'Dispatched', className: 'bg-emerald-50 text-emerald-700' },
    received: { label: 'Received', className: 'bg-green-50 text-green-700' },
    rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700' },
  };

  const { label, className } = statusMap[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}

function getPriorityBadge(priority: string) {
  const isUrgent = priority === 'urgent';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium uppercase whitespace-nowrap ${
      isUrgent ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
    }`}>
      {priority}
    </span>
  );
}

function getStatusAccent(status: string) {
  const colors: Record<string, string> = {
    draft: 'border-l-slate-400',
    pending_approval: 'border-l-amber-500',
    approved: 'border-l-sky-500',
    assigned: 'border-l-indigo-500',
    in_production: 'border-l-violet-500',
    ready: 'border-l-teal-500',
    dispatched: 'border-l-emerald-500',
    received: 'border-l-green-500',
    rejected: 'border-l-red-500',
  };
  return colors[status] || 'border-l-slate-400';
}

// ============================================================
// SLA BADGE COMPONENT (with stop conditions)
// ============================================================

function SLABadge({ request, tick }: { request: Request; tick: number }) {
  const slaResult = useMemo(() => {
    if (!request.required_by) return null;

    // Don't show SLA for drafts or rejected
    if (['draft', 'rejected'].includes(request.status)) return null;

    // Check if SLA is completed (stop conditions)
    if (isSLACompleted(request.status, request.pickup_responsibility)) {
      return {
        isCompleted: true,
        label: 'Done',
        className: 'bg-green-100 text-green-700 border-green-200',
        icon: CheckCircle,
      };
    }

    // Calculate working minutes remaining
    const workingMinutes = calculateWorkingMinutes(request.required_by);
    const status = getSLAStatus(workingMinutes);

    return {
      isCompleted: false,
      ...status,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.required_by, request.status, request.pickup_responsibility, tick]);

  if (slaResult === null) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const Icon = slaResult.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap ${slaResult.className}`}>
      <Icon className="h-3 w-3" />
      {slaResult.label}
    </span>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function CoordinatorDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: stats, isLoading: statsLoading } = useAllRequestsStats();
  const listSectionRef = useRef<HTMLDivElement>(null);

  const activeTab = searchParams.get('tab') || 'sample-requests';
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RequestStatus | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<{ id: string; number: string } | null>(null);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  // ============================================================
  // HEARTBEAT: Force re-render every 60 seconds for SLA updates
  // Zero API load - only recalculates existing data
  // ============================================================
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  const deleteDraft = useDeleteDraft();

  const { data: result, isLoading: requestsLoading } = usePaginatedRequests({
    page,
    pageSize: 20,
    search,
    status,
    priority,
    userId: profile?.id,
    userRole: profile?.role,
  });

  const requests = result?.data || [];
  const totalPages = result?.totalPages || 0;
  const totalCount = result?.count || 0;

  const isRequesterUser = profile?.role === 'requester';

  // Stat cards configuration — full production lifecycle
  const statCards: StatCardConfig[] = [
    { key: 'total', label: 'Total', icon: Inbox, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', getValue: (s) => s?.total || 0, filterStatus: null },
    { key: 'pending', label: 'Pending', icon: Clock, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', getValue: (s) => s?.pending || 0, filterStatus: 'pending_approval' },
    { key: 'approved', label: 'Approved', icon: CheckCircle, iconBg: 'bg-sky-50', iconColor: 'text-sky-600', getValue: (s) => s?.approved || 0, filterStatus: 'approved' },
    { key: 'assigned', label: 'Assigned', icon: User, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', getValue: (s) => s?.assigned || 0, filterStatus: 'assigned' },
    { key: 'in_production', label: 'Production', icon: Cog, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', getValue: (s) => s?.in_production || 0, filterStatus: 'in_production' },
    { key: 'ready', label: 'Ready', icon: Package, iconBg: 'bg-teal-50', iconColor: 'text-teal-600', getValue: (s) => s?.ready || 0, filterStatus: 'ready' },
    { key: 'dispatched', label: 'Dispatched', icon: Truck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', getValue: (s) => s?.dispatched || 0, filterStatus: 'dispatched' },
    { key: 'received', label: 'Received', icon: PackageCheck, iconBg: 'bg-green-50', iconColor: 'text-green-600', getValue: (s) => s?.received || 0, filterStatus: 'received' },
  ];

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: RequestStatus | null) => {
    setStatus(value);
    setPage(1);
    setActiveCard(null);
  };

  const handlePriorityChange = (value: Priority | null) => {
    setPriority(value);
    setPage(1);
  };

  const handleReset = () => {
    setSearch('');
    setStatus(null);
    setPriority(null);
    setPage(1);
    setActiveCard(null);
  };

  const handleCardClick = (card: StatCardConfig) => {
    setStatus(card.filterStatus);
    setPage(1);
    setActiveCard(card.key);

    setTimeout(() => {
      listSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDeleteDraft = async () => {
    if (!draftToDelete) return;
    try {
      await deleteDraft.mutateAsync(draftToDelete.id);
      toast.success('Draft deleted successfully');
      setDraftToDelete(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete draft');
    }
  };

  const renderContent = () => {
    if (activeTab === 'sample-requests') {
      return (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Stats Cards - 8 Card Lifecycle Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3">
            {statCards.map((card) => {
              const Icon = card.icon;
              const value = card.getValue(stats);
              const isActive = activeCard === card.key;

              return (
                <Card
                  key={card.key}
                  onClick={() => handleCardClick(card)}
                  className={`bg-white border shadow-sm hover:shadow-md transition-all cursor-pointer group ${
                    isActive
                      ? 'border-indigo-500 ring-2 ring-indigo-200'
                      : 'border-slate-200'
                  }`}
                >
                  <CardContent className="p-3">
                    <div className={`h-8 w-8 rounded-lg ${card.iconBg} flex items-center justify-center mb-2`}>
                      <Icon className={`h-4 w-4 ${card.iconColor}`} />
                    </div>
                    <p className="text-xl font-bold text-slate-900 leading-none">
                      {statsLoading ? '...' : value}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{card.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Toolbar with filters */}
          <div ref={listSectionRef}>
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <RequestToolbar
                  search={search}
                  status={status}
                  priority={priority}
                  onSearchChange={handleSearchChange}
                  onStatusChange={handleStatusChange}
                  onPriorityChange={handlePriorityChange}
                  onReset={handleReset}
                />
              </CardContent>
            </Card>
          </div>

          {/* Request Count Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {requestsLoading ? 'Loading...' : `${totalCount} Request${totalCount !== 1 ? 's' : ''}`}
              </h2>
              {!requestsLoading && totalPages > 0 && (
                <p className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </p>
              )}
            </div>
            {activeCard && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs h-8"
              >
                Clear Filter
              </Button>
            )}
          </div>

          {/* Request Data */}
          {requestsLoading ? (
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardContent className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                <p className="text-slate-500">Loading requests...</p>
              </CardContent>
            </Card>
          ) : requests.length === 0 ? (
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardContent className="p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">
                  {search || status || priority
                    ? 'No requests found matching your filters.'
                    : 'No requests found in the system.'}
                </p>
                {(search || status || priority) && (
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="mt-4 min-h-[44px]"
                  >
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile Card Stack View - Optimized Layout with Requester */}
              <div className="lg:hidden space-y-3">
                {requests.map((request) => {
                  const isDraft = request.status === 'draft';
                  const itemCount = request.item_count || 1;

                  return (
                    <Card
                      key={request.id}
                      onClick={!isDraft ? () => navigate(`/requests/${request.id}`) : undefined}
                      className={`bg-white border border-slate-200 shadow-sm overflow-hidden border-l-4 ${getStatusAccent(request.status)} ${
                        !isDraft ? 'cursor-pointer active:bg-slate-50' : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        {/* Top Row: Sample ID (Left) + Status Badge (Right) */}
                        <div className="flex items-center justify-between mb-2">
                          <code className="text-sm font-mono font-bold text-indigo-600">
                            {request.request_number}
                          </code>
                          <div className="flex items-center gap-2">
                            {request.priority === 'urgent' && getPriorityBadge(request.priority)}
                            {getStatusBadge(request.status)}
                          </div>
                        </div>

                        {/* Requester Row */}
                        {request.creator && (
                          <div className="flex items-center gap-1.5 mb-2 text-xs text-slate-500">
                            <User className="h-3 w-3" />
                            <span className="font-medium text-slate-700">{request.creator.full_name}</span>
                            {request.creator.department && (
                              <span className="text-slate-400 capitalize">• {request.creator.department}</span>
                            )}
                          </div>
                        )}

                        {/* Created Date Row */}
                        <div className="flex items-center gap-1.5 mb-2 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(request.created_at)}</span>
                        </div>

                        {/* Middle: Client Name + Item Count */}
                        <div className="mb-3">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {request.client_contact_name}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-slate-500 truncate flex-1 mr-2">
                              {request.firm_name || request.architect_firm_name || '—'}
                            </p>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${
                              itemCount > 1
                                ? 'bg-indigo-50 text-indigo-600 font-medium'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {itemCount > 1 && <Package className="h-3 w-3" />}
                              {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </div>

                        {/* Bottom Row: SLA Badge (Left) + Track Button (Right) */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <SLABadge request={request} tick={tick} />
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {/* Draft Actions */}
                            {isRequesterUser && isDraft && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/requests/edit/${request.id}`)}
                                  className="h-11 px-3 text-xs"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDraftToDelete({ id: request.id, number: request.request_number })}
                                  className="h-11 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {/* Track Button - Always visible, 44px touch target */}
                            {!isDraft && (
                              <TrackingDialog
                                request={request}
                                trigger={
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-11 px-4 text-xs font-medium border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                  >
                                    <MapPin className="h-4 w-4 mr-1.5" />
                                    Track
                                  </Button>
                                }
                              />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop High-Density Table */}
              <div className="hidden lg:block">
                <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px]">
                      {/* Sticky Header */}
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Sample ID
                          </th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Requester
                          </th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Client / Project
                          </th>
                          <th className="text-center py-3 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Items
                          </th>
                          <th className="text-center py-3 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Priority
                          </th>
                          <th className="text-center py-3 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Status
                          </th>
                          <th className="text-center py-3 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Created
                          </th>
                          <th className="text-center py-3 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Required By
                          </th>
                          <th className="text-center py-3 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            SLA Remaining
                          </th>
                          <th className="text-center py-3 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {requests.map((request) => {
                          const isDraft = request.status === 'draft';
                          const itemCount = request.item_count || 1;

                          return (
                            <tr
                              key={request.id}
                              className={`${!isDraft ? 'cursor-pointer' : ''} hover:bg-slate-50 transition-colors`}
                              onClick={!isDraft ? () => navigate(`/requests/${request.id}`) : undefined}
                            >
                              {/* Sample ID */}
                              <td className="py-2.5 px-3">
                                <code className="text-sm font-mono font-semibold text-indigo-600">
                                  {request.request_number}
                                </code>
                              </td>

                              {/* Requester */}
                              <td className="py-2.5 px-3">
                                <p className="text-sm font-medium text-slate-900 truncate max-w-[140px]">
                                  {request.creator?.full_name || 'Unknown'}
                                </p>
                                {request.creator?.department && (
                                  <p className="text-xs text-slate-500 capitalize truncate max-w-[140px]">
                                    {request.creator.department}
                                  </p>
                                )}
                              </td>

                              {/* Client / Project */}
                              <td className="py-2.5 px-3">
                                <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]">
                                  {request.client_contact_name}
                                </p>
                                <p className="text-xs text-slate-500 truncate max-w-[180px]">
                                  {request.firm_name || request.architect_firm_name || '—'}
                                </p>
                              </td>

                              {/* Item Count */}
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-flex items-center gap-1 text-sm ${
                                  itemCount > 1 ? 'text-indigo-600 font-medium' : 'text-slate-700'
                                }`}>
                                  {itemCount > 1 && <Package className="h-3.5 w-3.5" />}
                                  {itemCount}
                                </span>
                              </td>

                              {/* Priority */}
                              <td className="py-2.5 px-3 text-center">
                                {getPriorityBadge(request.priority)}
                              </td>

                              {/* Status */}
                              <td className="py-2.5 px-3 text-center">
                                {getStatusBadge(request.status)}
                              </td>

                              {/* Created */}
                              <td className="py-2.5 px-3 text-center">
                                <span className="text-sm text-slate-600">
                                  {formatCreatedDate(request.created_at)}
                                </span>
                              </td>

                              {/* Required By */}
                              <td className="py-2.5 px-3 text-center">
                                <span className="text-sm text-slate-600 whitespace-nowrap">
                                  {request.required_by ? formatRequiredBy(request.required_by) : '—'}
                                </span>
                              </td>

                              {/* SLA Remaining */}
                              <td className="py-2.5 px-3 text-center">
                                <SLABadge request={request} tick={tick} />
                              </td>

                              {/* Actions - Track only (row click opens details) */}
                              <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-center gap-1">
                                  <TrackingDialog
                                    request={request}
                                    trigger={
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                                      >
                                        <MapPin className="h-3.5 w-3.5 mr-1" />
                                        Track
                                      </Button>
                                    }
                                  />
                                  {isRequesterUser && isDraft && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => navigate(`/requests/edit/${request.id}`)}
                                        className="h-8 w-8 p-0 hover:bg-slate-100"
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setDraftToDelete({ id: request.id, number: request.request_number })}
                                        className="h-8 w-8 p-0 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Pagination Controls */}
          {!requestsLoading && totalPages > 1 && (
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardContent className="px-4 py-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-sm text-slate-600 text-center sm:text-left">
                    <span className="hidden sm:inline">
                      Showing <span className="font-medium text-slate-900">{(page - 1) * 20 + 1}</span> to{' '}
                      <span className="font-medium text-slate-900">{Math.min(page * 20, totalCount)}</span> of{' '}
                      <span className="font-medium text-slate-900">{totalCount}</span> results
                    </span>
                    <span className="sm:hidden">
                      Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                    </span>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="flex-1 sm:flex-none min-h-[44px] gap-2 border-slate-200"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      className="flex-1 sm:flex-none min-h-[44px] gap-2 border-slate-200"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!draftToDelete} onOpenChange={() => setDraftToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600">Delete Draft?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete draft <strong>{draftToDelete?.number}</strong>?
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteDraft}
                  className="min-h-[44px] bg-red-600 hover:bg-red-700"
                >
                  Delete Draft
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    }

    if (activeTab === 'reports') {
      return <ReportsView />;
    }

    return (
      <div className="p-6">
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Coming Soon</h2>
            <p className="text-slate-500">
              This feature is under development and will be available soon.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  );
}
