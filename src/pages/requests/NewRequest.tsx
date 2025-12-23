import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRequest, useUpdateDraft, checkForDuplicates } from '@/lib/api/requests';
import type { ExistingRequest } from '@/lib/api/requests';
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
import { Loader2, Upload, X, ChevronLeft, Save, SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import DuplicateWarningDialog from '@/components/requests/DuplicateWarningDialog';
import type {
  CreateRequestInput,
  PickupResponsibility,
  ClientType,
  ProductType,
  Quality,
  Purpose,
  PackingType,
} from '@/types';
import {
  PRODUCT_SIZE_OPTIONS,
  PRODUCT_FINISH_OPTIONS,
  PRODUCT_THICKNESS_OPTIONS
} from '@/types';

// Helper function to upload image
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

export default function NewRequest() {
  const navigate = useNavigate();
  const { id: draftId } = useParams<{ id: string }>(); // Get draft ID from URL if editing
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    type: 'exact_match' | 'client_match';
    request: ExistingRequest;
  } | null>(null);

  const { data: existingDraft, isLoading: isDraftLoading } = useRequest(draftId);
  const updateDraft = useUpdateDraft();
  const isEditMode = !!draftId && existingDraft?.status === 'draft';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateRequestInput>({
    defaultValues: {
      priority: 'normal',
      quantity: 1,
    },
  });

  // Watch fields for conditional logic
  const pickupResponsibility = watch('pickup_responsibility');
  const clientType = watch('client_type');
  const productType = watch('product_type');
  const sampleSize = watch('sample_size');
  const finish = watch('finish');
  const thickness = watch('thickness');
  const packingDetails = watch('packing_details');

  // Load draft data when editing
  useEffect(() => {
    if (isEditMode && existingDraft) {
      // Populate form with draft data
      setValue('client_type', existingDraft.client_type as any);
      setValue('client_type_remarks', existingDraft.client_type_remarks || '');
      setValue('client_project_name', existingDraft.client_project_name);
      setValue('client_phone', existingDraft.client_phone);
      setValue('client_email', existingDraft.client_email || '');
      setValue('company_firm_name', existingDraft.company_firm_name);
      setValue('site_location', existingDraft.site_location);
      setValue('priority', existingDraft.priority as any);
      setValue('required_by', existingDraft.required_by ? new Date(existingDraft.required_by).toISOString().slice(0, 16) : '');
      setValue('pickup_responsibility', existingDraft.pickup_responsibility as any);
      setValue('pickup_remarks', existingDraft.pickup_remarks || '');
      setValue('delivery_address', existingDraft.delivery_address || '');
      setValue('product_type', existingDraft.product_type as any);
      setValue('quality', existingDraft.quality as any);
      setValue('sample_size', existingDraft.sample_size);
      setValue('sample_size_remarks', existingDraft.sample_size_remarks || '');
      setValue('finish', existingDraft.finish || '');
      setValue('finish_remarks', existingDraft.finish_remarks || '');
      setValue('thickness', existingDraft.thickness);
      setValue('thickness_remarks', existingDraft.thickness_remarks || '');
      setValue('quantity', existingDraft.quantity);
      setValue('purpose', existingDraft.purpose as any);
      setValue('packing_details', existingDraft.packing_details as any);
      setValue('packing_remarks', existingDraft.packing_remarks || '');

      // Set image preview if exists
      if (existingDraft.image_url) {
        setImagePreview(existingDraft.image_url);
      }
    }
  }, [isEditMode, existingDraft, setValue]);

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size must be less than 10MB');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  // ============================================================
  // VALIDATION LOGIC
  // ============================================================

  // Validate all required fields for submission
  const validateSubmission = (data: CreateRequestInput): string[] => {
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

    // Section 3: Sample Request Details
    if (!data.product_type) missingFields.push('Product Type');
    if (!data.quality) missingFields.push('Quality');
    if (!data.sample_size) missingFields.push('Sample Size');
    if (data.sample_size === 'Custom' && !data.sample_size_remarks) {
      missingFields.push('Sample Size Remarks (required when "Custom" is selected)');
    }

    // Finish is required for marble and tile
    if (data.product_type === 'marble' || data.product_type === 'tile') {
      if (!data.finish) missingFields.push('Finish');
      if ((data.finish === 'Custom' || data.finish === 'Customize') && !data.finish_remarks) {
        missingFields.push('Finish Remarks (required when "Custom" is selected)');
      }
    }

    if (!data.thickness) missingFields.push('Thickness');
    if (data.thickness === 'Custom' && !data.thickness_remarks) {
      missingFields.push('Thickness Remarks (required when "Custom" is selected)');
    }
    if (!data.quantity || data.quantity <= 0) missingFields.push('Quantity (must be greater than 0)');
    if (!data.purpose) missingFields.push('Purpose');
    if (!data.packing_details) missingFields.push('Packing Details');
    if (data.packing_details === 'custom' && !data.packing_remarks) {
      missingFields.push('Packing Remarks (required when "Custom" is selected)');
    }

    return missingFields;
  };

  // ============================================================
  // SAVE AS DRAFT (Loose Validation - Allow Partial Data)
  // ============================================================
  const handleSaveDraft = async () => {
    if (!profile) {
      toast.error('You must be logged in to save a request');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get all form values (may be incomplete)
      const formValues = watch();

      // Upload image if new image provided
      let imageUrl: string | null = existingDraft?.image_url || null;
      if (selectedImage) {
        imageUrl = await uploadSampleImage(selectedImage);
      }

      // Prepare request data (allow nulls)
      const requestData = {
        created_by: profile.id,
        status: 'draft',

        // Section 1: Requester Details
        department: profile.department || null,
        mobile_no: profile.phone || null,
        pickup_responsibility: formValues.pickup_responsibility || null,
        pickup_remarks: formValues.pickup_remarks || null,
        delivery_address: formValues.delivery_address || null,
        required_by: formValues.required_by ? new Date(formValues.required_by).toISOString() : null,
        priority: formValues.priority || null,

        // Section 2: Client Project Details
        client_type: formValues.client_type || null,
        client_type_remarks: formValues.client_type_remarks || null,
        client_project_name: formValues.client_project_name || null,
        client_phone: formValues.client_phone || null,
        client_email: formValues.client_email || null,
        company_firm_name: formValues.company_firm_name || null,
        site_location: formValues.site_location || null,

        // Section 3: Sample Request Details
        product_type: formValues.product_type || null,
        quality: formValues.quality || null,
        sample_size: formValues.sample_size || null,
        sample_size_remarks: formValues.sample_size_remarks || null,
        finish: formValues.finish || null,
        finish_remarks: formValues.finish_remarks || null,
        thickness: formValues.thickness || null,
        thickness_remarks: formValues.thickness_remarks || null,
        quantity: formValues.quantity || null,
        purpose: formValues.purpose || null,
        packing_details: formValues.packing_details || null,
        packing_remarks: formValues.packing_remarks || null,

        // Image
        image_url: imageUrl,
      };

      if (isEditMode && draftId) {
        // Update existing draft
        await updateDraft.mutateAsync({ requestId: draftId, updates: requestData });
        toast.success('Draft updated successfully');
      } else {
        // Create new draft
        const { error } = await supabase
          .from('requests')
          .insert([requestData]);

        if (error) throw error;
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
  // SUBMIT REQUEST (Strict Validation - All Fields Required)
  // ============================================================

  // Extract submission logic to a separate function (can be called directly or after duplicate confirmation)
  const submitRequest = async (data: CreateRequestInput) => {
    try {
      // Upload image if new image provided
      let imageUrl: string | null = existingDraft?.image_url || null;
      if (selectedImage) {
        imageUrl = await uploadSampleImage(selectedImage);
      }

      // Prepare request data
      const requestData = {
        created_by: profile!.id,
        status: 'pending_approval',

        // Section 1: Requester Details
        department: profile!.department!,
        mobile_no: profile!.phone!,
        pickup_responsibility: data.pickup_responsibility,
        pickup_remarks: data.pickup_responsibility === 'other' ? data.pickup_remarks : null,
        delivery_address: data.pickup_responsibility === 'self_pickup' ? null : data.delivery_address,
        required_by: new Date(data.required_by).toISOString(),
        priority: data.priority,

        // Section 2: Client Project Details
        client_type: data.client_type,
        client_type_remarks: data.client_type === 'others' ? data.client_type_remarks : null,
        client_project_name: data.client_project_name,
        client_phone: data.client_phone,
        client_email: data.client_email || null,
        company_firm_name: data.company_firm_name,
        site_location: data.site_location,

        // Section 3: Sample Request Details
        product_type: data.product_type,
        quality: data.quality,
        sample_size: data.sample_size,
        sample_size_remarks: data.sample_size === 'Custom' ? data.sample_size_remarks : null,
        finish: (data.product_type === 'terrazzo' || data.product_type === 'quartz') ? null : data.finish,
        finish_remarks: data.finish === 'Custom' || data.finish === 'Customize' ? data.finish_remarks : null,
        thickness: data.thickness,
        thickness_remarks: data.thickness === 'Custom' ? data.thickness_remarks : null,
        quantity: data.quantity,
        purpose: data.purpose,
        packing_details: data.packing_details,
        packing_remarks: data.packing_details === 'custom' ? data.packing_remarks : null,

        // Image
        image_url: imageUrl,
      };

      if (isEditMode && draftId) {
        // Update and submit existing draft
        await updateDraft.mutateAsync({ requestId: draftId, updates: requestData });
        toast.success('Draft submitted successfully');
      } else {
        // Create new request
        const { error } = await supabase
          .from('requests')
          .insert([requestData]);

        if (error) throw error;
        toast.success('Request submitted successfully');
      }

      navigate('/requests');
    } catch (error: any) {
      console.error('Error submitting request:', error);
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRequest = async (data: CreateRequestInput) => {
    if (!profile) {
      toast.error('You must be logged in to submit a request');
      return;
    }

    // Validate all required fields
    const missingFields = validateSubmission(data);
    if (missingFields.length > 0) {
      // Show error toast with missing fields
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
      // Check for duplicates before submission
      const duplicateCheck = await checkForDuplicates({
        client_name: data.client_project_name,
        client_phone: data.client_phone,
        quality: data.quality,
        sample_size: data.sample_size,
        thickness: data.thickness,
        quantity: data.quantity,
      });

      if (duplicateCheck.is_duplicate && duplicateCheck.duplicate_type && duplicateCheck.existing_request) {
        // Show duplicate warning dialog
        setDuplicateDialog({
          type: duplicateCheck.duplicate_type,
          request: duplicateCheck.existing_request,
        });
        setIsSubmitting(false);
        return; // Wait for user decision
      }

      // No duplicate found - proceed with submission
      await submitRequest(data);
    } catch (error: any) {
      console.error('Error checking for duplicates:', error);
      toast.error('Failed to check for duplicates. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Handle duplicate dialog actions
  const handleDuplicateCancel = () => {
    setDuplicateDialog(null);
  };

  const handleDuplicateContinue = async () => {
    const data = watch(); // Get current form values
    setDuplicateDialog(null); // Close dialog
    setIsSubmitting(true);
    await submitRequest(data); // Proceed with submission
  };

  if (!profile || (draftId && isDraftLoading)) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Prevent editing non-draft requests
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

  return (
    <div className="min-h-screen bg-gray-50 pb-32 md:pb-8">
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
                {profile.full_name} • {profile.department}
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

      <form onSubmit={(e) => e.preventDefault()} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-40 md:pb-6">
        {/* Accordion Wrapper for Mobile-Friendly Sections */}
        <Accordion type="multiple" defaultValue={["section-1", "section-2", "section-3"]} className="space-y-4">
          {/* ============================================================ */}
          {/* SECTION 1: REQUESTER DETAILS (AUTO-FILLED, READ-ONLY) */}
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Name (Read-only) */}
                  <div>
                    <Label className="text-gray-700">Name</Label>
                    <p className="text-base font-medium mt-1">{profile.full_name}</p>
                  </div>

                  {/* Department (Read-only) */}
                  <div>
                    <Label className="text-gray-700">Department</Label>
                    <p className="text-base font-medium mt-1 capitalize">
                      {profile.department || 'Not Set'}
                    </p>
                  </div>

                  {/* Mobile No (Read-only) */}
                  <div>
                    <Label className="text-gray-700">Mobile No</Label>
                    <p className="text-base font-medium mt-1">{profile.phone || 'Not Set'}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  These details were captured during signup and cannot be changed here.
                </p>
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
              {errors.client_type && <p className="text-red-500 text-sm mt-1">{errors.client_type.message}</p>}
            </div>

            {/* Client Type Remarks (Conditional: show if client_type === 'others') */}
            {clientType === 'others' && (
              <div>
                <Label htmlFor="client_type_remarks">Client Type Remarks *</Label>
                <Input
                  id="client_type_remarks"
                  {...register('client_type_remarks', {
                    required: clientType === 'others' ? 'Remarks required when selecting Others' : false,
                  })}
                  placeholder="Please specify client type"
                />
                {errors.client_type_remarks && <p className="text-red-500 text-sm mt-1">{errors.client_type_remarks.message}</p>}
              </div>
            )}

            {/* Client/Architect/Project Name */}
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

            {/* Email (Optional) */}
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
          {/* SECTION 3: SAMPLE REQUEST DETAILS (CONSOLIDATED) */}
          {/* ============================================================ */}
          <AccordionItem value="section-3" className="border rounded-lg bg-white">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 font-semibold text-sm flex-shrink-0">
                  3
                </div>
                <span className="font-semibold text-base sm:text-lg">Sample Request Details</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-4">
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
              {errors.pickup_responsibility && <p className="text-red-500 text-sm mt-1">{errors.pickup_responsibility.message}</p>}
            </div>

            {/* Pickup Remarks (Conditional: show if pickup_responsibility === 'other') */}
            {pickupResponsibility === 'other' && (
              <div>
                <Label htmlFor="pickup_remarks">Pickup Remarks *</Label>
                <Input
                  id="pickup_remarks"
                  {...register('pickup_remarks', {
                    required: pickupResponsibility === 'other' ? 'Remarks required when selecting Other' : false
                  })}
                  placeholder="Please specify pickup method"
                />
                {errors.pickup_remarks && <p className="text-red-500 text-sm mt-1">{errors.pickup_remarks.message}</p>}
              </div>
            )}

            {/* Delivery Address (Conditional: NOT required if self_pickup) */}
            <div className="md:col-span-2">
              <Label htmlFor="delivery_address">
                Delivery Address {pickupResponsibility !== 'self_pickup' && '*'}
              </Label>
              <Textarea
                id="delivery_address"
                {...register('delivery_address', {
                  required: pickupResponsibility !== 'self_pickup' ? 'Delivery address is required' : false,
                })}
                placeholder={pickupResponsibility === 'self_pickup' ? 'Not required for self pickup' : 'Enter delivery address'}
                rows={3}
                disabled={pickupResponsibility === 'self_pickup'}
              />
              {errors.delivery_address && <p className="text-red-500 text-sm mt-1">{errors.delivery_address.message}</p>}
            </div>

            {/* Divider */}
            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h4 className="font-semibold text-gray-700 mb-4">Product Specifications</h4>
            </div>

            {/* Product Type */}
            <div>
              <Label htmlFor="product_type">Product Type *</Label>
              <Select onValueChange={(value) => setValue('product_type', value as ProductType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marble">Marble</SelectItem>
                  <SelectItem value="tile">Tile</SelectItem>
                  <SelectItem value="terrazzo">Terrazzo</SelectItem>
                  <SelectItem value="quartz">Quartz</SelectItem>
                </SelectContent>
              </Select>
              {errors.product_type && <p className="text-red-500 text-sm mt-1">{errors.product_type.message}</p>}
            </div>

            {/* Quality */}
            <div>
              <Label htmlFor="quality">Quality *</Label>
              <Select onValueChange={(value) => setValue('quality', value as Quality)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
              {errors.quality && <p className="text-red-500 text-sm mt-1">{errors.quality.message}</p>}
            </div>

            {/* Sample Size (Dynamic based on product_type) */}
            <div>
              <Label htmlFor="sample_size">Sample Size *</Label>
              {productType && (
                <Select onValueChange={(value) => setValue('sample_size', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_SIZE_OPTIONS[productType]?.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!productType && (
                <Input placeholder="Select product type first" disabled />
              )}
              {errors.sample_size && <p className="text-red-500 text-sm mt-1">{errors.sample_size.message}</p>}
            </div>

            {/* Sample Size Remarks (Conditional: show if size === 'Custom') */}
            {sampleSize === 'Custom' && (
              <div>
                <Label htmlFor="sample_size_remarks">Sample Size Remarks *</Label>
                <Input
                  id="sample_size_remarks"
                  {...register('sample_size_remarks', {
                    required: sampleSize === 'Custom' ? 'Size remarks required for custom size' : false,
                  })}
                  placeholder="Specify custom size"
                />
                {errors.sample_size_remarks && <p className="text-red-500 text-sm mt-1">{errors.sample_size_remarks.message}</p>}
              </div>
            )}

            {/* Finish (Dynamic based on product_type, HIDDEN for terrazzo/quartz) */}
            {productType && PRODUCT_FINISH_OPTIONS[productType] && (
              <>
                <div>
                  <Label htmlFor="finish">Finish *</Label>
                  <Select onValueChange={(value) => setValue('finish', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select finish" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_FINISH_OPTIONS[productType]?.map((finishOption) => (
                        <SelectItem key={finishOption} value={finishOption}>
                          {finishOption}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.finish && <p className="text-red-500 text-sm mt-1">{errors.finish.message}</p>}
                </div>

                {/* Finish Remarks (Conditional: show if finish === 'Custom' or 'Customize') */}
                {(finish === 'Custom' || finish === 'Customize') && (
                  <div>
                    <Label htmlFor="finish_remarks">Finish Remarks *</Label>
                    <Input
                      id="finish_remarks"
                      {...register('finish_remarks', {
                        required: (finish === 'Custom' || finish === 'Customize') ? 'Finish remarks required for custom finish' : false,
                      })}
                      placeholder="Specify custom finish"
                    />
                    {errors.finish_remarks && <p className="text-red-500 text-sm mt-1">{errors.finish_remarks.message}</p>}
                  </div>
                )}
              </>
            )}

            {/* Thickness (Dynamic based on product_type) */}
            <div>
              <Label htmlFor="thickness">Thickness *</Label>
              {productType && (
                <Select onValueChange={(value) => setValue('thickness', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select thickness" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_THICKNESS_OPTIONS[productType]?.map((thicknessOption) => (
                      <SelectItem key={thicknessOption} value={thicknessOption}>
                        {thicknessOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!productType && (
                <Input placeholder="Select product type first" disabled />
              )}
              {errors.thickness && <p className="text-red-500 text-sm mt-1">{errors.thickness.message}</p>}
            </div>

            {/* Thickness Remarks (Conditional: show if thickness === 'Custom') */}
            {thickness === 'Custom' && (
              <div>
                <Label htmlFor="thickness_remarks">Thickness Remarks *</Label>
                <Input
                  id="thickness_remarks"
                  {...register('thickness_remarks', {
                    required: thickness === 'Custom' ? 'Thickness remarks required for custom thickness' : false,
                  })}
                  placeholder="Specify custom thickness"
                />
                {errors.thickness_remarks && <p className="text-red-500 text-sm mt-1">{errors.thickness_remarks.message}</p>}
              </div>
            )}

            {/* Quantity */}
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                {...register('quantity', {
                  required: 'Quantity is required',
                  valueAsNumber: true,
                  min: { value: 1, message: 'Quantity must be at least 1' },
                })}
              />
              {errors.quantity && <p className="text-red-500 text-sm mt-1">{errors.quantity.message}</p>}
            </div>

            {/* Purpose of Sample */}
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
              {errors.purpose && <p className="text-red-500 text-sm mt-1">{errors.purpose.message}</p>}
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
              {errors.packing_details && <p className="text-red-500 text-sm mt-1">{errors.packing_details.message}</p>}
            </div>

            {/* Packing Remarks (Conditional: show if packing === 'custom') */}
            {packingDetails === 'custom' && (
              <div className="md:col-span-2">
                <Label htmlFor="packing_remarks">Packing Remarks *</Label>
                <Textarea
                  id="packing_remarks"
                  {...register('packing_remarks', {
                    required: packingDetails === 'custom' ? 'Packing remarks required for custom packing' : false,
                  })}
                  placeholder="Specify custom packing requirements"
                  rows={2}
                />
                {errors.packing_remarks && <p className="text-red-500 text-sm mt-1">{errors.packing_remarks.message}</p>}
              </div>
            )}

            {/* Quality Image Upload */}
            <div className="md:col-span-2">
              <Label htmlFor="image">Quality Image (Optional)</Label>
              {!imagePreview ? (
                <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <label htmlFor="image" className="cursor-pointer">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      Click to upload quality image
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                  </label>
                </div>
              ) : (
                <div className="mt-2 relative">
                  <img
                    src={imagePreview}
                    alt="Quality image preview"
                    className="max-w-full h-48 object-contain rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </form>

      {/* Sticky Footer - Mobile Optimized */}
      <div className="fixed bottom-0 left-0 right-0 md:relative md:max-w-4xl md:mx-auto md:px-4 sm:px-6 lg:px-8 md:mt-6 z-30">
        <div className="bg-white border-t md:border md:rounded-lg shadow-lg md:shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end max-w-4xl mx-auto">
            {/* Cancel Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/requests')}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none h-12 sm:h-11"
            >
              Cancel
            </Button>

            {/* Save Draft Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none h-12 sm:h-11 gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">{isEditMode ? 'Updating...' : 'Saving...'}</span>
                  <span className="sm:hidden">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">{isEditMode ? 'Update Draft' : 'Save as Draft'}</span>
                  <span className="sm:hidden">Save Draft</span>
                </>
              )}
            </Button>

            {/* Submit Button */}
            <Button
              type="button"
              onClick={handleSubmit(handleSubmitRequest)}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none h-12 sm:h-11 gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <SendHorizontal className="h-4 w-4" />
                  <span>Submit Request</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Duplicate Warning Dialog */}
      {duplicateDialog && (
        <DuplicateWarningDialog
          open={!!duplicateDialog}
          onOpenChange={(open) => !open && setDuplicateDialog(null)}
          duplicateType={duplicateDialog.type}
          existingRequest={duplicateDialog.request}
          onCancel={handleDuplicateCancel}
          onContinue={handleDuplicateContinue}
        />
      )}
    </div>
  );
}
