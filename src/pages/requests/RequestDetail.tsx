import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useRequestWithItems } from '@/lib/api/requests';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import RequestActions from '@/components/requests/RequestActions';
import MakerActions from '@/components/requests/MakerActions';
import TrackingDialog from '@/components/requests/TrackingDialog';
import EditRequiredByModal from '@/components/requests/EditRequiredByModal';
import RequiredByHistory from '@/components/requests/RequiredByHistory';
import {
  MapPin,
  MessageSquare,
  CheckCircle,
  XCircle,
  ChevronLeft,
  Image as ImageIcon,
  Truck,
  Loader2,
  Pencil,
  Printer,
  Check,
  X,
  Clock,
  Calendar,
  User,
  Building,
  Phone,
  Mail,
  Package,
  AlertCircle,
} from 'lucide-react';
import type { RequestItemDB } from '@/types';

export default function RequestDetail() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: request, isLoading, error } = useRequestWithItems(id);

  const isCoordinator = profile?.role === 'coordinator';
  const isMaker = profile?.role === 'maker';
  const backDestination = isCoordinator ? '/' : '/requests';
  const backButtonText = isCoordinator ? 'Dashboard' : 'Back';

  // Address editing state
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editedAddress, setEditedAddress] = useState('');
  const [addressEditRemark, setAddressEditRemark] = useState('');
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [labelFontSize, setLabelFontSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium');
  const [labelUnderline, setLabelUnderline] = useState(false);

  // Delivery method editing state
  const [isEditingDeliveryMethod, setIsEditingDeliveryMethod] = useState(false);
  const [editedDeliveryMethod, setEditedDeliveryMethod] = useState('');
  const [deliveryMethodRemark, setDeliveryMethodRemark] = useState('');
  const [isSavingDeliveryMethod, setIsSavingDeliveryMethod] = useState(false);

  // Image preview state
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Edit Required By modal state
  const [isEditRequiredByOpen, setIsEditRequiredByOpen] = useState(false);

  // Track previous pickup method
  const previousPickupMethod = useRef<string | null>(null);

  useEffect(() => {
    if (request) {
      setEditedAddress(request.delivery_address || '');
      previousPickupMethod.current = request.pickup_responsibility;
    }
  }, [request?.delivery_address, request?.pickup_responsibility]);

  const displayAddress = request?.delivery_address || '';

  const fontSizeMap = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-2xl',
    xlarge: 'text-4xl',
  };

  // Address handlers
  const handleStartEditAddress = () => {
    setEditedAddress(request?.delivery_address || '');
    setAddressEditRemark('');
    setIsEditingAddress(true);
  };

  const handleSaveAddress = async () => {
    if (!id || !request) return;

    setIsSavingAddress(true);

    try {
      const updatePayload: Record<string, unknown> = {
        delivery_address: editedAddress.trim() || null,
        is_address_edited: true,
        updated_at: new Date().toISOString(),
      };

      if (addressEditRemark.trim()) {
        updatePayload.address_edit_remark = addressEditRemark.trim();
      }

      const { error: updateError } = await supabase
        .from('requests')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) {
        console.error('Failed to save address:', updateError);
        alert('Failed to save address. Please try again.');
        return;
      }

      setIsEditingAddress(false);
      setAddressEditRemark('');

      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['request-with-items', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
    } catch (err) {
      console.error('Error saving address:', err);
      alert('An error occurred while saving. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingAddress(false);
    setEditedAddress(request?.delivery_address || '');
    setAddressEditRemark('');
  };

  // Delivery method handlers
  const handleStartEditDeliveryMethod = () => {
    setEditedDeliveryMethod(request?.pickup_responsibility || '');
    setDeliveryMethodRemark('');
    setIsEditingDeliveryMethod(true);
  };

  const handleSaveDeliveryMethod = async () => {
    if (!id || !request) return;

    const originalMethod = request.pickup_responsibility || '';
    const hasChanges = editedDeliveryMethod !== originalMethod;

    if (!hasChanges) {
      setIsEditingDeliveryMethod(false);
      return;
    }

    setIsSavingDeliveryMethod(true);

    try {
      const updatePayload: Record<string, unknown> = {
        pickup_responsibility: editedDeliveryMethod,
        is_delivery_method_edited: true,
        updated_at: new Date().toISOString(),
      };

      if (deliveryMethodRemark.trim()) {
        updatePayload.delivery_method_remark = deliveryMethodRemark.trim();
      } else {
        updatePayload.delivery_method_remark = null;
      }

      const { error: updateError } = await supabase
        .from('requests')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) {
        console.error('Failed to save delivery method:', updateError);
        alert(`Failed to save delivery method: ${updateError.message || 'Unknown error'}`);
        return;
      }

      const wasSelPickup = originalMethod === 'self_pickup';
      const isNowDelivery = editedDeliveryMethod !== 'self_pickup';
      const shouldPromptAddress = wasSelPickup && isNowDelivery && !request.delivery_address;

      setIsEditingDeliveryMethod(false);
      setDeliveryMethodRemark('');

      await queryClient.invalidateQueries({ queryKey: ['request', id] });
      await queryClient.invalidateQueries({ queryKey: ['request-with-items', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });

      if (shouldPromptAddress) {
        setTimeout(() => {
          setEditedAddress('');
          setAddressEditRemark('');
          setIsEditingAddress(true);
        }, 300);
      }
    } catch (err) {
      console.error('Error saving delivery method:', err);
      alert('An error occurred while saving. Please try again.');
    } finally {
      setIsSavingDeliveryMethod(false);
    }
  };

  const handleCancelEditDeliveryMethod = () => {
    setIsEditingDeliveryMethod(false);
    setEditedDeliveryMethod(request?.pickup_responsibility || '');
    setDeliveryMethodRemark('');
  };

  const PICKUP_METHOD_OPTIONS = [
    { value: 'self_pickup', label: 'Self Pickup' },
    { value: 'courier', label: 'Courier' },
    { value: 'company_vehicle', label: 'Company Vehicle' },
    { value: 'field_boy', label: 'Field Boy' },
    { value: '3rd_party', label: '3rd Party' },
    { value: 'other', label: 'Other' },
  ];

  const handlePrint = () => {
    const fontSizePixelMap: Record<string, string> = {
      small: '14px',
      medium: '18px',
      large: '24px',
      xlarge: '36px',
    };

    const fontSize = fontSizePixelMap[labelFontSize] || '18px';
    const textDecoration = labelUnderline ? 'underline' : 'none';
    const addressContent = displayAddress || 'No address available';

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shipping Label</title>
          <style>
            @page { size: auto; margin: 0mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: 100%; height: 100%; }
            body {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 20mm;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: white;
            }
            .label-text {
              font-size: ${fontSize};
              text-decoration: ${textDecoration};
              line-height: 1.6;
              color: black;
              white-space: pre-line;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="label-text">${addressContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </body>
      </html>
    `);
    iframeDoc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      try { iframe.contentWindow?.print(); } catch (err) { console.error(err); }
      setTimeout(() => { if (iframe.parentNode) document.body.removeChild(iframe); }, 1000);
    }, 250);
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600 border-slate-200' },
      pending_approval: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
      approved: { label: 'Approved', className: 'bg-sky-50 text-sky-700 border-sky-200' },
      assigned: { label: 'Assigned', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      in_production: { label: 'In Production', className: 'bg-violet-50 text-violet-700 border-violet-200' },
      ready: { label: 'Ready', className: 'bg-teal-50 text-teal-700 border-teal-200' },
      dispatched: { label: 'Dispatched', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      received: { label: 'Received', className: 'bg-green-50 text-green-700 border-green-200' },
      rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
    };

    const { label, className } = statusMap[status] || { label: status, className: 'bg-slate-100 text-slate-600 border-slate-200' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
        {label}
      </span>
    );
  };

  const formatPickupMethod = (method: string) => {
    const methodMap: Record<string, string> = {
      self_pickup: 'Self Pickup',
      courier: 'Courier',
      company_vehicle: 'Company Vehicle',
      field_boy: 'Field Boy',
      '3rd_party': '3rd Party',
      other: 'Other',
    };
    return methodMap[method] || method?.replace(/_/g, ' ');
  };

  // =============================================
  // MOBILE PRODUCT CARD COMPONENT
  // =============================================
  const ProductCard = ({ item, index }: { item: RequestItemDB; index: number }) => {
    const showFinish = item.product_type === 'marble' || item.product_type === 'tile' || item.product_type === 'magro_stone';

    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
              {index + 1}
            </span>
            <span className="font-semibold text-slate-900 capitalize">{item.product_type}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
              Qty: {item.quantity}
            </span>
            {item.image_url && (
              <button
                onClick={() => setPreviewImage(item.image_url)}
                className="h-8 w-8 rounded border border-slate-200 overflow-hidden hover:border-indigo-400 transition-colors"
              >
                <img src={item.image_url} alt="Ref" className="h-full w-full object-cover" />
              </button>
            )}
          </div>
        </div>

        {/* Card Body - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Quality</span>
            <p className="text-sm text-slate-900 mt-0.5">{item.quality_custom || item.quality}</p>
          </div>
          <div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Size</span>
            <p className="text-sm text-slate-900 mt-0.5">
              {item.sample_size}
              {item.sample_size_remarks && <span className="text-slate-400 text-xs block">{item.sample_size_remarks}</span>}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Finish</span>
            <p className="text-sm text-slate-900 mt-0.5">
              {showFinish && item.finish ? item.finish : '—'}
              {item.finish_remarks && <span className="text-slate-400 text-xs block">{item.finish_remarks}</span>}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Thickness</span>
            <p className="text-sm text-slate-900 mt-0.5">
              {item.thickness}
              {item.thickness_remarks && <span className="text-slate-400 text-xs block">{item.thickness_remarks}</span>}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // =============================================
  // LEGACY PRODUCT CARD (for single-item requests)
  // =============================================
  const LegacyProductCard = () => {
    if (!request) return null;
    const showFinish = request.product_type === 'marble' || request.product_type === 'tile' || request.product_type === 'magro_stone';

    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-900 capitalize">{request.product_type}</span>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
              Qty: {request.quantity}
            </span>
            {request.image_url && (
              <button
                onClick={() => setPreviewImage(request.image_url)}
                className="h-8 w-8 rounded border border-slate-200 overflow-hidden"
              >
                <img src={request.image_url} alt="Ref" className="h-full w-full object-cover" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Quality</span>
            <p className="text-sm text-slate-900 mt-0.5">{request.quality}</p>
          </div>
          <div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Size</span>
            <p className="text-sm text-slate-900 mt-0.5">{request.sample_size}</p>
          </div>
          <div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Finish</span>
            <p className="text-sm text-slate-900 mt-0.5">{showFinish && request.finish ? request.finish : '—'}</p>
          </div>
          <div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Thickness</span>
            <p className="text-sm text-slate-900 mt-0.5">{request.thickness}</p>
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !request) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-sm bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-6 text-center">
            <XCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-slate-900 font-medium mb-1">Request not found</p>
            <p className="text-slate-500 text-sm mb-4">Unable to load request details.</p>
            <Button onClick={() => navigate(backDestination)} className="bg-indigo-600 hover:bg-indigo-700">
              {backButtonText}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasItems = request.items && request.items.length > 0;
  const isSelfPickup = request.pickup_responsibility === 'self_pickup';

  // Helper to determine deadline status for consistent styling
  const getDeadlineStatus = () => {
    if (!request.required_by) return { status: 'normal', className: '', label: '' };

    const now = new Date();
    const deadline = new Date(request.required_by);
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Already received - no urgency styling needed
    if (request.status === 'received') {
      return { status: 'completed', className: 'text-green-600', label: '' };
    }

    // Overdue
    if (hoursUntilDeadline < 0) {
      return { status: 'overdue', className: 'text-red-600', label: 'Overdue' };
    }

    // Due within 24 hours OR marked as urgent priority
    if (hoursUntilDeadline <= 24 || request.priority === 'urgent') {
      return { status: 'urgent', className: 'text-amber-600', label: request.priority === 'urgent' ? 'Urgent' : 'Due Soon' };
    }

    return { status: 'normal', className: 'text-slate-600', label: '' };
  };

  const deadlineStatus = getDeadlineStatus();

  // Statuses where shipping details can still be edited
  const EDITABLE_STATUSES = ['pending_approval', 'approved', 'assigned', 'in_production', 'ready'];
  const canEditShipping = isCoordinator && EDITABLE_STATUSES.includes(request.status);

  return (
    <div className="min-h-screen bg-slate-50 pb-32 md:pb-24">
      {/* =========================================== */}
      {/* HEADER - Mobile Optimized */}
      {/* =========================================== */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Back + Request Info */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(backDestination)}
                className="h-9 w-9 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-xl font-semibold text-slate-900 truncate">
                    {request.request_number}
                  </h1>
                  {getStatusBadge(request.status)}
                  {request.priority === 'urgent' && (
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                      Urgent
                    </span>
                  )}
                </div>
                {/* Mobile: Show only due date with urgency styling */}
                <p className="text-xs mt-0.5 truncate">
                  <span className={`sm:hidden flex items-center gap-1 ${deadlineStatus.className || 'text-slate-500'}`}>
                    <Calendar className="h-3 w-3" />
                    Due: {formatDateTime(request.required_by)}
                    {deadlineStatus.label && (
                      <span className={`ml-1 px-1 py-0.5 rounded text-[10px] font-medium ${
                        deadlineStatus.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {deadlineStatus.label}
                      </span>
                    )}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-4 text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created {formatDateTime(request.created_at)}
                    </span>
                    <span className={`flex items-center gap-1 ${deadlineStatus.className || ''}`}>
                      <Calendar className="h-3 w-3" />
                      Due {formatDateTime(request.required_by)}
                      {deadlineStatus.label && (
                        <span className={`ml-1 px-1 py-0.5 rounded text-[10px] font-medium ${
                          deadlineStatus.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {deadlineStatus.label}
                        </span>
                      )}
                    </span>
                  </span>
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <TrackingDialog
                request={request}
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 sm:w-auto sm:px-3 p-0 text-xs border-slate-200 text-slate-600"
                  >
                    <MapPin className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Track</span>
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="h-9 px-2 sm:px-3 text-xs text-slate-500 hover:bg-slate-100 hidden md:flex"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {/* =========================================== */}
        {/* ALERTS */}
        {/* =========================================== */}

        {/* Requester Special Instructions */}
        {request.requester_message && (
          <Alert className="mb-4 border border-violet-200 bg-violet-50 rounded-lg">
            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <AlertTitle className="text-sm font-medium text-violet-900">Special Instructions from Requester</AlertTitle>
                <AlertDescription className="text-sm text-violet-700 mt-1">{request.requester_message}</AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {request.coordinator_message && (
          <Alert
            className={`mb-4 border rounded-lg ${
              request.status === 'rejected'
                ? 'border-red-200 bg-red-50'
                : request.status === 'approved'
                ? 'border-green-200 bg-green-50'
                : 'border-blue-200 bg-blue-50'
            }`}
          >
            <div className="flex items-start gap-2">
              {request.status === 'rejected' ? (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              ) : request.status === 'approved' ? (
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <AlertTitle className="text-sm font-medium text-slate-900">Coordinator Message</AlertTitle>
                <AlertDescription className="text-sm text-slate-600 mt-1">{request.coordinator_message}</AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {request.dispatch_notes && (request.status === 'dispatched' || request.status === 'received') && (
          <Alert className="mb-4 border border-emerald-200 bg-emerald-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Truck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <AlertTitle className="text-sm font-medium text-slate-900">Dispatch Info</AlertTitle>
                <AlertDescription className="text-sm text-slate-600 mt-1">{request.dispatch_notes}</AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {/* Mobile: Urgent Priority Badge */}
        {request.priority === 'urgent' && (
          <div className="sm:hidden mb-4 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-700">Urgent Priority</span>
          </div>
        )}

        {/* =========================================== */}
        {/* MAIN GRID - Responsive */}
        {/* =========================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* LEFT COLUMN - Main Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5">

            {/* =========================================== */}
            {/* PRODUCT ITEMS - Responsive View Swap */}
            {/* =========================================== */}
            <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-500" />
                  Product Items
                  {hasItems && (
                    <span className="text-xs font-normal text-slate-500">
                      ({request.items!.length})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {hasItems ? (
                  <>
                    {/* DESKTOP: Data Table (hidden on mobile) */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="w-10 text-xs font-medium text-slate-500">#</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500">Type</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500">Quality</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500">Size</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500">Finish</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500">Thickness</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 text-right">Qty</TableHead>
                            <TableHead className="w-10 text-xs font-medium text-slate-500">Img</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {request.items!.map((item: RequestItemDB, index: number) => (
                            <TableRow key={item.id} className="hover:bg-slate-50/50">
                              <TableCell className="text-sm font-medium text-slate-600">{index + 1}</TableCell>
                              <TableCell className="text-sm text-slate-900 capitalize font-medium">{item.product_type}</TableCell>
                              <TableCell className="text-sm text-slate-700">{item.quality_custom || item.quality}</TableCell>
                              <TableCell className="text-sm text-slate-700">
                                {item.sample_size}
                                {item.sample_size_remarks && <span className="block text-xs text-slate-400">{item.sample_size_remarks}</span>}
                              </TableCell>
                              <TableCell className="text-sm text-slate-700">
                                {item.finish || '—'}
                                {item.finish_remarks && <span className="block text-xs text-slate-400">{item.finish_remarks}</span>}
                              </TableCell>
                              <TableCell className="text-sm text-slate-700">
                                {item.thickness}
                                {item.thickness_remarks && <span className="block text-xs text-slate-400">{item.thickness_remarks}</span>}
                              </TableCell>
                              <TableCell className="text-sm text-slate-900 font-medium text-right">{item.quantity}</TableCell>
                              <TableCell>
                                {item.image_url ? (
                                  <button
                                    onClick={() => setPreviewImage(item.image_url)}
                                    className="h-8 w-8 rounded border border-slate-200 overflow-hidden hover:border-indigo-400"
                                  >
                                    <img src={item.image_url} alt="Ref" className="h-full w-full object-cover" />
                                  </button>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* MOBILE: Card View (hidden on desktop) */}
                    <div className="md:hidden p-3 space-y-3">
                      {request.items!.map((item: RequestItemDB, index: number) => (
                        <ProductCard key={item.id} item={item} index={index} />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {/* DESKTOP: Legacy Table */}
                    <div className="hidden md:block p-4">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="text-xs font-medium text-slate-500">Type</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500">Quality</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500">Size</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500">Finish</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500">Thickness</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 text-right">Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="hover:bg-slate-50/50">
                            <TableCell className="text-sm text-slate-900 capitalize font-medium">{request.product_type}</TableCell>
                            <TableCell className="text-sm text-slate-700">{request.quality}</TableCell>
                            <TableCell className="text-sm text-slate-700">{request.sample_size}</TableCell>
                            <TableCell className="text-sm text-slate-700">{request.finish || '—'}</TableCell>
                            <TableCell className="text-sm text-slate-700">{request.thickness}</TableCell>
                            <TableCell className="text-sm text-slate-900 font-medium text-right">{request.quantity}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      {request.image_url && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => setPreviewImage(request.image_url)}
                            className="flex items-center gap-2 text-sm text-indigo-600"
                          >
                            <ImageIcon className="h-4 w-4" />
                            View Reference Image
                          </button>
                        </div>
                      )}
                    </div>

                    {/* MOBILE: Legacy Card */}
                    <div className="md:hidden p-3">
                      <LegacyProductCard />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* =========================================== */}
            {/* SHIPPING & LOGISTICS */}
            {/* =========================================== */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-slate-900 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-emerald-500" />
                    Shipping
                  </CardTitle>
                  {isCoordinator && !isSelfPickup && displayAddress && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPrintModal(true)}
                      className="h-8 px-2 text-xs text-slate-500 hover:text-indigo-600"
                    >
                      <Printer className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">Print Address</span>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Pickup Method */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Pickup Method
                    </label>
                    {canEditShipping && !isEditingDeliveryMethod && (
                      <button
                        onClick={handleStartEditDeliveryMethod}
                        className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {isEditingDeliveryMethod ? (
                    <div className="space-y-3">
                      <Select value={editedDeliveryMethod} onValueChange={setEditedDeliveryMethod}>
                        <SelectTrigger className="h-11 text-sm border-slate-200">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          {PICKUP_METHOD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        value={deliveryMethodRemark}
                        onChange={(e) => setDeliveryMethodRemark(e.target.value)}
                        className="text-sm min-h-[70px] border-slate-200"
                        placeholder="Reason for change (optional)"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEditDeliveryMethod}
                          disabled={isSavingDeliveryMethod}
                          className="h-10 px-4"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveDeliveryMethod}
                          disabled={isSavingDeliveryMethod}
                          className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700"
                        >
                          {isSavingDeliveryMethod ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-slate-900 font-medium">
                        {formatPickupMethod(request.pickup_responsibility)}
                      </p>
                      {request.is_delivery_method_edited && (
                        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
                          <Pencil className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                          <div className="text-xs text-amber-700">
                            <span className="font-medium">Modified by Coordinator</span>
                            {request.delivery_method_remark && (
                              <span className="block text-amber-600 mt-0.5">{request.delivery_method_remark}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Delivery Address */}
                {!isSelfPickup && (
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Delivery Address
                      </label>
                      {canEditShipping && !isEditingAddress && (
                        <button
                          onClick={handleStartEditAddress}
                          className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {isEditingAddress ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editedAddress}
                          onChange={(e) => setEditedAddress(e.target.value)}
                          className="text-sm min-h-[100px] border-slate-200"
                          placeholder="Enter delivery address..."
                        />
                        <Textarea
                          value={addressEditRemark}
                          onChange={(e) => setAddressEditRemark(e.target.value)}
                          className="text-sm min-h-[70px] border-slate-200"
                          placeholder="Reason for address change (optional)"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={isSavingAddress}
                            className="h-10 px-4"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveAddress}
                            disabled={isSavingAddress}
                            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700"
                          >
                            {isSavingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {displayAddress ? (
                          <p className="text-sm text-slate-700 whitespace-pre-line">{displayAddress}</p>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                            <div className="flex items-center gap-2 flex-1">
                              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                              <div>
                                <p className="text-sm text-amber-700 font-medium">Address required</p>
                                <p className="text-xs text-amber-600">Add delivery address for shipment.</p>
                              </div>
                            </div>
                            {canEditShipping && (
                              <Button
                                size="sm"
                                onClick={handleStartEditAddress}
                                className="h-9 text-xs bg-amber-600 hover:bg-amber-700 w-full sm:w-auto"
                              >
                                Add Address
                              </Button>
                            )}
                          </div>
                        )}
                        {request.is_address_edited && displayAddress && (
                          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
                            <Pencil className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                            <div className="text-xs text-amber-700">
                              <span className="font-medium">Modified by Coordinator</span>
                              {request.address_edit_remark && (
                                <span className="block text-amber-600 mt-0.5">{request.address_edit_remark}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {request.pickup_remarks && (
                  <div className="pt-3 border-t border-slate-100">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                      Pickup Remarks
                    </label>
                    <p className="text-sm text-slate-600">{request.pickup_remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* =========================================== */}
            {/* PACKING DETAILS */}
            {/* =========================================== */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-500" />
                  Packing
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Purpose</label>
                    <p className="text-sm text-slate-900 capitalize">{request.purpose?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Type</label>
                    <p className="text-sm text-slate-900 capitalize">{request.packing_details?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                {request.packing_remarks && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Notes</label>
                    <p className="text-sm text-slate-600">{request.packing_remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* =========================================== */}
          {/* RIGHT COLUMN - Sidebar */}
          {/* =========================================== */}
          <div className="space-y-4 sm:space-y-5">
            {/* Deadline / Required By */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-slate-900 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-500" />
                    Required By
                  </CardTitle>
                  {/* Hide pencil for pending_approval - coordinator should use the Approval Dialog instead */}
                  {isCoordinator && request.status !== 'pending_approval' && (
                    <button
                      onClick={() => setIsEditRequiredByOpen(true)}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit deadline"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {/* Current Deadline - Primary Display */}
                <div className={`p-3 rounded-lg ${
                  deadlineStatus.status === 'overdue' ? 'bg-red-50 border border-red-200' :
                  deadlineStatus.status === 'urgent' ? 'bg-amber-50 border border-amber-200' :
                  deadlineStatus.status === 'completed' ? 'bg-green-50 border border-green-200' :
                  'bg-slate-50 border border-slate-200'
                }`}>
                  <p className={`text-xl font-bold ${
                    deadlineStatus.status === 'overdue' ? 'text-red-700' :
                    deadlineStatus.status === 'urgent' ? 'text-amber-700' :
                    deadlineStatus.status === 'completed' ? 'text-green-700' :
                    'text-slate-900'
                  }`}>
                    {formatDateTime(request.required_by)}
                  </p>
                  {deadlineStatus.label && (
                    <span className={`inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium ${
                      deadlineStatus.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {deadlineStatus.label}
                    </span>
                  )}
                </div>

                {/* Deadline History */}
                {request.required_by_history && request.required_by_history.length > 0 && (
                  <RequiredByHistory history={request.required_by_history} />
                )}
              </CardContent>
            </Card>

            {/* Assigned Maker */}
            {request.maker && (
              <Card className="bg-white border border-slate-200 shadow-sm">
                <CardHeader className="py-3 px-4 border-b border-slate-100">
                  <CardTitle className="text-sm font-medium text-slate-900 flex items-center gap-2">
                    <User className="h-4 w-4 text-violet-500" />
                    Assigned Maker
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
                      <span className="text-sm font-bold text-violet-600">
                        {request.maker.full_name?.charAt(0).toUpperCase() || 'M'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{request.maker.full_name}</p>
                      <p className="text-xs text-slate-500">Production Team</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Requester Info */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  Requester
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Name</label>
                  <p className="text-sm text-slate-900 font-medium">{request.creator?.full_name || 'Unknown'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Dept</label>
                    <p className="text-sm text-slate-700 capitalize">{request.department}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Mobile</label>
                    <p className="text-sm text-slate-700">{request.mobile_no}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Client Info */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <Building className="h-4 w-4 text-rose-500" />
                  Client
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Project</label>
                  <p className="text-sm text-slate-900 font-medium">{request.client_project_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Type</label>
                    <p className="text-sm text-slate-700 capitalize">{request.client_type}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Company</label>
                    <p className="text-sm text-slate-700 truncate">{request.company_firm_name}</p>
                  </div>
                </div>
                {/* Hide contact info from Makers for privacy */}
                {!isMaker && request.client_phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{request.client_phone}</span>
                  </div>
                )}
                {!isMaker && request.client_email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{request.client_email}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Location</label>
                  <p className="text-sm text-slate-700">{request.site_location}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Production actions - Show for assigned users OR coordinators (manager override) */}
        {(isCoordinator || request.assigned_to === profile?.id) && (
          <MakerActions request={request} userRole={profile?.role || ''} userId={profile?.id || ''} />
        )}
      </main>

      {/* =========================================== */}
      {/* STICKY COORDINATOR ACTION BAR */}
      {/* =========================================== */}
      {isCoordinator && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-20 safe-area-pb">
          <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              {/* Mobile: Simplified left side */}
              <div className="hidden sm:flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Coordinator Actions</p>
                  <p className="text-xs text-slate-500">
                    {request.status === 'pending_approval' && 'Review and approve'}
                    {request.status === 'approved' && 'Assign to maker'}
                    {request.status === 'assigned' && 'Start production'}
                    {request.status === 'in_production' && 'Mark as ready'}
                    {request.status === 'ready' && 'Mark as dispatched'}
                    {!['pending_approval', 'approved', 'ready', 'assigned', 'in_production'].includes(request.status) && `Status: ${request.status.replace(/_/g, ' ')}`}
                  </p>
                </div>
              </div>

              {/* Mobile: Full width action area */}
              <div className="flex-1 sm:flex-initial">
                <RequestActions request={request} userRole={profile?.role || ''} isCompact />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================== */}
      {/* PRINT ADDRESS MODAL */}
      {/* =========================================== */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="text-base font-medium text-slate-900">Print Address</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Font Size</Label>
                <Select value={labelFontSize} onValueChange={(v: typeof labelFontSize) => setLabelFontSize(v)}>
                  <SelectTrigger className="h-10 text-sm border-slate-200">
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="xlarge">X-Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Style</Label>
                <button
                  onClick={() => setLabelUnderline(!labelUnderline)}
                  className={`w-full h-10 px-3 border rounded-md flex items-center justify-between text-sm ${
                    labelUnderline ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <span className={labelUnderline ? 'underline' : ''}>Underline</span>
                  {labelUnderline && <Check className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-600">Preview</Label>
              <div className="border border-dashed border-slate-200 rounded-lg p-4 bg-white min-h-[100px] flex items-center justify-center">
                <div className={`text-center ${fontSizeMap[labelFontSize]} ${labelUnderline ? 'underline' : ''} text-slate-900 whitespace-pre-line`}>
                  {displayAddress || 'No address'}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPrintModal(false)} className="h-10 flex-1 sm:flex-initial">
              Cancel
            </Button>
            <Button size="sm" onClick={handlePrint} className="h-10 flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700">
              <Printer className="h-4 w-4 mr-1.5" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================== */}
      {/* IMAGE PREVIEW MODAL */}
      {/* =========================================== */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden mx-2">
          <div className="relative">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 z-10"
            >
              <X className="h-5 w-5" />
            </button>
            {previewImage && (
              <img src={previewImage} alt="Reference" className="w-full h-auto max-h-[80vh] object-contain bg-slate-900" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* =========================================== */}
      {/* EDIT REQUIRED BY MODAL */}
      {/* =========================================== */}
      <EditRequiredByModal
        request={request}
        open={isEditRequiredByOpen}
        onOpenChange={setIsEditRequiredByOpen}
      />
    </div>
  );
}
