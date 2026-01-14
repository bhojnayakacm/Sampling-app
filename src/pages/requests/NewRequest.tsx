import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Loader2, ChevronLeft, Save, SendHorizontal, Plus, Package, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ProductItemCard from '@/components/requests/ProductItemCard';
import { LocationAutocomplete } from '@/components/ui/location-autocomplete';
import type {
  PickupResponsibility,
  ClientType,
  ProductType,
  Purpose,
  PackingType,
  ProductItem,
  CreateRequestItemInput,
} from '@/types';
import { PRODUCT_FINISH_OPTIONS } from '@/types';

// ============================================================
// TYPES
// ============================================================

interface RequestFormData {
  // Section 1: Requester Details
  pickup_responsibility: PickupResponsibility;
  pickup_remarks?: string;
  delivery_address?: string;
  required_by: string;
  priority: 'urgent' | 'normal';

  // Section 2: Client Project Details
  client_type: ClientType;
  client_type_remarks?: string;
  client_project_name: string;
  client_phone: string;
  client_email?: string;
  company_firm_name: string;
  site_location: string;

  // Dynamic fields based on client_type
  supporting_architect_name?: string;  // For Retail clients
  architect_firm_name?: string;  // For Retail clients
  project_type?: string;  // For Project clients
  project_type_custom?: string;  // For Project when "other" selected
  project_placeholder?: string;  // For Project clients

