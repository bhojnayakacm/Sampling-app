import { useState, useEffect } from 'react';
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
  Pencil,
  Printer,
  Check,
  X,
} from 'lucide-react';
import type { RequestItemDB } from '@/types';

export default function RequestDetail() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  // Use the new hook that fetches request WITH items
  const { data: request, isLoading, error } = useRequestWithItems(id);

  // Dynamic back navigation based on user role
  const isCoordinator = profile?.role === 'coordinator';
  const backDestination = isCoordinator ? '/' : '/requests';
  const backButtonText = isCoordinator ? 'Back to Dashboard' : 'Back to List';

  // Logistics Label State (Coordinator only)
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editedAddress, setEditedAddress] = useState('');
  const [addressModified, setAddressModified] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [labelFontSize, setLabelFontSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium');
  const [labelUnderline, setLabelUnderline] = useState(false);

  // Initialize addressModified from request data (for persisted edits)
  useEffect(() => {
    if (request?.is_address_edited) {
      setAddressModified(true);
      setEditedAddress(request.delivery_address || '');
    }
  }, [request?.is_address_edited, request?.delivery_address]);

  // Get the display address (edited or original)
  const displayAddress = addressModified ? editedAddress : (request?.delivery_address || '');

  // Font size mapping for label preview and print
  const fontSizeMap = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-2xl',
    xlarge: 'text-4xl',
  };

  // Start editing address
  const handleStartEditAddress = () => {
    setEditedAddress(request?.delivery_address || '');
    setIsEditingAddress(true);
  };

  // Save edited address to Supabase
  const handleSaveAddress = async () => {
    if (!id || !request) return;

    const originalAddress = request.delivery_address || '';
    const hasChanges = editedAddress.trim() !== originalAddress.trim();

    if (!hasChanges) {
      setIsEditingAddress(false);
      return;
    }

    setIsSavingAddress(true);

    try {
      const { error: updateError } = await supabase
        .from('requests')
        .update({
          delivery_address: editedAddress.trim(),
          is_address_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        console.error('Failed to save address:', updateError);
        alert('Failed to save address. Please try again.');
        return;
      }

      // Update local state
      setAddressModified(true);
      setIsEditingAddress(false);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });

    } catch (err) {
      console.error('Error saving address:', err);
      alert('An error occurred while saving. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditingAddress(false);
    // Reset to current persisted address
    setEditedAddress(request?.delivery_address || '');
  };

  // Handle print using isolated iframe technique
  const handlePrint = () => {
    // Map Tailwind classes to actual CSS font sizes
    const fontSizePixelMap: Record<string, string> = {
      small: '14px',
      medium: '18px',
      large: '24px',
      xlarge: '36px',
    };

    const fontSize = fontSizePixelMap[labelFontSize] || '18px';
    const textDecoration = labelUnderline ? 'underline' : 'none';
    const addressContent = displayAddress || 'No address available';

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    // Get the iframe's document
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      console.error('Could not access iframe document');
      document.body.removeChild(iframe);
      return;
    }

    // Write clean HTML to the iframe
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shipping Label</title>
          <style>
            /* Remove browser headers/footers */
            @page {
              size: auto;
              margin: 0mm;
            }

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
            }

            body {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 20mm;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background: white;
            }

            .label-container {
              text-align: center;
              max-width: 100%;
            }

            .label-text {
              font-size: ${fontSize};
              text-decoration: ${textDecoration};
              line-height: 1.6;
              color: black;
              white-space: pre-line;
              word-wrap: break-word;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="label-text">${addressContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    // Wait for content to render, then print
    iframe.contentWindow?.focus();

    // Use setTimeout to ensure content is fully rendered
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print failed:', err);
      }

      // Cleanup: Remove iframe after a delay (to allow print dialog to complete)
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 250);
  };

  // Clean status badge styling (matching dashboard)
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700' },
      pending_approval: { label: 'Pending Approval', className: 'bg-amber-50 text-amber-700' },
      approved: { label: 'Approved', className: 'bg-sky-50 text-sky-700' },
      assigned: { label: 'Assigned', className: 'bg-indigo-50 text-indigo-700' },
      in_production: { label: 'In Production', className: 'bg-violet-50 text-violet-700' },
      ready: { label: 'Ready', className: 'bg-teal-50 text-teal-700' },
      dispatched: { label: 'Dispatched', className: 'bg-emerald-50 text-emerald-700' },
      received: { label: 'Received', className: 'bg-green-50 text-green-700' },
      rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700' },
    };

    const { label, className } = statusMap[status] || { label: status, className: 'bg-slate-100 text-slate-700' };
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${className}`}>
        {label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const isUrgent = priority === 'urgent';
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${
        isUrgent
          ? 'bg-red-50 text-red-700'
          : 'bg-slate-100 text-slate-600'
      }`}>
        {priority}
      </span>
    );
  };

  // Get product type color for visual differentiation
  const getProductTypeColor = (productType: string) => {
    const colors: Record<string, string> = {
      marble: 'bg-indigo-50 text-indigo-700',
      tile: 'bg-emerald-50 text-emerald-700',
      terrazzo: 'bg-amber-50 text-amber-700',
      quartz: 'bg-pink-50 text-pink-700',
    };
    return colors[productType] || 'bg-slate-100 text-slate-700';
  };

  // Render a single product item card - Clean styling matching dashboard
  const renderProductItem = (item: RequestItemDB, index: number, total: number) => {
    const showFinish = item.product_type === 'marble' || item.product_type === 'tile';

    return (
      <Card key={item.id} className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 bg-indigo-600" />

        {/* Card Header */}
        <CardHeader className="pb-2 sm:pb-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
                {index + 1}
              </div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-slate-800">
                <Package className="h-4 w-4 text-indigo-500" />
                <span className="capitalize font-bold">{item.product_type}</span>
              </CardTitle>
            </div>
            <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getProductTypeColor(item.product_type)}`}>
              {total > 1 ? `${index + 1}/${total}` : 'Item'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-5 space-y-4">
          {/* Mobile-First: Stacked detail rows */}
          <div className="space-y-3">
            {/* Quality & Quantity - Side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Quality</span>
                <p className="text-sm sm:text-base font-semibold mt-1 capitalize text-slate-800">
                  {item.quality_custom || item.quality}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Quantity</span>
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
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <ImageIcon className="h-3.5 w-3.5 text-indigo-500" />
                Reference Image
              </span>
              <img
                src={item.image_url}
                alt={`${item.product_type} reference`}
                className="w-full sm:max-w-xs h-32 sm:h-40 object-contain rounded-lg border border-slate-200 bg-slate-50"
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
      <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1 bg-indigo-600" />
        <CardHeader className="bg-slate-50 border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Package className="h-5 w-5 text-indigo-500" />
            Sample Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Product Type</span>
              <p className="text-base capitalize font-semibold text-slate-800 mt-1">{request.product_type}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Quality</span>
              <p className="text-base capitalize font-semibold text-slate-800 mt-1">{request.quality}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Quantity</span>
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
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <ImageIcon className="h-4 w-4 text-indigo-500" />
                Sample Image
              </span>
              <img
                src={request.image_url}
                alt="Sample reference"
                className="max-w-md h-48 object-contain rounded-lg border border-slate-200 bg-slate-50"
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-slate-600 font-medium">Loading request details...</p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md bg-white border border-slate-200 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-red-600 font-semibold mb-2 text-lg">Failed to load request</p>
            <p className="text-slate-500 mb-6">The request details could not be loaded. Please try again.</p>
            <Button
              onClick={() => navigate(backDestination)}
              className="min-h-[48px] px-6 text-base font-semibold bg-indigo-600 hover:bg-indigo-700"
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

  // Get status banner color
  const getStatusBannerColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-slate-50 border-slate-200',
      pending_approval: 'bg-amber-50 border-amber-200',
      approved: 'bg-sky-50 border-sky-200',
      assigned: 'bg-indigo-50 border-indigo-200',
      in_production: 'bg-violet-50 border-violet-200',
      ready: 'bg-teal-50 border-teal-200',
      dispatched: 'bg-emerald-50 border-emerald-200',
      received: 'bg-green-50 border-green-200',
      rejected: 'bg-red-50 border-red-200',
    };
    return colors[status] || 'bg-slate-50 border-slate-200';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Clean White Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                onClick={() => navigate(backDestination)}
                className="md:hidden min-h-[44px] px-3 gap-2 text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back</span>
              </Button>
              <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">Request Details</h1>
                <code className="text-xs sm:text-sm font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {request.request_number}
                </code>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <TrackingDialog
                request={request}
                trigger={
                  <Button
                    variant="outline"
                    className="min-h-[44px] px-4 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="hidden sm:inline">Track</span>
                  </Button>
                }
              />
              <Button
                variant="outline"
                onClick={() => navigate(backDestination)}
                className="hidden md:flex min-h-[44px] px-4 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                {backButtonText}
              </Button>
              <Button
                variant="ghost"
                onClick={signOut}
                className="hidden sm:flex min-h-[44px] px-4 text-slate-600 hover:bg-slate-100"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* PROMINENT STATUS BANNER - Always visible at top */}
        <div className={`rounded-xl border p-4 sm:p-5 mb-5 ${getStatusBannerColor(request.status)}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {getStatusBadge(request.status)}
              {getPriorityBadge(request.priority)}
              {itemCount > 1 && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-slate-700 border border-slate-200">
                  {itemCount} Products
                </span>
              )}
            </div>
            <div className="text-sm text-slate-600">
              <span className="opacity-75">Required by:</span>{' '}
              <span className="font-semibold">{formatDateTime(request.required_by)}</span>
            </div>
          </div>
        </div>

        {/* Coordinator Message Alert (if exists) */}
        {request.coordinator_message && (
          <Alert
            className={`mb-5 border-l-4 rounded-lg ${
              request.status === 'rejected'
                ? 'border-l-red-500 bg-red-50'
                : request.status === 'approved'
                ? 'border-l-green-500 bg-green-50'
                : 'border-l-blue-500 bg-blue-50'
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
          <Alert className="mb-5 border-l-4 border-l-emerald-500 bg-emerald-50 rounded-lg">
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
            <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-1 bg-indigo-600" />
              <CardHeader className="pb-3 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-base sm:text-lg text-slate-900 font-bold">Requester Info</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Created By</span>
                    <p className="text-sm font-semibold mt-0.5 text-slate-800">{request.creator?.full_name || 'Unknown'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Department</span>
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
              </CardContent>
            </Card>

            {/* Client Details */}
            <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-1 bg-violet-600" />
              <CardHeader className="pb-3 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-base sm:text-lg text-slate-900 font-bold">Client Info</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Project Name</span>
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

          {/* Section 2: Shipping Details - ONLY visible when NOT Self Pickup */}
          {request.pickup_responsibility !== 'self_pickup' && request.delivery_address && (
            <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden print:hidden" id="shipping-details-card">
              <div className="h-1 bg-teal-600" />
              <CardHeader className="pb-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg text-slate-900 font-bold flex items-center gap-2">
                    <Truck className="h-5 w-5 text-teal-600" />
                    Shipping Details
                  </CardTitle>
                  {isCoordinator && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPrintModal(true)}
                      className="gap-2 border-teal-200 text-teal-700 hover:bg-teal-50"
                    >
                      <Printer className="h-4 w-4" />
                      Print Label
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <span className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Pickup Method</span>
                  <p className="text-sm font-semibold mt-0.5 capitalize text-slate-800">{request.pickup_responsibility?.replace('_', ' ')}</p>
                </div>

                {/* Delivery Address - Editable for Coordinators */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-teal-600" />
                      Delivery Address
                    </span>
                    {isCoordinator && !isEditingAddress && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStartEditAddress}
                        className="h-7 px-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {isEditingAddress ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editedAddress}
                        onChange={(e) => setEditedAddress(e.target.value)}
                        className="min-h-[100px] border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter delivery address..."
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={isSavingAddress}
                          className="gap-1 text-slate-600"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveAddress}
                          disabled={isSavingAddress}
                          className="gap-1 bg-indigo-600 hover:bg-indigo-700"
                        >
                          {isSavingAddress ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          {isSavingAddress ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-line text-slate-700">{displayAddress}</p>
                  )}

                  {/* Audit Trail Note */}
                  {addressModified && !isEditingAddress && (
                    <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                        <Pencil className="h-3 w-3" />
                        Note: Address modified by Coordinator
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 4: Product Items (NEW - Multi-Product Support) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <Package className="h-5 w-5 text-indigo-500" />
                Product Items
                {hasItems && (
                  <span className="ml-2 text-xs px-3 py-1.5 rounded-full font-semibold bg-indigo-50 text-indigo-700">
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
          <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-1 bg-emerald-600" />
            <CardHeader className="pb-3 bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-base sm:text-lg text-slate-900 font-bold">Shipping & Packing</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Purpose</span>
                  <p className="text-sm font-semibold mt-0.5 capitalize text-slate-800">{request.purpose?.replace('_', ' ')}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Packing</span>
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
          <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-1 bg-slate-600" />
            <CardHeader className="pb-3 bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-base sm:text-lg text-slate-900 font-bold">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Timeline as horizontal steps on mobile */}
              <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
                <div className="flex-shrink-0 min-w-[130px] sm:min-w-0 bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Created</span>
                  <p className="text-xs sm:text-sm font-semibold mt-0.5 text-slate-800">{formatDateTime(request.created_at)}</p>
                </div>
                {request.completed_at && (
                  <div className="flex-shrink-0 min-w-[130px] sm:min-w-0 bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Completed</span>
                    <p className="text-xs sm:text-sm font-semibold mt-0.5 text-slate-800">{formatDateTime(request.completed_at)}</p>
                  </div>
                )}
                {request.dispatched_at && (
                  <div className="flex-shrink-0 min-w-[130px] sm:min-w-0 bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Dispatched</span>
                    <p className="text-xs sm:text-sm font-semibold mt-0.5 text-slate-800">{formatDateTime(request.dispatched_at)}</p>
                  </div>
                )}
                {request.received_at && (
                  <div className="flex-shrink-0 min-w-[130px] sm:min-w-0 bg-green-50 rounded-lg p-3 border border-green-200">
                    <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Received</span>
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

      {/* Print Label Modal - Coordinator Only */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="sm:max-w-lg print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Printer className="h-5 w-5 text-teal-600" />
              Print Shipping Label
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Print Settings */}
            <div className="grid grid-cols-2 gap-4">
              {/* Font Size Control */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Font Size</Label>
                <Select value={labelFontSize} onValueChange={(value: 'small' | 'medium' | 'large' | 'xlarge') => setLabelFontSize(value)}>
                  <SelectTrigger className="h-10 border-slate-200">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="xlarge">Extra Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Underline Control */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Style</Label>
                <button
                  onClick={() => setLabelUnderline(!labelUnderline)}
                  className={`w-full h-10 px-3 border rounded-md flex items-center justify-between transition-colors ${
                    labelUnderline
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-sm ${labelUnderline ? 'underline' : ''}`}>Underline Text</span>
                  {labelUnderline && <Check className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Preview</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 bg-white min-h-[150px] flex items-center justify-center">
                <div
                  className={`text-center ${fontSizeMap[labelFontSize]} ${labelUnderline ? 'underline' : ''} text-slate-900 whitespace-pre-line leading-relaxed`}
                >
                  {displayAddress || 'No address available'}
                </div>
              </div>
            </div>

            {/* Request Info (for reference) */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Request:</span>
                  <span className="ml-1 font-mono font-semibold text-slate-700">{request.request_number}</span>
                </div>
                <div>
                  <span className="text-slate-500">Project:</span>
                  <span className="ml-1 font-semibold text-slate-700">{request.client_project_name}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPrintModal(false)}
              className="border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePrint}
              className="gap-2 bg-teal-600 hover:bg-teal-700"
            >
              <Printer className="h-4 w-4" />
              Print Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
