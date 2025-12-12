import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase, uploadSampleImage } from '@/lib/supabase';
import { CreateRequestInput } from '@/types';
import { toast } from 'sonner';
import { Upload, X, Loader2 } from 'lucide-react';

export default function NewRequest() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateRequestInput>({
    defaultValues: {
      requested_date: new Date().toISOString().split('T')[0],
      priority: 'medium',
      unit: 'pieces',
      quantity: 1,
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const onSubmit = async (data: CreateRequestInput) => {
    if (!profile) return;

    setIsSubmitting(true);
    try {
      // Insert the request into the database
      const { data: newRequest, error: insertError } = await supabase
        .from('requests')
        .insert({
          created_by: profile.id,
          status: 'pending_approval',
          priority: data.priority,
          requested_date: data.requested_date,
          client_name: data.client_name,
          client_phone: data.client_phone,
          delivery_address: data.delivery_address,
          sample_name: data.sample_name,
          stone_type: data.stone_type,
          dimensions: data.dimensions,
          thickness: data.thickness,
          finish: data.finish,
          edge_profile: data.edge_profile,
          quantity: data.quantity,
          unit: data.unit,
          remarks: data.remarks || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload image if provided
      if (imageFile && newRequest) {
        const imageUrl = await uploadSampleImage(imageFile, newRequest.id);

        // Update request with image URL
        const { error: updateError } = await supabase
          .from('requests')
          .update({ image_url: imageUrl })
          .eq('id', newRequest.id);

        if (updateError) throw updateError;
      }

      toast.success('Request created successfully!');
      navigate('/requests');
    } catch (error) {
      console.error('Error creating request:', error);
      toast.error('Failed to create request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">New Sample Request</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{profile?.full_name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Create New Request</h2>
          <Button variant="outline" onClick={() => navigate('/requests')}>
            Cancel
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Request Details */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Request Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="requested_date">Requested Date</Label>
                <Input
                  id="requested_date"
                  type="date"
                  {...register('requested_date', {
                    required: 'Requested date is required',
                  })}
                />
                {errors.requested_date && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.requested_date.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  id="priority"
                  {...register('priority', {
                    required: 'Priority is required',
                  })}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
                {errors.priority && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.priority.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Client Information */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Client Information</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="client_name">Client Name</Label>
                <Input
                  id="client_name"
                  {...register('client_name', {
                    required: 'Client name is required',
                  })}
                  placeholder="Enter client name"
                />
                {errors.client_name && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.client_name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="client_phone">Client Phone</Label>
                <Input
                  id="client_phone"
                  {...register('client_phone', {
                    required: 'Client phone is required',
                  })}
                  placeholder="Enter phone number"
                />
                {errors.client_phone && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.client_phone.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="delivery_address">Delivery Address</Label>
                <Textarea
                  id="delivery_address"
                  {...register('delivery_address', {
                    required: 'Delivery address is required',
                  })}
                  placeholder="Enter delivery address"
                  rows={3}
                />
                {errors.delivery_address && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.delivery_address.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Marble Specifications */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Marble Specifications</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="sample_name">Sample Name</Label>
                <Input
                  id="sample_name"
                  {...register('sample_name', {
                    required: 'Sample name is required',
                  })}
                  placeholder="e.g., White Carrara"
                />
                {errors.sample_name && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.sample_name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="stone_type">Stone Type</Label>
                <Input
                  id="stone_type"
                  {...register('stone_type', {
                    required: 'Stone type is required',
                  })}
                  placeholder="e.g., Marble, Granite, Quartz"
                />
                {errors.stone_type && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.stone_type.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dimensions">Dimensions</Label>
                  <Input
                    id="dimensions"
                    {...register('dimensions', {
                      required: 'Dimensions are required',
                    })}
                    placeholder="e.g., 12x12, 24x24"
                  />
                  {errors.dimensions && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.dimensions.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="thickness">Thickness</Label>
                  <Input
                    id="thickness"
                    {...register('thickness', {
                      required: 'Thickness is required',
                    })}
                    placeholder="e.g., 2cm, 3cm"
                  />
                  {errors.thickness && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.thickness.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="finish">Finish</Label>
                  <Input
                    id="finish"
                    {...register('finish', {
                      required: 'Finish is required',
                    })}
                    placeholder="e.g., Polished, Honed, Brushed"
                  />
                  {errors.finish && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.finish.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="edge_profile">Edge Profile</Label>
                  <Input
                    id="edge_profile"
                    {...register('edge_profile', {
                      required: 'Edge profile is required',
                    })}
                    placeholder="e.g., Beveled, Bullnose, Square"
                  />
                  {errors.edge_profile && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.edge_profile.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    {...register('quantity', {
                      required: 'Quantity is required',
                      min: { value: 1, message: 'Minimum quantity is 1' },
                    })}
                  />
                  {errors.quantity && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.quantity.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    id="unit"
                    {...register('unit', {
                      required: 'Unit is required',
                    })}
                  >
                    <option value="pieces">Pieces</option>
                    <option value="sqft">Square Feet</option>
                  </Select>
                  {errors.unit && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.unit.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="remarks">Remarks (Optional)</Label>
                <Textarea
                  id="remarks"
                  {...register('remarks')}
                  placeholder="Any additional notes or special requirements"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Image Upload */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Sample Image (Optional)</h3>
            <div className="space-y-4">
              {!imagePreview ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <Label
                      htmlFor="image-upload"
                      className="cursor-pointer text-blue-600 hover:text-blue-700"
                    >
                      Click to upload
                    </Label>
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/requests')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Request'
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
