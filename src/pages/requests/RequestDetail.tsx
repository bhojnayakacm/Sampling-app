import { Button } from '@/components/ui/button';
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
  Loader2,
  FileText,
} from 'lucide-react';
import type { RequestItemDB } from '@/types';

export default function RequestDetail() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  // Use the new hook that fetches request WITH items
  const { data: request, isLoading, error } = useRequestWithItems(id);

  // Dynamic back navigation based on user role
  const isCoordinator = profile?.role === 'coordinator';
  const backDestination = isCoordinator ? '/' : '/requests';
  const backButtonText = isCoordinator ? 'Back to Dashboard' : 'Back to List';

  // Premium status badge with gradient styling
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-200' },
      pending_approval: { label: 'Pending Approval', className: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border-amber-200' },
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
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border ${className}`}>
        {label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const isUrgent = priority === 'urgent';
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
        isUrgent
          ? 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border-red-200'
          : 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-700 border-slate-200'
      }`}>
        {priority}
      </span>
    );
  };

  // Get product type color for visual differentiation
  const getProductTypeColor = (productType: string) => {
    const colors: Record<string, string> = {
      marble: 'bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-800 border-indigo-200',
      tile: 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border-emerald-200',
      terrazzo: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border-amber-200',
      quartz: 'bg-gradient-to-r from-pink-100 to-rose-100 text-pink-800 border-pink-200',
    };
    return colors[productType] || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  // Render a single product item card - Mobile-optimized with premium styling
  const renderProductItem = (item: RequestItemDB, index: number, total: number) => {
    const showFinish = item.product_type === 'marble' || item.product_type === 'tile';

    return (
      <Card key={item.id} className="border-0 shadow-md bg-white/80 backdrop-blur-sm overflow-hidden">
        {/* Gradient accent bar */}
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

        {/* Card Header - Compact on mobile */}
        <CardHeader className="pb-2 sm:pb-3 bg-gradient-to-br from-slate-50 to-indigo-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/30">
                {index + 1}
              </div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-slate-800">
                <Package className="h-4 w-4 text-indigo-500" />
                <span className="capitalize font-bold">{item.product_type}</span>
              </CardTitle>
            </div>
            <span className={`text-xs px-3 py-1.5 rounded-full font-bold border ${getProductTypeColor(item.product_type)}`}>
              {total > 1 ? `${index + 1}/${total}` : 'Item'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-5 space-y-4">
          {/* Mobile-First: Stacked detail rows */}
          <div className="space-y-3">
            {/* Quality & Quantity - Side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-xl p-3 border border-slate-100">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Quality</span>
                <p className="text-sm sm:text-base font-semibold mt-1 capitalize text-slate-800">
                  {item.quality_custom || item.quality}
                </p>
              </div>
              <div className="bg-gradient-to-br from-slate-50 to-violet-50/30 rounded-xl p-3 border border-slate-100">
                <span className="text-xs font-bold text-violet-600 uppercase tracking-wide">Quantity</span>
                <p className="text-sm sm:text-base font-bold mt-1 text-slate-800">{item.quantity} pcs</p>
              </div>
            </div>

            {/* Size & Thickness - Side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Size</span>
                <p className="text-sm font-semibold mt-0.5 text-slate-800">{item.sample_size}</p>
                {item.sample_size_remarks && (
                  <p className="text-xs text-slate-500 mt-0.5">{item.sample_size_remarks}</p>
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Thickness</span>
                <p className="text-sm font-semibold mt-0.5 text-slate-800">{item.thickness}</p>
                {item.thickness_remarks && (
                  <p className="text-xs text-slate-500 mt-0.5">{item.thickness_remarks}</p>
                )}
              </div>
            </div>

            {/* Finish - Full width if applicable */}
            {showFinish && item.finish && (
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Finish</span>
                <p className="text-sm font-semibold mt-0.5 text-slate-800">{item.finish}</p>
                {item.finish_remarks && (
                  <p className="text-xs text-slate-500 mt-0.5">{item.finish_remarks}</p>
                )}
              </div>
            )}
          </div>

          {/* Item Image - Responsive */}
          {item.image_url && (
            <div className="pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <ImageIcon className="h-3.5 w-3.5 text-indigo-500" />
                Reference Image
              </span>
              <img
                src={item.image_url}
                alt={`${item.product_type} reference`}
                className="w-full sm:max-w-xs h-32 sm:h-40 object-contain rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/20"
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
      <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
        <CardHeader className="bg-gradient-to-br from-slate-50 to-indigo-50/30">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Package className="h-5 w-5 text-indigo-500" />
            Sample Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-xl p-3 border border-slate-100">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Product Type</span>
              <p className="text-base capitalize font-semibold text-slate-800 mt-1">{request.product_type}</p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-violet-50/30 rounded-xl p-3 border border-slate-100">
              <span className="text-xs font-bold text-violet-600 uppercase tracking-wide">Quality</span>
              <p className="text-base capitalize font-semibold text-slate-800 mt-1">{request.quality}</p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-purple-50/30 rounded-xl p-3 border border-slate-100">
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wide">Quantity</span>
              <p className="text-base font-bold text-slate-800 mt-1">{request.quantity} pieces</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Sample Size</span>
              <p className="text-base font-semibold text-slate-800 mt-1">{request.sample_size}</p>
            </div>
            {request.sample_size_remarks && (
              <div className="md:col-span-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Size Remarks</span>
                <p className="text-base text-slate-700 mt-1">{request.sample_size_remarks}</p>
              </div>
            )}
          </div>

          {request.finish && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Finish</span>
                <p className="text-base font-semibold text-slate-800 mt-1">{request.finish}</p>
              </div>
              {request.finish_remarks && (
                <div className="md:col-span-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Finish Remarks</span>
                  <p className="text-base text-slate-700 mt-1">{request.finish_remarks}</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Thickness</span>
              <p className="text-base font-semibold text-slate-800 mt-1">{request.thickness}</p>
            </div>
            {request.thickness_remarks && (
              <div className="md:col-span-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Thickness Remarks</span>
                <p className="text-base text-slate-700 mt-1">{request.thickness_remarks}</p>
              </div>
            )}
          </div>

          {/* Legacy Image */}
          {request.image_url && (
            <div className="pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <ImageIcon className="h-4 w-4 text-indigo-500" />
                Sample Image
              </span>
              <img
                src={request.image_url}
                alt="Sample reference"
                className="max-w-md h-48 object-contain rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/20"
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-slate-600 font-medium">Loading request details...</p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-red-600 font-semibold mb-2 text-lg">Failed to load request</p>
            <p className="text-slate-500 mb-6">The request details could not be loaded. Please try again.</p>
            <Button
              onClick={() => navigate(backDestination)}
              className="min-h-[60px] py-5 px-8 text-base font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/25"
            >
              {backButtonText}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine if we have items in the new structure
  const hasItems = request.items && request.items.length > 0;
  const itemCount = hasItems ? request.items!.length : 1;

  // Get status banner gradient
  const getStatusBannerColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gradient-to-r from-slate-100 to-gray-100 border-slate-300',
      pending_approval: 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300',
      approved: 'bg-gradient-to-r from-sky-50 to-blue-50 border-sky-300',
      assigned: 'bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-300',
      in_production: 'bg-gradient-to-r from-violet-50 to-purple-50 border-violet-300',
      ready: 'bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-300',
      dispatched: 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300',
      received: 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300',
      rejected: 'bg-gradient-to-r from-red-50 to-rose-50 border-red-300',
    };
    return colors[status] || 'bg-gradient-to-r from-slate-50 to-gray-50 border-slate-300';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100">
      {/* Premium Gradient Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                onClick={() => navigate(backDestination)}
                className="md:hidden min-h-[56px] py-4 px-3 gap-2 text-white hover:bg-white/20 hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="text-sm font-semibold">Back</span>
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-300" />
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Request Details</h1>
                </div>
                <code className="text-xs sm:text-sm font-mono text-white/80 bg-white/10 px-2 py-0.5 rounded mt-1 inline-block">
                  {request.request_number}
                </code>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <TrackingDialog
                request={request}
                trigger={
                  <Button
                    variant="ghost"
                    className="min-h-[56px] py-4 px-4 gap-2 text-white hover:bg-white/20 hover:text-white font-semibold"
                  >
                    <MapPin className="h-5 w-5" />
                    <span className="hidden sm:inline">Track</span>
                  </Button>
                }
              />
              <Button
                variant="ghost"
                onClick={() => navigate(backDestination)}
                className="hidden md:flex min-h-[56px] py-4 px-4 gap-2 text-white hover:bg-white/20 hover:text-white font-semibold"
              >
                <ChevronLeft className="h-4 w-4" />
                {backButtonText}
              </Button>
              <Button
                variant="ghost"
                onClick={signOut}
                className="hidden sm:flex min-h-[56px] py-4 px-4 text-white hover:bg-white/20 hover:text-white font-semibold"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* PROMINENT STATUS BANNER - Always visible at top */}
        <div className={`rounded-xl border-2 p-4 sm:p-5 mb-5 shadow-sm ${getStatusBannerColor(request.status)}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {getStatusBadge(request.status)}
              {getPriorityBadge(request.priority)}
              {itemCount > 1 && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border bg-white/50 text-slate-700 border-slate-200">
                  {itemCount} Products
                </span>
              )}
            </div>
            <div className="text-sm text-slate-700">
              <span className="opacity-75">Required by:</span>{' '}
              <span className="font-bold">{formatDateTime(request.required_by)}</span>
            </div>
          </div>
        </div>

        {/* Coordinator Message Alert (if exists) */}
        {request.coordinator_message && (
          <Alert
            className={`mb-5 border-l-4 rounded-xl shadow-sm ${
              request.status === 'rejected'
                ? 'border-l-red-500 bg-gradient-to-r from-red-50 to-rose-50'
                : request.status === 'approved'
                ? 'border-l-green-500 bg-gradient-to-r from-green-50 to-emerald-50'
                : 'border-l-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50'
            }`}
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
                  className={`font-bold ${
                    request.status === 'rejected'
                      ? 'text-red-800'
                      : request.status === 'approved'
                      ? 'text-green-800'
                      : 'text-blue-800'
                  }`}
                >
                  Message from Coordinator
                </AlertTitle>
                <AlertDescription
                  className={`mt-2 ${
                    request.status === 'rejected'
                      ? 'text-red-700'
                      : request.status === 'approved'
                      ? 'text-green-700'
                      : 'text-blue-700'
                  }`}
                >
                  {request.coordinator_message}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {/* Dispatch Notes Alert (if exists and status is dispatched/received) */}
        {request.dispatch_notes && (request.status === 'dispatched' || request.status === 'received') && (
          <Alert className="mb-5 border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl shadow-sm">
            <div className="flex items-start gap-3">
              <Truck className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div className="flex-1">
                <AlertTitle className="text-emerald-800 font-bold">
                  Dispatch Information
                </AlertTitle>
                <AlertDescription className="text-emerald-700 mt-2">
                  {request.dispatch_notes}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <div className="space-y-5">
          {/* Section 1: Requester & Client Info - Grouped for mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Requester Details */}
            <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
              <CardHeader className="pb-3 bg-gradient-to-br from-indigo-50/50 to-blue-50/30 border-b border-indigo-100">
                <CardTitle className="text-base sm:text-lg text-indigo-900 font-bold">Requester Info</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-slate-50 to-indigo-50/20 rounded-xl p-3 border border-slate-100">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Created By</span>
                    <p className="text-sm font-semibold mt-0.5 text-slate-800">{request.creator?.full_name || 'Unknown'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-slate-50 to-indigo-50/20 rounded-xl p-3 border border-slate-100">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Department</span>
                    <p className="text-sm font-semibold mt-0.5 capitalize text-slate-800">{request.department}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mobile</span>
                    <p className="text-sm font-semibold mt-0.5 text-slate-800">{request.mobile_no}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pickup</span>
                    <p className="text-sm font-semibold mt-0.5 capitalize text-slate-800">{request.pickup_responsibility?.replace('_', ' ')}</p>
                  </div>
                </div>
                {request.delivery_address && (
                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Delivery Address</span>
                    <p className="text-sm mt-0.5 whitespace-pre-line text-slate-700">{request.delivery_address}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Client Details */}
            <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
              <CardHeader className="pb-3 bg-gradient-to-br from-violet-50/50 to-purple-50/30 border-b border-violet-100">
                <CardTitle className="text-base sm:text-lg text-violet-900 font-bold">Client Info</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-gradient-to-br from-slate-50 to-violet-50/20 rounded-xl p-3 border border-slate-100">
                  <span className="text-xs font-bold text-violet-600 uppercase tracking-wide">Project Name</span>
                  <p className="text-sm font-bold mt-0.5 text-slate-800">{request.client_project_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Client Type</span>
                    <p className="text-sm font-semibold mt-0.5 capitalize text-slate-800">{request.client_type}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Company</span>
                    <p className="text-sm font-semibold mt-0.5 text-slate-800">{request.company_firm_name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {request.client_phone && (
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Phone</span>
                      <p className="text-sm font-semibold mt-0.5 text-slate-800">{request.client_phone}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Location</span>
                    <p className="text-sm font-semibold mt-0.5 text-slate-800">{request.site_location}</p>
                  </div>
                </div>
                {request.client_email && (
                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email</span>
                    <p className="text-sm mt-0.5 text-slate-700">{request.client_email}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Section 4: Product Items (NEW - Multi-Product Support) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <Package className="h-5 w-5 text-indigo-500" />
                Product Items
                {hasItems && (
                  <span className="ml-2 text-xs px-3 py-1.5 rounded-full font-bold bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-700 border border-indigo-200">
                    {request.items!.length} {request.items!.length === 1 ? 'item' : 'items'}
                  </span>
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
          <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
            <CardHeader className="pb-3 bg-gradient-to-br from-emerald-50/50 to-green-50/30 border-b border-emerald-100">
              <CardTitle className="text-base sm:text-lg text-emerald-900 font-bold">Shipping & Packing</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-slate-50 to-emerald-50/20 rounded-xl p-3 border border-slate-100">
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Purpose</span>
                  <p className="text-sm font-semibold mt-0.5 capitalize text-slate-800">{request.purpose?.replace('_', ' ')}</p>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-green-50/20 rounded-xl p-3 border border-slate-100">
                  <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Packing</span>
                  <p className="text-sm font-semibold mt-0.5 capitalize text-slate-800">{request.packing_details?.replace('_', ' ')}</p>
                </div>
              </div>
              {request.packing_remarks && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Packing Notes</span>
                  <p className="text-sm mt-0.5 text-slate-700">{request.packing_remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 6: Timeline & Assignment - Horizontal scroll on mobile */}
          <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-slate-400 to-gray-500" />
            <CardHeader className="pb-3 bg-gradient-to-br from-slate-50 to-gray-50/30 border-b border-slate-200">
              <CardTitle className="text-base sm:text-lg text-slate-800 font-bold">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Timeline as horizontal steps on mobile */}
              <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
                <div className="flex-shrink-0 min-w-[130px] sm:min-w-0 bg-gradient-to-br from-slate-50 to-gray-50/30 rounded-xl p-3 border border-slate-200">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Created</span>
                  <p className="text-xs sm:text-sm font-semibold mt-0.5 text-slate-800">{formatDateTime(request.created_at)}</p>
                </div>
                {request.completed_at && (
                  <div className="flex-shrink-0 min-w-[130px] sm:min-w-0 bg-gradient-to-br from-blue-50 to-indigo-50/30 rounded-xl p-3 border border-blue-200">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Completed</span>
                    <p className="text-xs sm:text-sm font-semibold mt-0.5 text-slate-800">{formatDateTime(request.completed_at)}</p>
                  </div>
                )}
                {request.dispatched_at && (
                  <div className="flex-shrink-0 min-w-[130px] sm:min-w-0 bg-gradient-to-br from-emerald-50 to-green-50/30 rounded-xl p-3 border border-emerald-200">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Dispatched</span>
                    <p className="text-xs sm:text-sm font-semibold mt-0.5 text-slate-800">{formatDateTime(request.dispatched_at)}</p>
                  </div>
                )}
                {request.received_at && (
                  <div className="flex-shrink-0 min-w-[130px] sm:min-w-0 bg-gradient-to-br from-green-50 to-emerald-50/30 rounded-xl p-3 border border-green-200">
                    <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Received</span>
                    <p className="text-xs sm:text-sm font-semibold mt-0.5 text-slate-800">{formatDateTime(request.received_at)}</p>
                  </div>
                )}
              </div>
              {request.maker && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Assigned To:</span>
                  <span className="text-sm font-bold text-indigo-600">{request.maker.full_name}</span>
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
