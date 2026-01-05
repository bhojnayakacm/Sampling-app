import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
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
import DashboardLayout from '@/components/layouts/DashboardLayout';
import RequestToolbar from '@/components/requests/RequestToolbar';
import TrackingDialog from '@/components/requests/TrackingDialog';
import ReportsView from './coordinator/ReportsView';
import { useAuth } from '@/contexts/AuthContext';
import { useAllRequestsStats, usePaginatedRequests, useDeleteDraft } from '@/lib/api/requests';
import { formatDate } from '@/lib/utils';
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
  Eye
} from 'lucide-react';
import { RequestStatus, Priority, Request } from '@/types';

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

// Premium status badge with gradient styling
function getStatusBadge(status: string) {
  const statusMap: Record<string, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    pending_approval: { label: 'Pending', className: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border-amber-200' },
    approved: { label: 'Approved', className: 'bg-gradient-to-r from-sky-100 to-blue-100 text-sky-800 border-sky-200' },
    assigned: { label: 'Assigned', className: 'bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-800 border-indigo-200' },
    in_production: { label: 'In Production', className: 'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-800 border-violet-200' },
    ready: { label: 'Ready', className: 'bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-800 border-teal-200' },
    dispatched: { label: 'Dispatched', className: 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border-emerald-200' },
    received: { label: 'Received', className: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200' },
    rejected: { label: 'Rejected', className: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-200' },
  };

  const { label, className } = statusMap[status] || { label: status, className: 'bg-slate-100 text-slate-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${className}`}>
      {label}
    </span>
  );
}

function getPriorityBadge(priority: string) {
  const isUrgent = priority === 'urgent';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
      isUrgent
        ? 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border-red-200'
        : 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-600 border-slate-200'
    }`}>
      {priority}
    </span>
  );
}

// Get status gradient bar color for mobile cards
function getStatusBarColor(status: string) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-300',
    pending_approval: 'bg-gradient-to-r from-amber-400 to-orange-400',
    approved: 'bg-gradient-to-r from-sky-400 to-blue-400',
    assigned: 'bg-gradient-to-r from-indigo-400 to-violet-400',
    in_production: 'bg-gradient-to-r from-violet-400 to-purple-400',
    ready: 'bg-gradient-to-r from-teal-400 to-cyan-400',
    dispatched: 'bg-gradient-to-r from-emerald-400 to-green-400',
    received: 'bg-gradient-to-r from-green-400 to-emerald-400',
    rejected: 'bg-gradient-to-r from-red-400 to-rose-400',
  };
  return colors[status] || 'bg-slate-300';
}

export default function CoordinatorDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: stats, isLoading: statsLoading } = useAllRequestsStats();

  const activeTab = searchParams.get('tab') || 'sample-requests';
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RequestStatus | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<{ id: string; number: string } | null>(null);

  const deleteDraft = useDeleteDraft();

  const { data: result, isLoading: requestsLoading } = usePaginatedRequests({
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

  const isRequesterUser = profile?.role === 'requester';
  const isStaffUser = profile?.role === 'admin' || profile?.role === 'coordinator' || profile?.role === 'maker';

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

  const handleReset = () => {
    setSearch('');
    setStatus(null);
    setPriority(null);
    setPage(1);
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
          {/* Command Center - Premium KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Requests */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Total</p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                      {statsLoading ? '...' : stats?.total || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Inbox className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pending Approval */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Pending</p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                      {statsLoading ? '...' : stats?.pending || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* In Production */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-500" />
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-violet-600 uppercase tracking-wide">Production</p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                      {statsLoading ? '...' : stats?.in_production || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Cog className="h-6 w-6 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dispatched */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-green-500" />
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Dispatched</p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                      {statsLoading ? '...' : stats?.dispatched || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Truck className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Toolbar with filters */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-4 border border-white/50">
            <RequestToolbar
              search={search}
              status={status}
              priority={priority}
              onSearchChange={handleSearchChange}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onReset={handleReset}
            />
          </div>

          {/* Request Count Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {requestsLoading ? 'Loading...' : `${totalCount} Request${totalCount !== 1 ? 's' : ''}`}
              </h2>
              {!requestsLoading && totalPages > 0 && (
                <p className="text-sm text-slate-500 mt-0.5">
                  Page {page} of {totalPages}
                </p>
              )}
            </div>
          </div>

          {/* Request Data */}
          {requestsLoading ? (
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Loading requests...</p>
              </CardContent>
            </Card>
          ) : requests.length === 0 ? (
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-slate-600 text-lg font-medium">
                  {search || status || priority
                    ? 'No requests found matching your filters.'
                    : 'No requests found in the system.'}
                </p>
                {(search || status || priority) && (
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="mt-4 min-h-[48px]"
                  >
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile Card Stack View */}
              <div className="md:hidden space-y-3">
                {requests.map((request) => {
                  const isDraft = request.status === 'draft';
                  return (
                    <Card
                      key={request.id}
                      onClick={!isDraft ? () => navigate(`/requests/${request.id}`) : undefined}
                      className={`border-0 shadow-md bg-white/80 backdrop-blur-sm overflow-hidden ${
                        !isDraft ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
                      }`}
                    >
                      {/* Status gradient bar */}
                      <div className={`h-1.5 ${getStatusBarColor(request.status)}`} />

                      <CardContent className="p-4">
                        {/* Header Row */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <code className="text-sm font-mono font-bold text-indigo-600 block">
                              {request.request_number}
                            </code>
                            <p className="text-sm font-semibold text-slate-800 mt-1 truncate">
                              {request.client_project_name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{request.company_firm_name}</p>
                          </div>
                          <div className="flex gap-1 ml-2 flex-shrink-0">
                            <TrackingDialog
                              request={request}
                              trigger={
                                <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-indigo-50">
                                  <MapPin className="h-4 w-4 text-indigo-500" />
                                </Button>
                              }
                            />
                            {!isDraft && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 w-10 p-0 hover:bg-indigo-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/requests/${request.id}`);
                                }}
                              >
                                <Eye className="h-4 w-4 text-indigo-500" />
                              </Button>
                            )}
                            {isRequesterUser && isDraft && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/requests/edit/${request.id}`);
                                  }}
                                  className="h-10 w-10 p-0"
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
                                  className="h-10 w-10 p-0"
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

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="col-span-2 bg-slate-50 rounded-lg p-2">
                            <span className="text-slate-500">Items:</span>
                            {(() => {
                              const summary = getItemSummary(request);
                              return (
                                <span
                                  className={`ml-1 font-semibold ${summary.isMulti ? 'text-indigo-600' : 'text-slate-700'}`}
                                  title={summary.tooltip}
                                >
                                  {summary.isMulti && <Package className="inline h-3 w-3 mr-1" />}
                                  {summary.text}
                                </span>
                              );
                            })()}
                          </div>
                          <div>
                            <span className="text-slate-500">Created:</span>
                            <span className="ml-1 font-semibold text-slate-700">{formatDate(request.created_at)}</span>
                          </div>
                        </div>

                        {/* Creator Info */}
                        {request.creator && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <span className="text-xs text-slate-500">Requester: </span>
                            <span className="text-xs font-bold text-indigo-600">
                              {request.creator.full_name}
                            </span>
                            {request.creator.department && (
                              <span className="text-xs text-slate-400 ml-1 capitalize">
                                ({request.creator.department})
                              </span>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-slate-50 to-indigo-50/30 hover:bg-slate-50">
                        <TableHead className="font-bold text-slate-700">Request #</TableHead>
                        {isStaffUser && <TableHead className="font-bold text-slate-700">Requester</TableHead>}
                        <TableHead className="font-bold text-slate-700">Client / Project</TableHead>
                        <TableHead className="font-bold text-slate-700">Items</TableHead>
                        <TableHead className="font-bold text-slate-700">Priority</TableHead>
                        <TableHead className="font-bold text-slate-700">Status</TableHead>
                        <TableHead className="font-bold text-slate-700">Created</TableHead>
                        <TableHead className="font-bold text-slate-700 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request, index) => {
                        const isDraft = request.status === 'draft';
                        return (
                          <TableRow
                            key={request.id}
                            className={`${!isDraft ? 'cursor-pointer' : ''} ${
                              index % 2 === 0 ? 'bg-white/50' : 'bg-slate-50/50'
                            } hover:bg-indigo-50/50 transition-colors`}
                            onClick={!isDraft ? () => navigate(`/requests/${request.id}`) : undefined}
                          >
                            <TableCell className="font-mono font-bold text-indigo-600">
                              {request.request_number}
                            </TableCell>
                            {isStaffUser && (
                              <TableCell>
                                <p className="font-semibold text-sm text-slate-800">
                                  {request.creator?.full_name || 'Unknown'}
                                </p>
                                {request.creator?.department && (
                                  <p className="text-xs text-slate-500 capitalize">
                                    {request.creator.department}
                                  </p>
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <div>
                                <p className="font-semibold text-sm text-slate-800">{request.client_project_name}</p>
                                <p className="text-xs text-slate-500">{request.company_firm_name}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const summary = getItemSummary(request);
                                return (
                                  <div
                                    className={`flex items-center gap-1.5 ${summary.isMulti ? 'text-indigo-600 font-semibold' : 'text-slate-700'}`}
                                    title={summary.tooltip}
                                  >
                                    {summary.isMulti && <Package className="h-4 w-4" />}
                                    <span className="text-sm">{summary.text}</span>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                            <TableCell>{getStatusBadge(request.status)}</TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {formatDate(request.created_at)}
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-center gap-1">
                                <TrackingDialog
                                  request={request}
                                  trigger={
                                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-indigo-50">
                                      <MapPin className="h-4 w-4 text-indigo-500" />
                                    </Button>
                                  }
                                />
                                {!isDraft && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 p-0 hover:bg-indigo-50"
                                    onClick={() => navigate(`/requests/${request.id}`)}
                                  >
                                    <Eye className="h-4 w-4 text-indigo-500" />
                                  </Button>
                                )}
                                {isRequesterUser && isDraft && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => navigate(`/requests/edit/${request.id}`)}
                                      className="h-9 w-9 p-0"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setDraftToDelete({ id: request.id, number: request.request_number })}
                                      className="h-9 w-9 p-0"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            </>
          )}

          {/* Pagination Controls */}
          {!requestsLoading && totalPages > 1 && (
            <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm">
              <CardContent className="px-4 py-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-sm text-slate-600 text-center sm:text-left">
                    <span className="hidden sm:inline">
                      Showing <span className="font-bold text-slate-800">{(page - 1) * 15 + 1}</span> to{' '}
                      <span className="font-bold text-slate-800">{Math.min(page * 15, totalCount)}</span> of{' '}
                      <span className="font-bold text-slate-800">{totalCount}</span> results
                    </span>
                    <span className="sm:hidden">
                      Page <span className="font-bold">{page}</span> of <span className="font-bold">{totalPages}</span>
                    </span>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="flex-1 sm:flex-none min-h-[48px] gap-2 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      className="flex-1 sm:flex-none min-h-[48px] gap-2 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200"
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
            <AlertDialogContent className="bg-white/95 backdrop-blur-sm">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600">Delete Draft?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete draft <strong>{draftToDelete?.number}</strong>?
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-[48px]">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteDraft}
                  className="min-h-[48px] bg-red-600 hover:bg-red-700"
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
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-12 text-center">
            <h2 className="text-2xl font-bold text-slate-700 mb-2">Coming Soon</h2>
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
