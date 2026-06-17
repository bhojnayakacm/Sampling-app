import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { useRequestWithItems, useDismissScheduleWarning, useEditItemSize } from '@/lib/api/requests';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import RequestActions from '@/components/requests/RequestActions';
import MakerActions from '@/components/requests/MakerActions';
import ReceiverActions from '@/components/requests/ReceiverActions';
import TrackingDialog from '@/components/requests/TrackingDialog';
import EditRequiredByModal from '@/components/requests/EditRequiredByModal';
import RequiredByHistory from '@/components/requests/RequiredByHistory';
import EditedInfoTooltip from '@/components/requests/EditedInfoTooltip';
// Kit feature deprecated — UnpackKitDialog no longer rendered. Import
// kept in source but commented out so the dialog component is tree-shaken
// out of the bundle.
// import UnpackKitDialog from '@/components/requests/UnpackKitDialog';
import {
  MapPin,
  MessageSquare,
  CheckCircle,
  XCircle,
  ChevronLeft,
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
  AlertTriangle,
  Copy,
  RotateCcw,
} from 'lucide-react';
import type { RequestItemDB, SubCategory, OptionsKey, RequestCategory } from '@/types';
import { SUB_CATEGORY_LABELS, PRODUCT_SIZE_OPTIONS, getOptionsKey } from '@/types';
import { RequestDetailSkeleton } from '@/components/skeletons';

