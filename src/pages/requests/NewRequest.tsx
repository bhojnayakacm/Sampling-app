import { useState, useEffect } from 'react';
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
import { Loader2, ChevronLeft, Save, SendHorizontal, Plus, Package } from 'lucide-react';
import { toast } from 'sonner';
import ProductItemCard from '@/components/requests/ProductItemCard';
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
      setValue('company_firm_name', existingDraft.company_firm_name);
      setValue('site_location', existingDraft.site_location);
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
    if (!data.client_phone) missingFields.push('Client Phone');
    if (!data.company_firm_name) missingFields.push('Company/Firm Name');
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
        company_firm_name: formValues.company_firm_name || null,
        site_location: formValues.site_location || null,

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
      toast.error(error.message || 'Failed to save draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // SUBMIT REQUEST (Parent-Child Structure)
  // ============================================================

  const handleSubmitRequest = async (data: RequestFormData) => {
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

    setIsSubmitting(true);

    try {
      // Step 1: Upload all images in parallel
      const imageUrlMap = await uploadAllImages(products);

      // Step 2: Prepare request data (parent - ONE request ID)
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
        company_firm_name: data.company_firm_name,
        site_location: data.site_location,

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

      // Step 3: Prepare items data (children - ALL products)
      const itemsData = products.map((product, index) => {
        const imageUrl = imageUrlMap.get(index) || product.image_url || null;
        return productToItemInput(product, imageUrl);
      });

      // Step 4: Create or update using transactional API
      if (isEditMode && draftId) {
        await updateRequestWithItems(draftId, requestData, itemsData);
        toast.success('Draft submitted successfully');
      } else {
        const result = await createRequestWithItems(requestData, itemsData);
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
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // LOADING STATES
  // ============================================================

  if (!profile || (draftId && isDraftLoading)) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (draftId && existingDraft && existingDraft.status !== 'draft') {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Cannot Edit Submitted Request</h2>
          <p className="text-gray-600 mb-6">This request has already been submitted and cannot be edited.</p>
          <Button onClick={() => navigate('/requests')}>Back to Requests</Button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-Optimized Header */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/requests')}
              className="md:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold truncate">
                {isEditMode ? 'Edit Draft' : 'New Request'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                {profile.full_name} | {profile.department}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/requests')}
              className="hidden md:flex"
            >
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
          <AccordionItem value="section-1" className="border rounded-lg bg-white">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold text-sm flex-shrink-0">
                  1
                </div>
                <span className="font-semibold text-base sm:text-lg">Requester Details</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-4">
              {/* Read-only profile info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-700">Name</Label>
                    <p className="text-base font-medium mt-1">{profile.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-700">Department</Label>
                    <p className="text-base font-medium mt-1 capitalize">{profile.department || 'Not Set'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-700">Mobile No</Label>
                    <p className="text-base font-medium mt-1">{profile.phone || 'Not Set'}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  These details were captured during signup and cannot be changed here.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <Label htmlFor="priority">Priority *</Label>
                  <Select onValueChange={(value) => setValue('priority', value as 'urgent' | 'normal')} defaultValue="normal">
                    <SelectTrigger>
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
                  <Label htmlFor="required_by">Required By *</Label>
                  <Input
                    id="required_by"
                    type="datetime-local"
                    {...register('required_by', { required: 'Required by date is required' })}
                  />
                  {errors.required_by && <p className="text-red-500 text-sm mt-1">{errors.required_by.message}</p>}
                </div>

                {/* Pickup Responsibility */}
                <div>
                  <Label htmlFor="pickup_responsibility">Pickup Responsibility *</Label>
                  <Select onValueChange={(value) => setValue('pickup_responsibility', value as PickupResponsibility)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pickup method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self_pickup">Self Pickup</SelectItem>
                      <SelectItem value="courier">Courier</SelectItem>
                      <SelectItem value="company_vehicle">Company Vehicle</SelectItem>
                      <SelectItem value="3rd_party">3rd Party</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pickup Remarks */}
                {pickupResponsibility === 'other' && (
                  <div>
                    <Label htmlFor="pickup_remarks">Pickup Remarks *</Label>
                    <Input
                      id="pickup_remarks"
                      {...register('pickup_remarks')}
                      placeholder="Please specify pickup method"
                    />
                  </div>
                )}

                {/* Delivery Address */}
                <div className="md:col-span-2">
                  <Label htmlFor="delivery_address">
                    Delivery Address {pickupResponsibility !== 'self_pickup' && '*'}
                  </Label>
                  <Textarea
                    id="delivery_address"
                    {...register('delivery_address')}
                    placeholder={pickupResponsibility === 'self_pickup' ? 'Not required for self pickup' : 'Enter delivery address'}
                    rows={3}
                    disabled={pickupResponsibility === 'self_pickup'}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============================================================ */}
          {/* SECTION 2: CLIENT PROJECT DETAILS */}
          {/* ============================================================ */}
          <AccordionItem value="section-2" className="border rounded-lg bg-white">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 font-semibold text-sm flex-shrink-0">
                  2
                </div>
                <span className="font-semibold text-base sm:text-lg">Client Project Details</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Type */}
                <div>
                  <Label htmlFor="client_type">Client Type *</Label>
                  <Select onValueChange={(value) => setValue('client_type', value as ClientType)}>
                    <SelectTrigger>
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

                {/* Client Type Remarks */}
                {clientType === 'others' && (
                  <div>
                    <Label htmlFor="client_type_remarks">Client Type Remarks *</Label>
                    <Input
                      id="client_type_remarks"
                      {...register('client_type_remarks')}
                      placeholder="Please specify client type"
                    />
                  </div>
                )}

                {/* Client/Project Name */}
                <div>
                  <Label htmlFor="client_project_name">Client/Architect/Project Name *</Label>
                  <Input
                    id="client_project_name"
                    {...register('client_project_name', { required: 'Client/Project name is required' })}
                    placeholder="Enter name"
                  />
                  {errors.client_project_name && <p className="text-red-500 text-sm mt-1">{errors.client_project_name.message}</p>}
                </div>

                {/* Mobile */}
                <div>
                  <Label htmlFor="client_phone">Mobile *</Label>
                  <Input
                    id="client_phone"
                    {...register('client_phone', { required: 'Mobile number is required' })}
                    placeholder="Enter mobile number"
                  />
                  {errors.client_phone && <p className="text-red-500 text-sm mt-1">{errors.client_phone.message}</p>}
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="client_email">Email</Label>
                  <Input
                    id="client_email"
                    type="email"
                    {...register('client_email')}
                    placeholder="Enter email (optional)"
                  />
                </div>

                {/* Company Firm Name */}
                <div>
                  <Label htmlFor="company_firm_name">Company Firm Name *</Label>
                  <Input
                    id="company_firm_name"
                    {...register('company_firm_name', { required: 'Company firm name is required' })}
                    placeholder="Enter firm name"
                  />
                  {errors.company_firm_name && <p className="text-red-500 text-sm mt-1">{errors.company_firm_name.message}</p>}
                </div>

                {/* Site Location */}
                <div className="md:col-span-2">
                  <Label htmlFor="site_location">Site Location (City + State) *</Label>
                  <Input
                    id="site_location"
                    {...register('site_location', { required: 'Site location is required' })}
                    placeholder="e.g., Mumbai, Maharashtra"
                  />
                  {errors.site_location && <p className="text-red-500 text-sm mt-1">{errors.site_location.message}</p>}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============================================================ */}
          {/* SECTION 3: PRODUCT ITEMS (MULTI-PRODUCT) */}
          {/* ============================================================ */}
          <AccordionItem value="section-3" className="border rounded-lg bg-white">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 font-semibold text-sm flex-shrink-0">
                  3
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base sm:text-lg">Products</span>
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                    {products.length} {products.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-4">
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
                className="w-full mt-4 border-dashed border-2 h-12 gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Another Product
              </Button>

              {/* Shared Details Divider */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Shared Details (Applied to All Products)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Purpose */}
                  <div>
                    <Label htmlFor="purpose">Purpose of Sample *</Label>
                    <Select onValueChange={(value) => setValue('purpose', value as Purpose)}>
                      <SelectTrigger>
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
                    <Label htmlFor="packing_details">Packing *</Label>
                    <Select onValueChange={(value) => setValue('packing_details', value as PackingType)}>
                      <SelectTrigger>
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
                      <Label htmlFor="packing_remarks">Packing Remarks *</Label>
                      <Textarea
                        id="packing_remarks"
                        {...register('packing_remarks')}
                        placeholder="Specify custom packing requirements"
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Form Actions - Static at bottom of form */}
        <div className="mt-8 bg-white border rounded-lg shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end">
            {/* Cancel Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/requests')}
              disabled={isSubmitting}
              className="w-full sm:w-auto h-12 sm:h-11"
            >
              Cancel
            </Button>

            {/* Save Draft Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="w-full sm:w-auto h-12 sm:h-11 gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isEditMode ? 'Updating...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{isEditMode ? 'Update Draft' : 'Save Draft'}</span>
                </>
              )}
            </Button>

            {/* Submit Button */}
            <Button
              type="button"
              onClick={handleSubmit(handleSubmitRequest)}
              disabled={isSubmitting}
              className="w-full sm:w-auto h-12 sm:h-11 gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <SendHorizontal className="h-4 w-4" />
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
