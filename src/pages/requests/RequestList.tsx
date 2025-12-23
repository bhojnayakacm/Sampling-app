import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Edit, Trash2, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { RequestStatus, Priority } from '@/types';
import RequestToolbar from '@/components/requests/RequestToolbar';
import TrackingDialog from '@/components/requests/TrackingDialog';

// Status filter mapping for dashboard navigation
const STATUS_FILTERS: Record<string, RequestStatus[]> = {
  pending: ['pending_approval', 'approved', 'assigned'],
  in_production: ['assigned', 'in_production'],
  dispatched: ['dispatched'],
  assigned: ['assigned'],
  completed: ['ready', 'dispatched'],
};

export default function RequestList() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pagination and filter state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RequestStatus | RequestStatus[] | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<{ id: string; number: string } | null>(null);

  // Initialize filters from URL parameters (for dashboard navigation)
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    const urlFilter = searchParams.get('filter');

    // Handle status-based filtering from dashboard cards
    if (urlStatus && STATUS_FILTERS[urlStatus]) {
      setStatus(STATUS_FILTERS[urlStatus]);
    } else if (urlStatus) {
      setStatus(urlStatus as RequestStatus);
    }

    // Handle filter-based navigation (drafts/submitted)
    if (urlFilter === 'drafts') {
      setStatus('draft');
    } else if (urlFilter === 'submitted') {
      // For submitted, we'll handle it differently - show all non-draft
      // This is handled in the API call with role-based filtering
    }
  }, [searchParams]);

  const deleteDraft = useDeleteDraft();

  // Determine user role for filtering
  const isRequesterUser = profile?.role === 'requester';
  const isMakerUser = profile?.role === 'maker';
  const isStaffUser = profile?.role === 'admin' || profile?.role === 'coordinator' || profile?.role === 'maker';

  // Fetch paginated requests with server-side filtering
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

  // Get appropriate page title based on role
  const getPageTitle = () => {
    if (isRequesterUser) return 'My Requests';
    if (isMakerUser) return 'My Tasks';
    return 'All Requests';
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Draft', variant: 'outline' },
      pending_approval: { label: 'Pending Approval', variant: 'outline' },
      approved: { label: 'Approved', variant: 'secondary' },
      assigned: { label: 'Assigned', variant: 'secondary' },
      in_production: { label: 'In Production', variant: 'default' },
      ready: { label: 'Ready', variant: 'default' },
      dispatched: { label: 'Dispatched', variant: 'default' },
      received: { label: 'Received', variant: 'secondary' },
      rejected: { label: 'Rejected', variant: 'destructive' },
    };

    const { label, variant } = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' }> = {
      urgent: { variant: 'destructive' },
      normal: { variant: 'default' },
    };

    return (
      <Badge variant={priorityMap[priority]?.variant || 'default'}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  // Handle delete draft
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

  // Reset all filters
  const handleReset = () => {
    setSearch('');
    setStatus(null);
    setPriority(null);
    setPage(1);
  };

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: RequestStatus | null) => {
    setStatus(value); // Single status from toolbar filter
    setPage(1);
  };

  const handlePriorityChange = (value: Priority | null) => {
    setPriority(value);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{profile?.full_name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Toolbar with Search and Filters */}
        <RequestToolbar
          search={search}
          status={Array.isArray(status) ? null : status}
          priority={priority}
          onSearchChange={handleSearchChange}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onReset={handleReset}
        />

        {/* Header with count and actions - Mobile Optimized */}
        <div className="flex justify-between items-start gap-4">
          {/* Left Side: Text Group */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-semibold">
                {isLoading ? 'Loading...' : totalCount}
              </h2>
              <span className="text-base text-gray-600">
                Request{totalCount !== 1 ? 's' : ''}
              </span>
            </div>
            {!isLoading && totalPages > 0 && (
              <p className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </p>
            )}
          </div>

          {/* Right Side: Button Group - Vertical on mobile, horizontal on desktop */}
          <div className="flex flex-col md:flex-row gap-2 md:gap-4 ml-auto flex-shrink-0">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              size="sm"
              className="h-10 whitespace-nowrap"
            >
              Back to Dashboard
            </Button>
            {isRequesterUser && (
              <Button
                onClick={() => navigate('/requests/new')}
                size="sm"
                className="h-10 whitespace-nowrap"
              >
                New Request
              </Button>
            )}
          </div>
        </div>

        {/* Data Table */}
        {isLoading ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
            </div>
            <p className="text-gray-500 mt-4">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <p className="text-gray-500 text-lg">
              {search || status || priority
                ? 'No requests found matching your filters.'
                : isRequesterUser
                ? 'No requests found. Create your first request to get started.'
                : isMakerUser
                ? 'No tasks assigned to you yet.'
                : 'No requests found in the system.'}
            </p>
            {(search || status || priority) && (
              <Button variant="outline" onClick={handleReset} className="mt-4">
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
                return (
                  <div
                    key={request.id}
                    onClick={!isDraft ? () => navigate(`/requests/${request.id}`) : undefined}
                    className={`bg-white rounded-lg border shadow-sm p-4 ${
                      !isDraft ? 'cursor-pointer active:bg-gray-50' : ''
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <code className="text-sm font-mono font-semibold text-gray-900 block">
                          {request.request_number}
                        </code>
                        <p className="text-sm font-medium text-gray-700 mt-1 truncate">
                          {request.client_project_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{request.company_firm_name}</p>
                      </div>
                      <div className="flex gap-2 ml-2 flex-shrink-0">
                        <div onClick={(e) => e.stopPropagation()}>
                          <TrackingDialog
                            request={request}
                            trigger={
                              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                                <MapPin className="h-4 w-4" />
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
                              className="h-9 w-9 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDraftToDelete({ id: request.id, number: request.request_number });
                              }}
                              className="h-9 w-9 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status and Priority Badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {getStatusBadge(request.status)}
                      {getPriorityBadge(request.priority)}
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Product:</span>
                        <span className="ml-1 font-medium capitalize">{request.product_type}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Quality:</span>
                        <span className="ml-1 font-medium capitalize">{request.quality}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Quantity:</span>
                        <span className="ml-1 font-medium">{request.quantity} pcs</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Created:</span>
                        <span className="ml-1 font-medium">{formatDate(request.created_at)}</span>
                      </div>
                    </div>

                    {/* Creator Info */}
                    {request.creator && (
                      <p className="text-xs text-gray-400 mt-2 pt-2 border-t">
                        Requested by {request.creator.full_name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request #</TableHead>
                    {isStaffUser && <TableHead>Requester</TableHead>}
                    <TableHead>Client / Project</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-center">Track</TableHead>
                    {isRequesterUser && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const isDraft = request.status === 'draft';
                    return (
                      <TableRow
                        key={request.id}
                        className={!isDraft ? 'cursor-pointer hover:bg-gray-50' : ''}
                        onClick={!isDraft ? () => navigate(`/requests/${request.id}`) : undefined}
                      >
                        <TableCell className="font-medium font-mono text-sm">{request.request_number}</TableCell>
                        {isStaffUser && (
                          <TableCell>
                            <p className="font-medium text-sm">
                              {request.creator?.full_name || 'Unknown'}
                            </p>
                            {request.creator?.department && (
                              <p className="text-xs text-gray-500 capitalize">
                                {request.creator.department}
                              </p>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{request.client_project_name}</p>
                            <p className="text-xs text-gray-500">{request.company_firm_name}</p>
                            {!isStaffUser && request.creator && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                by {request.creator.full_name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{request.product_type}</TableCell>
                        <TableCell className="capitalize">{request.quality}</TableCell>
                        <TableCell className="text-center">{request.quantity}</TableCell>
                        <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDate(request.created_at)}
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <TrackingDialog
                            request={request}
                            trigger={
                              <Button variant="ghost" size="sm">
                                <MapPin className="h-4 w-4" />
                              </Button>
                            }
                          />
                        </TableCell>
                        {isRequesterUser && (
                          <TableCell className="text-right">
                            {isDraft && (
                              <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/requests/edit/${request.id}`);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDraftToDelete({ id: request.id, number: request.request_number });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
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

        {/* Pagination Controls - Mobile Optimized */}
        {!isLoading && totalPages > 1 && (
          <div className="bg-white px-3 sm:px-4 py-3 rounded-lg border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
                <span className="hidden sm:inline">
                  Showing <span className="font-medium">{(page - 1) * 15 + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(page * 15, totalCount)}</span> of{' '}
                  <span className="font-medium">{totalCount}</span> results
                </span>
                <span className="sm:hidden">
                  Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                </span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="flex-1 sm:flex-none h-10 sm:h-9"
                >
                  <ChevronLeft className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="flex-1 sm:flex-none h-10 sm:h-9"
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
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Draft?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete draft <strong>{draftToDelete?.number}</strong>?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
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
