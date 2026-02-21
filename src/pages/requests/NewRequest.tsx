import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  useRequestWithItems,
  createRequestWithItems,
  updateRequestWithItems,
} from '@/lib/api/requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ChevronLeft, Save, SendHorizontal, Plus, Package, Check, Sparkles, MessageSquare, XCircle, RotateCcw, LogOut, FileText } from 'lucide-react';
import { FormSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';
import ProductItemCard from '@/components/requests/ProductItemCard';
import { SaveTemplateDialog } from '@/components/requests/SaveTemplateDialog';
import { LoadTemplateDrawer } from '@/components/requests/LoadTemplateDrawer';
import { LocationAutocomplete } from '@/components/ui/location-autocomplete';
import DateTimePicker from '@/components/ui/date-time-picker';
import type {
  PickupResponsibility,
  ClientType,
  Purpose,
  PackingType,
  ProductItem,
  CreateRequestItemInput,
  RequestCategory,
} from '@/types';
import {
  PRODUCT_FINISH_OPTIONS,
  PRODUCT_SIZE_OPTIONS,
  PRODUCT_THICKNESS_OPTIONS,
  getOptionsKey,
} from '@/types';

// ============================================================
// TYPES
// ============================================================

// Known client type values — anything else is a custom "Other" entry
const KNOWN_CLIENT_TYPES = ['retail', 'architect', 'project'] as const;

// Known project type values — anything else is a custom "Other" entry
const KNOWN_PROJECT_TYPES = ['hotel', 'resort', 'hospital'] as const;

interface RequestFormData {
  // Section 1: Requester Details
  pickup_responsibility: PickupResponsibility;
  delivery_address?: string;
  required_by: string;
  priority: 'urgent' | 'normal';

  // Section 2: Client Project Details
  client_type: ClientType;
  client_type_custom?: string;  // UI-only: custom text when client_type select = "other"
  client_contact_name: string;  // Dynamic label based on client_type
  client_phone: string;
  client_email?: string;
  firm_name: string;  // Company or firm name
  site_location: string;

  // Dynamic fields based on client_type
  supporting_architect_name?: string;  // For Retail clients
  architect_firm_name?: string;  // For Retail clients
  project_type?: string;  // For Project clients — select value or "other"
  project_type_custom?: string;  // UI-only: custom text when project_type select = "other"
  project_placeholder?: string;  // For Project clients

  // Section 3: Shared Details
  purpose: Purpose;
  packing_details: PackingType;
  packing_remarks?: string;

  // Optional message to coordinator
  requester_message?: string;
}

// ============================================================
// HELPERS
// ============================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Map database errors to user-friendly messages
function getFriendlyErrorMessage(error: any): { title: string; description: string } {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code || '';

  // Check constraint violations
  if (message.includes('valid_product_type') || message.includes('product_type')) {
    return {
      title: 'Invalid Product Type',
      description: 'The selected product type is not valid. Please select a different product type.',
    };
  }

  if (message.includes('valid_quantity') || message.includes('quantity')) {
    return {
      title: 'Invalid Quantity',
      description: 'Quantity must be greater than 0.',
    };
  }

  // Foreign key violations
  if (message.includes('foreign key') || code === '23503') {
    return {
      title: 'Reference Error',
      description: 'A referenced record no longer exists. Please refresh and try again.',
    };
  }

  // Unique constraint violations
  if (message.includes('unique') || code === '23505') {
    return {
      title: 'Duplicate Entry',
      description: 'This record already exists. Please check your entries.',
    };
  }

  // Not null violations
  if (message.includes('not-null') || message.includes('null value') || code === '23502') {
    return {
      title: 'Missing Required Field',
      description: 'A required field is empty. Please fill in all required fields.',
    };
  }

  // Network errors
  if (message.includes('network') || message.includes('fetch')) {
    return {
      title: 'Connection Error',
      description: 'Unable to connect to the server. Please check your internet connection.',
    };
  }

  // RLS policy violations
  if (message.includes('policy') || message.includes('permission')) {
    return {
      title: 'Permission Denied',
      description: 'You do not have permission to perform this action.',
    };
  }

  // Storage errors
  if (message.includes('storage') || message.includes('upload')) {
    return {
      title: 'Image Upload Failed',
      description: 'Failed to upload one or more images. Please try again.',
    };
  }

  // Default fallback
  return {
    title: 'Submission Failed',
    description: 'Something went wrong. Please try again or contact support.',
  };
}

function createEmptyProduct(): ProductItem {
  return {
    id: generateId(),
    category: '',
    sub_category: '',
    selected_qualities: [],
    quality: '', // Legacy field
    sample_size: '',
    sample_size_custom: '',
    thickness: '',
    thickness_custom: '',
    finish: '',
    finish_custom: '',
    quantity: 1,
    image_file: null,
    image_preview: null,
    image_url: null,
  };
}

async function uploadSampleImage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('sample-images')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('sample-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Upload all images in parallel and return a map of index -> url
async function uploadAllImages(
  products: ProductItem[]
): Promise<Map<number, string>> {
  const uploadPromises: Promise<{ index: number; url: string }>[] = [];

  products.forEach((product, index) => {
    if (product.image_file) {
      uploadPromises.push(
        uploadSampleImage(product.image_file).then((url) => ({ index, url }))
      );
    }
  });

  const results = await Promise.all(uploadPromises);
  const urlMap = new Map<number, string>();

  results.forEach(({ index, url }) => {
    urlMap.set(index, url);
  });

  return urlMap;
}

// Convert ProductItem to CreateRequestItemInput (without request_id)
// This is called AFTER exploding batch entries, so each item has exactly one quality
// Hybrid Write: when select = "Other", store the custom text directly in the primary column
function productToItemInput(
  product: ProductItem,
  imageUrl: string | null,
  qualityOverride?: string, // Used when exploding batch entries
): Omit<CreateRequestItemInput, 'request_id'> {
  const optionsKey = getOptionsKey(product.category, product.sub_category);
  const hasFinish = optionsKey !== null && PRODUCT_FINISH_OPTIONS[optionsKey] !== null;

  // Determine the quality value
  let qualityValue: string;
  if (qualityOverride) {
    qualityValue = qualityOverride;
  } else if (product.selected_qualities.length > 0) {
    qualityValue = product.selected_qualities[0];
  } else {
    qualityValue = product.quality;
  }

  // Hybrid Write: resolve "Other" selections to their custom text
  const resolvedSize = product.sample_size === 'Other'
    ? (product.sample_size_custom || '')
    : product.sample_size;

  const resolvedThickness = product.thickness === 'Other'
    ? (product.thickness_custom || '')
    : product.thickness;

  const resolvedFinish = hasFinish
    ? (product.finish === 'Other'
      ? (product.finish_custom || '')
      : product.finish)
    : null;

  return {
    item_index: 0, // Will be set by the API function
    product_type: product.category as RequestCategory,
    sub_category: product.category === 'magro' ? (product.sub_category as any) || null : null,
    quality: qualityValue,
    sample_size: resolvedSize,
    thickness: resolvedThickness,
    finish: resolvedFinish,
    quantity: product.quantity,
    image_url: imageUrl,
  };
}

// ============================================================
// SMART CONSOLIDATION: Merge duplicate items and sum quantities
// ============================================================

type ItemPayload = Omit<CreateRequestItemInput, 'request_id'>;

function consolidateItems(items: ItemPayload[]): ItemPayload[] {
  const map = new Map<string, ItemPayload>();

  for (const item of items) {
    const key = [
      item.product_type,
      (item as any).sub_category ?? '',
      item.quality,
      item.sample_size,
      item.thickness,
      item.finish ?? '',
    ].join('||');

    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      // Keep the image from whichever entry had one
      if (!existing.image_url && item.image_url) {
        existing.image_url = item.image_url;
      }
    } else {
      map.set(key, { ...item });
    }
  }

  // Re-index items sequentially
  return Array.from(map.values()).map((item, i) => ({
    ...item,
    item_index: i,
  }));
}

// ============================================================
// BATCH ENTRY: Explode products with multiple qualities into individual items
// ============================================================
//
// Example: User selects verified ["Statuario", "Michel Angelo"] + custom "MyStone"
// Result: 3 separate items with identical specs but different qualities
// Custom detection: checks if quality exists in the DB list for that product type
//
interface ExplodedItem {
  product: ProductItem;
  quality: string;
  originalIndex: number; // Track which original product this came from (for image URL mapping)
  isFirstFromCard: boolean; // True for only the first item exploded from each card
}

function explodeProducts(products: ProductItem[]): ExplodedItem[] {
  const exploded: ExplodedItem[] = [];

  products.forEach((product, originalIndex) => {
    // Deduplicate selected_qualities (safety net against UI bugs)
    const uniqueQualities = [...new Set(product.selected_qualities)];

    if (uniqueQualities.length > 0) {
      // Unified mode: each selected quality becomes a separate item
      uniqueQualities.forEach((quality, qualityIndex) => {
        exploded.push({
          product,
          quality,
          originalIndex,
          isFirstFromCard: qualityIndex === 0,
        });
      });
    } else if (product.quality) {
      // Legacy fallback: single quality from old format
      exploded.push({
        product,
        quality: product.quality,
        originalIndex,
        isFirstFromCard: true,
      });
    }
  });

  return exploded;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function NewRequest() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: draftId } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Where to go when the user exits the form
  const exitPath = (location.state as any)?.from || '/';
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref to prevent double-submission (belt + suspenders with isSubmitting state)
  const isSubmittingRef = useRef(false);

  // Exit guard — dirty form protection
  const [showExitWarning, setShowExitWarning] = useState(false);
  const allowExitRef = useRef(false); // set true when save/submit succeeds to skip the guard
  const [isSavingFromDialog, setIsSavingFromDialog] = useState(false);

  // Multi-product state
  const [products, setProducts] = useState<ProductItem[]>([createEmptyProduct()]);

  // Use the new hook that fetches request with items
  const { data: existingDraft, isLoading: isDraftLoading } = useRequestWithItems(draftId);
  const isEditMode = !!draftId && (existingDraft?.status === 'draft' || existingDraft?.status === 'rejected');
  const isResubmitMode = !!draftId && existingDraft?.status === 'rejected';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<RequestFormData>({
    defaultValues: {
      priority: 'normal',
    },
  });

  // Watch fields for conditional logic
  const pickupResponsibility = watch('pickup_responsibility');
  const clientType = watch('client_type');
  const packingDetails = watch('packing_details');

  // Load draft data when editing — use reset() for atomic form population
  useEffect(() => {
    if (isEditMode && existingDraft) {
      // Parse required_by safely
      let requiredBy = '';
      try {
        if (existingDraft.required_by) {
          requiredBy = new Date(existingDraft.required_by).toISOString();
        }
      } catch (e) {
        console.warn('[Draft Load] Invalid required_by date:', existingDraft.required_by);
      }

      // Detect hybrid "Other" values for client_type and project_type
      // If the stored value is NOT in the known list, it's a custom entry
      const storedClientType = existingDraft.client_type || '';
      const isCustomClientType = storedClientType && !(KNOWN_CLIENT_TYPES as readonly string[]).includes(storedClientType);

      const storedProjectType = existingDraft.project_type || '';
      const isCustomProjectType = storedProjectType && !(KNOWN_PROJECT_TYPES as readonly string[]).includes(storedProjectType);

      // Atomically reset all form fields at once — avoids race conditions with setValue
      reset({
        // Section 1: Requester Details
        priority: (existingDraft.priority as 'urgent' | 'normal') || 'normal',
        pickup_responsibility: (existingDraft.pickup_responsibility as PickupResponsibility) || undefined,
        delivery_address: existingDraft.delivery_address || '',
        required_by: requiredBy,

        // Section 2: Client Project Details
        // Hybrid read: if custom, set select to "other" and populate custom input
        client_type: isCustomClientType ? 'other' : (storedClientType as ClientType) || undefined,
        client_type_custom: isCustomClientType ? storedClientType : '',
        client_contact_name: existingDraft.client_contact_name || '',
        client_phone: existingDraft.client_phone || '',
        client_email: existingDraft.client_email || '',
        firm_name: existingDraft.firm_name || '',
        site_location: existingDraft.site_location || '',

        // Dynamic client type fields
        supporting_architect_name: existingDraft.supporting_architect_name || '',
        architect_firm_name: existingDraft.architect_firm_name || '',
        // Hybrid read: if custom project type, set select to "other" and populate custom input
        project_type: isCustomProjectType ? 'other' : (storedProjectType || ''),
        project_type_custom: isCustomProjectType ? storedProjectType : '',
        project_placeholder: existingDraft.project_placeholder || '',

        // Section 3: Shared Details
        purpose: (existingDraft.purpose as Purpose) || undefined,
        packing_details: (existingDraft.packing_details as PackingType) || undefined,
        packing_remarks: existingDraft.packing_remarks || '',
        requester_message: existingDraft.requester_message || '',
      });

      // Load items from request_items table (new structure)
      if (existingDraft.items && existingDraft.items.length > 0) {
        const loadedProducts: ProductItem[] = existingDraft.items.map((item) => {
          // Map DB product_type ('marble'|'magro') + sub_category back to UI state
          const category = item.product_type as RequestCategory;
          const sub_category = (item.sub_category || '') as any;

          const optionsKey = getOptionsKey(category, sub_category);
          const hasFinish = optionsKey !== null && PRODUCT_FINISH_OPTIONS[optionsKey] !== null;

          // Hybrid Read: detect custom values by checking against predefined options
          const sizeOptions      = optionsKey ? PRODUCT_SIZE_OPTIONS[optionsKey]      : [];
          const thicknessOptions = optionsKey ? PRODUCT_THICKNESS_OPTIONS[optionsKey] : [];
          const finishOptionsList = optionsKey ? (PRODUCT_FINISH_OPTIONS[optionsKey] ?? []) : [];

          // If the saved value is NOT in the predefined list, it's a custom "Other" entry
          const isCustomSize      = item.sample_size && !sizeOptions.includes(item.sample_size);
          const isCustomThickness = item.thickness && !thicknessOptions.includes(item.thickness);
          const isCustomFinish    = hasFinish && item.finish && !finishOptionsList.includes(item.finish);

          return {
            id: generateId(),
            category,
            sub_category,
            selected_qualities: item.quality ? [item.quality] : [],
            quality: item.quality || '',
            // Hybrid Read: set select to "Other" and populate custom input for non-standard values
            sample_size:        isCustomSize      ? 'Other' : item.sample_size,
            sample_size_custom: isCustomSize      ? item.sample_size : '',
            thickness:          isCustomThickness ? 'Other' : item.thickness,
            thickness_custom:   isCustomThickness ? item.thickness : '',
            finish:             isCustomFinish    ? 'Other' : (hasFinish ? (item.finish || 'Polish') : ''),
            finish_custom:      isCustomFinish    ? item.finish! : '',
            quantity:           item.quantity,
            image_url:          item.image_url,
            image_preview:      item.image_url,
          };
        });
        setProducts(loadedProducts);
      }
    }
  }, [isEditMode, existingDraft, reset]);

  // ============================================================
  // DIRTY FORM PROTECTION — Intercept browser back button
  // ============================================================

  // Check if user has entered any meaningful data
  const hasProductData = products.some(
    (p) => p.category || p.selected_qualities.length > 0 || p.quality
  );
  const isFormDirty = isDirty || hasProductData;

  /** Navigate away — always works regardless of history stack depth */
  const leaveForm = useCallback(() => {
    allowExitRef.current = true;
    navigate(exitPath, { replace: true });
  }, [navigate, exitPath]);

  useEffect(() => {
    // Push a dummy history entry so the browser back button fires popstate
    // instead of actually leaving — we intercept it to show the exit modal.
    window.history.pushState({ formGuard: true }, '');

    const handlePopState = () => {
      if (allowExitRef.current) return;
      if (isFormDirty) {
        // Re-push so URL stays on the form while the modal is shown
        window.history.pushState({ formGuard: true }, '');
        setShowExitWarning(true);
      } else {
        // Form is clean — navigate to explicit exit path
        leaveForm();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isFormDirty, leaveForm]);

  // Handle exit attempt from Cancel / Back buttons
  const handleExitAttempt = useCallback(() => {
    if (isFormDirty) {
      setShowExitWarning(true);
    } else {
      leaveForm();
    }
  }, [isFormDirty, leaveForm]);

  // Exit dialog actions
  const handleExitWithoutSaving = useCallback(() => {
    setShowExitWarning(false);
    leaveForm();
  }, [leaveForm]);

  // handleSaveDraftAndExit — close dialog then trigger the real save (which navigates on success)
  const handleSaveDraftAndExit = useCallback(() => {
    setShowExitWarning(false);
    setIsSavingFromDialog(true);
  }, []);

  const handleKeepEditing = useCallback(() => {
    setShowExitWarning(false);
  }, []);

  // ============================================================
  // PRODUCT MANAGEMENT
  // ============================================================

  const addProduct = () => {
    setProducts([...products, createEmptyProduct()]);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const updateProduct = (index: number, updates: Partial<ProductItem>) => {
    setProducts(products.map((p, i) => (i === index ? { ...p, ...updates } : p)));
  };

  // Load products from a saved template
  const loadFromTemplate = (items: ProductItem[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      // Replace current products with template items
      setProducts(items.length > 0 ? items : [createEmptyProduct()]);
    } else {
      // Append template items to current products
      // Filter out empty products before appending
      const existingValid = products.filter((p) => p.category);
      setProducts([...existingValid, ...items]);
    }
  };

  // ============================================================
  // VALIDATION
  // ============================================================

  const validateProducts = (): string[] => {
    const errors: string[] = [];

    products.forEach((product, index) => {
      const prefix = products.length > 1 ? `Product ${index + 1}: ` : '';

      if (!product.category) {
        errors.push(`${prefix}Category is required`);
      }
      if (product.category === 'magro' && !product.sub_category) {
        errors.push(`${prefix}Sub Category is required for Magro products`);
      }

      // Quality validation: at least one quality must be selected (verified or custom)
      if (!product.selected_qualities || product.selected_qualities.length === 0) {
        // Fallback to legacy quality field for backward compatibility
        if (!product.quality) {
          errors.push(`${prefix}At least one Quality must be selected`);
        }
      }

      if (!product.sample_size) {
        errors.push(`${prefix}Sample Size is required`);
      }
      if (product.sample_size === 'Other' && !product.sample_size_custom) {
        errors.push(`${prefix}Please specify the custom size`);
      }
      if (!product.thickness) {
        errors.push(`${prefix}Thickness is required`);
      }
      if (product.thickness === 'Other' && !product.thickness_custom) {
        errors.push(`${prefix}Please specify the custom thickness`);
      }

      // Finish validation (only for types that have finish)
      const optionsKey = getOptionsKey(product.category, product.sub_category);
      const hasFinish = optionsKey !== null && PRODUCT_FINISH_OPTIONS[optionsKey] !== null;
      if (hasFinish && !product.finish) {
        errors.push(`${prefix}Finish is required`);
      }
      if (product.finish === 'Other' && !product.finish_custom) {
        errors.push(`${prefix}Please specify the custom finish`);
      }

      if (!product.quantity || product.quantity <= 0) {
        errors.push(`${prefix}Quantity must be greater than 0`);
      }
    });

    return errors;
  };

  const validateSubmission = (data: RequestFormData): string[] => {
    const missingFields: string[] = [];

    // Section 1: Requester Details
    if (!profile?.department) missingFields.push('Department');
    if (!profile?.phone) missingFields.push('Mobile Number');
    if (!data.pickup_responsibility) missingFields.push('Pickup Responsibility');
    if (data.pickup_responsibility && data.pickup_responsibility !== 'self_pickup' && !data.delivery_address) {
      missingFields.push('Delivery Address');
    }
    if (!data.required_by) missingFields.push('Required By Date');
    if (!data.priority) missingFields.push('Priority');

    // Section 2: Client Project Details
    if (!data.client_type) missingFields.push('Client Type');
    if (data.client_type === 'other' && !data.client_type_custom) {
      missingFields.push('Client Type (please specify when "Other" is selected)');
    }
    if (!data.client_contact_name) missingFields.push('Contact Name');
    // client_phone is optional, but if provided must be exactly 10 digits
    if (data.client_phone && !/^\d{10}$/.test(data.client_phone)) {
      missingFields.push('Client mobile number must be exactly 10 digits');
    }
    // client_email is optional, but if provided must be valid format
    if (data.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.client_email)) {
      missingFields.push('Client email must be a valid email address');
    }

    // Conditional validation based on client_type
    if (data.client_type === 'retail') {
      // Retail: Company Firm Name is NOT required (replaced by optional architect fields)
    } else {
      // All other types: Company/Firm Name is required
      if (!data.firm_name) {
        missingFields.push(data.client_type === 'architect' ? 'Architect Firm Name' : 'Firm Name');
      }
    }

    // Project-specific validations
    if (data.client_type === 'project') {
      if (!data.project_type) missingFields.push('Type of Project');
      if (data.project_type === 'other' && !data.project_type_custom) {
        missingFields.push('Project Type (please specify when "Other" is selected)');
      }
    }

    if (!data.site_location) missingFields.push('Site Location');

    // Section 3: Shared Details
    if (!data.purpose) missingFields.push('Purpose');
    if (!data.packing_details) missingFields.push('Packing Details');
    if (data.packing_details === 'custom' && !data.packing_remarks) {
      missingFields.push('Packing Remarks (required when "Custom" is selected)');
    }

    // Validate products
    const productErrors = validateProducts();
    missingFields.push(...productErrors);

    return missingFields;
  };

  // ============================================================
  // SAVE AS DRAFT (Parent-Child Structure)
  // ============================================================

  const handleSaveDraft = async () => {
    if (!profile) {
      toast.error('You must be logged in to save a request');
      return;
    }

    // Prevent concurrent draft save + submit
    if (isSubmittingRef.current) {
      console.warn('[NewRequest] Blocked concurrent draft save');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const formValues = watch();

      // Step 1: Upload all images in parallel
      const imageUrlMap = await uploadAllImages(products);

      // Step 2: Explode batch entries into individual items
      const explodedItems = explodeProducts(products);

      // Step 3: Prepare request data (parent)
      // Hybrid Write: when select = "other", store the custom text directly in the primary column
      const resolvedClientType = formValues.client_type === 'other'
        ? (formValues.client_type_custom || null)
        : (formValues.client_type || null);

      const resolvedProjectType = formValues.client_type === 'project' && formValues.project_type === 'other'
        ? (formValues.project_type_custom || null)
        : formValues.client_type === 'project' ? (formValues.project_type || null) : null;

      const requestData = {
        created_by: profile.id,
        status: 'draft',

        // Requester Details
        department: profile.department || null,
        mobile_no: profile.phone || null,
        pickup_responsibility: formValues.pickup_responsibility || null,
        delivery_address: formValues.delivery_address || null,
        required_by: formValues.required_by ? new Date(formValues.required_by).toISOString() : null,
        priority: formValues.priority || null,

        // Client Project Details
        client_type: resolvedClientType,
        client_contact_name: formValues.client_contact_name || null,
        client_phone: formValues.client_phone || null,
        client_email: formValues.client_email || null,
        firm_name: formValues.client_type === 'retail' ? null : (formValues.firm_name || null),
        site_location: formValues.site_location || null,

        // Dynamic client type fields
        supporting_architect_name: formValues.client_type === 'retail' ? (formValues.supporting_architect_name || null) : null,
        architect_firm_name: formValues.client_type === 'retail' ? (formValues.architect_firm_name || null) : null,
        project_type: resolvedProjectType,
        project_placeholder: formValues.client_type === 'project' ? (formValues.project_placeholder || null) : null,

        // Shared Details
        purpose: formValues.purpose || null,
        packing_details: formValues.packing_details || null,
        packing_remarks: formValues.packing_remarks || null,

        // Requester message (optional)
        requester_message: formValues.requester_message || null,
      };

      // Step 5: Prepare items data from exploded entries
      // IMAGE RULE: Only the FIRST item from each batch card gets the image
      const rawItems = explodedItems.map((explodedItem) => {
        const imageUrl = explodedItem.isFirstFromCard
          ? (imageUrlMap.get(explodedItem.originalIndex) || explodedItem.product.image_url || null)
          : null;
        return productToItemInput(
          explodedItem.product,
          imageUrl,
          explodedItem.quality,
        );
      });

      // Step 5b: Smart Consolidation — merge duplicate items, sum quantities
      const itemsData = consolidateItems(rawItems);

      // Step 6: Save using appropriate method
      if (isEditMode && draftId) {
        await updateRequestWithItems(draftId, requestData, itemsData);
        toast.success('Draft updated successfully');
      } else {
        await createRequestWithItems(requestData, itemsData);
        toast.success('Request saved as draft');
      }

      // Invalidate cached data so re-opening this draft shows fresh values
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      if (draftId) {
        queryClient.invalidateQueries({ queryKey: ['request-with-items', draftId] });
        queryClient.invalidateQueries({ queryKey: ['request', draftId] });
        queryClient.invalidateQueries({ queryKey: ['request-items', draftId] });
      }

      allowExitRef.current = true;
      navigate('/requests');
    } catch (error: any) {
      console.error('Error saving draft:', error);
      const friendly = getFriendlyErrorMessage(error);
      toast.error(
        <div>
          <p className="font-semibold">{friendly.title}</p>
          <p className="text-sm mt-1">{friendly.description}</p>
        </div>,
        { duration: 5000 }
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Trigger save when "Save Draft & Exit" is clicked from exit dialog
  useEffect(() => {
    if (isSavingFromDialog) {
      setIsSavingFromDialog(false);
      handleSaveDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSavingFromDialog]);

  // ============================================================
  // SUBMIT REQUEST (Parent-Child Structure)
  // ============================================================

  const handleSubmitRequest = async (data: RequestFormData) => {
    // ========================================
    // GUARD: Prevent double-submission
    // ========================================
    if (isSubmittingRef.current) {
      console.warn('[NewRequest] Blocked duplicate submission attempt');
      return;
    }

    if (!profile) {
      toast.error('You must be logged in to submit a request');
      return;
    }

    // Validate all required fields
    const missingFields = validateSubmission(data);
    if (missingFields.length > 0) {
      toast.error(
        <div>
          <p className="font-semibold mb-2">Please complete all required fields:</p>
          <ul className="list-disc list-inside space-y-1">
            {missingFields.slice(0, 5).map((field, index) => (
              <li key={index} className="text-sm">{field}</li>
            ))}
            {missingFields.length > 5 && (
              <li className="text-sm font-medium">...and {missingFields.length - 5} more</li>
            )}
          </ul>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    // Lock submission immediately (ref for synchronous check, state for UI)
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    // Generate unique submission ID for debugging
    const submissionId = `SUB-${Date.now()}`;
    console.log(`[NewRequest] Starting submission ${submissionId}`);
    console.log(`[NewRequest] Products count: ${products.length}`);
    console.log(`[NewRequest] Products data:`, products.map(p => ({
      category: p.category,
      sub_category: p.sub_category,
      quality: p.quality,
      quantity: p.quantity, // This should be a NUMBER, not causing multiple requests
    })));

    try {
      // Step 1: Upload all images in parallel
      const imageUrlMap = await uploadAllImages(products);

      // Step 2: Detect mixed-category submission
      const marbleProducts = products.filter(p => p.category === 'marble');
      const magroProducts  = products.filter(p => p.category === 'magro');
      const isMixed = marbleProducts.length > 0 && magroProducts.length > 0;

      // Step 3: Prepare shared request data (same for both split requests)
      // Hybrid Write: when select = "other", store the custom text directly in the primary column
      const resolvedClientType = data.client_type === 'other'
        ? (data.client_type_custom || data.client_type)
        : data.client_type;

      const resolvedProjectType = data.client_type === 'project' && data.project_type === 'other'
        ? (data.project_type_custom || data.project_type)
        : data.client_type === 'project' ? (data.project_type || null) : null;

      const requestData = {
        created_by: profile.id,
        status: 'pending_approval',

        // Requester Details
        department: profile.department!,
        mobile_no: profile.phone!,
        pickup_responsibility: data.pickup_responsibility,
        delivery_address: data.pickup_responsibility === 'self_pickup' ? null : data.delivery_address,
        required_by: new Date(data.required_by).toISOString(),
        priority: data.priority,

        // Client Project Details
        client_type: resolvedClientType,
        client_contact_name: data.client_contact_name,
        client_phone: data.client_phone,
        client_email: data.client_email || null,
        firm_name: data.client_type === 'retail' ? null : data.firm_name,
        site_location: data.site_location,

        // Dynamic client type fields
        supporting_architect_name: data.client_type === 'retail' ? (data.supporting_architect_name || null) : null,
        architect_firm_name: data.client_type === 'retail' ? (data.architect_firm_name || null) : null,
        project_type: resolvedProjectType,
        project_placeholder: data.client_type === 'project' ? (data.project_placeholder || null) : null,

        // Shared Details
        purpose: data.purpose,
        packing_details: data.packing_details,
        packing_remarks: data.packing_details === 'custom' ? data.packing_remarks : null,

        // Requester message (optional)
        requester_message: data.requester_message || null,
      };

      // Helper: build consolidated items list for a given subset of product cards
      const buildItemsForProducts = (subset: ProductItem[]) => {
        // Map original indices from the full `products` array for image URL lookup
        const exploded = explodeProducts(subset);
        const rawItems = exploded.map((explodedItem) => {
          // Find original index in the full products array for image URL lookup
          const originalIndex = products.indexOf(explodedItem.product);
          const imageUrl = explodedItem.isFirstFromCard
            ? (imageUrlMap.get(originalIndex) || explodedItem.product.image_url || null)
            : null;
          return productToItemInput(explodedItem.product, imageUrl, explodedItem.quality);
        });
        return consolidateItems(rawItems);
      };

      if (isMixed) {
        // ── SPLIT PATH: Create 2 requests atomically via RPC ──────────────
        console.log(`[NewRequest] ${submissionId} - Mixed categories detected. Splitting into 2 requests.`);

        // If editing an existing draft, delete it first (split replaces one draft with two new requests)
        if (isEditMode && draftId) {
          const { error: deleteError } = await supabase.from('requests').delete().eq('id', draftId);
          if (deleteError) throw deleteError;
        }

        const marbleItems = buildItemsForProducts(marbleProducts);
        const magroItems  = buildItemsForProducts(magroProducts);

        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_split_requests', {
          p_request_data: requestData,
          p_marble_items: marbleItems,
          p_magro_items:  magroItems,
        });
        if (rpcError) throw rpcError;

        toast.success(
          <div>
            <p className="font-semibold">Split into 2 requests!</p>
            <p className="text-sm mt-0.5">
              {rpcResult.marble_number} ({marbleItems.length} Marble item{marbleItems.length > 1 ? 's' : ''})
              {' + '}
              {rpcResult.magro_number} ({magroItems.length} Magro item{magroItems.length > 1 ? 's' : ''})
            </p>
          </div>
        );
      } else {
        // ── SINGLE PATH: One category, one request ────────────────────────
        const explodedItems = explodeProducts(products);
        console.log(`[NewRequest] ${submissionId} - Exploded ${products.length} product cards into ${explodedItems.length} items`);

        const rawItems = explodedItems.map((explodedItem) => {
          const imageUrl = explodedItem.isFirstFromCard
            ? (imageUrlMap.get(explodedItem.originalIndex) || explodedItem.product.image_url || null)
            : null;
          return productToItemInput(explodedItem.product, imageUrl, explodedItem.quality);
        });
        const itemsData = consolidateItems(rawItems);
        const category = (marbleProducts.length > 0 ? 'marble' : 'magro') as RequestCategory;
        const singleRequestData = { ...requestData, category };

        console.log(`[NewRequest] ${submissionId} - Exploded: ${rawItems.length}, Consolidated: ${itemsData.length} items`);

        if (isEditMode && draftId) {
          // For resubmission, clear the old coordinator message
          if (isResubmitMode) {
            (singleRequestData as any).coordinator_message = null;
          }
          console.log(`[NewRequest] ${submissionId} - Updating ${isResubmitMode ? 'rejected' : 'draft'} request ${draftId}`);
          await updateRequestWithItems(draftId, singleRequestData, itemsData);
          toast.success(isResubmitMode
            ? 'Request resubmitted successfully!'
            : 'Draft submitted successfully'
          );
        } else {
          console.log(`[NewRequest] ${submissionId} - Creating new request (single insert)`);
          const result = await createRequestWithItems(singleRequestData, itemsData);
          console.log(`[NewRequest] ${submissionId} - Created request: ${result.request.request_number}`);

          const itemCount = itemsData.length;
          const cardCount = products.length;
          const isBatch = itemCount > cardCount;

          toast.success(
            <div>
              <p className="font-semibold">Request submitted successfully!</p>
              <p className="text-sm">
                Request #{result.request.request_number} with {itemCount} item{itemCount > 1 ? 's' : ''}
                {isBatch && ` (from ${cardCount} product card${cardCount > 1 ? 's' : ''})`}
              </p>
            </div>
          );
        }
      }

      // Invalidate cached data so re-opening this request shows fresh values
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['all-requests-stats'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      if (draftId) {
        queryClient.invalidateQueries({ queryKey: ['request-with-items', draftId] });
        queryClient.invalidateQueries({ queryKey: ['request', draftId] });
        queryClient.invalidateQueries({ queryKey: ['request-items', draftId] });
      }

      allowExitRef.current = true;
      navigate('/requests');
    } catch (error: any) {
      console.error('Error submitting request:', error);
      const friendly = getFriendlyErrorMessage(error);
      toast.error(
        <div>
          <p className="font-semibold">{friendly.title}</p>
          <p className="text-sm mt-1">{friendly.description}</p>
        </div>,
        { duration: 5000 }
      );
    } finally {
      // Reset both the ref and state
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // SECTION COMPLETION TRACKING (for visual progress indicators)
  // ============================================================

  // Section 1: Requester Details - check if essential fields are filled
  const isSection1Complete = Boolean(
    profile?.department &&
    profile?.phone &&
    pickupResponsibility &&
    watch('required_by') &&
    watch('priority') &&
    (pickupResponsibility === 'self_pickup' || watch('delivery_address'))
  );

  // Section 2: Client Project Details - check required fields (with conditional logic)
  const clientContactName = watch('client_contact_name');
  const firmName = watch('firm_name');
  const siteLocation = watch('site_location');
  const projectType = watch('project_type');
  const projectTypeCustom = watch('project_type_custom');
  const clientTypeCustom = watch('client_type_custom');

  const isSection2Complete = Boolean(
    clientType &&
    clientContactName &&
    siteLocation &&
    // Conditional: Firm Name required for non-Retail
    (clientType === 'retail' || firmName) &&
    // Conditional: Custom text required when client type is "Other"
    (clientType !== 'other' || clientTypeCustom) &&
    // Conditional: Project Type required for "Project" client type
    (clientType !== 'project' || projectType) &&
    // Conditional: Project Type Custom required when project_type is "other"
    (clientType !== 'project' || projectType !== 'other' || projectTypeCustom)
  );

  // Section 3: Products - check if all products are valid and shared details filled
  const purpose = watch('purpose');
  const isSection3Complete = Boolean(
    products.length > 0 &&
    products.every(product => {
      const optionsKey = getOptionsKey(product.category, product.sub_category);
      const hasFinish = optionsKey !== null && PRODUCT_FINISH_OPTIONS[optionsKey] !== null;

      // Quality validation: at least one quality selected (verified or custom)
      const hasValidQuality =
        (product.selected_qualities && product.selected_qualities.length > 0) ||
        (product.quality && product.quality !== 'Custom');

      return (
        product.category &&
        (product.category !== 'magro' || product.sub_category) &&
        hasValidQuality &&
        product.sample_size &&
        (product.sample_size !== 'Other' || product.sample_size_custom) &&
        product.thickness &&
        (product.thickness !== 'Other' || product.thickness_custom) &&
        (!hasFinish || product.finish) &&
        (product.finish !== 'Other' || product.finish_custom) &&
        product.quantity > 0
      );
    }) &&
    purpose &&
    packingDetails &&
    (packingDetails !== 'custom' || watch('packing_remarks'))
  );

  // ============================================================
  // LOADING STATES
  // ============================================================

  if (!profile || (draftId && isDraftLoading)) {
    return <FormSkeleton />;
  }

  if (draftId && existingDraft && existingDraft.status !== 'draft' && existingDraft.status !== 'rejected') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Cannot Edit Submitted Request</h2>
            <p className="text-slate-600 mb-6">This request has already been submitted and cannot be edited.</p>
            <Button
              onClick={() => navigate('/requests')}
              className="min-h-[48px] px-6 text-base font-semibold bg-indigo-600 hover:bg-indigo-700"
            >
              Back to Requests
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Clean White Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              onClick={handleExitAttempt}
              className="md:hidden min-h-[44px] px-3 gap-2 text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </Button>
            <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                {isResubmitMode ? 'Edit & Resubmit' : isEditMode ? 'Edit Draft' : 'New Request'}
              </h1>
              <p className="text-sm text-slate-500 hidden sm:block">
                {profile.full_name} | {profile.department}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleExitAttempt}
              className="hidden md:flex min-h-[44px] px-4 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      </header>

      <form onSubmit={(e) => e.preventDefault()} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-8">
        {/* Rejection Reason Alert (Edit & Resubmit mode only) */}
        {isResubmitMode && existingDraft?.coordinator_message && (
          <div className="mb-5 border-2 border-red-300 bg-red-50 rounded-xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-red-800 uppercase tracking-wide">Reason for Rejection</h3>
                <p className="mt-1.5 text-sm text-red-700 leading-relaxed">{existingDraft.coordinator_message}</p>
                <p className="mt-3 text-xs text-red-500">Please address the above feedback, make the necessary changes, and resubmit.</p>
              </div>
            </div>
          </div>
        )}

        <Accordion type="multiple" defaultValue={["section-1", "section-2", "section-3"]} className="space-y-4">
          {/* ============================================================ */}
          {/* SECTION 1: REQUESTER DETAILS */}
          {/* ============================================================ */}
          <AccordionItem value="section-1" className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 text-left">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold text-sm flex-shrink-0 transition-all duration-300 ${
                  isSection1Complete
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 text-white'
                }`}>
                  {isSection1Complete ? <Check className="h-5 w-5" /> : '1'}
                </div>
                <span className="font-bold text-base sm:text-lg text-slate-800">Requester Details</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-5">
              {/* Read-only profile info */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label className="text-indigo-600 font-medium text-xs uppercase tracking-wide">Name</Label>
                    <p className="text-base font-semibold mt-1 text-slate-800">{profile.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-indigo-600 font-medium text-xs uppercase tracking-wide">Department</Label>
                    <p className="text-base font-semibold mt-1 capitalize text-slate-800">{profile.department || 'Not Set'}</p>
                  </div>
                  <div>
                    <Label className="text-indigo-600 font-medium text-xs uppercase tracking-wide">Mobile No</Label>
                    <p className="text-base font-semibold mt-1 text-slate-800">{profile.phone || 'Not Set'}</p>
                  </div>
                </div>
                <p className="text-xs text-indigo-600 mt-3">
                  These details were captured during signup and cannot be changed here.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <Label htmlFor="priority" className="text-slate-700 font-semibold">Priority *</Label>
                  <Controller
                    name="priority"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || 'normal'} onValueChange={field.onChange}>
                        <SelectTrigger className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Required By */}
                <div>
                  <Label className="font-semibold text-slate-700">
                    Required By *
                  </Label>
                  <DateTimePicker
                    value={watch('required_by') || ''}
                    onChange={(v) => setValue('required_by', v)}
                  />
                </div>

                {/* Pickup Responsibility - Restricted options for Requesters */}
                <div>
                  <Label htmlFor="pickup_responsibility" className="text-slate-700 font-semibold">Pickup Responsibility *</Label>
                  <Controller
                    name="pickup_responsibility"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500">
                          <SelectValue placeholder="Select pickup method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="self_pickup">Self Pickup</SelectItem>
                          <SelectItem value="courier">Courier</SelectItem>
                          <SelectItem value="company_vehicle">Company Vehicle</SelectItem>
                          <SelectItem value="field_boy">Field Boy</SelectItem>
                          {/* Note: "3rd Party" and "Other" are restricted to Coordinator only */}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Delivery Address - Hidden for Self Pickup */}
                {pickupResponsibility !== 'self_pickup' && (
                  <div className="md:col-span-2">
                    <Label htmlFor="delivery_address" className="text-slate-700 font-semibold">
                      Full Delivery Address (House No, Street, Landmark, City) *
                    </Label>
                    <Textarea
                      id="delivery_address"
                      {...register('delivery_address')}
                      placeholder="e.g., Plot 45, Sector 56, Near Metro Station, Gurgaon..."
                      rows={3}
                      className="mt-1.5 border-slate-200 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============================================================ */}
          {/* SECTION 2: CLIENT PROJECT DETAILS */}
          {/* ============================================================ */}
          <AccordionItem value="section-2" className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 text-left">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold text-sm flex-shrink-0 transition-all duration-300 ${
                  isSection2Complete
                    ? 'bg-emerald-600 text-white'
                    : 'bg-violet-600 text-white'
                }`}>
                  {isSection2Complete ? <Check className="h-5 w-5" /> : '2'}
                </div>
                <span className="font-bold text-base sm:text-lg text-slate-800">Client Project Details</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Type */}
                <div>
                  <Label htmlFor="client_type" className="text-slate-700 font-semibold">Client Type *</Label>
                  <Controller
                    name="client_type"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500">
                          <SelectValue placeholder="Select client type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="architect">Architect</SelectItem>
                          <SelectItem value="project">Project</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Client Type Custom - Show for "Other" */}
                {clientType === 'other' && (
                  <div>
                    <Label htmlFor="client_type_custom" className="text-slate-700 font-semibold">Specify Client Type *</Label>
                    <Input
                      id="client_type_custom"
                      {...register('client_type_custom')}
                      placeholder="Enter client type"
                      className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {/* PROJECT TYPE FIELDS - Show only for "Project" client type */}
                {clientType === 'project' && (
                  <>
                    <div>
                      <Label htmlFor="project_type" className="text-slate-700 font-semibold">Type of Project *</Label>
                      <Select
                        value={watch('project_type') || ''}
                        onValueChange={(value) => setValue('project_type', value)}
                      >
                        <SelectTrigger className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500">
                          <SelectValue placeholder="Select project type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hotel">Hotel</SelectItem>
                          <SelectItem value="resort">Resort</SelectItem>
                          <SelectItem value="hospital">Hospital</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Project Type - Show only when "Other" is selected */}
                    {watch('project_type') === 'other' && (
                      <div>
                        <Label htmlFor="project_type_custom" className="text-slate-700 font-semibold">Specify Project Type *</Label>
                        <Input
                          id="project_type_custom"
                          {...register('project_type_custom')}
                          placeholder="Enter project type"
                          className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    {/* Project Placeholder */}
                    <div className={watch('project_type') === 'other' ? '' : ''}>
                      <Label htmlFor="project_placeholder" className="text-slate-700 font-semibold">Placeholder</Label>
                      <Input
                        id="project_placeholder"
                        {...register('project_placeholder')}
                        placeholder="Enter placeholder (optional)"
                        className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                      />
                    </div>
                  </>
                )}

                {/* Client/Contacted Person Name - Dynamic label based on client_type */}
                <div>
                  <Label htmlFor="client_contact_name" className={`font-semibold ${errors.client_contact_name ? 'text-red-500' : 'text-slate-700'}`}>
                    {clientType === 'retail' && 'Client Name *'}
                    {clientType === 'architect' && 'Architect Name *'}
                    {clientType === 'project' && 'Contacted Person / Purchase Manager / Builder Name *'}
                    {(!clientType || clientType === 'other') && 'Contact Name *'}
                  </Label>
                  <Input
                    id="client_contact_name"
                    {...register('client_contact_name', { required: 'Contact name is required' })}
                    placeholder={
                      clientType === 'retail' ? 'Enter client name' :
                      clientType === 'architect' ? 'Enter architect name' :
                      clientType === 'project' ? 'Enter contacted person name' :
                      'Enter contact name'
                    }
                    error={!!errors.client_contact_name}
                    className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                  />
                  {errors.client_contact_name && <p className="text-red-500 text-xs mt-1">{errors.client_contact_name.message}</p>}
                </div>

                {/* Mobile (Optional) */}
                <div>
                  <Label htmlFor="client_phone" className="text-slate-700 font-semibold">Mobile</Label>
                  <Input
                    id="client_phone"
                    {...register('client_phone')}
                    placeholder="Enter 10-digit mobile number"
                    inputMode="numeric"
                    maxLength={10}
                    className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Please enter 10 digits only (no country code).</p>
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="client_email" className="text-slate-700 font-semibold">Email</Label>
                  <Input
                    id="client_email"
                    type="email"
                    {...register('client_email')}
                    placeholder="Enter email (optional)"
                    className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                  />
                </div>

                {/* RETAIL SPECIFIC FIELDS - Supporting Architect & Architect Firm (replaces Company Firm) */}
                {clientType === 'retail' && (
                  <>
                    <div>
                      <Label htmlFor="supporting_architect_name" className="text-slate-700 font-semibold">Supporting Architect</Label>
                      <Input
                        id="supporting_architect_name"
                        {...register('supporting_architect_name')}
                        placeholder="Enter architect name (optional)"
                        className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="architect_firm_name" className="text-slate-700 font-semibold">Architect Firm</Label>
                      <Input
                        id="architect_firm_name"
                        {...register('architect_firm_name')}
                        placeholder="Enter architect firm name (optional)"
                        className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                      />
                    </div>
                  </>
                )}

                {/* Firm Name - Hidden for Retail, Label changes for Architect */}
                {clientType !== 'retail' && (
                  <div>
                    <Label htmlFor="firm_name" className={`font-semibold ${errors.firm_name ? 'text-red-500' : 'text-slate-700'}`}>
                      {clientType === 'architect' ? 'Architect Firm Name *' : 'Firm Name *'}
                    </Label>
                    <Input
                      id="firm_name"
                      {...register('firm_name')}
                      placeholder={clientType === 'architect' ? 'Enter architect firm name' : 'Enter firm name'}
                      error={!!errors.firm_name}
                      className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                    />
                    {errors.firm_name && <p className="text-red-500 text-sm mt-1">{errors.firm_name.message}</p>}
                  </div>
                )}

                {/* Site Location - Smart Autocomplete */}
                <div className="md:col-span-2">
                  <Label htmlFor="site_location" className={`font-semibold ${errors.site_location ? 'text-red-500' : 'text-slate-700'}`}>
                    Site Location (City + State) *
                  </Label>
                  <LocationAutocomplete
                    value={siteLocation || ''}
                    onChange={(value) => setValue('site_location', value, { shouldValidate: true })}
                    placeholder="e.g. Mumbai, Maharashtra"
                    error={!!errors.site_location}
                    className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                  />
                  {errors.site_location && <p className="text-red-500 text-xs mt-1">{errors.site_location.message}</p>}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============================================================ */}
          {/* SECTION 3: PRODUCT ITEMS (MULTI-PRODUCT) */}
          {/* ============================================================ */}
          <AccordionItem value="section-3" className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 text-left">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold text-sm flex-shrink-0 transition-all duration-300 ${
                  isSection3Complete
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}>
                  {isSection3Complete ? <Check className="h-5 w-5" /> : '3'}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base sm:text-lg text-slate-800">Products</span>
                  {(() => {
                    // Calculate total items including batch entries
                    const totalItems = products.reduce((sum, p) => {
                      if (p.selected_qualities.length > 0) return sum + p.selected_qualities.length;
                      if (p.quality) return sum + 1;
                      return sum;
                    }, 0);
                    const isBatch = totalItems > products.length;

                    return (
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        isSection3Complete
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {totalItems > 0
                          ? `${totalItems} item${totalItems !== 1 ? 's' : ''}${isBatch ? ` (${products.length} card${products.length !== 1 ? 's' : ''})` : ''}`
                          : `${products.length} card${products.length !== 1 ? 's' : ''}`
                        }
                      </span>
                    );
                  })()}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-5">
              {/* Template Actions - Load from saved buckets */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                <LoadTemplateDrawer
                  onLoadTemplate={loadFromTemplate}
                  hasExistingProducts={products.some((p) => p.category)}
                />
                <SaveTemplateDialog
                  products={products}
                  disabled={isSubmitting}
                />
              </div>

              {/* Mixed-category banner — shown when both Marble and Magro items are present */}
              {(() => {
                const hasMarble = products.some(p => p.category === 'marble');
                const hasMagro  = products.some(p => p.category === 'magro');
                if (!hasMarble || !hasMagro) return null;
                const marbleCount = products.filter(p => p.category === 'marble').length;
                const magroCount  = products.filter(p => p.category === 'magro').length;
                return (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                    <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800">Mixed categories detected</p>
                      <p className="text-amber-700 mt-0.5">
                        This form has {marbleCount} Marble and {magroCount} Magro product{magroCount > 1 ? 's' : ''}.
                        On Submit, they will automatically be created as <strong>2 separate requests</strong>.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Product Cards */}
              <div className="space-y-4">
                {products.map((product, index) => (
                  <ProductItemCard
                    key={product.id}
                    item={product}
                    index={index}
                    canDelete={products.length > 1}
                    onUpdate={updateProduct}
                    onRemove={removeProduct}
                  />
                ))}
              </div>

              {/* Add Product Button */}
              <Button
                type="button"
                variant="outline"
                onClick={addProduct}
                className="w-full mt-4 border-dashed border-2 border-indigo-300 min-h-[56px] py-4 gap-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 font-semibold transition-all"
              >
                <Plus className="h-5 w-5" />
                Add Another Product
              </Button>

              {/* Shared Details Divider */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-indigo-500" />
                  Shared Details (Applied to All Products)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Purpose */}
                  <div>
                    <Label htmlFor="purpose" className="text-slate-700 font-semibold">Purpose of Sample *</Label>
                    <Controller
                      name="purpose"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <SelectTrigger className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500">
                            <SelectValue placeholder="Select purpose" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new_launch">New Launch</SelectItem>
                            <SelectItem value="client_presentation">Client Presentation</SelectItem>
                            <SelectItem value="mock_up">Mock UP</SelectItem>
                            <SelectItem value="approval">Approval</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Packing Details */}
                  <div>
                    <Label htmlFor="packing_details" className="text-slate-700 font-semibold">Packing *</Label>
                    <Controller
                      name="packing_details"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <SelectTrigger className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500">
                            <SelectValue placeholder="Select packing type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="wooden_crate">Wooden Crate</SelectItem>
                            <SelectItem value="cardboard">Cardboard</SelectItem>
                            <SelectItem value="bubble_wrap">Bubble Wrap</SelectItem>
                            <SelectItem value="foam">Foam</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Packing Remarks */}
                  {packingDetails === 'custom' && (
                    <div className="md:col-span-2">
                      <Label htmlFor="packing_remarks" className="text-slate-700 font-semibold">Packing Remarks *</Label>
                      <Textarea
                        id="packing_remarks"
                        {...register('packing_remarks')}
                        placeholder="Specify custom packing requirements"
                        rows={2}
                        className="mt-1.5 border-slate-200 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* ============================================================ */}
        {/* OPTIONAL: Message to Coordinator */}
        {/* ============================================================ */}
        <div className="mt-4 bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <Label htmlFor="requester_message" className="text-slate-800 font-semibold text-base">
                Message to Coordinator
              </Label>
              <p className="text-xs text-slate-500 mt-0.5">
                Add any special instructions or notes for the coordinator (optional)
              </p>
            </div>
          </div>
          <Textarea
            id="requester_message"
            {...register('requester_message')}
            placeholder="e.g., Please pack urgently, Call me before dispatch, Handle with extra care..."
            rows={3}
            className="border-slate-200 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Form Actions - Clean Card at bottom */}
        <div className="mt-8 bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end">
            {/* Cancel Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleExitAttempt}
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[48px] px-6 text-base font-medium border-slate-200 hover:bg-slate-50 transition-all"
            >
              Cancel
            </Button>

            {/* Save Draft Button — hidden in resubmit mode */}
            {!isResubmitMode && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                className="w-full sm:w-auto min-h-[48px] px-6 gap-2 text-base font-medium border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{isEditMode ? 'Updating...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    <span>{isEditMode ? 'Update Draft' : 'Save Draft'}</span>
                  </>
                )}
              </Button>
            )}

            {/* Submit / Resubmit Button - Primary */}
            {(() => {
              // Calculate total item count (accounting for batch entries)
              const totalItemCount = products.reduce((sum, product) => {
                if (product.selected_qualities.length > 0) {
                  return sum + product.selected_qualities.length;
                } else if (product.quality) {
                  return sum + 1;
                }
                return sum;
              }, 0);

              return (
                <Button
                  type="button"
                  onClick={handleSubmit(handleSubmitRequest)}
                  disabled={isSubmitting}
                  className={`w-full sm:w-auto min-h-[48px] px-8 gap-2 text-base font-semibold transition-all ${
                    isResubmitMode
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {isResubmitMode ? 'Resubmitting...' : 'Submitting...'}
                    </>
                  ) : (
                    <>
                      {isResubmitMode ? <RotateCcw className="h-5 w-5" /> : <SendHorizontal className="h-5 w-5" />}
                      <span>
                        {isResubmitMode
                          ? 'Resubmit Request'
                          : totalItemCount > 1
                            ? `Submit (${totalItemCount} items)`
                            : 'Submit Request'
                        }
                      </span>
                    </>
                  )}
                </Button>
              );
            })()}
          </div>
        </div>
      </form>

      {/* Exit Warning Modal */}
      <Dialog open={showExitWarning} onOpenChange={(open) => { if (!open) handleKeepEditing(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved work on this form. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {!isResubmitMode && (
              <Button
                onClick={handleSaveDraftAndExit}
                disabled={isSubmitting}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="h-4 w-4" />
                Save Draft & Exit
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleExitWithoutSaving}
              className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
              Exit Without Saving
            </Button>
            <Button
              variant="ghost"
              onClick={handleKeepEditing}
              className="w-full gap-2 text-slate-600"
            >
              <FileText className="h-4 w-4" />
              Keep Editing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