export default function RequestDetail() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: request, isLoading, error } = useRequestWithItems(id);
  const dismissWarning = useDismissScheduleWarning();
  const editItemSize = useEditItemSize();

  const isCoordinator = ['coordinator', 'marble_coordinator', 'magro_coordinator'].includes(profile?.role || '');
  const isMaker = profile?.role === 'maker';
  const isRequester = profile?.role === 'requester' && profile?.id === request?.created_by;
  const hideClientContact = ['maker', 'dispatcher'].includes(profile?.role || '');

  // Size edits are only permitted while the sample is still in early-stage
  // workflow. Once the sample reaches "ready" (production complete) or
  // moves further along (dispatched / received / rejected), the recorded
  // specs become immutable — at that point the maker has already produced
  // to spec, and changing the size retroactively would falsify history.
  const SIZE_EDITABLE_STATUSES: ReadonlyArray<string> = [
    'draft',
    'pending_approval',
    'approved',
    'assigned',
    'in_production',
  ];
  const canEditItemSize = isCoordinator
    && !!request
    && SIZE_EDITABLE_STATUSES.includes(request.status);

  // Role-aware back navigation
  const backDestination = profile?.role === 'requester' ? '/requests' : '/';
  const backButtonText = profile?.role === 'requester' ? 'Back' : 'Dashboard';

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(backDestination);
    }
  };

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
  const [deliveryMethodAddress, setDeliveryMethodAddress] = useState('');
  const [isSavingDeliveryMethod, setIsSavingDeliveryMethod] = useState(false);

  // Image preview state
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Edit Required By modal state
  const [isEditRequiredByOpen, setIsEditRequiredByOpen] = useState(false);

  // Copy qualities state
  const [qualitiesCopied, setQualitiesCopied] = useState(false);

  // Kit feature deprecated — useState kept so the dead kit branches inside
  // ProductCard and the desktop kit table still type-check, but kitItems
  // is hard-empty below so the setter is never actually called and the
  // UnpackKitDialog mount has been commented out at the bottom of the file.
  const [unpackKitItem, setUnpackKitItem] = useState<RequestItemDB | null>(null);

  // Coordinator size-edit state: which item row is currently in edit-mode,
  // plus the in-flight draft values for size + mandatory reason.
  const [editingSizeItemId, setEditingSizeItemId] = useState<string | null>(null);
  const [editingSizeValue,  setEditingSizeValue]  = useState('');
  const [editingSizeCustom, setEditingSizeCustom] = useState(''); // when "Other"
  const [editingSizeReason, setEditingSizeReason] = useState('');

  const handleStartEditItemSize = (item: RequestItemDB) => {
    const cat = item.product_type as RequestCategory;
    const sub = (item.sub_category || '') as SubCategory | '';
    const optionsKey: OptionsKey | null = getOptionsKey(cat, sub);
    const opts = optionsKey ? PRODUCT_SIZE_OPTIONS[optionsKey] : [];
    const isCustom = !!item.sample_size && !opts.includes(item.sample_size);

    setEditingSizeItemId(item.id);
    setEditingSizeValue(isCustom ? 'Other' : item.sample_size);
    setEditingSizeCustom(isCustom ? item.sample_size : '');
    setEditingSizeReason('');
  };

  const handleCancelEditItemSize = () => {
    setEditingSizeItemId(null);
    setEditingSizeValue('');
    setEditingSizeCustom('');
    setEditingSizeReason('');
  };

  const handleSaveItemSize = async (item: RequestItemDB) => {
    const resolvedSize = (editingSizeValue === 'Other'
      ? editingSizeCustom
      : editingSizeValue).trim();

    if (!resolvedSize) {
      toast.error('Please choose a size or enter a custom value.');
      return;
    }
    if (!editingSizeReason.trim()) {
      toast.error('A reason is required when editing the size.');
      return;
    }

    try {
      await editItemSize.mutateAsync({
        itemId: item.id,
        newSize: resolvedSize,
        reason: editingSizeReason,
        requestId: request?.id,
      });
      toast.success('Item size updated.');
      handleCancelEditItemSize();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update item size.');
    }
  };

  useEffect(() => {
    if (request) {
      setEditedAddress(request.delivery_address || '');
    }
  }, [request?.delivery_address]);

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

    // 2026-06 refactor: reason is now MANDATORY for any address change.
    if (!addressEditRemark.trim()) {
      toast.error('Please provide a reason for the address change.');
      return;
    }

    setIsSavingAddress(true);

    try {
      const updatePayload: Record<string, unknown> = {
        delivery_address: editedAddress.trim() || null,
        is_address_edited: true,
        address_edit_remark: addressEditRemark.trim(),
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('requests')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) {
        console.error('Failed to save address:', updateError);
        toast.error('Failed to save address. Please try again.');
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
      toast.error('An error occurred while saving. Please try again.');
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
    setDeliveryMethodAddress('');
    setIsEditingDeliveryMethod(true);
  };

  const handleSaveDeliveryMethod = async () => {
    if (!id || !request) return;

    const originalMethod = request.pickup_responsibility || '';
    const isNowDelivery = editedDeliveryMethod !== 'self_pickup';
    const needsAddress = isNowDelivery && !request.delivery_address;
    const hasMethodChange = editedDeliveryMethod !== originalMethod;

    if (needsAddress && !deliveryMethodAddress.trim()) {
      toast.error('Please enter a delivery address before saving.');
      return;
    }

    // 2026-06 refactor: reason is now MANDATORY for any pickup-method change.
    // If the method did not change and no address was added, treat as a noop close.
    if (!hasMethodChange && !deliveryMethodAddress.trim()) {
      setIsEditingDeliveryMethod(false);
      return;
    }

    if (!deliveryMethodRemark.trim()) {
      toast.error('Please provide a reason for the pickup-method change.');
      return;
    }

    setIsSavingDeliveryMethod(true);

    try {
      const updatePayload: Record<string, unknown> = {
        pickup_responsibility: editedDeliveryMethod,
        is_delivery_method_edited: true,
        delivery_method_remark: deliveryMethodRemark.trim(),
        updated_at: new Date().toISOString(),
      };

      if (needsAddress && deliveryMethodAddress.trim()) {
        updatePayload.delivery_address = deliveryMethodAddress.trim();
        updatePayload.is_address_edited = true;
        // Use the same reason for the bundled address change.
        updatePayload.address_edit_remark = deliveryMethodRemark.trim();
      }

      const { error: updateError } = await supabase
        .from('requests')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) {
        console.error('Failed to save delivery method:', updateError);
        toast.error(`Failed to save delivery method: ${updateError.message || 'Unknown error'}`);
        return;
      }

      setIsEditingDeliveryMethod(false);
      setDeliveryMethodRemark('');
      setDeliveryMethodAddress('');

      await queryClient.invalidateQueries({ queryKey: ['request', id] });
      await queryClient.invalidateQueries({ queryKey: ['request-with-items', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
    } catch (err) {
      console.error('Error saving delivery method:', err);
      toast.error('An error occurred while saving. Please try again.');
    } finally {
      setIsSavingDeliveryMethod(false);
    }
  };

  const handleCancelEditDeliveryMethod = () => {
    setIsEditingDeliveryMethod(false);
    setEditedDeliveryMethod(request?.pickup_responsibility || '');
    setDeliveryMethodRemark('');
    setDeliveryMethodAddress('');
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

  // Status badge — borderless, rounded-full, bold colors
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600' },
      pending_approval: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
      approved: { label: 'Approved', className: 'bg-sky-100 text-sky-700' },
      assigned: { label: 'Assigned', className: 'bg-indigo-100 text-indigo-700' },
      in_production: { label: 'In Production', className: 'bg-violet-100 text-violet-700' },
      ready: { label: 'Ready', className: 'bg-teal-100 text-teal-700' },
      dispatched: { label: 'Dispatched', className: 'bg-emerald-100 text-emerald-700' },
      received: { label: 'Received', className: 'bg-green-100 text-green-700' },
      rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
    };

    const { label, className } = statusMap[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${className}`}>
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
  // PRODUCT ITEM HELPERS
  // =============================================
  const MAGRO_SORT_ORDER: Record<string, number> = { tile: 0, stone: 1, quartz: 2, terrazzo: 3 };

  const itemHasFinish = (item: RequestItemDB) =>
    item.product_type === 'marble' ||
    (item.product_type === 'magro' && (item.sub_category === 'tile' || item.sub_category === 'stone'));

  const formatChildLine = (item: RequestItemDB) => {
    // Thickness removed in 2026-06 refactor — copy text now lists only finish.
    const specs = [itemHasFinish(item) && item.finish ? item.finish : null].filter(Boolean).join(', ');
    return `   ↳ ${item.quality}${specs ? ` (${specs})` : ''} x ${item.quantity}`;
  };

  const formatItemBlock = (item: RequestItemDB, num: number, allItems: RequestItemDB[]) => {
    // Regular (non-kit) item
    if (!item.is_kit) {
      const label = item.product_type === 'marble'
        ? 'Marble'
        : item.sub_category
          ? `Magro ${item.sub_category.charAt(0).toUpperCase() + item.sub_category.slice(1)}`
          : 'Magro';
      // Thickness removed in 2026-06 refactor.
      const specs = [item.sample_size, itemHasFinish(item) && item.finish ? item.finish : null].filter(Boolean).join(', ');
      return `${num}. ${label} - ${item.quality} (${specs}) - Qty: ${item.quantity}`;
    }

    // Kit item
    const type = item.product_type === 'marble' ? 'Marble' : 'Magro';
    const lines: string[] = [`${num}. ${type} Kit (${item.sample_size}) - Qty: ${item.quantity}`];

    if (!item.is_unpacked) return lines.join('\n');

    const children = getKitChildren(allItems, item.id);
    if (children.length === 0) return lines.join('\n');

    const isGrouped = children.some(c => c.kit_index != null);

    if (isGrouped) {
      // Non-identical: group by kit_index
      const groups = new Map<number, RequestItemDB[]>();
      for (const child of children) {
        const idx = child.kit_index ?? 0;
        if (!groups.has(idx)) groups.set(idx, []);
        groups.get(idx)!.push(child);
      }
      const sortedKeys = Array.from(groups.keys()).sort((a, b) => a - b);
      for (const kitIdx of sortedKeys) {
        lines.push(`   [Kit ${kitIdx + 1}]`);
        for (const child of groups.get(kitIdx)!) {
          lines.push(formatChildLine(child));
        }
      }
    } else {
      // Identical: flat list
      for (const child of children) {
        lines.push(formatChildLine(child));
      }
    }

    return lines.join('\n');
  };

  const getSortedItems = (items: RequestItemDB[]) => {
    if (request?.category === 'magro') {
      return [...items].sort((a, b) =>
        (MAGRO_SORT_ORDER[a.sub_category || ''] ?? 99) - (MAGRO_SORT_ORDER[b.sub_category || ''] ?? 99)
      );
    }
    return items;
  };

  const getGroupedMagroItems = (items: RequestItemDB[]) => {
    const sorted = getSortedItems(items);
    const groups: { label: string; items: RequestItemDB[] }[] = [];
    let currentSub = '';
    for (const item of sorted) {
      const sub = item.sub_category || '';
      if (sub !== currentSub) {
        currentSub = sub;
        const label = sub ? `Magro ${sub.charAt(0).toUpperCase() + sub.slice(1)}` : 'Magro';
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  };

  const getKitChildren = (allItems: RequestItemDB[], kitId: string) =>
    allItems.filter(item => item.kit_id === kitId).sort((a, b) => a.item_index - b.item_index);

  const groupBySubCategory = (items: RequestItemDB[]) => {
    const map = new Map<string, RequestItemDB[]>();
    for (const item of items) {
      const key = item.sub_category || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sub, items]) => ({
        sub_category: sub,
        label: sub ? SUB_CATEGORY_LABELS[sub as SubCategory] || sub : 'Other',
        items,
      }));
  };

  const getParentKitQty = (allItems: RequestItemDB[], childItem: RequestItemDB): number | null => {
    if (!childItem.kit_id) return null;
    const parent = allItems.find(i => i.id === childItem.kit_id);
    return parent && parent.quantity > 1 ? parent.quantity : null;
  };

  const handleEditKit = (kit: RequestItemDB) => {
    setUnpackKitItem(kit);
  };

  // =============================================
  // MOBILE PRODUCT CARD
  // =============================================
  const ProductCard = ({ item, index }: { item: RequestItemDB; index: number }) => {
    if (item.is_kit) {
      const type = item.product_type === 'marble' ? 'Marble' : 'Magro';
      const children = getKitChildren(request?.items || [], item.id);
      return (
        <div className="space-y-1.5">
          <div className="rounded-lg bg-amber-50/80 border border-amber-200/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-5 w-5 rounded-full bg-amber-200/60 text-amber-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {index}
                </span>
                <Package className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-sm font-semibold text-amber-900 truncate">{type} Kit</span>
                {item.is_unpacked ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">Unpacked</span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-semibold">Pending</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                  ×{item.quantity}
                </span>
                {isCoordinator && !item.is_unpacked && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setUnpackKitItem(item)}
                    className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    Unpack
                  </Button>
                )}
                {isCoordinator && item.is_unpacked && request?.status === 'pending_approval' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditKit(item)}
                    className="h-7 text-xs text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                  >
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-amber-600 mt-1 ml-7">Size: {item.sample_size}</p>
          </div>
          {/* Kit children */}
          {item.is_unpacked && children.length > 0 && (() => {
            const isMagroKit = item.product_type === 'magro';
            const isGrouped = children.some((c) => c.kit_index != null);

            const renderChildList = (items: RequestItemDB[]) => {
              if (isMagroKit) {
                const subGroups = groupBySubCategory(items);
                if (subGroups.length > 1 || (subGroups.length === 1 && subGroups[0].sub_category)) {
                  return (
                    <div className="space-y-2">
                      {subGroups.map((sg) => (
                        <div key={sg.sub_category}>
                          <div className="flex items-center gap-1.5 py-0.5 pl-1">
                            <span className="text-[10px] font-medium text-emerald-600 italic">{sg.label}</span>
                            <div className="h-px flex-1 bg-emerald-100" />
                          </div>
                          <div className="space-y-1.5">
                            {sg.items.map((child, ci) => (
                              <ProductCard key={child.id} item={child} index={ci + 1} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
              }
              return (
                <div className="space-y-1.5">
                  {items.map((child, ci) => (
                    <ProductCard key={child.id} item={child} index={ci + 1} />
                  ))}
                </div>
              );
            };

            if (isGrouped) {
              const groups = new Map<number, typeof children>();
              for (const child of children) {
                const idx = child.kit_index ?? 0;
                if (!groups.has(idx)) groups.set(idx, []);
                groups.get(idx)!.push(child);
              }
              const sortedKeys = Array.from(groups.keys()).sort((a, b) => a - b);
              return (
                <div className="ml-5 pl-3 border-l-2 border-amber-300/60 space-y-2">
                  {sortedKeys.map((kitIdx) => {
                    const groupChildren = groups.get(kitIdx)!;
                    return (
                      <div key={kitIdx}>
                        <div className="flex items-center gap-2 py-1">
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            Kit {kitIdx + 1}
                          </span>
                          <div className="h-px flex-1 bg-amber-100" />
                        </div>
                        {renderChildList(groupChildren)}
                      </div>
                    );
                  })}
                </div>
              );
            }
            return (
              <div className="ml-5 pl-3 border-l-2 border-amber-300/60 space-y-1.5">
                {renderChildList(children)}
              </div>
            );
          })()}
        </div>
      );
    }

    // Regular item card
    const showFinish = itemHasFinish(item);
    const parentKitQty = getParentKitQty(request?.items || [], item);
    const perKit = parentKitQty ? Math.round(item.quantity / parentKitQty) : null;

    return (
      <div className="rounded-lg bg-white border border-slate-200/80 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-5 w-5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0">
              {index}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{item.quality}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
                {/* Thickness removed in 2026-06 refactor — mobile spec line shows size + finish. */}
                <span>{[item.sample_size, showFinish && item.finish ? item.finish : null].filter(Boolean).join(' · ')}</span>
                {item.is_size_edited && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded border border-amber-100">
                    Size edited
                    {item.size_edit_reason && (
                      <EditedInfoTooltip
                        label="Reason for size change"
                        reason={item.size_edit_reason}
                        ariaLabel="View reason for size change"
                      />
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">
                ×{item.quantity}
              </span>
              {perKit !== null && perKit !== item.quantity && (
                <span className="text-[10px] text-slate-400">{perKit}/kit</span>
              )}
            </div>
            {canEditItemSize && (
              <button
                type="button"
                onClick={() => handleStartEditItemSize(item)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors"
                aria-label="Edit item size"
                title="Edit size"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {item.image_url && (
              <button
                onClick={() => setPreviewImage(item.image_url)}
                className="h-8 w-8 rounded-md border border-slate-200 overflow-hidden hover:border-indigo-400 transition-colors"
              >
                <img src={item.image_url} alt="Ref" className="h-full w-full object-cover" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Loading
  if (isLoading) {
    return <RequestDetailSkeleton />;
  }

  // Error
  if (error || !request) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm rounded-xl bg-white border border-slate-200 shadow-sm p-6 text-center">
          <XCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-900 font-medium mb-1">Request not found</p>
          <p className="text-slate-500 text-sm mb-4">Unable to load request details.</p>
          <Button onClick={handleBack} className="bg-indigo-600 hover:bg-indigo-700">
            {backButtonText}
          </Button>
        </div>
      </div>
    );
  }

  const hasItems = request.items && request.items.length > 0;
  const isSelfPickup = request.pickup_responsibility === 'self_pickup';

  const getDeadlineStatus = () => {
    if (!request.required_by) return { status: 'normal', className: '', label: '' };
    const now = new Date();
    const deadline = new Date(request.required_by);
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (request.status === 'received') {
      return { status: 'completed', className: 'text-green-600', label: '' };
    }
    if (hoursUntilDeadline < 0) {
      return { status: 'overdue', className: 'text-red-600', label: 'Overdue' };
    }
    if (hoursUntilDeadline <= 24 || request.priority === 'urgent') {
      return { status: 'urgent', className: 'text-amber-600', label: request.priority === 'urgent' ? 'Urgent' : 'Due Soon' };
    }
    return { status: 'normal', className: 'text-slate-600', label: '' };
  };

  const deadlineStatus = getDeadlineStatus();
  const EDITABLE_STATUSES = ['pending_approval', 'approved', 'assigned', 'in_production', 'ready'];
  const canEditShipping = isCoordinator && EDITABLE_STATUSES.includes(request.status);

  return (
    <div className="min-h-screen bg-slate-50 pb-32 md:pb-24">
      {/* ======== HEADER ======== */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 h-14 flex items-center justify-between gap-2">
          {/* Left */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base font-semibold text-slate-900 truncate">
                  {request.request_number}
                </h1>
                {getStatusBadge(request.status)}
                {request.priority === 'urgent' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
                    Urgent
                  </span>
                )}
                {request.category && (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    request.category === 'marble' ? 'bg-stone-100 text-stone-600' : 'bg-cyan-50 text-cyan-700'
                  }`}>
                    {request.category === 'marble' ? 'Marble' : 'Magro'}
                  </span>
                )}
              </div>
              <div className="text-[11px] mt-0.5 truncate">
                {/* Mobile: due date only */}
                <span className={`sm:hidden flex items-center gap-1 ${deadlineStatus.className || 'text-slate-400'}`}>
                  <Calendar className="h-3 w-3" />
                  Due: {formatDateTime(request.required_by)}
                  {deadlineStatus.label && (
                    <span className={`ml-1 px-1 py-0.5 rounded text-[10px] font-semibold ${
                      deadlineStatus.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {deadlineStatus.label}
                    </span>
                  )}
                </span>
                {/* Desktop: both dates */}
                <span className="hidden sm:inline-flex items-center gap-4 text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created {formatDateTime(request.created_at)}
                  </span>
                  <span className={`flex items-center gap-1 ${deadlineStatus.className || ''}`}>
                    <Calendar className="h-3 w-3" />
                    Due {formatDateTime(request.required_by)}
                    {deadlineStatus.label && (
                      <span className={`ml-1 px-1 py-0.5 rounded text-[10px] font-semibold ${
                        deadlineStatus.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {deadlineStatus.label}
                      </span>
                    )}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1 shrink-0">
            <TrackingDialog
              request={request}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 sm:w-auto sm:px-3 p-0 text-xs border-slate-200 text-slate-500"
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
              className="h-8 px-2.5 text-xs text-slate-400 hover:bg-slate-100 hidden md:flex"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-5">
        {/* ======== ALERTS ======== */}

        {request.requester_message && (
          <Alert className="mb-3 border border-violet-200 bg-violet-50 rounded-xl">
            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <AlertTitle className="text-sm font-medium text-violet-900">Special Instructions</AlertTitle>
                <AlertDescription className="text-sm text-violet-700 mt-0.5">{request.requester_message}</AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {request.coordinator_message && (
          <Alert
            className={`mb-3 border rounded-xl ${
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
              <div className="min-w-0 flex-1">
                <AlertTitle className="text-sm font-medium text-slate-900">Coordinator Message</AlertTitle>
                <AlertDescription className="text-sm text-slate-600 mt-0.5">{request.coordinator_message}</AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {request.status === 'rejected' && profile?.id === request.created_by && (
          <div className="mb-3 border-2 border-dashed border-amber-300 bg-amber-50 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <RotateCcw className="h-4 w-4 text-amber-700" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">Want to fix and resubmit?</p>
                <p className="text-[11px] text-amber-700">Edit based on feedback above and send for review again.</p>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/requests/edit/${request.id}`)}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white gap-2 shrink-0"
              size="sm"
            >
              <Pencil className="h-4 w-4" />
              Edit & Resubmit
            </Button>
          </div>
        )}

        {(request.dispatch_notes || request.dispatch_metadata) && (request.status === 'dispatched' || request.status === 'received') && (
          <Alert className="mb-3 border border-emerald-200 bg-emerald-50 rounded-xl">
            <div className="flex items-start gap-2">
              <Truck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <AlertTitle className="text-sm font-medium text-slate-900">Dispatch Info</AlertTitle>
                {request.dispatch_notes && (
                  <AlertDescription className="text-sm text-slate-600 mt-0.5">{request.dispatch_notes}</AlertDescription>
                )}
                {/* Surface the structured dispatch metadata when available
                    (migration 1016). Driver / courier / field-boy facts get a
                    short fact line, followed by the package-photo thumbnails.
                    The thumbnails are gone once the request hits `received`
                    because the cleanup edge function wipes the bucket; we
                    keep this block rendering for `received` so the textual
                    audit (courier name, driver phone) stays visible. */}
                {request.dispatch_metadata && (
                  <div className="mt-2 space-y-2">
                    {request.dispatch_metadata.type === 'courier' && (
                      <p className="text-[11px] text-emerald-700">
                        <span className="font-semibold">Courier:</span>{' '}
                        {request.dispatch_metadata.courier_service === 'Other'
                          ? request.dispatch_metadata.courier_other_name
                          : request.dispatch_metadata.courier_service}
                      </p>
                    )}
                    {request.dispatch_metadata.type === 'company_vehicle' && (
                      <p className="text-[11px] text-emerald-700">
                        <span className="font-semibold">Driver:</span>{' '}
                        {request.dispatch_metadata.driver_name}
                        {request.dispatch_metadata.driver_phone && ` · ${request.dispatch_metadata.driver_phone}`}
                      </p>
                    )}
                    {request.dispatch_metadata.type === 'field_boy' && (
                      <p className="text-[11px] text-emerald-700">
                        <span className="font-semibold">Field boy:</span>{' '}
                        {request.dispatch_metadata.field_boy}
                      </p>
                    )}
                    {request.dispatch_metadata.images && request.dispatch_metadata.images.length > 0 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 pt-1">
                        {request.dispatch_metadata.images.map((url) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setPreviewImage(url)}
                            className="aspect-square rounded-md overflow-hidden border border-emerald-200 hover:border-emerald-400 transition-colors"
                            aria-label="View dispatch photo"
                          >
                            <img src={url} alt="Dispatch photo" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Alert>
        )}

        {request.status === 'received' && request.received_by && (
          <Alert className="mb-3 border border-green-200 bg-green-50 rounded-xl">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <AlertTitle className="text-sm font-medium text-slate-900">Received</AlertTitle>
                <AlertDescription className="text-sm text-slate-600 mt-0.5">
                  Received by <span className="font-medium text-slate-700">{request.received_by}</span>
                  {request.received_at && (
                    <span className="text-slate-400"> — {formatDateTime(request.received_at)}</span>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {/* Schedule Change Warning */}
        {request.has_schedule_warning && profile?.role === 'requester' && profile?.id === request.created_by && (
          <button
            onClick={() => dismissWarning.mutate(request.id)}
            disabled={dismissWarning.isPending}
            className="w-full mb-3 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 text-left hover:bg-amber-100 active:bg-amber-100 transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">Schedule has been updated</p>
              <p className="text-[11px] text-amber-700">The deadline was changed. Tap to dismiss.</p>
            </div>
            {dismissWarning.isPending ? (
              <Loader2 className="h-4 w-4 text-amber-500 animate-spin shrink-0" />
            ) : (
              <X className="h-4 w-4 text-amber-400 shrink-0" />
            )}
          </button>
        )}

        {/* ======== MAIN GRID ======== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-4">

            {/* ── Deadline Bar ── */}
            <div className={`flex items-center justify-between rounded-xl p-3 shadow-sm ${
              deadlineStatus.status === 'overdue' ? 'bg-red-50 border border-red-200/60' :
              deadlineStatus.status === 'urgent' ? 'bg-amber-50 border border-amber-200/60' :
              deadlineStatus.status === 'completed' ? 'bg-green-50 border border-green-200/60' :
              'bg-white border border-slate-200/80'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <Calendar className={`h-4 w-4 shrink-0 ${
                  deadlineStatus.status === 'overdue' ? 'text-red-500' :
                  deadlineStatus.status === 'urgent' ? 'text-amber-500' :
                  deadlineStatus.status === 'completed' ? 'text-green-500' :
                  'text-slate-400'
                }`} />
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block leading-none mb-0.5">Required By</span>
                  <span className={`inline-flex items-center gap-1 text-sm font-bold leading-tight ${
                    deadlineStatus.status === 'overdue' ? 'text-red-700' :
                    deadlineStatus.status === 'urgent' ? 'text-amber-700' :
                    deadlineStatus.status === 'completed' ? 'text-green-700' :
                    'text-slate-900'
                  }`}>
                    {formatDateTime(request.required_by)}
                    {/* Surface the latest deadline-edit reason via the same
                        EditedInfoTooltip pattern used for size / address /
                        delivery-method edits. The raw reason text is hidden
                        behind the icon so this block stays compact. */}
                    {request.required_by_edit_reason && (
                      <EditedInfoTooltip
                        label="Reason for deadline change"
                        reason={request.required_by_edit_reason}
                        ariaLabel="View deadline change reason"
                      />
                    )}
                  </span>
                </div>
                {deadlineStatus.label && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                    deadlineStatus.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <AlertCircle className="h-2.5 w-2.5 inline mr-0.5" />
                    {deadlineStatus.label}
                  </span>
                )}
              </div>
              {isCoordinator && request.status !== 'pending_approval' && (
                <button
                  onClick={() => setIsEditRequiredByOpen(true)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors shrink-0"
                  title="Edit deadline"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Deadline History */}
            {request.required_by_history && request.required_by_history.length > 0 && (
              <div className="-mt-2">
                <RequiredByHistory history={request.required_by_history} />
              </div>
            )}

            {/* ── Product Items ── */}
            <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Items</h3>
                  {hasItems && (
                    <span className="text-[11px] text-slate-400 font-medium">
                      {/* Kit feature deprecated — also exclude is_kit parent rows
                          from the displayed count so legacy kit data is hidden. */}
                      ({request.items!.filter(i => !i.kit_id && !i.is_kit).length})
                    </span>
                  )}
                </div>
                <button
                  onClick={async () => {
                    if (!hasItems) return;
                    const allItems = request.items!;
                    // Kit feature deprecated — exclude is_kit parents from the
                    // copy-list output so legacy kits don't appear in pasted text.
                    const topItems = allItems.filter(i => !i.kit_id && !i.is_kit);
                    const sorted = getSortedItems(topItems);
                    const blocks = sorted.map((item, i) => formatItemBlock(item, i + 1, allItems));
                    await navigator.clipboard.writeText(blocks.join('\n\n'));
                    setQualitiesCopied(true);
                    setTimeout(() => setQualitiesCopied(false), 2000);
                  }}
                  className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Copy item list"
                >
                  {qualitiesCopied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {hasItems ? (() => {
                const allItems = request.items!;
                const regularItems = allItems.filter(i => !i.is_kit && !i.kit_id);
                // Kit feature deprecated — kitItems is hard-empty so the kit
                // table rows / mobile kit cards below never render. The kit
                // rendering blocks are kept as dead branches for now; safe to
                // delete once the deprecation has stuck.
                const kitItems: RequestItemDB[] = [];
                const regularCount = regularItems.length;

                const isMagro = request.category === 'magro';
                const sortedItems = getSortedItems(regularItems);
                const magroGroups = isMagro ? getGroupedMagroItems(regularItems) : [];
                const groupStartIndices = magroGroups.reduce<number[]>((acc, _group, i) => {
                  acc.push(i === 0 ? 0 : acc[i - 1] + magroGroups[i - 1].items.length);
                  return acc;
                }, []);

                return (
                  <>
                    {/* DESKTOP TABLE
                        Thickness column was removed in the 2026-06 refactor — the
                        table now has 6 visible columns (#, Quality, Size, Finish, Qty,
                        Img). Group header rows that previously used colSpan={7}
                        were updated to colSpan={6}. */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-b border-slate-100">
                            <TableHead className="w-10 text-[11px] font-medium text-slate-400 uppercase tracking-wider py-2.5">#</TableHead>
                            <TableHead className="text-[11px] font-medium text-slate-400 uppercase tracking-wider py-2.5">Quality</TableHead>
                            <TableHead className="text-[11px] font-medium text-slate-400 uppercase tracking-wider py-2.5">Size</TableHead>
                            <TableHead className="text-[11px] font-medium text-slate-400 uppercase tracking-wider py-2.5">Finish</TableHead>
                            <TableHead className="text-[11px] font-medium text-slate-400 uppercase tracking-wider py-2.5 text-right">Qty</TableHead>
                            <TableHead className="w-10 text-[11px] font-medium text-slate-400 uppercase tracking-wider py-2.5">Img</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isMagro ? (
                            magroGroups.map((group, gi) => {
                              const groupStartIndex = groupStartIndices[gi];
                              return (
                                <React.Fragment key={group.label}>
                                  <TableRow className="hover:bg-transparent border-b-0">
                                    <TableCell colSpan={6} className="py-1.5 px-4">
                                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{group.label}</span>
                                    </TableCell>
                                  </TableRow>
                                  {group.items.map((item, i) => (
                                    <TableRow key={item.id} className="hover:bg-slate-50/50 border-b border-slate-50">
                                      <TableCell className="text-sm font-medium text-slate-400">{groupStartIndex + i + 1}</TableCell>
                                      <TableCell className="text-sm text-slate-900 font-medium">{item.quality}</TableCell>
                                      <TableCell className="text-sm text-slate-600">
                                        <span className="inline-flex items-center gap-1 flex-wrap">
                                          <span>{item.sample_size}</span>
                                          {item.is_size_edited && (
                                            <>
                                              <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100">Edited</span>
                                              {item.size_edit_reason && (
                                                <EditedInfoTooltip
                                                  label="Reason for size change"
                                                  reason={item.size_edit_reason}
                                                  ariaLabel="View reason for size change"
                                                />
                                              )}
                                            </>
                                          )}
                                          {canEditItemSize && (
                                            <button
                                              type="button"
                                              onClick={() => handleStartEditItemSize(item)}
                                              className="ml-0.5 p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                              aria-label="Edit item size"
                                              title="Edit size"
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </button>
                                          )}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-sm text-slate-600">{itemHasFinish(item) && item.finish ? item.finish : '—'}</TableCell>
                                      <TableCell className="text-sm text-slate-900 font-medium text-right">{item.quantity}</TableCell>
                                      <TableCell>
                                        {item.image_url ? (
                                          <button onClick={() => setPreviewImage(item.image_url)} className="h-8 w-8 rounded-md border border-slate-200 overflow-hidden hover:border-indigo-400 transition-colors">
                                            <img src={item.image_url} alt="Ref" className="h-full w-full object-cover" />
                                          </button>
                                        ) : <span className="text-slate-300">—</span>}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </React.Fragment>
                              );
                            })
                          ) : (
                            sortedItems.map((item, index) => (
                              <TableRow key={item.id} className="hover:bg-slate-50/50 border-b border-slate-50">
                                <TableCell className="text-sm font-medium text-slate-400">{index + 1}</TableCell>
                                <TableCell className="text-sm text-slate-900 font-medium">{item.quality}</TableCell>
                                <TableCell className="text-sm text-slate-600">
                                  <span className="inline-flex items-center gap-1 flex-wrap">
                                    <span>{item.sample_size}</span>
                                    {item.is_size_edited && (
                                      <>
                                        <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100">Edited</span>
                                        {item.size_edit_reason && (
                                          <EditedInfoTooltip
                                            label="Reason for size change"
                                            reason={item.size_edit_reason}
                                            ariaLabel="View reason for size change"
                                          />
                                        )}
                                      </>
                                    )}
                                    {canEditItemSize && (
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditItemSize(item)}
                                        className="ml-0.5 p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                        aria-label="Edit item size"
                                        title="Edit size"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    )}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">{item.finish || '—'}</TableCell>
                                <TableCell className="text-sm text-slate-900 font-medium text-right">{item.quantity}</TableCell>
                                <TableCell>
                                  {item.image_url ? (
                                    <button onClick={() => setPreviewImage(item.image_url)} className="h-8 w-8 rounded-md border border-slate-200 overflow-hidden hover:border-indigo-400 transition-colors">
                                      <img src={item.image_url} alt="Ref" className="h-full w-full object-cover" />
                                    </button>
                                  ) : <span className="text-slate-300">—</span>}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                          {/* Kit items (desktop) */}
                          {kitItems.map((kit, ki) => {
                            const children = getKitChildren(allItems, kit.id);
                            const displayNum = regularCount + ki + 1;
                            return (
                              <React.Fragment key={kit.id}>
                                <TableRow className="bg-amber-50/50 hover:bg-amber-50/70 border-b border-amber-100/50">
                                  <TableCell className="text-sm font-medium text-slate-400">{displayNum}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-5 rounded-full bg-amber-400 shrink-0" />
                                      <Package className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                      <span className="text-sm text-amber-900 font-semibold">
                                        {kit.product_type === 'marble' ? 'Marble' : 'Magro'} Kit
                                      </span>
                                      {kit.is_unpacked ? (
                                        <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">Unpacked</span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-semibold">Pending</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-slate-600">{kit.sample_size}</TableCell>
                                  {/* Thickness placeholder cell removed in 2026-06 refactor.
                                      Remaining cells: Finish placeholder, Qty, Actions. */}
                                  <TableCell className="text-sm text-slate-300">—</TableCell>
                                  <TableCell className="text-sm text-slate-900 font-medium text-right">{kit.quantity}</TableCell>
                                  <TableCell>
                                    {isCoordinator && !kit.is_unpacked && (
                                      <Button size="sm" variant="outline" onClick={() => setUnpackKitItem(kit)} className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100">
                                        Unpack
                                      </Button>
                                    )}
                                    {isCoordinator && kit.is_unpacked && request.status === 'pending_approval' && (
                                      <Button size="sm" variant="ghost" onClick={() => handleEditKit(kit)} className="h-7 text-xs text-slate-500 hover:text-amber-700 hover:bg-amber-50">
                                        <Pencil className="h-3 w-3 mr-1" /> Edit
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                                {/* Kit children rows */}
                                {kit.is_unpacked && (() => {
                                  const isMagroKit = kit.product_type === 'magro';
                                  const isGrouped = children.some((c) => c.kit_index != null);

                                  const renderChildRows = (items: RequestItemDB[], indent: number, kitQtyForBreakdown?: number) => {
                                    const subGroups = isMagroKit ? groupBySubCategory(items) : null;
                                    const hasSubGroups = subGroups && (subGroups.length > 1 || (subGroups.length === 1 && subGroups[0].sub_category));

                                    if (hasSubGroups) {
                                      return subGroups!.map((sg) => (
                                        <React.Fragment key={`sub-${sg.sub_category}`}>
                                          <TableRow className="bg-emerald-50/30 hover:bg-emerald-50/30 border-b-0">
                                            <TableCell style={{ paddingLeft: indent }} className="text-sm text-emerald-400"></TableCell>
                                            <TableCell colSpan={5}>
                                              <span className="text-[10px] font-medium text-emerald-600 italic">{sg.label}</span>
                                            </TableCell>
                                          </TableRow>
                                          {sg.items.map((child) => {
                                            const childPerKit = kitQtyForBreakdown && kitQtyForBreakdown > 1
                                              ? Math.round(child.quantity / kitQtyForBreakdown) : null;
                                            return (
                                              <TableRow key={child.id} className="hover:bg-slate-50/50 border-b border-slate-50">
                                                <TableCell style={{ paddingLeft: indent + 16 }} className="text-sm text-slate-300"></TableCell>
                                                <TableCell className="text-sm text-slate-900 font-medium">{child.quality}</TableCell>
                                                <TableCell className="text-sm text-slate-600">{child.sample_size}</TableCell>
                                                <TableCell className="text-sm text-slate-600">{itemHasFinish(child) && child.finish ? child.finish : '—'}</TableCell>
                                                <TableCell className="text-sm text-right">
                                                  <span className="text-slate-900 font-medium">{child.quantity}</span>
                                                  {childPerKit !== null && childPerKit !== child.quantity && (
                                                    <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded bg-slate-50 text-[10px] text-slate-400 font-normal">
                                                      {childPerKit}/kit
                                                    </span>
                                                  )}
                                                </TableCell>
                                                <TableCell>
                                                  {child.image_url ? (
                                                    <button onClick={() => setPreviewImage(child.image_url)} className="h-8 w-8 rounded-md border border-slate-200 overflow-hidden hover:border-indigo-400 transition-colors">
                                                      <img src={child.image_url} alt="Ref" className="h-full w-full object-cover" />
                                                    </button>
                                                  ) : <span className="text-slate-300">—</span>}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </React.Fragment>
                                      ));
                                    }

                                    return items.map((child) => {
                                      const childPerKit = kitQtyForBreakdown && kitQtyForBreakdown > 1
                                        ? Math.round(child.quantity / kitQtyForBreakdown) : null;
                                      return (
                                        <TableRow key={child.id} className="hover:bg-slate-50/50 border-b border-slate-50">
                                          <TableCell style={{ paddingLeft: indent }} className="text-sm text-slate-300">↳</TableCell>
                                          <TableCell className="text-sm text-slate-900 font-medium">{child.quality}</TableCell>
                                          <TableCell className="text-sm text-slate-600">{child.sample_size}</TableCell>
                                          <TableCell className="text-sm text-slate-600">{itemHasFinish(child) && child.finish ? child.finish : '—'}</TableCell>
                                          <TableCell className="text-sm text-right">
                                            <span className="text-slate-900 font-medium">{child.quantity}</span>
                                            {childPerKit !== null && childPerKit !== child.quantity && (
                                              <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded bg-slate-50 text-[10px] text-slate-400 font-normal">
                                                {childPerKit}/kit
                                              </span>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {child.image_url ? (
                                              <button onClick={() => setPreviewImage(child.image_url)} className="h-8 w-8 rounded-md border border-slate-200 overflow-hidden hover:border-indigo-400 transition-colors">
                                                <img src={child.image_url} alt="Ref" className="h-full w-full object-cover" />
                                              </button>
                                            ) : <span className="text-slate-300">—</span>}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    });
                                  };

                                  if (isGrouped) {
                                    const groups = new Map<number, typeof children>();
                                    for (const child of children) {
                                      const idx = child.kit_index ?? 0;
                                      if (!groups.has(idx)) groups.set(idx, []);
                                      groups.get(idx)!.push(child);
                                    }
                                    const sortedKeys = Array.from(groups.keys()).sort((a, b) => a - b);
                                    return sortedKeys.map((kitIdx) => {
                                      const groupChildren = groups.get(kitIdx)!;
                                      return (
                                        <React.Fragment key={`grp-${kitIdx}`}>
                                          <TableRow className="bg-amber-50/30 hover:bg-amber-50/30 border-b-0">
                                            <TableCell className="text-sm text-amber-500 pl-6">↳</TableCell>
                                            <TableCell colSpan={5}>
                                              <span className="text-[11px] font-semibold text-amber-600">Kit {kitIdx + 1}</span>
                                            </TableCell>
                                          </TableRow>
                                          {renderChildRows(groupChildren, 40)}
                                        </React.Fragment>
                                      );
                                    });
                                  }
                                  return renderChildRows(children, 24, kit.quantity);
                                })()}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* MOBILE CARDS */}
                    <div className="md:hidden p-3 space-y-2">
                      {isMagro ? (
                        magroGroups.map((group, gi) => {
                          const groupStartIndex = groupStartIndices[gi];
                          return (
                            <div key={group.label}>
                              <div className="flex items-center gap-2 py-1.5 px-1">
                                <div className="h-px flex-1 bg-slate-200" />
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{group.label}</span>
                                <div className="h-px flex-1 bg-slate-200" />
                              </div>
                              <div className="space-y-1.5">
                                {group.items.map((item, i) => (
                                  <ProductCard key={item.id} item={item} index={groupStartIndex + i + 1} />
                                ))}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        sortedItems.map((item, index) => (
                          <ProductCard key={item.id} item={item} index={index + 1} />
                        ))
                      )}
                      {kitItems.map((kit, ki) => (
                        <ProductCard key={kit.id} item={kit} index={regularCount + ki + 1} />
                      ))}
                    </div>
                  </>
                );
              })() : (
                <div className="p-6 text-center text-slate-400 text-sm">
                  No product items found for this request.
                </div>
              )}
            </div>

            {/* ── Shipping & Logistics ── */}
            <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Shipping</h3>
                </div>
                {isCoordinator && !isSelfPickup && displayAddress && (
                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="h-8 flex items-center gap-1 px-2 rounded-md text-[11px] text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Print</span>
                  </button>
                )}
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {/* Pickup Method */}
                  <div className={isEditingDeliveryMethod ? 'sm:col-span-2' : ''}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pickup Method</span>
                        {!isEditingDeliveryMethod && request.is_delivery_method_edited && (
                          <>
                            <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100">Edited</span>
                            {request.delivery_method_remark && (
                              <EditedInfoTooltip
                                label="Reason for pickup-method change"
                                reason={request.delivery_method_remark}
                                ariaLabel="View pickup-method change reason"
                              />
                            )}
                          </>
                        )}
                      </div>
                      {canEditShipping && !isEditingDeliveryMethod && (
                        <button
                          onClick={handleStartEditDeliveryMethod}
                          className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {isEditingDeliveryMethod ? (
                      <div className="space-y-2.5">
                        <Select value={editedDeliveryMethod} onValueChange={setEditedDeliveryMethod}>
                          <SelectTrigger className="h-9 text-sm border-slate-200">
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
                        {editedDeliveryMethod !== 'self_pickup' && !request.delivery_address && (
                          <div className="space-y-1.5 p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg">
                            <label className="text-[11px] font-medium text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                              <MapPin className="h-3 w-3" />
                              Delivery Address (required)
                            </label>
                            <Textarea
                              value={deliveryMethodAddress}
                              onChange={(e) => setDeliveryMethodAddress(e.target.value)}
                              className="text-sm min-h-[70px] border-amber-300 bg-white focus:border-indigo-500"
                              placeholder="Enter delivery address..."
                            />
                          </div>
                        )}
                        <div>
                          <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            Reason for change <span className="text-red-500">*</span>
                          </Label>
                          <Textarea
                            value={deliveryMethodRemark}
                            onChange={(e) => setDeliveryMethodRemark(e.target.value)}
                            className="text-sm min-h-[50px] border-slate-200 mt-1"
                            placeholder="E.g., Requester requested doorstep delivery."
                            required
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={handleCancelEditDeliveryMethod} disabled={isSavingDeliveryMethod} className="h-8 px-3 text-xs">
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSaveDeliveryMethod} disabled={isSavingDeliveryMethod || !deliveryMethodRemark.trim()} className="h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-xs">
                            {isSavingDeliveryMethod ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-900 font-medium">{formatPickupMethod(request.pickup_responsibility)}</p>
                    )}
                  </div>

                  {/* Delivery Address */}
                  {!isSelfPickup && (
                    <div className={isEditingAddress ? 'sm:col-span-2' : ''}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Delivery Address</span>
                          {!isEditingAddress && request.is_address_edited && displayAddress && (
                            <>
                              <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100">Edited</span>
                              {request.address_edit_remark && (
                                <EditedInfoTooltip
                                  label="Reason for address change"
                                  reason={request.address_edit_remark}
                                  ariaLabel="View address change reason"
                                />
                              )}
                            </>
                          )}
                        </div>
                        {canEditShipping && !isEditingAddress && (
                          <button
                            onClick={handleStartEditAddress}
                            className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {isEditingAddress ? (
                        <div className="space-y-2.5">
                          <Textarea
                            value={editedAddress}
                            onChange={(e) => setEditedAddress(e.target.value)}
                            className="text-sm min-h-[70px] border-slate-200"
                            placeholder="Enter delivery address..."
                          />
                          <div>
                            <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                              Reason for address change <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                              value={addressEditRemark}
                              onChange={(e) => setAddressEditRemark(e.target.value)}
                              className="text-sm min-h-[50px] border-slate-200 mt-1"
                              placeholder="E.g., Client moved to a new site address."
                              required
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSavingAddress} className="h-8 px-3 text-xs">
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleSaveAddress} disabled={isSavingAddress || !addressEditRemark.trim()} className="h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-xs">
                              {isSavingAddress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {displayAddress ? (
                            <p className="text-sm text-slate-700 whitespace-pre-line">{displayAddress}</p>
                          ) : (
                            <div className="flex items-center gap-2 p-2 bg-amber-50/60 border border-amber-200/50 rounded-md">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <p className="text-xs text-amber-600">Address required for shipment</p>
                              {canEditShipping && (
                                <button
                                  onClick={handleStartEditAddress}
                                  className="ml-auto text-[11px] font-medium text-amber-700 hover:text-amber-800 underline underline-offset-2"
                                >
                                  Add
                                </button>
                              )}
                            </div>
                          )}
                          {/* Inline italic reason text was replaced by the
                              EditedInfoTooltip above the address (next to the
                              "Edited" badge) in the 2026-06 refactor. */}
                        </>
                      )}
                    </div>
                  )}

                  {/* Point of Contact */}
                  {request.pickup_responsibility === 'field_boy' && request.delivery_poc_name && (
                    <div className="sm:col-span-2 pt-3 border-t border-slate-100">
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Point of Contact</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-slate-900 font-medium">{request.delivery_poc_name}</p>
                        {request.delivery_poc_contacts && request.delivery_poc_contacts.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {request.delivery_poc_contacts.map((num, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-indigo-50 text-indigo-700">
                                {num}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Unified Details Panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">

              {/* Assigned Maker */}
              {request.maker && (
                <div className="p-4 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-violet-600">
                      {request.maker.full_name?.charAt(0).toUpperCase() || 'M'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider leading-none">Assigned Maker</p>
                    <p className="text-sm font-medium text-slate-900 truncate mt-0.5">{request.maker.full_name}</p>
                  </div>
                </div>
              )}

              {/* Requester */}
              <div className="p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                  <User className="h-3 w-3" />
                  Requester
                </p>
                <p className="text-sm font-medium text-slate-900 mb-2">{request.creator?.full_name || 'Unknown'}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div>
                    <p className="text-[11px] text-slate-400">Department</p>
                    <p className="text-sm text-slate-700 capitalize">{request.department}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Mobile</p>
                    <p className="text-sm text-slate-700">{request.mobile_no}</p>
                  </div>
                </div>
              </div>

              {/* Client */}
              <div className="p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                  <Building className="h-3 w-3" />
                  Client
                </p>
                <div className="space-y-2">
                  {/* Contact name */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-[11px] text-slate-400">
                        {request.client_type === 'retail' && 'Client Name'}
                        {request.client_type === 'architect' && 'Architect Name'}
                        {request.client_type === 'project' && 'Contacted Person'}
                        {(!request.client_type || !['retail', 'architect', 'project'].includes(request.client_type)) && 'Contact Name'}
                      </p>
                      <p className="text-sm text-slate-900 font-medium truncate">{request.client_contact_name}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">Type</p>
                      <p className="text-sm text-slate-700 capitalize">{request.client_type}</p>
                    </div>
                    {request.client_type !== 'retail' && request.firm_name && (
                      <div>
                        <p className="text-[11px] text-slate-400">
                          {request.client_type === 'architect' ? 'Firm' : 'Company'}
                        </p>
                        <p className="text-sm text-slate-700 truncate">{request.firm_name}</p>
                      </div>
                    )}
                  </div>
                  {/* Retail-specific fields */}
                  {request.client_type === 'retail' && (request.supporting_architect_name || request.architect_firm_name) && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-slate-50">
                      {request.supporting_architect_name && (
                        <div>
                          <p className="text-[11px] text-slate-400">Supporting Architect</p>
                          <p className="text-sm text-slate-700 truncate">{request.supporting_architect_name}</p>
                        </div>
                      )}
                      {request.architect_firm_name && (
                        <div>
                          <p className="text-[11px] text-slate-400">Architect Firm</p>
                          <p className="text-sm text-slate-700 truncate">{request.architect_firm_name}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Contact info (hidden from makers & dispatchers) */}
                  {!hideClientContact && (request.client_phone || request.client_email) && (
                    <div className="flex flex-col gap-1 pt-1.5">
                      {request.client_phone && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{request.client_phone}</span>
                        </div>
                      )}
                      {request.client_email && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{request.client_email}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] text-slate-400">Location</p>
                    <p className="text-sm text-slate-700">{request.site_location}</p>
                  </div>
                </div>
              </div>

              {/* Purpose & Packing */}
              <div className="p-4">
                <div className="grid grid-cols-2 gap-x-4">
                  <div>
                    <p className="text-[11px] text-slate-400">Purpose</p>
                    <p className="text-sm text-slate-900 capitalize font-medium">{request.purpose?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Packing</p>
                    <p className="text-sm text-slate-900 capitalize font-medium">{request.packing_details?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Maker actions */}
        {isMaker && request.assigned_to === profile?.id && (
          <MakerActions request={request} userRole={profile?.role || ''} userId={profile?.id || ''} />
        )}
      </main>

      {/* ======== STICKY REQUESTER ACTION BAR ========
          ReceiverActions self-gates on status — it renders nothing
          unless the request is ready+self_pickup or dispatched. So
          mounting it unconditionally for requesters is cheap and
          keeps the visibility logic localised to the component. */}
      {isRequester && <ReceiverActions request={request} />}

      {/* ======== STICKY COORDINATOR ACTION BAR ======== */}
      {isCoordinator && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-20 safe-area-pb">
          <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="hidden sm:flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">Coordinator Actions</p>
                  <p className="text-[11px] text-slate-400">
                    {request.status === 'pending_approval' && 'Review and approve'}
                    {request.status === 'approved' && 'Assign to maker'}
                    {request.status === 'assigned' && 'Start production'}
                    {request.status === 'in_production' && 'Mark as ready'}
                    {request.status === 'ready' && request.pickup_responsibility === 'self_pickup' && 'Awaiting pickup by requester'}
                    {request.status === 'ready' && request.pickup_responsibility === 'field_boy' && 'Awaiting dispatcher pickup'}
                    {request.status === 'ready' && !['self_pickup', 'field_boy'].includes(request.pickup_responsibility) && 'Dispatch sample'}
                    {request.status === 'dispatched' && 'Awaiting requester confirmation'}
                    {!['pending_approval', 'approved', 'ready', 'assigned', 'in_production', 'dispatched'].includes(request.status) && `Status: ${request.status.replace(/_/g, ' ')}`}
                  </p>
                </div>
              </div>
              <div className="flex-1 sm:flex-initial">
                <RequestActions request={request} userRole={profile?.role || ''} isCompact onDeadlineBlock={() => setIsEditRequiredByOpen(true)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======== MODALS ======== */}

      {/* Print Address */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="text-base font-medium text-slate-900">Print Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-slate-500">Font Size</Label>
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
                <Label className="text-[11px] font-medium text-slate-500">Style</Label>
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
              <Label className="text-[11px] font-medium text-slate-500">Preview</Label>
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

      {/* Image Preview */}
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

      {/* Edit Required By */}
      <EditRequiredByModal
        request={request}
        open={isEditRequiredByOpen}
        onOpenChange={setIsEditRequiredByOpen}
      />

      {/* Kit feature deprecated — UnpackKitDialog import was commented out,
          so this block is reduced to a noop that swallows the unpackKitItem
          state reference (keeps noUnusedLocals happy) without ever
          rendering anything. kitItems is hard-empty above, so nothing in
          the page ever calls setUnpackKitItem to flip this on anyway. */}
      {unpackKitItem ? null : null}

      {/* ======== EDIT ITEM SIZE (Coordinator) ========
          Triggered by the Pencil icon next to any item's Size cell.
          Reason is MANDATORY — backend RPC `coordinator_edit_item_size`
          re-validates server-side, so this dialog is the first guard
          rather than the only guard. */}
      <Dialog
        open={!!editingSizeItemId}
        onOpenChange={(o) => { if (!o) handleCancelEditItemSize(); }}
      >
        {/* Centering fix (2026-06-15):
            The base DialogContent uses `fixed left-[50%] translate-x-[-50%] w-full`.
            Adding `mx-4` on top of that shifts the box right on mobile because
            CSS margin still affects the box edge after the translate, breaking
            symmetry. Instead we clamp the width to `100vw - 2rem` so the dialog
            sits exactly 1rem in from both viewport edges, and cap it with
            `max-w-md` so it doesn't grow huge on desktop. `mx-auto` is added
            for belt-and-suspenders. */}
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full sm:max-w-md mx-auto">
          {(() => {
            const editingItem = request?.items?.find((i) => i.id === editingSizeItemId) || null;
            if (!editingItem) return null;

            const cat = editingItem.product_type as RequestCategory;
            const sub = (editingItem.sub_category || '') as SubCategory | '';
            const optionsKey: OptionsKey | null = getOptionsKey(cat, sub);
            const opts = optionsKey ? PRODUCT_SIZE_OPTIONS[optionsKey] : [];

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-indigo-600" />
                    Edit Item Size
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-3">
                  {/* Item context */}
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Item</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5 break-words">
                      {editingItem.quality || '—'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Current size: <span className="font-medium text-slate-700">{editingItem.sample_size}</span>
                    </p>
                  </div>

                  {/* Size select */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      New size <span className="text-red-500">*</span>
                    </Label>
                    {opts.length > 0 ? (
                      <Select value={editingSizeValue} onValueChange={setEditingSizeValue}>
                        <SelectTrigger className="h-10 border-slate-200">
                          <SelectValue placeholder="Choose a new size" />
                        </SelectTrigger>
                        <SelectContent>
                          {opts.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Textarea
                        value={editingSizeValue}
                        onChange={(e) => setEditingSizeValue(e.target.value)}
                        className="text-sm min-h-[40px] border-slate-200"
                        placeholder="Enter new size"
                      />
                    )}
                  </div>

                  {/* Custom size — only when "Other" is picked */}
                  {editingSizeValue === 'Other' && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">
                        Specify custom size <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        value={editingSizeCustom}
                        onChange={(e) => setEditingSizeCustom(e.target.value)}
                        className="text-sm min-h-[40px] border-slate-200"
                        placeholder="E.g., 5x10"
                      />
                    </div>
                  )}

                  {/* Mandatory reason */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      Reason for size change <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      value={editingSizeReason}
                      onChange={(e) => setEditingSizeReason(e.target.value)}
                      className="text-sm min-h-[70px] border-slate-200 resize-none"
                      placeholder="E.g., Out of stock at requested size; substituting nearest available."
                      required
                      autoFocus
                    />
                    <p className="text-[11px] text-slate-500">
                      This reason will be visible to the requester next to the new size.
                    </p>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  {/* Touch-target fix (2026-06-15):
                      Bumped from `h-10` to `min-h-[48px] py-3` so the buttons
                      meet the Material Design 48 dp tap-target guideline (also
                      comfortably above the iOS 44pt minimum). `text-base` and
                      `font-semibold` add visual weight to match the chunky
                      affordance. */}
                  <Button
                    variant="outline"
                    onClick={handleCancelEditItemSize}
                    disabled={editItemSize.isPending}
                    className="min-h-[48px] py-3 px-5 text-base font-semibold flex-1 sm:flex-initial"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleSaveItemSize(editingItem)}
                    disabled={
                      editItemSize.isPending ||
                      !editingSizeReason.trim() ||
                      !((editingSizeValue === 'Other' ? editingSizeCustom : editingSizeValue) || '').trim()
                    }
                    className="min-h-[48px] py-3 px-5 text-base font-semibold flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700"
                  >
                    {editItemSize.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1.5" />
                        Save changes
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
