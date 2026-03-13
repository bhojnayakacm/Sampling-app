import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePaginatedRequests, useDeleteDraft } from '@/lib/api/requests';
import { formatDate } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Edit, Trash2, ChevronLeft, ChevronRight, MapPin, Package, LogOut, List, Phone, Clock } from 'lucide-react';
import { RequestStatus, Priority, Request } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { RequestListSkeleton } from '@/components/skeletons';
import RequestToolbar from '@/components/requests/RequestToolbar';
import TrackingDialog from '@/components/requests/TrackingDialog';

// Status filter mapping for dashboard navigation
const STATUS_FILTERS: Record<string, RequestStatus[]> = {
  pending: ['pending_approval', 'approved', 'assigned'],
  completed: ['ready', 'dispatched', 'received'],
  in_progress: ['pending_approval', 'approved', 'assigned', 'in_production', 'ready'],
};

// Category tabs: All / Marble / Magro
const CATEGORY_TABS: { label: string; value: 'marble' | 'magro' | null }[] = [
  { label: 'All', value: null },
  { label: 'Marble', value: 'marble' },
  { label: 'Magro', value: 'magro' },
];

// Helper: smart item summary for display
function getItemSummary(request: Request): { text: string; tooltip: string; isMulti: boolean } {
  const itemCount = request.item_count || 0;

  if (itemCount === 1 && request.items && request.items.length > 0) {
    const item = request.items[0];
    // Kit item: show "Marble Kit" / "Magro Kit"
    if (item.is_kit) {
      const kitLabel = item.product_type === 'marble' ? 'Marble Kit' : 'Magro Kit';
      return {
        text: `${kitLabel} · ${item.quantity} pcs`,
        tooltip: `${kitLabel} — ${item.sample_size}`,
        isMulti: false,
      };
    }
    const label = item.product_type === 'marble'
      ? 'Marble'
      : item.sub_category
        ? `Magro ${item.sub_category.charAt(0).toUpperCase() + item.sub_category.slice(1)}`
        : 'Magro';
    return {
      text: `${label} · ${item.quantity} pcs`,
      tooltip: `${label} — ${item.quality || 'N/A'}`,
      isMulti: false,
    };
  }

  if (itemCount <= 1) {
    return { text: '1 product', tooltip: 'Click to view details', isMulti: false };
  }

  return {
    text: `${itemCount} products`,
    tooltip: 'Click to view all products',
    isMulti: true,
  };
}

