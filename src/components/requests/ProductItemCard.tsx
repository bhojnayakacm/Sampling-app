import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Trash2, Upload, X, Package, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { ProductItem, ProductType } from '@/types';
import {
  PRODUCT_SIZE_OPTIONS,
  PRODUCT_FINISH_OPTIONS,
  PRODUCT_THICKNESS_OPTIONS,
} from '@/types';
import {
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPES_ORDERED,
  PRODUCT_QUALITIES_BY_KEY,
  POPULAR_QUALITIES,
  type ProductTypeKey,
} from '@/lib/productData';

interface ProductItemCardProps {
  item: ProductItem;
  index: number;
  canDelete: boolean;
  onUpdate: (index: number, updates: Partial<ProductItem>) => void;
  onRemove: (index: number) => void;
}

export default function ProductItemCard({
  item,
  index,
  canDelete,
  onUpdate,
  onRemove,
}: ProductItemCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Get product-specific options
  const productType = item.product_type as ProductType;
  const productTypeKey = item.product_type as ProductTypeKey;
  const sizeOptions = productType ? PRODUCT_SIZE_OPTIONS[productType] : [];
  const finishOptions = productType ? PRODUCT_FINISH_OPTIONS[productType] : null;
  const thicknessOptions = productType ? PRODUCT_THICKNESS_OPTIONS[productType] : [];

  // Get quality options from the data source
  const qualityOptions = useMemo(() => {
    if (!productTypeKey) return [];
    return PRODUCT_QUALITIES_BY_KEY[productTypeKey] || [];
  }, [productTypeKey]);

  // Get popular qualities for the selected product type
  const popularQualities = useMemo(() => {
    if (!productTypeKey) return [];
    return POPULAR_QUALITIES[productTypeKey] || [];
  }, [productTypeKey]);

  // Build a Set for O(1) custom detection
  const qualityOptionsSet = useMemo(() => new Set(qualityOptions), [qualityOptions]);

  // Check if finish should be shown (not for terrazzo/quartz)
  const showFinish = productType && finishOptions !== null;

  // Is this a batch entry (multiple qualities selected)?
  const isBatch = item.selected_qualities.length > 1;

  // Count custom vs verified qualities
  const customCount = item.selected_qualities.filter((q) => !qualityOptionsSet.has(q)).length;

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size must be less than 10MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate(index, {
          image_file: file,
          image_preview: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    onUpdate(index, {
      image_file: null,
      image_preview: null,
      image_url: null,
    });
  };

  // Helper: Get the first non-custom option if only one exists
  const getAutoSelectValue = (options: string[]): string | null => {
    const nonCustomOptions = options.filter(opt => opt !== 'Custom' && opt !== 'Customize');
    return nonCustomOptions.length === 1 ? nonCustomOptions[0] : null;
  };

  // Reset dependent fields when product type changes
  const handleProductTypeChange = (value: string) => {
    const newProductType = value as ProductType;
    const hasFinish = PRODUCT_FINISH_OPTIONS[newProductType] !== null;

    const newSizeOptions = PRODUCT_SIZE_OPTIONS[newProductType] || [];
    const newThicknessOptions = PRODUCT_THICKNESS_OPTIONS[newProductType] || [];
    const newFinishOptions = PRODUCT_FINISH_OPTIONS[newProductType] || [];

    const autoSize = getAutoSelectValue(newSizeOptions);
    const autoThickness = getAutoSelectValue(newThicknessOptions);
    const autoFinish = hasFinish ? getAutoSelectValue(newFinishOptions) : null;

    onUpdate(index, {
      product_type: newProductType,
      selected_qualities: [],
      quality_custom: '',
      use_custom_quality: false,
      quality: '',
      sample_size: autoSize || '',
      sample_size_remarks: '',
      thickness: autoThickness || '',
      thickness_remarks: '',
      finish: autoFinish || (hasFinish ? newFinishOptions[0] : ''),
      finish_remarks: '',
    });
  };

  // Handle quality changes from the unified creatable multi-select
  const handleQualitiesChange = (qualities: string[]) => {
    onUpdate(index, {
      selected_qualities: qualities,
      // Legacy field for backward compat
      quality: qualities[0] || '',
    });
  };

  // Get display label for card header
  const getProductLabel = () => {
    if (!item.product_type) return 'New Product';
    return PRODUCT_TYPE_LABELS[item.product_type] || 'Product';
  };

  // Get quality summary for header
  const getQualitySummary = () => {
    if (item.selected_qualities.length === 1) {
      const q = item.selected_qualities[0];
      const isCustom = !qualityOptionsSet.has(q);
      return isCustom ? `${q} (custom)` : q;
    }
    if (item.selected_qualities.length > 1) {
      return `${item.selected_qualities.length} qualities${customCount > 0 ? ` (${customCount} custom)` : ''}`;
    }
    // Legacy fallback
    if (item.quality && item.quality !== 'Custom') {
      return item.quality;
    }
    return null;
  };

  const qualitySummary = getQualitySummary();
  const imagePreview = item.image_preview || item.image_url;

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      {/* Card Header - Always visible */}
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-3 text-left flex-1 min-w-0"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
              {index + 1}
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Package className="h-4 w-4 text-slate-500 flex-shrink-0" />
              <span className="font-medium text-slate-800 truncate">
                {getProductLabel()}
              </span>
              {qualitySummary && (
                <span className="text-xs text-slate-500 truncate max-w-[120px] hidden sm:inline">
                  • {qualitySummary}
                </span>
              )}
              {item.quantity > 0 && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex-shrink-0">
                  Qty: {item.quantity}
                </span>
              )}
              {isBatch && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0 hidden sm:inline">
                  Batch: {item.selected_qualities.length}
                </span>
              )}
            </div>
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4 text-slate-400 ml-auto flex-shrink-0" />
            ) : (
              <ChevronUp className="h-4 w-4 text-slate-400 ml-auto flex-shrink-0" />
            )}
          </button>

          <div className="flex items-center ml-2 flex-shrink-0">
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(index)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Card Content - Collapsible */}
      {!isCollapsed && (
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Type */}
            <div>
              <Label>Product Type *</Label>
              <Select
                value={item.product_type}
                onValueChange={handleProductTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES_ORDERED.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PRODUCT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ============================================================ */}
            {/* UNIFIED QUALITY INPUT: Creatable Multi-Select */}
            {/* Verified DB entries = Blue chips | Custom typed = Amber chips */}
            {/* ============================================================ */}
            <div className="md:col-span-2">
              <Label className="flex items-center gap-2 flex-wrap">
                Quality *
                {isBatch && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-normal">
                    Batch: {item.selected_qualities.length} items
                  </span>
                )}
                {customCount > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-normal">
                    {customCount} custom
                  </span>
                )}
              </Label>
              {productTypeKey ? (
                <MultiSelectCombobox
                  options={qualityOptions}
                  popularOptions={popularQualities}
                  value={item.selected_qualities || []}
                  onChange={handleQualitiesChange}
                  placeholder="Select or type custom qualities..."
                  searchPlaceholder="Search qualities or type a custom name..."
                  emptyMessage="No matching quality"
                  className="w-full mt-1.5"
                  maxDisplay={4}
                  creatable
                  createLabel="Add custom quality"
                />
              ) : (
                <Input placeholder="Select product type first" disabled className="mt-1.5" />
              )}
              {isBatch && (
                <p className="text-xs text-indigo-600 mt-1.5">
                  Same specs (Size, Finish, Thickness, Qty) will apply to all {item.selected_qualities.length} selected qualities.
                </p>
              )}
            </div>

            {/* Sample Size */}
            <div>
              <Label>Sample Size *</Label>
              {productType ? (
                <Select
                  value={item.sample_size}
                  onValueChange={(value) => onUpdate(index, {
                    sample_size: value,
                    sample_size_remarks: value === 'Custom' ? '' : undefined
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizeOptions.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="Select product type first" disabled />
              )}
            </div>

            {/* Size Remarks - Show when "Custom" is selected */}
            {item.sample_size === 'Custom' && (
              <div>
                <Label>Size Remarks *</Label>
                <Input
                  value={item.sample_size_remarks || ''}
                  onChange={(e) => onUpdate(index, { sample_size_remarks: e.target.value })}
                  placeholder="Specify custom size"
                />
              </div>
            )}

            {/* Thickness */}
            <div>
              <Label>Thickness *</Label>
              {productType ? (
                <Select
                  value={item.thickness}
                  onValueChange={(value) => onUpdate(index, {
                    thickness: value,
                    thickness_remarks: value === 'Custom' ? '' : undefined
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select thickness" />
                  </SelectTrigger>
                  <SelectContent>
                    {thicknessOptions.map((thickness) => (
                      <SelectItem key={thickness} value={thickness}>
                        {thickness}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="Select product type first" disabled />
              )}
            </div>

            {/* Thickness Remarks - Show when "Custom" is selected */}
            {item.thickness === 'Custom' && (
              <div>
                <Label>Thickness Remarks *</Label>
                <Input
                  value={item.thickness_remarks || ''}
                  onChange={(e) => onUpdate(index, { thickness_remarks: e.target.value })}
                  placeholder="Specify custom thickness"
                />
              </div>
            )}

            {/* Finish - Only show for marble/tile/magro_stone */}
            {showFinish && (
              <>
                <div>
                  <Label>Finish *</Label>
                  <Select
                    value={item.finish}
                    onValueChange={(value) => onUpdate(index, {
                      finish: value,
                      finish_remarks: (value === 'Custom' || value === 'Customize') ? '' : undefined
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select finish" />
                    </SelectTrigger>
                    <SelectContent>
                      {finishOptions?.map((finish) => (
                        <SelectItem key={finish} value={finish}>
                          {finish}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Finish Remarks - Show when "Custom" is selected */}
                {(item.finish === 'Custom' || item.finish === 'Customize') && (
                  <div>
                    <Label>Finish Remarks *</Label>
                    <Input
                      value={item.finish_remarks || ''}
                      onChange={(e) => onUpdate(index, { finish_remarks: e.target.value })}
                      placeholder="Specify custom finish"
                    />
                  </div>
                )}
              </>
            )}

            {/* Quantity */}
            <div>
              <Label>Quantity *</Label>
              <Input
                type="number"
                min="1"
                value={item.quantity || ''}
                onChange={(e) => onUpdate(index, { quantity: parseInt(e.target.value) || 0 })}
                placeholder="Enter quantity"
              />
            </div>

            {/* Reference Image Upload */}
            <div className="md:col-span-2">
              <Label>Reference Image (Optional)</Label>
              {!imagePreview ? (
                <div className="mt-2 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-slate-300 transition-colors">
                  <input
                    id={`image-${item.id}`}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <label htmlFor={`image-${item.id}`} className="cursor-pointer">
                    <Upload className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-1 text-sm text-slate-600">
                      Click to upload
                    </p>
                    <p className="text-xs text-slate-400">PNG, JPG up to 10MB</p>
                  </label>
                </div>
              ) : (
                <div className="mt-2 relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Product reference"
                    className="max-w-full h-32 object-contain rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Batch Image Helper Note */}
              {isBatch && (
                <div className="flex items-start gap-2 mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    <span className="font-semibold">Note:</span> This image will be attached to the first item only.
                    To add specific images for other items, please use the "Add Another Product" button below.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
