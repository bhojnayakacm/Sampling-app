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
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Edit, Trash2, ChevronLeft, ChevronRight, MapPin, Package, Plus, LogOut, List } from 'lucide-react';
import { RequestStatus, Priority, Request } from '@/types';
import RequestToolbar from '@/components/requests/RequestToolbar';
import TrackingDialog from '@/components/requests/TrackingDialog';

// Status filter mapping for dashboard navigation
const STATUS_FILTERS: Record<string, RequestStatus[]> = {
  pending: ['pending_approval', 'approved', 'assigned'],
  completed: ['ready', 'dispatched', 'received'],
  // In Progress: All active statuses before dispatch (for Requester Dashboard)
  in_progress: ['pending_approval', 'approved', 'assigned', 'in_production', 'ready'],
};

// Helper function to generate smart item summary for table display
function getItemSummary(request: Request): { text: string; tooltip: string; isMulti: boolean } {
  const itemCount = request.item_count || 1;
  const totalQuantity = request.quantity || 0;

  if (itemCount === 1) {
    const productType = request.product_type || 'Unknown';
    const capitalizedType = productType.charAt(0).toUpperCase() + productType.slice(1);
    return {
      text: `${capitalizedType} (${totalQuantity} pcs)`,
      tooltip: `${capitalizedType} - ${request.quality || 'N/A'}`,
      isMulti: false,
    };
  }

  return {
    text: `${itemCount} Products`,
    tooltip: 'Click to view all products in this request',
    isMulti: true,
  };
}

