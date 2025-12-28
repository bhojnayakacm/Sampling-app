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

  // Render a single product item card
  const renderProductItem = (item: RequestItemDB, index: number, total: number) => {
    const showFinish = item.product_type === 'marble' || item.product_type === 'tile';

    return (
      <Card key={item.id} className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                {index + 1}
              </div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="capitalize">{item.product_type}</span>
              </CardTitle>
            </div>
            <Badge className={getProductTypeColor(item.product_type)}>
              {total > 1 ? `Item ${index + 1} of ${total}` : 'Single Item'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Product Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-600">Product Type</span>
              <p className="text-base capitalize font-medium">{item.product_type}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Quality</span>
              <p className="text-base capitalize">
                {item.quality_custom || item.quality}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Quantity</span>
              <p className="text-base font-semibold">{item.quantity} pieces</p>
            </div>
          </div>

          {/* Size & Thickness */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-600">Sample Size</span>
              <p className="text-base">{item.sample_size}</p>
              {item.sample_size_remarks && (
                <p className="text-xs text-gray-500 mt-1">{item.sample_size_remarks}</p>
              )}
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Thickness</span>
              <p className="text-base">{item.thickness}</p>
              {item.thickness_remarks && (
                <p className="text-xs text-gray-500 mt-1">{item.thickness_remarks}</p>
              )}
            </div>
            {showFinish && item.finish && (
              <div>
                <span className="text-sm font-medium text-gray-600">Finish</span>
                <p className="text-base">{item.finish}</p>
                {item.finish_remarks && (
                  <p className="text-xs text-gray-500 mt-1">{item.finish_remarks}</p>
                )}
              </div>
            )}
          </div>

          {/* Item Image */}
          {item.image_url && (
            <div className="pt-2 border-t">
              <span className="text-sm font-medium text-gray-600 flex items-center gap-1 mb-2">
                <ImageIcon className="h-4 w-4" />
                Reference Image
              </span>
              <img
                src={item.image_url}
                alt={`${item.product_type} reference`}
                className="max-w-xs h-40 object-contain rounded-lg border bg-gray-50"
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Request Details</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{profile?.full_name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold">{request.request_number}</h2>
              {itemCount > 1 && (
                <Badge variant="secondary" className="text-xs">
                  {itemCount} Products
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {getPriorityBadge(request.priority)}
              {getStatusBadge(request.status)}
            </div>
          </div>
          <div className="flex gap-2">
            <TrackingDialog
              request={request}
              trigger={
                <Button variant="outline" className="h-11">
                  <MapPin className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Track Sample</span>
                </Button>
              }
            />
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="h-11"
            >
              <ChevronLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Button>
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

        <div className="space-y-6">
          {/* Section 1: Request Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Request Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-600">Request Number</span>
                <p className="text-base font-mono">{request.request_number}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Status</span>
                <div className="mt-1">{getStatusBadge(request.status)}</div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Priority</span>
                <div className="mt-1">{getPriorityBadge(request.priority)}</div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Required By</span>
                <p className="text-base">{formatDateTime(request.required_by)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Requester Details */}
          <Card>
            <CardHeader>
              <CardTitle>Requester Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Created By</span>
                  <p className="text-base">{request.creator?.full_name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Department</span>
                  <p className="text-base capitalize">{request.department}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Mobile No</span>
                  <p className="text-base">{request.mobile_no}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Pickup Responsibility</span>
                  <p className="text-base capitalize">{request.pickup_responsibility?.replace('_', ' ')}</p>
                </div>
                {request.pickup_remarks && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Pickup Remarks</span>
                    <p className="text-base">{request.pickup_remarks}</p>
                  </div>
                )}
              </div>
              {request.delivery_address && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Delivery Address</span>
                  <p className="text-base whitespace-pre-line">{request.delivery_address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Client Project Details */}
          <Card>
            <CardHeader>
              <CardTitle>Client Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Client Type</span>
                  <p className="text-base capitalize">{request.client_type}</p>
                </div>
                {request.client_type_remarks && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Client Type Remarks</span>
                    <p className="text-base">{request.client_type_remarks}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Client/Architect/Project Name</span>
                  <p className="text-base">{request.client_project_name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Mobile</span>
                  <p className="text-base">{request.client_phone}</p>
                </div>
                {request.client_email && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Email</span>
                    <p className="text-base">{request.client_email}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Company Firm Name</span>
                  <p className="text-base">{request.company_firm_name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Site Location</span>
                  <p className="text-base">{request.site_location}</p>
                </div>
              </div>
            </CardContent>
          </Card>

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

          {/* Section 5: Shared Details (Purpose & Packing) */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping & Packing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Purpose of Sample</span>
                  <p className="text-base capitalize">{request.purpose?.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Packing</span>
                  <p className="text-base capitalize">{request.packing_details?.replace('_', ' ')}</p>
                </div>
              </div>
              {request.packing_remarks && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Packing Remarks</span>
                  <p className="text-base">{request.packing_remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 6: Timeline & Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Created</span>
                  <p className="text-base">{formatDateTime(request.created_at)}</p>
                </div>
                {request.completed_at && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Completed</span>
                    <p className="text-base">{formatDateTime(request.completed_at)}</p>
                  </div>
                )}
                {request.dispatched_at && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Dispatched</span>
                    <p className="text-base">{formatDateTime(request.dispatched_at)}</p>
                  </div>
                )}
                {request.received_at && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Received</span>
                    <p className="text-base">{formatDateTime(request.received_at)}</p>
                  </div>
                )}
              </div>
              {request.maker && (
                <div className="pt-3 border-t">
                  <span className="text-sm font-medium text-gray-600">Assigned To</span>
                  <p className="text-base">{request.maker.full_name}</p>
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
