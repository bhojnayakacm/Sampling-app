import { useState, useRef } from 'react';
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
  Eye,
  ArrowRight,
  CheckCircle,
  PackageCheck,
} from 'lucide-react';
import { RequestStatus, Priority, Request } from '@/types';

// Stat card configuration type
interface StatCardConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  hoverColor: string;
  getValue: (stats: any) => number;
  filterStatus: RequestStatus | null; // null means "show all"
}

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

// Clean status badge
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function getPriorityBadge(priority: string) {
  const isUrgent = priority === 'urgent';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium uppercase ${
      isUrgent ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
    }`}>
      {priority}
    </span>
  );
}

// Get status accent color for mobile cards
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

  // Define all 6 stat cards
  const statCards: StatCardConfig[] = [
    {
      key: 'total',
      label: 'Total Requests',
      icon: Inbox,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      hoverColor: 'group-hover:text-blue-500',
      getValue: (s) => s?.total || 0,
      filterStatus: null,
    },
    {
      key: 'pending',
      label: 'Pending',
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      hoverColor: 'group-hover:text-amber-500',
      getValue: (s) => s?.pending || 0,
      filterStatus: 'pending_approval',
    },
    {
      key: 'in_production',
      label: 'In Production',
      icon: Cog,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      hoverColor: 'group-hover:text-violet-500',
      getValue: (s) => s?.in_production || 0,
      filterStatus: 'in_production',
    },
    {
      key: 'ready',
      label: 'Ready',
      icon: CheckCircle,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      hoverColor: 'group-hover:text-teal-500',
      getValue: (s) => s?.ready || 0,
      filterStatus: 'ready',
    },
    {
      key: 'dispatched',
      label: 'Dispatched',
      icon: Truck,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      hoverColor: 'group-hover:text-emerald-500',
      getValue: (s) => s?.dispatched || 0,
      filterStatus: 'dispatched',
    },
    {
      key: 'received',
      label: 'Received',
      icon: PackageCheck,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      hoverColor: 'group-hover:text-green-500',
      getValue: (s) => s?.received || 0,
      filterStatus: 'received',
    },
  ];

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: RequestStatus | null) => {
    setStatus(value);
    setPage(1);
    // Clear active card highlight when manually changing status
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

  // Handle stat card click - filters list and scrolls
  const handleCardClick = (card: StatCardConfig) => {
    setStatus(card.filterStatus);
    setPage(1);
    setActiveCard(card.key);

    // Smooth scroll to list section
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
          {/* Stats Cards - 6 Card Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                        <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.iconColor}`} />
                      </div>
                      <ArrowRight className={`h-3.5 w-3.5 text-slate-300 ${card.hoverColor} transition-colors`} />
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900">
                      {statsLoading ? '...' : value}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">{card.label}</p>
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
              {/* Mobile Card Stack View */}
              <div className="md:hidden space-y-3">
                {requests.map((request) => {
                  const isDraft = request.status === 'draft';
                  return (
                    <Card
                      key={request.id}
                      onClick={!isDraft ? () => navigate(`/requests/${request.id}`) : undefined}
                      className={`bg-white border border-slate-200 shadow-sm overflow-hidden border-l-4 ${getStatusAccent(request.status)} ${
                        !isDraft ? 'cursor-pointer active:bg-slate-50' : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        {/* Header Row */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <code className="text-sm font-mono font-semibold text-indigo-600">
                              {request.request_number}
                            </code>
                            <p className="text-sm font-medium text-slate-900 mt-1 truncate">
                              {request.client_project_name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{request.company_firm_name}</p>
                          </div>
                          <div className="flex gap-1 ml-2 flex-shrink-0">
                            <TrackingDialog
                              request={request}
                              trigger={
                                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-slate-100">
                                  <MapPin className="h-4 w-4 text-slate-400" />
                                </Button>
                              }
                            />
                            {!isDraft && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 hover:bg-slate-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/requests/${request.id}`);
                                }}
                              >
                                <Eye className="h-4 w-4 text-slate-400" />
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
                                  <Trash2 className="h-4 w-4 text-red-500" />
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
                          <div className="col-span-2 bg-slate-50 rounded-md p-2">
                            <span className="text-slate-500">Items:</span>
                            {(() => {
                              const summary = getItemSummary(request);
                              return (
                                <span
                                  className={`ml-1 font-medium ${summary.isMulti ? 'text-indigo-600' : 'text-slate-700'}`}
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
                            <span className="ml-1 font-medium text-slate-700">{formatDate(request.created_at)}</span>
                          </div>
                        </div>

                        {/* Creator Info */}
                        {request.creator && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <span className="text-xs text-slate-500">Requester: </span>
                            <span className="text-xs font-medium text-indigo-600">
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
                <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">Request #</TableHead>
                        {isStaffUser && <TableHead className="font-semibold text-slate-700">Requester</TableHead>}
                        <TableHead className="font-semibold text-slate-700">Client / Project</TableHead>
                        <TableHead className="font-semibold text-slate-700">Items</TableHead>
                        <TableHead className="font-semibold text-slate-700">Priority</TableHead>
                        <TableHead className="font-semibold text-slate-700">Status</TableHead>
                        <TableHead className="font-semibold text-slate-700">Created</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => {
                        const isDraft = request.status === 'draft';
                        return (
                          <TableRow
                            key={request.id}
                            className={`${!isDraft ? 'cursor-pointer' : ''} hover:bg-slate-50 transition-colors`}
                            onClick={!isDraft ? () => navigate(`/requests/${request.id}`) : undefined}
                          >
                            <TableCell className="font-mono font-medium text-indigo-600">
                              {request.request_number}
                            </TableCell>
                            {isStaffUser && (
                              <TableCell>
                                <p className="font-medium text-sm text-slate-900">
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
                                <p className="font-medium text-sm text-slate-900">{request.client_project_name}</p>
                                <p className="text-xs text-slate-500">{request.company_firm_name}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const summary = getItemSummary(request);
                                return (
                                  <div
                                    className={`flex items-center gap-1.5 ${summary.isMulti ? 'text-indigo-600 font-medium' : 'text-slate-700'}`}
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
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100">
                                      <MapPin className="h-4 w-4 text-slate-400" />
                                    </Button>
                                  }
                                />
                                {!isDraft && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-slate-100"
                                    onClick={() => navigate(`/requests/${request.id}`)}
                                  >
                                    <Eye className="h-4 w-4 text-slate-400" />
                                  </Button>
                                )}
                                {isRequesterUser && isDraft && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => navigate(`/requests/edit/${request.id}`)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setDraftToDelete({ id: request.id, number: request.request_number })}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
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
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardContent className="px-4 py-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-sm text-slate-600 text-center sm:text-left">
                    <span className="hidden sm:inline">
                      Showing <span className="font-medium text-slate-900">{(page - 1) * 15 + 1}</span> to{' '}
                      <span className="font-medium text-slate-900">{Math.min(page * 15, totalCount)}</span> of{' '}
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