export default function RequestList() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RequestStatus | RequestStatus[] | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<{ id: string; number: string } | null>(null);

  useEffect(() => {
    const urlStatus = searchParams.get('status');
    const urlFilter = searchParams.get('filter');

    if (urlStatus && STATUS_FILTERS[urlStatus]) {
      setStatus(STATUS_FILTERS[urlStatus]);
    } else if (urlStatus) {
      setStatus(urlStatus as RequestStatus);
    }

    if (urlFilter === 'drafts') {
      setStatus('draft');
    }
  }, [searchParams]);

  const deleteDraft = useDeleteDraft();

  const isRequesterUser = profile?.role === 'requester';
  const isMakerUser = profile?.role === 'maker';
  const isStaffUser = profile?.role === 'admin' || profile?.role === 'coordinator' || profile?.role === 'maker';

  const { data: result, isLoading } = usePaginatedRequests({
    page,
    pageSize: 15,
    search,
    status,
    priority,
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

  // Clean status badge styling (matching dashboard)
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700' },
      pending_approval: { label: 'Pending', className: 'bg-amber-50 text-amber-700' },
      approved: { label: 'Approved', className: 'bg-sky-50 text-sky-700' },
      assigned: { label: 'Assigned', className: 'bg-indigo-50 text-indigo-700' },
      in_production: { label: 'In Production', className: 'bg-violet-50 text-violet-700' },
      ready: { label: 'Ready', className: 'bg-teal-50 text-teal-700' },
      dispatched: { label: 'Dispatched', className: 'bg-emerald-50 text-emerald-700' },
      received: { label: 'Received', className: 'bg-green-50 text-green-700' },
      rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700' },
    };

    const { label, className } = statusMap[status] || { label: status, className: 'bg-slate-100 text-slate-700' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}>{label}</span>;
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'urgent') {
      return <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded uppercase">Urgent</span>;
    }
    return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded uppercase">Normal</span>;
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

  const handleReset = () => {
    setSearch('');
    setStatus(null);
    setPriority(null);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: RequestStatus | null) => {
    setStatus(value);
    setPage(1);
  };

  const handlePriorityChange = (value: Priority | null) => {
    setPriority(value);
    setPage(1);
  };

  // Get status bar color for mobile cards
  const getStatusBarColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-slate-400',
      pending_approval: 'bg-amber-500',
      approved: 'bg-sky-500',
      assigned: 'bg-indigo-500',
      in_production: 'bg-violet-500',
      ready: 'bg-teal-500',
      dispatched: 'bg-emerald-500',
      received: 'bg-green-500',
      rejected: 'bg-red-500',
    };
    return colors[status] || 'bg-slate-400';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Clean White Header */}
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
                  {isLoading ? 'Loading...' : `${totalCount} request${totalCount !== 1 ? 's' : ''}`}
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* Mobile Quick Action - New Request button */}
        {isRequesterUser && (
          <div className="md:hidden">
            <Button
              onClick={() => navigate('/requests/new')}
              className="w-full min-h-[52px] gap-3 font-semibold text-base bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-5 w-5" />
              New Request
            </Button>
          </div>
        )}

        {/* Toolbar with Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <RequestToolbar
            search={search}
            status={Array.isArray(status) ? null : status}
            priority={priority}
            onSearchChange={handleSearchChange}
            onStatusChange={handleStatusChange}
            onPriorityChange={handlePriorityChange}
            onReset={handleReset}
          />
        </div>

        {/* Header with count and actions - Desktop */}
        <div className="flex justify-between items-center">
          <div className="hidden sm:flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-bold text-slate-800">
                {isLoading ? '...' : totalCount}
              </h2>
              <span className="text-base text-slate-500 font-medium">
                Request{totalCount !== 1 ? 's' : ''}
              </span>
            </div>
            {!isLoading && totalPages > 0 && (
              <p className="text-sm text-slate-400">
                Page {page} of {totalPages}
              </p>
            )}
          </div>

          <div className="hidden md:flex gap-3 ml-auto">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="h-11 gap-2 font-medium border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Dashboard
            </Button>
            {isRequesterUser && (
              <Button
                onClick={() => navigate('/requests/new')}
                className="h-11 gap-2 font-semibold bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                New Request
              </Button>
            )}
          </div>
        </div>

        {/* Data Display */}
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-100 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
              <div className="h-4 bg-slate-100 rounded w-2/3 mx-auto"></div>
            </div>
            <p className="text-slate-500 mt-4 font-medium">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="rounded-xl bg-slate-100 p-5 w-fit mx-auto mb-4">
              <Package className="h-10 w-10 text-slate-400" />
            </div>
            <p className="text-slate-600 text-lg font-medium">
              {search || status || priority
                ? 'No requests found matching your filters.'
                : isRequesterUser
                ? 'No requests found. Create your first request to get started.'
                : isMakerUser
                ? 'No tasks assigned to you yet.'
                : 'No requests found in the system.'}
            </p>
            {(search || status || priority) && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="mt-4 border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {requests.map((request) => {
                const isDraft = request.status === 'draft';
                const summary = getItemSummary(request);
                return (
                  <div
                    key={request.id}
                    onClick={!isDraft ? () => navigate(`/requests/${request.id}`) : undefined}
                    className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 ${
                      !isDraft ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : ''
                    }`}
                  >
                    {/* Status Bar */}
                    <div className={`h-1.5 ${getStatusBarColor(request.status)}`} />

                    <div className="p-4">
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-sm font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                              {request.request_number}
                            </code>
                            {request.priority === 'urgent' && (
                              <span className="px-1.5 py-0.5 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold rounded uppercase">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {request.client_project_name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{request.company_firm_name}</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-0.5 ml-2 flex-shrink-0">
                          <div onClick={(e) => e.stopPropagation()}>
                            <TrackingDialog
                              request={request}
                              trigger={
                                <Button variant="ghost" size="sm" className="h-11 w-11 p-0 hover:bg-indigo-50">
                                  <MapPin className="h-5 w-5 text-indigo-500" />
                                </Button>
                              }
                            />
                          </div>
                          {isRequesterUser && isDraft && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/requests/edit/${request.id}`);
                                }}
                                className="h-11 w-11 p-0 hover:bg-sky-50"
                              >
                                <Edit className="h-5 w-5 text-sky-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDraftToDelete({ id: request.id, number: request.request_number });
                                }}
                                className="h-11 w-11 p-0 hover:bg-red-50"
                              >
                                <Trash2 className="h-5 w-5 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="mb-3">
                        {getStatusBadge(request.status)}
                      </div>

                      {/* Details Row */}
                      <div className="flex items-center justify-between text-xs bg-slate-50 -mx-4 px-4 py-2.5 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Package className="h-3.5 w-3.5 text-slate-400" />
                          <span className={summary.isMulti ? 'font-semibold text-indigo-600' : ''}>
                            {summary.text}
                          </span>
                        </div>
                        <span className="text-slate-400 font-medium">{formatDate(request.created_at)}</span>
                      </div>

                      {/* Creator Info */}
                      {request.creator && (
                        <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-dashed border-slate-200">
                          by {request.creator.full_name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
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
                        <TableCell className="font-bold font-mono text-sm text-slate-800">{request.request_number}</TableCell>
                        {isStaffUser && (
                          <TableCell>
                            <p className="font-medium text-sm text-slate-700">{request.creator?.full_name || 'Unknown'}</p>
                            {request.creator?.department && (
                              <p className="text-xs text-slate-400 capitalize">{request.creator.department}</p>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <div>
                            <p className="font-semibold text-sm text-slate-700">{request.client_project_name}</p>
                            <p className="text-xs text-slate-400">{request.company_firm_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const summary = getItemSummary(request);
                            return (
                              <div
                                className={`flex items-center gap-1.5 ${summary.isMulti ? 'text-indigo-600 font-semibold' : 'text-slate-600'}`}
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

        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-slate-600 text-center sm:text-left">
                <span className="hidden sm:inline">
                  Showing <span className="font-semibold text-slate-800">{(page - 1) * 15 + 1}</span> to{' '}
                  <span className="font-semibold text-slate-800">{Math.min(page * 15, totalCount)}</span> of{' '}
                  <span className="font-semibold text-slate-800">{totalCount}</span> results
                </span>
                <span className="sm:hidden">
                  Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
                </span>
              </div>
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

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!draftToDelete} onOpenChange={() => setDraftToDelete(null)}>
          <AlertDialogContent className="border border-slate-200 shadow-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900">Delete Draft?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500">
                Are you sure you want to delete draft <strong className="text-slate-700">{draftToDelete?.number}</strong>?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-slate-200">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteDraft}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Draft
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
