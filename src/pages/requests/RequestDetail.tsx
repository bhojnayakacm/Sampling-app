import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { useRequestWithItems } from '@/lib/api/requests';
import { formatDateTime } from '@/lib/utils';
import RequestActions from '@/components/requests/RequestActions';
import MakerActions from '@/components/requests/MakerActions';
import TrackingDialog from '@/components/requests/TrackingDialog';
import {
  MapPin,
  MessageSquare,
  CheckCircle,
  XCircle,
  ChevronLeft,
  Package,
  Image as ImageIcon,
  Truck,
} from 'lucide-react';
import type { RequestItemDB } from '@/types';

export default function RequestDetail() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  // Use the new hook that fetches request WITH items
  const { data: request, isLoading, error } = useRequestWithItems(id);

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

  // Get product type color for visual differentiation
  const getProductTypeColor = (productType: string) => {
    const colors: Record<string, string> = {
      marble: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      tile: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      terrazzo: 'bg-amber-100 text-amber-800 border-amber-200',
      quartz: 'bg-pink-100 text-pink-800 border-pink-200',
    };
    return colors[productType] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Render a single product item card - Mobile-optimized stacked layout
  const renderProductItem = (item: RequestItemDB, index: number, total: number) => {
    const showFinish = item.product_type === 'marble' || item.product_type === 'tile';

    return (
      <Card key={item.id} className="border-l-4 border-l-primary overflow-hidden">
        {/* Card Header - Compact on mobile */}
        <CardHeader className="pb-2 sm:pb-3 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs sm:text-sm">
                {index + 1}
              </div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="capitalize">{item.product_type}</span>
              </CardTitle>
            </div>
            <Badge className={`text-xs ${getProductTypeColor(item.product_type)}`}>
              {total > 1 ? `${index + 1}/${total}` : 'Item'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-3 sm:pt-4 space-y-3 sm:space-y-4">
          {/* Mobile-First: Stacked detail rows */}
          <div className="space-y-3">
            {/* Quality & Quantity - Side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quality</span>
                <p className="text-sm sm:text-base font-medium mt-0.5 capitalize">
                  {item.quality_custom || item.quality}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quantity</span>
                <p className="text-sm sm:text-base font-semibold mt-0.5">{item.quantity} pcs</p>
              </div>
            </div>

            {/* Size & Thickness - Side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Size</span>
                <p className="text-sm font-medium mt-0.5">{item.sample_size}</p>
                {item.sample_size_remarks && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.sample_size_remarks}</p>
                )}
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Thickness</span>
                <p className="text-sm font-medium mt-0.5">{item.thickness}</p>
                {item.thickness_remarks && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.thickness_remarks}</p>
                )}
              </div>
            </div>

            {/* Finish - Full width if applicable */}
            {showFinish && item.finish && (
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Finish</span>
                <p className="text-sm font-medium mt-0.5">{item.finish}</p>
                {item.finish_remarks && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.finish_remarks}</p>
                )}
              </div>
            )}
          </div>

          {/* Item Image - Responsive */}
          {item.image_url && (
            <div className="pt-3 border-t">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                <ImageIcon className="h-3.5 w-3.5" />
                Reference Image
              </span>
              <img
                src={item.image_url}
                alt={`${item.product_type} reference`}
                className="w-full sm:max-w-xs h-32 sm:h-40 object-contain rounded-lg border bg-gray-50"
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render legacy product details (backward compatibility)
  const renderLegacyProductDetails = () => {
    if (!request) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Sample Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-600">Product Type</span>
              <p className="text-base capitalize">{request.product_type}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Quality</span>
              <p className="text-base capitalize">{request.quality}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Quantity</span>
              <p className="text-base">{request.quantity} pieces</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-600">Sample Size</span>
              <p className="text-base">{request.sample_size}</p>
            </div>
            {request.sample_size_remarks && (
              <div className="md:col-span-2">
                <span className="text-sm font-medium text-gray-600">Size Remarks</span>
                <p className="text-base">{request.sample_size_remarks}</p>
              </div>
            )}
          </div>

          {request.finish && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-600">Finish</span>
                <p className="text-base">{request.finish}</p>
              </div>
              {request.finish_remarks && (
                <div className="md:col-span-2">
                  <span className="text-sm font-medium text-gray-600">Finish Remarks</span>
                  <p className="text-base">{request.finish_remarks}</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-600">Thickness</span>
              <p className="text-base">{request.thickness}</p>
            </div>
            {request.thickness_remarks && (
              <div className="md:col-span-2">
                <span className="text-sm font-medium text-gray-600">Thickness Remarks</span>
                <p className="text-base">{request.thickness_remarks}</p>
              </div>
            )}
          </div>

          {/* Legacy Image */}
          {request.image_url && (
            <div className="pt-4 border-t">
              <span className="text-sm font-medium text-gray-600 flex items-center gap-1 mb-2">
                <ImageIcon className="h-4 w-4" />
                Sample Image
              </span>
              <img
                src={request.image_url}
                alt="Sample reference"
                className="max-w-md h-48 object-contain rounded-lg border bg-gray-50"
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600 mb-4">Failed to load request details</p>
            <Button onClick={() => navigate('/requests')}>Back to Requests</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine if we have items in the new structure
  const hasItems = request.items && request.items.length > 0;
  const itemCount = hasItems ? request.items!.length : 1;

  // Get status color for the prominent banner
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 border-gray-300 text-gray-700',
      pending_approval: 'bg-amber-50 border-amber-300 text-amber-800',
      approved: 'bg-blue-50 border-blue-300 text-blue-800',
      assigned: 'bg-indigo-50 border-indigo-300 text-indigo-800',
      in_production: 'bg-purple-50 border-purple-300 text-purple-800',
      ready: 'bg-teal-50 border-teal-300 text-teal-800',
      dispatched: 'bg-emerald-50 border-emerald-300 text-emerald-800',
      received: 'bg-green-50 border-green-300 text-green-800',
      rejected: 'bg-red-50 border-red-300 text-red-800',
    };
    return colors[status] || 'bg-gray-50 border-gray-300 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-Optimized Header */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="md:hidden h-9 w-9 p-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold">Request Details</h1>
                <code className="text-xs sm:text-sm font-mono text-gray-600">{request.request_number}</code>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrackingDialog
                request={request}
                trigger={
                  <Button variant="outline" size="sm" className="h-9 gap-1">
                    <MapPin className="h-4 w-4" />
                    <span className="hidden sm:inline">Track</span>
                  </Button>
                }
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/')}
                className="hidden md:flex h-9"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} className="hidden sm:flex h-9">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* PROMINENT STATUS BANNER - Always visible at top */}
        <div className={`rounded-lg border-2 p-4 mb-4 sm:mb-6 ${getStatusColor(request.status)}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {getStatusBadge(request.status)}
                {getPriorityBadge(request.priority)}
              </div>
              {itemCount > 1 && (
                <Badge variant="outline" className="text-xs border-current">
                  {itemCount} Products
                </Badge>
              )}
            </div>
            <div className="text-sm">
              <span className="opacity-75">Required by:</span>{' '}
              <span className="font-semibold">{formatDateTime(request.required_by)}</span>
            </div>
          </div>
        </div>

        {/* Coordinator Message Alert (if exists) */}
        {request.coordinator_message && (
          <Alert
            className={
              request.status === 'rejected'
                ? 'mb-6 border-l-4 border-l-red-500 bg-red-50'
                : request.status === 'approved'
                ? 'mb-6 border-l-4 border-l-green-500 bg-green-50'
                : 'mb-6 border-l-4 border-l-blue-500 bg-blue-50'
            }
          >
            <div className="flex items-start gap-3">
              {request.status === 'rejected' ? (
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              ) : request.status === 'approved' ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
              )}
              <div className="flex-1">
                <AlertTitle
                  className={
                    request.status === 'rejected'
                      ? 'text-red-800 font-semibold'
                      : request.status === 'approved'
                      ? 'text-green-800 font-semibold'
                      : 'text-blue-800 font-semibold'
                  }
                >
                  Message from Coordinator
                </AlertTitle>
                <AlertDescription
                  className={
                    request.status === 'rejected'
                      ? 'text-red-700 mt-2'
                      : request.status === 'approved'
                      ? 'text-green-700 mt-2'
                      : 'text-blue-700 mt-2'
                  }
                >
                  {request.coordinator_message}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {/* Dispatch Notes Alert (if exists and status is dispatched/received) */}
        {request.dispatch_notes && (request.status === 'dispatched' || request.status === 'received') && (
          <Alert className="mb-6 border-l-4 border-l-blue-500 bg-blue-50">
            <div className="flex items-start gap-3">
              <Truck className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <AlertTitle className="text-blue-800 font-semibold">
                  Dispatch Information
                </AlertTitle>
                <AlertDescription className="text-blue-700 mt-2">
                  {request.dispatch_notes}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <div className="space-y-4 sm:space-y-6">
          {/* Section 1: Requester & Client Info - Grouped for mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Requester Details */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 sm:pb-3 bg-blue-50/50 border-b">
                <CardTitle className="text-base sm:text-lg text-blue-900">Requester Info</CardTitle>
              </CardHeader>
              <CardContent className="pt-3 sm:pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created By</span>
                    <p className="text-sm font-medium mt-0.5">{request.creator?.full_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Department</span>
                    <p className="text-sm font-medium mt-0.5 capitalize">{request.department}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mobile</span>
                    <p className="text-sm font-medium mt-0.5">{request.mobile_no}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pickup</span>
                    <p className="text-sm font-medium mt-0.5 capitalize">{request.pickup_responsibility?.replace('_', ' ')}</p>
                  </div>
                </div>
                {request.delivery_address && (
                  <div className="pt-2 border-t">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Delivery Address</span>
                    <p className="text-sm mt-0.5 whitespace-pre-line">{request.delivery_address}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Client Details */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 sm:pb-3 bg-purple-50/50 border-b">
                <CardTitle className="text-base sm:text-lg text-purple-900">Client Info</CardTitle>
              </CardHeader>
              <CardContent className="pt-3 sm:pt-4 space-y-3">
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Project Name</span>
                  <p className="text-sm font-semibold mt-0.5">{request.client_project_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Client Type</span>
                    <p className="text-sm font-medium mt-0.5 capitalize">{request.client_type}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Company</span>
                    <p className="text-sm font-medium mt-0.5">{request.company_firm_name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {request.client_phone && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</span>
                      <p className="text-sm font-medium mt-0.5">{request.client_phone}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</span>
                    <p className="text-sm font-medium mt-0.5">{request.site_location}</p>
                  </div>
                </div>
                {request.client_email && (
                  <div className="pt-2 border-t">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</span>
                    <p className="text-sm mt-0.5">{request.client_email}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Section 4: Product Items (NEW - Multi-Product Support) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Items
                {hasItems && (
                  <Badge variant="outline" className="ml-2">
                    {request.items!.length} {request.items!.length === 1 ? 'item' : 'items'}
                  </Badge>
                )}
              </h3>
            </div>

            {/* Render items if available, otherwise fall back to legacy */}
            {hasItems ? (
              <div className="space-y-4">
                {request.items!.map((item, index) =>
                  renderProductItem(item, index, request.items!.length)
                )}
              </div>
            ) : (
              renderLegacyProductDetails()
            )}
          </div>

          {/* Section 5: Shipping & Packing - Compact on mobile */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 sm:pb-3 bg-green-50/50 border-b">
              <CardTitle className="text-base sm:text-lg text-green-900">Shipping & Packing</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Purpose</span>
                  <p className="text-sm font-medium mt-0.5 capitalize">{request.purpose?.replace('_', ' ')}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Packing</span>
                  <p className="text-sm font-medium mt-0.5 capitalize">{request.packing_details?.replace('_', ' ')}</p>
                </div>
              </div>
              {request.packing_remarks && (
                <div className="mt-3 pt-3 border-t">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Packing Notes</span>
                  <p className="text-sm mt-0.5">{request.packing_remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 6: Timeline & Assignment - Horizontal scroll on mobile */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 sm:pb-3 bg-gray-50/50 border-b">
              <CardTitle className="text-base sm:text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4">
              {/* Timeline as horizontal steps on mobile */}
              <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
                <div className="flex-shrink-0 min-w-[120px] sm:min-w-0 bg-gray-50 rounded-lg p-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</span>
                  <p className="text-xs sm:text-sm font-medium mt-0.5">{formatDateTime(request.created_at)}</p>
                </div>
                {request.completed_at && (
                  <div className="flex-shrink-0 min-w-[120px] sm:min-w-0 bg-blue-50 rounded-lg p-3">
                    <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Completed</span>
                    <p className="text-xs sm:text-sm font-medium mt-0.5">{formatDateTime(request.completed_at)}</p>
                  </div>
                )}
                {request.dispatched_at && (
                  <div className="flex-shrink-0 min-w-[120px] sm:min-w-0 bg-emerald-50 rounded-lg p-3">
                    <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Dispatched</span>
                    <p className="text-xs sm:text-sm font-medium mt-0.5">{formatDateTime(request.dispatched_at)}</p>
                  </div>
                )}
                {request.received_at && (
                  <div className="flex-shrink-0 min-w-[120px] sm:min-w-0 bg-green-50 rounded-lg p-3">
                    <span className="text-xs font-medium text-green-600 uppercase tracking-wide">Received</span>
                    <p className="text-xs sm:text-sm font-medium mt-0.5">{formatDateTime(request.received_at)}</p>
                  </div>
                )}
              </div>
              {request.maker && (
                <div className="mt-3 pt-3 border-t flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Assigned To:</span>
                  <span className="text-sm font-medium">{request.maker.full_name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Request Actions - for coordinators */}
        <RequestActions request={request} userRole={profile?.role || ''} />

        {/* Maker Actions - for makers */}
        <MakerActions request={request} userRole={profile?.role || ''} userId={profile?.id || ''} />
      </main>
    </div>
  );
}