  // Section 3: Shared Details
  purpose: Purpose;
  packing_details: PackingType;
  packing_remarks?: string;
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
    product_type: '',
    quality: '',
    quality_custom: '',
    sample_size: '',
    sample_size_remarks: '',
    thickness: '',
    thickness_remarks: '',
    finish: '',
    finish_remarks: '',
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
function productToItemInput(
  product: ProductItem,
  imageUrl: string | null
): Omit<CreateRequestItemInput, 'request_id'> {
  const hasFinish = product.product_type &&
    PRODUCT_FINISH_OPTIONS[product.product_type as ProductType] !== null;

  return {
    item_index: 0, // Will be set by the API function
    product_type: product.product_type,
    quality: product.quality === 'Custom' ? (product.quality_custom || 'Custom') : product.quality,
    quality_custom: product.quality === 'Custom' ? product.quality_custom : null,
    sample_size: product.sample_size,
    sample_size_remarks: product.sample_size === 'Custom' ? product.sample_size_remarks : null,
    thickness: product.thickness,
    thickness_remarks: product.thickness === 'Custom' ? product.thickness_remarks : null,
    finish: hasFinish ? product.finish : null,
    finish_remarks: (product.finish === 'Custom' || product.finish === 'Customize')
      ? product.finish_remarks
      : null,
    quantity: product.quantity,
    image_url: imageUrl,
  };
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function NewRequest() {
  const navigate = useNavigate();
  const { id: draftId } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref to prevent double-submission (belt + suspenders with isSubmitting state)
  const isSubmittingRef = useRef(false);

  // Multi-product state
  const [products, setProducts] = useState<ProductItem[]>([createEmptyProduct()]);

  // Use the new hook that fetches request with items
  const { data: existingDraft, isLoading: isDraftLoading } = useRequestWithItems(draftId);
  const isEditMode = !!draftId && existingDraft?.status === 'draft';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RequestFormData>({
    defaultValues: {
      priority: 'normal',
    },
  });

  // Watch fields for conditional logic
  const pickupResponsibility = watch('pickup_responsibility');
  const clientType = watch('client_type');
  const packingDetails = watch('packing_details');

  // Load draft data when editing
  useEffect(() => {
    if (isEditMode && existingDraft) {
      // Load form fields
      setValue('client_type', existingDraft.client_type as ClientType);
      setValue('client_type_remarks', existingDraft.client_type_remarks || '');
      setValue('client_project_name', existingDraft.client_project_name);
      setValue('client_phone', existingDraft.client_phone);
      setValue('client_email', existingDraft.client_email || '');
      setValue('company_firm_name', existingDraft.company_firm_name || '');
      setValue('site_location', existingDraft.site_location);

      // Load dynamic client type fields
      setValue('supporting_architect_name', existingDraft.supporting_architect_name || '');
      setValue('architect_firm_name', existingDraft.architect_firm_name || '');
      setValue('project_type', existingDraft.project_type || '');
      setValue('project_type_custom', existingDraft.project_type_custom || '');
      setValue('project_placeholder', existingDraft.project_placeholder || '');
      setValue('priority', existingDraft.priority as 'urgent' | 'normal');
      setValue('required_by', existingDraft.required_by ? new Date(existingDraft.required_by).toISOString().slice(0, 16) : '');
      setValue('pickup_responsibility', existingDraft.pickup_responsibility as PickupResponsibility);
      setValue('pickup_remarks', existingDraft.pickup_remarks || '');
      setValue('delivery_address', existingDraft.delivery_address || '');
      setValue('purpose', existingDraft.purpose as Purpose);
      setValue('packing_details', existingDraft.packing_details as PackingType);
      setValue('packing_remarks', existingDraft.packing_remarks || '');

      // Load items from request_items table (new structure)
      if (existingDraft.items && existingDraft.items.length > 0) {
        const loadedProducts: ProductItem[] = existingDraft.items.map((item) => {
          const productType = item.product_type as ProductType;
          const hasFinish = PRODUCT_FINISH_OPTIONS[productType] !== null;

          return {
            id: generateId(),
            product_type: productType,
            quality: item.quality_custom ? 'Custom' : item.quality,
            quality_custom: item.quality_custom || '',
            sample_size: item.sample_size,
            sample_size_remarks: item.sample_size_remarks || '',
            thickness: item.thickness,
            thickness_remarks: item.thickness_remarks || '',
            finish: hasFinish ? (item.finish || 'Polish') : '',
            finish_remarks: item.finish_remarks || '',
            quantity: item.quantity,
            image_url: item.image_url,
            image_preview: item.image_url,
          };
        });
        setProducts(loadedProducts);
      } else if (existingDraft.product_type) {
        // Backward compatibility: Load from legacy columns
        const productType = existingDraft.product_type as ProductType;
        const hasFinish = PRODUCT_FINISH_OPTIONS[productType] !== null;

        setProducts([{
          id: generateId(),
          product_type: productType,
          quality: existingDraft.quality || '',
          sample_size: existingDraft.sample_size || '',
          sample_size_remarks: existingDraft.sample_size_remarks || '',
          thickness: existingDraft.thickness || '',
          thickness_remarks: existingDraft.thickness_remarks || '',
          finish: hasFinish ? (existingDraft.finish || 'Polish') : '',
          finish_remarks: existingDraft.finish_remarks || '',
          quantity: existingDraft.quantity || 1,
          image_url: existingDraft.image_url,
          image_preview: existingDraft.image_url,
        }]);
      }
    }
  }, [isEditMode, existingDraft, setValue]);

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

  // ============================================================
  // VALIDATION
  // ============================================================

  const validateProducts = (): string[] => {
    const errors: string[] = [];

    products.forEach((product, index) => {
      const prefix = products.length > 1 ? `Product ${index + 1}: ` : '';

      if (!product.product_type) {
        errors.push(`${prefix}Product Type is required`);
      }
      if (!product.quality) {
        errors.push(`${prefix}Quality is required`);
      }
      if (product.quality === 'Custom' && !product.quality_custom) {
        errors.push(`${prefix}Custom Quality text is required`);
      }
      if (!product.sample_size) {
        errors.push(`${prefix}Sample Size is required`);
      }
      if (product.sample_size === 'Custom' && !product.sample_size_remarks) {
        errors.push(`${prefix}Size Remarks is required for custom size`);
      }
      if (!product.thickness) {
        errors.push(`${prefix}Thickness is required`);
      }
      if (product.thickness === 'Custom' && !product.thickness_remarks) {
        errors.push(`${prefix}Thickness Remarks is required for custom thickness`);
      }

      // Finish validation (only for marble/tile)
      const hasFinish = product.product_type && PRODUCT_FINISH_OPTIONS[product.product_type as ProductType] !== null;
      if (hasFinish && !product.finish) {
        errors.push(`${prefix}Finish is required`);
      }
      if ((product.finish === 'Custom' || product.finish === 'Customize') && !product.finish_remarks) {
        errors.push(`${prefix}Finish Remarks is required for custom finish`);
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
    if (data.pickup_responsibility === 'other' && !data.pickup_remarks) {
      missingFields.push('Pickup Remarks (required when "Other" is selected)');
    }
    if (data.pickup_responsibility && data.pickup_responsibility !== 'self_pickup' && !data.delivery_address) {
      missingFields.push('Delivery Address');
    }
    if (!data.required_by) missingFields.push('Required By Date');
    if (!data.priority) missingFields.push('Priority');

    // Section 2: Client Project Details
    if (!data.client_type) missingFields.push('Client Type');
    if (data.client_type === 'others' && !data.client_type_remarks) {
      missingFields.push('Client Type Remarks (required when "Others" is selected)');
    }
    if (!data.client_project_name) missingFields.push('Client/Project Name');
    // client_phone is now optional

    // Conditional validation based on client_type
    if (data.client_type === 'retail') {
      // Retail: Company Firm Name is NOT required (replaced by optional architect fields)
    } else {
      // All other types: Company/Firm Name is required
      if (!data.company_firm_name) {
        missingFields.push(data.client_type === 'architect' ? 'Architect Firm Name' : 'Company/Firm Name');
      }
    }

    // Project-specific validations
    if (data.client_type === 'project') {
      if (!data.project_type) missingFields.push('Type of Project');
      if (data.project_type === 'other' && !data.project_type_custom) {
        missingFields.push('Project Type (specify "Other")');
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

    setIsSubmitting(true);

    try {
      const formValues = watch();

      // Step 1: Upload all images in parallel
      const imageUrlMap = await uploadAllImages(products);

      // Step 2: Prepare request data (parent)
      const requestData = {
        created_by: profile.id,
        status: 'draft',

        // Requester Details
        department: profile.department || null,
        mobile_no: profile.phone || null,
        pickup_responsibility: formValues.pickup_responsibility || null,
        pickup_remarks: formValues.pickup_remarks || null,
        delivery_address: formValues.delivery_address || null,
        required_by: formValues.required_by ? new Date(formValues.required_by).toISOString() : null,
        priority: formValues.priority || null,

        // Client Project Details
        client_type: formValues.client_type || null,
        client_type_remarks: formValues.client_type_remarks || null,
        client_project_name: formValues.client_project_name || null,
        client_phone: formValues.client_phone || null,
        client_email: formValues.client_email || null,
        company_firm_name: formValues.client_type === 'retail' ? null : (formValues.company_firm_name || null),
        site_location: formValues.site_location || null,

        // Dynamic client type fields
        supporting_architect_name: formValues.client_type === 'retail' ? (formValues.supporting_architect_name || null) : null,
        architect_firm_name: formValues.client_type === 'retail' ? (formValues.architect_firm_name || null) : null,
        project_type: formValues.client_type === 'project' ? (formValues.project_type || null) : null,
        project_type_custom: formValues.client_type === 'project' && formValues.project_type === 'other' ? (formValues.project_type_custom || null) : null,
        project_placeholder: formValues.client_type === 'project' ? (formValues.project_placeholder || null) : null,

        // Shared Details
        purpose: formValues.purpose || null,
        packing_details: formValues.packing_details || null,
        packing_remarks: formValues.packing_remarks || null,

        // Legacy columns (set to first product for backward compatibility)
        product_type: products[0]?.product_type || null,
        quality: products[0]?.quality === 'Custom' ? products[0]?.quality_custom : products[0]?.quality || null,
        sample_size: products[0]?.sample_size || null,
        thickness: products[0]?.thickness || null,
        finish: products[0]?.finish || null,
        quantity: products[0]?.quantity || null,
        image_url: imageUrlMap.get(0) || products[0]?.image_url || null,
      };

      // Step 3: Prepare items data (children)
      const itemsData = products.map((product, index) => {
        const imageUrl = imageUrlMap.get(index) || product.image_url || null;
        return productToItemInput(product, imageUrl);
      });

      // Step 4: Save using appropriate method
      if (isEditMode && draftId) {
        await updateRequestWithItems(draftId, requestData, itemsData);
        toast.success('Draft updated successfully');
      } else {
        await createRequestWithItems(requestData, itemsData);
        toast.success('Request saved as draft');
      }

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
      setIsSubmitting(false);
    }
  };

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
      type: p.product_type,
      quality: p.quality,
      quantity: p.quantity, // This should be a NUMBER, not causing multiple requests
    })));

    try {
      // Step 1: Upload all images in parallel
      const imageUrlMap = await uploadAllImages(products);

      // Step 2: Prepare request data (parent - EXACTLY ONE request)
      const requestData = {
        created_by: profile.id,
        status: 'pending_approval',

        // Requester Details
        department: profile.department!,
        mobile_no: profile.phone!,
        pickup_responsibility: data.pickup_responsibility,
        pickup_remarks: data.pickup_responsibility === 'other' ? data.pickup_remarks : null,
        delivery_address: data.pickup_responsibility === 'self_pickup' ? null : data.delivery_address,
        required_by: new Date(data.required_by).toISOString(),
        priority: data.priority,

        // Client Project Details
        client_type: data.client_type,
        client_type_remarks: data.client_type === 'others' ? data.client_type_remarks : null,
        client_project_name: data.client_project_name,
        client_phone: data.client_phone,
        client_email: data.client_email || null,
        company_firm_name: data.client_type === 'retail' ? null : data.company_firm_name,
        site_location: data.site_location,

        // Dynamic client type fields
        supporting_architect_name: data.client_type === 'retail' ? (data.supporting_architect_name || null) : null,
        architect_firm_name: data.client_type === 'retail' ? (data.architect_firm_name || null) : null,
        project_type: data.client_type === 'project' ? (data.project_type || null) : null,
        project_type_custom: data.client_type === 'project' && data.project_type === 'other' ? (data.project_type_custom || null) : null,
        project_placeholder: data.client_type === 'project' ? (data.project_placeholder || null) : null,

        // Shared Details
        purpose: data.purpose,
        packing_details: data.packing_details,
        packing_remarks: data.packing_details === 'custom' ? data.packing_remarks : null,

        // Legacy columns (set to first product for backward compatibility)
        product_type: products[0]?.product_type || null,
        quality: products[0]?.quality === 'Custom' ? products[0]?.quality_custom : products[0]?.quality || null,
        sample_size: products[0]?.sample_size || null,
        thickness: products[0]?.thickness || null,
        finish: products[0]?.finish || null,
        quantity: products[0]?.quantity || null,
        image_url: imageUrlMap.get(0) || products[0]?.image_url || null,
      };

      // Step 3: Prepare items data (ONE item per product card, quantity is just a field value)
      const itemsData = products.map((product, index) => {
        const imageUrl = imageUrlMap.get(index) || product.image_url || null;
        return productToItemInput(product, imageUrl);
      });

      console.log(`[NewRequest] ${submissionId} - Items to insert: ${itemsData.length}`);
      console.log(`[NewRequest] ${submissionId} - Item quantities:`, itemsData.map(i => i.quantity));

      // Step 4: Create or update - CALLED EXACTLY ONCE
      if (isEditMode && draftId) {
        console.log(`[NewRequest] ${submissionId} - Updating draft ${draftId}`);
        await updateRequestWithItems(draftId, requestData, itemsData);
        toast.success('Draft submitted successfully');
      } else {
        console.log(`[NewRequest] ${submissionId} - Creating new request (single insert)`);
        const result = await createRequestWithItems(requestData, itemsData);
        console.log(`[NewRequest] ${submissionId} - Created request: ${result.request.request_number}`);
        toast.success(
          <div>
            <p className="font-semibold">Request submitted successfully!</p>
            <p className="text-sm">
              Request #{result.request.request_number} with {products.length} product{products.length > 1 ? 's' : ''}
            </p>
          </div>
        );
      }

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
    (pickupResponsibility === 'self_pickup' || watch('delivery_address')) &&
    (pickupResponsibility !== 'other' || watch('pickup_remarks'))
  );

  // Section 2: Client Project Details - check required fields (with conditional logic)
  const clientProjectName = watch('client_project_name');
  const companyFirmName = watch('company_firm_name');
  const siteLocation = watch('site_location');
  const projectType = watch('project_type');
  const projectTypeCustom = watch('project_type_custom');

  const isSection2Complete = Boolean(
    clientType &&
    clientProjectName &&
    siteLocation &&
    // Conditional: Company Firm Name required for non-Retail
    (clientType === 'retail' || companyFirmName) &&
    // Conditional: Client Type Remarks required for "Others"
    (clientType !== 'others' || watch('client_type_remarks')) &&
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
      const hasFinish = product.product_type && PRODUCT_FINISH_OPTIONS[product.product_type as ProductType] !== null;
      return (
        product.product_type &&
        product.quality &&
        (product.quality !== 'Custom' || product.quality_custom) &&
        product.sample_size &&
        (product.sample_size !== 'Custom' || product.sample_size_remarks) &&
        product.thickness &&
        (product.thickness !== 'Custom' || product.thickness_remarks) &&
        (!hasFinish || product.finish) &&
        ((product.finish !== 'Custom' && product.finish !== 'Customize') || product.finish_remarks) &&
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
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-slate-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (draftId && existingDraft && existingDraft.status !== 'draft') {
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
              onClick={() => navigate('/requests')}
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
                {isEditMode ? 'Edit Draft' : 'New Request'}
              </h1>
              <p className="text-sm text-slate-500 hidden sm:block">
                {profile.full_name} | {profile.department}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/requests')}
              className="hidden md:flex min-h-[44px] px-4 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      </header>

      <form onSubmit={(e) => e.preventDefault()} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-8">
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
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
                  <Select onValueChange={(value) => setValue('priority', value as 'urgent' | 'normal')} defaultValue="normal">
                    <SelectTrigger className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Required By */}
                <div>
                  <Label htmlFor="required_by" className={`font-semibold ${errors.required_by ? 'text-red-500' : 'text-slate-700'}`}>
                    Required By *
                  </Label>
                  <Input
                    id="required_by"
                    type="datetime-local"
                    {...register('required_by', { required: 'Required by date is required' })}
                    error={!!errors.required_by}
                    className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                  />
                  {errors.required_by && <p className="text-red-500 text-xs mt-1">{errors.required_by.message}</p>}
                </div>

                {/* Pickup Responsibility - Restricted options for Requesters */}
                <div>
                  <Label htmlFor="pickup_responsibility" className="text-slate-700 font-semibold">Pickup Responsibility *</Label>
                  <Select onValueChange={(value) => setValue('pickup_responsibility', value as PickupResponsibility)}>
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
                </div>

                {/* Pickup Remarks */}
                {pickupResponsibility === 'other' && (
                  <div>
                    <Label htmlFor="pickup_remarks" className="text-slate-700 font-semibold">Pickup Remarks *</Label>
                    <Input
                      id="pickup_remarks"
                      {...register('pickup_remarks')}
                      placeholder="Please specify pickup method"
                      className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {/* Delivery Address - Hidden for Self Pickup */}
                {pickupResponsibility !== 'self_pickup' && (
                  <div className="md:col-span-2">
                    <Label htmlFor="delivery_address" className="text-slate-700 font-semibold">Delivery Address *</Label>
                    <Textarea
                      id="delivery_address"
                      {...register('delivery_address')}
                      placeholder="Enter delivery address"
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
                  <Select
                    value={clientType || ''}
                    onValueChange={(value) => setValue('client_type', value as ClientType)}
                  >
                    <SelectTrigger className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500">
                      <SelectValue placeholder="Select client type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="architect">Architect</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Client Type Remarks - Show for "Others" */}
                {clientType === 'others' && (
                  <div>
                    <Label htmlFor="client_type_remarks" className="text-slate-700 font-semibold">Client Type Remarks *</Label>
                    <Input
                      id="client_type_remarks"
                      {...register('client_type_remarks')}
                      placeholder="Please specify client type"
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

                {/* Client/Contacted Person Name */}
                <div>
                  <Label htmlFor="client_project_name" className={`font-semibold ${errors.client_project_name ? 'text-red-500' : 'text-slate-700'}`}>
                    Client/Architect/Contacted Person Name *
                  </Label>
                  <Input
                    id="client_project_name"
                    {...register('client_project_name', { required: 'Client/Project name is required' })}
                    placeholder="Enter name"
                    error={!!errors.client_project_name}
                    className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                  />
                  {errors.client_project_name && <p className="text-red-500 text-xs mt-1">{errors.client_project_name.message}</p>}
                </div>

                {/* Mobile (Optional) */}
                <div>
                  <Label htmlFor="client_phone" className="text-slate-700 font-semibold">Mobile</Label>
                  <Input
                    id="client_phone"
                    {...register('client_phone')}
                    placeholder="Enter mobile number (optional)"
                    className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                  />
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

                {/* Company Firm Name - Hidden for Retail, Label changes for Architect */}
                {clientType !== 'retail' && (
                  <div>
                    <Label htmlFor="company_firm_name" className={`font-semibold ${errors.company_firm_name ? 'text-red-500' : 'text-slate-700'}`}>
                      {clientType === 'architect' ? 'Architect Firm Name *' : 'Company Firm Name *'}
                    </Label>
                    <Input
                      id="company_firm_name"
                      {...register('company_firm_name', { required: clientType !== 'retail' ? 'Firm name is required' : false })}
                      placeholder={clientType === 'architect' ? 'Enter architect firm name' : 'Enter firm name'}
                      error={!!errors.company_firm_name}
                      className="mt-1.5 h-12 border-slate-200 focus:ring-indigo-500"
                    />
                    {errors.company_firm_name && <p className="text-red-500 text-sm mt-1">{errors.company_firm_name.message}</p>}
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
                    placeholder="Start typing to search cities..."
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
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base sm:text-lg text-slate-800">Products</span>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                    isSection3Complete
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {products.length} {products.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-5">
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
                    <Select onValueChange={(value) => setValue('purpose', value as Purpose)}>
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
                  </div>

                  {/* Packing Details */}
                  <div>
                    <Label htmlFor="packing_details" className="text-slate-700 font-semibold">Packing *</Label>
                    <Select onValueChange={(value) => setValue('packing_details', value as PackingType)}>
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

        {/* Form Actions - Clean Card at bottom */}
        <div className="mt-8 bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end">
            {/* Cancel Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/requests')}
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[48px] px-6 text-base font-medium border-slate-200 hover:bg-slate-50 transition-all"
            >
              Cancel
            </Button>

            {/* Save Draft Button */}
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

            {/* Submit Button - Primary */}
            <Button
              type="button"
              onClick={handleSubmit(handleSubmitRequest)}
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[48px] px-8 gap-2 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <SendHorizontal className="h-5 w-5" />
                  <span>Submit {products.length > 1 ? `(${products.length} items)` : 'Request'}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