export default function RequestList() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive category from URL ?tab= param for state preservation across navigation
  const tabParam = searchParams.get('tab');
  const category: 'marble' | 'magro' | null =
    tabParam === 'marble' || tabParam === 'magro' ? tabParam : null;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RequestStatus | RequestStatus[] | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [overdue, setOverdue] = useState(false);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<{ id: string; number: string } | null>(null);

  // URL param-driven status pre-filtering (from dashboard stat card navigation)
  const urlStatus = searchParams.get('status');
  const urlFilter = searchParams.get('filter');

  useEffect(() => {
    if (urlStatus && STATUS_FILTERS[urlStatus]) {
      setStatus(STATUS_FILTERS[urlStatus]);
    } else if (urlStatus) {
      setStatus(urlStatus as RequestStatus);
    }
    if (urlFilter === 'drafts') {
      setStatus('draft');
    }
  }, [urlStatus, urlFilter]);

  const deleteDraft = useDeleteDraft();

  const isRequesterUser = profile?.role === 'requester';
  const isMakerUser = profile?.role === 'maker';
  const isStaffUser = ['admin', 'coordinator', 'marble_coordinator', 'magro_coordinator', 'maker'].includes(profile?.role || '');

  // Pass category + subCategory to the correct API filter fields.
  // subCategory is only meaningful when category === 'magro'.
  const { data: result, isLoading } = usePaginatedRequests({
    page,
    pageSize: 15,
    search,
    status,
    priority,
    overdue,
    category,
    subCategory: category === 'magro' ? subCategory : null,
    userId: profile?.id,
    userRole: profile?.role,
  });

  const requests = result?.data || [];
  const totalPages = result?.totalPages || 0;
  const totalCount = result?.count || 0;

  const getPageTitle = () => {
    if (isRequesterUser) return 'My Requests';
    if (isMakerUser) return 'My Tasks';
    return 'All Requests';
  };

  const getStatusBadge = (s: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft:            { label: 'Draft',       className: 'bg-slate-100 text-slate-700' },
      pending_approval: { label: 'Pending',      className: 'bg-amber-50 text-amber-700' },
      approved:         { label: 'Approved',     className: 'bg-sky-50 text-sky-700' },
      assigned:         { label: 'Assigned',     className: 'bg-indigo-50 text-indigo-700' },
      in_production:    { label: 'In Production',className: 'bg-violet-50 text-violet-700' },
      ready:            { label: 'Ready',        className: 'bg-teal-50 text-teal-700' },
      dispatched:       { label: 'Dispatched',   className: 'bg-emerald-50 text-emerald-700' },
      received:         { label: 'Received',     className: 'bg-green-50 text-green-700' },
      rejected:         { label: 'Rejected',     className: 'bg-red-50 text-red-700' },
    };
    const { label, className } = statusMap[s] || { label: s, className: 'bg-slate-100 text-slate-700' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}>{label}</span>;
  };

  const getPriorityBadge = (p: string) => {
    if (p === 'urgent') {
      return <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded uppercase tracking-wide">Urgent</span>;
    }
    return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded uppercase">Normal</span>;
  };

  const getStatusAccent = (s: string) => {
    const colors: Record<string, string> = {
      draft:            'border-l-slate-400',
      pending_approval: 'border-l-amber-400',
      approved:         'border-l-sky-500',
      assigned:         'border-l-indigo-500',
      in_production:    'border-l-violet-500',
      ready:            'border-l-teal-500',
      dispatched:       'border-l-emerald-500',
      received:         'border-l-green-500',
      rejected:         'border-l-red-500',
    };
    return colors[s] || 'border-l-slate-400';
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

  const hasActiveFilters = !!(search || status || priority || overdue || category || subCategory);

  const handleReset = useCallback(() => {
    setSearch('');
    setStatus(null);
    setPriority(null);
    setOverdue(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('tab');
      return next;
    }, { replace: true });
    setSubCategory(null);
    setPage(1);
  }, [setSearchParams]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((value: RequestStatus | null) => {
    setStatus(value);
    setPage(1);
  }, []);

  const handlePriorityChange = useCallback((value: Priority | null) => {
    setPriority(value);
    setPage(1);
  }, []);

  const handleOverdueChange = useCallback((value: boolean) => {
    setOverdue(value);
    setPage(1);
  }, []);

  const handleCategoryChange = useCallback((value: 'marble' | 'magro' | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set('tab', value);
      } else {
        next.delete('tab');
      }
      return next;
    }, { replace: true });
    setSubCategory(null);
    setPage(1);
  }, [setSearchParams]);

  const handleSubCategoryChange = useCallback((value: string | null) => {
    setSubCategory(value);
    setPage(1);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky Header ──────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="md:hidden h-11 px-2 gap-1 min-w-[70px] text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back</span>
              </Button>
              <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center">
                <List className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">{getPageTitle()}</h1>
                <p className="text-xs text-slate-500 sm:hidden">
                  {isLoading ? '\u00A0' : `${totalCount} request${totalCount !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-sm text-slate-600 hidden sm:block">{profile?.full_name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="hidden sm:flex text-slate-600 hover:bg-slate-100 gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">

        {/* ── Filters: Search / Priority / Overdue + Category Tabs ── */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-3">
            {/* Search + secondary filters (Priority, Status, Overdue) */}
            {/* Sub-category dropdown appears automatically when Magro tab is active */}
            <RequestToolbar
              search={search}
              status={Array.isArray(status) ? null : status}
              priority={priority}
              overdue={overdue}
              onSearchChange={handleSearchChange}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onOverdueChange={handleOverdueChange}
              onReset={handleReset}
              {...(category === 'magro' && {
                subCategory,
                onSubCategoryChange: handleSubCategoryChange,
              })}
            />

            {/* Category Tabs: All / Marble / Magro */}
            <div className="flex rounded-lg bg-slate-100 p-1 gap-1">
              {CATEGORY_TABS.map((tab) => {
                const isActive = category === tab.value;
                return (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => handleCategoryChange(tab.value)}
                    className={`flex-1 h-9 rounded-md text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-800 active:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Result count (Desktop) ─────────────────────── */}
        <div className="hidden sm:flex items-baseline gap-2">
          <h2 className="text-2xl font-bold text-slate-800">
            {isLoading ? '\u00A0' : totalCount}
          </h2>
          <span className="text-base text-slate-500 font-medium">
            {isMakerUser ? 'task' : 'request'}{totalCount !== 1 ? 's' : ''}
          </span>
          {!isLoading && totalPages > 1 && (
            <span className="text-sm text-slate-400 ml-1">· Page {page} of {totalPages}</span>
          )}
          <div className="ml-auto">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="hidden md:flex h-10 gap-2 font-medium border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </div>
        </div>

        {/* ── Data Display ───────────────────────────────── */}
        {isLoading ? (
          <RequestListSkeleton rows={5} />
        ) : requests.length === 0 ? (

          /* Empty State */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 sm:p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-800 text-lg font-semibold mb-1.5">
              {hasActiveFilters
                ? 'No results found'
                : isRequesterUser
                ? 'No requests yet'
                : isMakerUser
                ? 'No tasks assigned yet'
                : 'No requests found'}
            </p>
            <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
              {hasActiveFilters
                ? 'Try adjusting your filters or clearing the search term.'
                : isRequesterUser
                ? 'Create your first sample request to get started.'
                : isMakerUser
                ? 'Assigned tasks will appear here once a coordinator assigns them to you.'
                : 'No requests have been submitted to the system yet.'}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="mt-5 border-slate-200 text-slate-600 hover:bg-slate-50 h-10"
              >
                Clear All Filters
              </Button>
            )}
          </div>

        ) : (
          <>
            {/* ── Mobile Card Stack ────────────────────────── */}
            <div className="md:hidden space-y-2.5">
              {requests.map((request) => {
                const isDraft = request.status === 'draft';
                const summary = getItemSummary(request);
                const hasActions = isRequesterUser || !isDraft;

                return (
                  <Card
                    key={request.id}
                    onClick={!isDraft ? () => navigate(`/requests/${request.id}`) : undefined}
                    className={`bg-white border border-slate-200 shadow-sm overflow-hidden border-l-4 ${getStatusAccent(request.status)} ${
                      !isDraft ? 'cursor-pointer active:bg-slate-50 transition-colors' : ''
                    }`}
                  >
                    <CardContent className="p-4">

                      {/* Row 1: Request number + badges */}
                      <div className="flex items-center justify-between mb-2.5">
                        <code className="text-sm font-mono font-bold text-indigo-600">
                          {request.request_number}
                        </code>
                        <div className="flex items-center gap-1.5">
                          {request.priority === 'urgent' && (
                            <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded uppercase tracking-wide">
                              Urgent
                            </span>
                          )}
                          {getStatusBadge(request.status)}
                        </div>
                      </div>

                      {/* Row 2: Role-aware hero content */}
                      {isRequesterUser ? (
                        /* Requester: client info is the hero */
                        <div className="mb-2.5">
                          <p className="text-base font-semibold text-slate-900 leading-snug truncate">
                            {request.client_contact_name || '—'}
                          </p>
                          {(request.firm_name || request.site_location) && (
                            <p className="text-sm text-slate-500 truncate mt-0.5">
                              {[request.firm_name, request.site_location].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        /* Staff: requester identity is the hero */
                        <div className="mb-2.5">
                          {request.creator && (
                            <div className="flex items-center gap-2 mb-0.5">
                              <div className="flex items-baseline gap-1.5 flex-wrap min-w-0 flex-1">
                                <p className="text-base font-semibold text-slate-900 truncate">
                                  {request.creator.full_name}
                                </p>
                                {request.creator.department && (
                                  <span className="text-xs text-slate-500 whitespace-nowrap">
                                    · {request.creator.department}
                                  </span>
                                )}
                              </div>
                              {request.creator.phone && (
                                <a
                                  href={`tel:${request.creator.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-shrink-0 h-11 w-11 rounded-full bg-green-50 hover:bg-green-100 active:bg-green-200 flex items-center justify-center transition-colors"
                                >
                                  <Phone className="h-4 w-4 text-green-600" />
                                </a>
                              )}
                            </div>
                          )}
                          <p className="text-sm text-slate-500 truncate">
                            {[request.client_contact_name, request.firm_name].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      )}

                      {/* Row 3: Product summary + date (always visible on mobile) */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium ${
                            summary.isMulti
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                          title={summary.tooltip}
                        >
                          <Package className="h-3 w-3 flex-shrink-0" />
                          {summary.text}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          {formatDate(request.created_at)}
                        </div>
                      </div>

                      {/* Row 4: Action buttons (conditionally rendered) */}
                      {hasActions && (
                        <div
                          className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isRequesterUser && isDraft && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/requests/edit/${request.id}`)}
                                className="h-10 px-3 text-xs"
                              >
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDraftToDelete({ id: request.id, number: request.request_number })}
                                className="h-10 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {!isDraft && (
                            <TrackingDialog
                              request={request}
                              trigger={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-10 px-4 text-xs font-medium border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                >
                                  <MapPin className="h-3.5 w-3.5 mr-1.5" />
                                  Track
                                </Button>
                              }
                            />
                          )}
                        </div>
                      )}

                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ── Desktop Table ─────────────────────────────── */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b border-slate-200">
                    <TableHead className="font-bold text-slate-700">Request #</TableHead>
                    {isStaffUser && <TableHead className="font-bold text-slate-700">Requester</TableHead>}
                    <TableHead className="font-bold text-slate-700">Client / Project</TableHead>
                    <TableHead className="font-bold text-slate-700">Items</TableHead>
                    <TableHead className="font-bold text-slate-700">Priority</TableHead>
                    <TableHead className="font-bold text-slate-700">Status</TableHead>
                    <TableHead className="font-bold text-slate-700">Created</TableHead>
                    <TableHead className="text-center font-bold text-slate-700">Track</TableHead>
                    {isRequesterUser && <TableHead className="text-right font-bold text-slate-700">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const isDraft = request.status === 'draft';
                    return (
                      <TableRow
                        key={request.id}
                        className={`${!isDraft ? 'cursor-pointer hover:bg-slate-50' : ''} border-b border-slate-100 transition-colors`}
                        onClick={!isDraft ? () => navigate(`/requests/${request.id}`) : undefined}
                      >
                        <TableCell className="font-bold font-mono text-sm text-slate-800">
                          {request.request_number}
                        </TableCell>
                        {isStaffUser && (
                          <TableCell>
                            <p className="font-medium text-sm text-slate-700">{request.creator?.full_name || 'Unknown'}</p>
                            {request.creator?.department && (
                              <p className="text-xs text-slate-400 capitalize">{request.creator.department}</p>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <p className="font-semibold text-sm text-slate-700">{request.client_contact_name}</p>
                          {(request.firm_name || request.site_location) && (
                            <p className="text-xs text-slate-400">
                              {request.firm_name || request.site_location}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const summary = getItemSummary(request);
                            return (
                              <div
                                className={`flex items-center gap-1.5 text-sm ${summary.isMulti ? 'text-indigo-600 font-semibold' : 'text-slate-600'}`}
                                title={summary.tooltip}
                              >
                                {summary.isMulti && <Package className="h-4 w-4" />}
                                <span>{summary.text}</span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="text-sm text-slate-500">{formatDate(request.created_at)}</TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <TrackingDialog
                            request={request}
                            trigger={
                              <Button variant="ghost" size="sm" className="hover:bg-indigo-50">
                                <MapPin className="h-4 w-4 text-indigo-500" />
                              </Button>
                            }
                          />
                        </TableCell>
                        {isRequesterUser && (
                          <TableCell className="text-right">
                            {isDraft && (
                              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => navigate(`/requests/edit/${request.id}`)}
                                  className="hover:bg-sky-50"
                                >
                                  <Edit className="h-4 w-4 text-sky-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDraftToDelete({ id: request.id, number: request.request_number })}
                                  className="hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* ── Pagination ─────────────────────────────────── */}
        {!isLoading && totalPages > 1 && (
          <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-slate-600 text-center sm:text-left">
                <span className="hidden sm:inline">
                  Showing{' '}
                  <span className="font-semibold text-slate-800">{(page - 1) * 15 + 1}</span>–
                  <span className="font-semibold text-slate-800">{Math.min(page * 15, totalCount)}</span>
                  {' '}of{' '}
                  <span className="font-semibold text-slate-800">{totalCount}</span> results
                </span>
                <span className="sm:hidden">
                  Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
                </span>
              </p>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="flex-1 sm:flex-none h-11 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="flex-1 sm:flex-none h-11 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4 sm:ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Draft Confirmation ───────────────────── */}
        <AlertDialog open={!!draftToDelete} onOpenChange={() => setDraftToDelete(null)}>
          <AlertDialogContent className="border border-slate-200 shadow-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900">Delete Draft?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500">
                Are you sure you want to delete draft{' '}
                <strong className="text-slate-700">{draftToDelete?.number}</strong>?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-slate-200">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteDraft} className="bg-red-600 hover:bg-red-700">
                Delete Draft
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </main>
    </div>
  );
}
