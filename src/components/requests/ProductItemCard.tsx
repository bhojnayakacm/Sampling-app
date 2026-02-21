import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Trash2, Upload, X, Package, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { ProductItem, RequestCategory, SubCategory } from '@/types';
import {
  PRODUCT_SIZE_OPTIONS,
  PRODUCT_FINISH_OPTIONS,
  PRODUCT_THICKNESS_OPTIONS,
  CATEGORY_LABELS,
  MAGRO_SUB_CATEGORIES,
  SUB_CATEGORY_LABELS,
  getOptionsKey,
  type OptionsKey,
} from '@/types';
import {
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

  // Derive the options key from (category, sub_category)
  const optionsKey = getOptionsKey(item.category, item.sub_category);
  const productTypeKey = optionsKey as ProductTypeKey | null;

  // Get product-specific options (null if category not yet selected)
  const sizeOptions      = optionsKey ? PRODUCT_SIZE_OPTIONS[optionsKey]      : [];
  const finishOptions    = optionsKey ? PRODUCT_FINISH_OPTIONS[optionsKey]    : null;
  const thicknessOptions = optionsKey ? PRODUCT_THICKNESS_OPTIONS[optionsKey] : [];

  // Check if finish should be shown (null = no finish for this type)
  const showFinish = optionsKey !== null && finishOptions !== null;

  // Quality options from productData
  const qualityOptions = useMemo(() => {
    if (!productTypeKey) return [];
    return PRODUCT_QUALITIES_BY_KEY[productTypeKey] || [];
  }, [productTypeKey]);

  const popularQualities = useMemo(() => {
    if (!productTypeKey) return [];
    return POPULAR_QUALITIES[productTypeKey] || [];
  }, [productTypeKey]);

  const qualityOptionsSet = useMemo(() => new Set(qualityOptions), [qualityOptions]);

  // Batch / custom count helpers
  const isBatch = item.selected_qualities.length > 1;
  const customCount = item.selected_qualities.filter((q) => !qualityOptionsSet.has(q)).length;

  // ── Image handling ──────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size must be less than 10MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate(index, { image_file: file, image_preview: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    onUpdate(index, { image_file: null, image_preview: null, image_url: null });
  };

  // Helper: auto-select when only one option exists (excluding "Other")
  const getAutoSelectValue = (options: string[]): string | null => {
    const nonOther = options.filter(opt => opt !== 'Other');
    return nonOther.length === 1 ? nonOther[0] : null;
  };

  // ── Category change — resets everything below ───────────────
  const handleCategoryChange = (newCategory: RequestCategory) => {
    onUpdate(index, {
      category: newCategory,
      sub_category: '',
      selected_qualities: [],
      quality: '',
      sample_size: '',
      sample_size_custom: '',
      thickness: '',
      thickness_custom: '',
      finish: '',
      finish_custom: '',
    });
  };

  // ── Sub-category change — resets specs below ────────────────
  const handleSubCategoryChange = (newSubCategory: SubCategory) => {
    const newOptionsKey = newSubCategory as OptionsKey;
    const hasFinish = PRODUCT_FINISH_OPTIONS[newOptionsKey] !== null;

    const newSizeOptions      = PRODUCT_SIZE_OPTIONS[newOptionsKey]      || [];
    const newThicknessOptions = PRODUCT_THICKNESS_OPTIONS[newOptionsKey] || [];
    const newFinishOptions    = PRODUCT_FINISH_OPTIONS[newOptionsKey]    || [];

    const autoSize      = getAutoSelectValue(newSizeOptions);
    const autoThickness = getAutoSelectValue(newThicknessOptions);
    const autoFinish    = hasFinish ? getAutoSelectValue(newFinishOptions) : null;

    onUpdate(index, {
      sub_category: newSubCategory,
      selected_qualities: [],
      quality: '',
      sample_size: autoSize || '',
      sample_size_custom: '',
      thickness: autoThickness || '',
      thickness_custom: '',
      finish: autoFinish || (hasFinish ? newFinishOptions[0] ?? '' : ''),
      finish_custom: '',
    });
  };

  // Handle quality changes from multi-select combobox
  const handleQualitiesChange = (qualities: string[]) => {
    onUpdate(index, {
      selected_qualities: qualities,
      quality: qualities[0] || '',
    });
  };

  // ── Header label ────────────────────────────────────────────
  const getProductLabel = () => {
    if (!item.category) return 'New Product';
    if (item.category === 'marble') return CATEGORY_LABELS.marble;
    if (item.category === 'magro' && item.sub_category) {
      return `${CATEGORY_LABELS.magro} / ${SUB_CATEGORY_LABELS[item.sub_category]}`;
    }
    return CATEGORY_LABELS.magro;
  };

  const getQualitySummary = () => {
    if (item.selected_qualities.length === 1) {
      const q = item.selected_qualities[0];
      return qualityOptionsSet.has(q) ? q : `${q} (custom)`;
    }
    if (item.selected_qualities.length > 1) {
      return `${item.selected_qualities.length} qualities${customCount > 0 ? ` (${customCount} custom)` : ''}`;
    }
    if (item.quality && item.quality !== 'Custom') return item.quality;
    return null;
  };

  const qualitySummary = getQualitySummary();
  const imagePreview   = item.image_preview || item.image_url;

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      {/* Card Header */}
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

      {/* Card Content */}
      {!isCollapsed && (
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ── Step 1: Category Toggle (Marble / Magro) ─────────────── */}
            <div className="md:col-span-2">
              <Label>Category *</Label>
              <div className="flex gap-2 mt-1.5">
                {(['marble', 'magro'] as RequestCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    className={[
                      'flex-1 h-10 rounded-md border text-sm font-medium transition-colors',
                      item.category === cat
                        ? cat === 'marble'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Step 2: Sub-Category (only for Magro) ────────────────── */}
            {item.category === 'magro' && (
              <div className="md:col-span-2">
                <Label>Sub Category *</Label>
                <Select
                  value={item.sub_category}
                  onValueChange={(v) => handleSubCategoryChange(v as SubCategory)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub category" />
                  </SelectTrigger>
                  <SelectContent>
                    {MAGRO_SUB_CATEGORIES.map((sc) => (
                      <SelectItem key={sc} value={sc}>
                        {SUB_CATEGORY_LABELS[sc]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ── Quality (multi-select combobox) ──────────────────────── */}
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
                <Input
                  placeholder={
                    item.category === 'magro' && !item.sub_category
                      ? 'Select sub category first'
                      : 'Select category first'
                  }
                  disabled
                  className="mt-1.5"
                />
              )}
              {isBatch && (
                <p className="text-xs text-indigo-600 mt-1.5">
                  Same specs (Size, Finish, Thickness, Qty) will apply to all {item.selected_qualities.length} selected qualities.
                </p>
              )}
            </div>

            {/* ── Sample Size ───────────────────────────────────────────── */}
            <div>
              <Label>Sample Size *</Label>
              {optionsKey ? (
                <Select
                  value={item.sample_size}
                  onValueChange={(value) => onUpdate(index, {
                    sample_size: value,
                    sample_size_custom: value === 'Other' ? '' : undefined,
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizeOptions.map((size) => (
                      <SelectItem key={size} value={size}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="Select category first" disabled />
              )}
            </div>

            {/* Specify Size — shown when "Other" selected */}
            {item.sample_size === 'Other' && (
              <div>
                <Label>Specify Size *</Label>
                <Input
                  value={item.sample_size_custom || ''}
                  onChange={(e) => onUpdate(index, { sample_size_custom: e.target.value })}
                  placeholder="Enter custom size"
                />
              </div>
            )}

            {/* ── Thickness ─────────────────────────────────────────────── */}
            <div>
              <Label>Thickness *</Label>
              {optionsKey ? (
                <Select
                  value={item.thickness}
                  onValueChange={(value) => onUpdate(index, {
                    thickness: value,
                    thickness_custom: value === 'Other' ? '' : undefined,
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select thickness" />
                  </SelectTrigger>
                  <SelectContent>
                    {thicknessOptions.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="Select category first" disabled />
              )}
            </div>

            {/* Specify Thickness — shown when "Other" selected */}
            {item.thickness === 'Other' && (
              <div>
                <Label>Specify Thickness *</Label>
                <Input
                  value={item.thickness_custom || ''}
                  onChange={(e) => onUpdate(index, { thickness_custom: e.target.value })}
                  placeholder="Enter custom thickness"
                />
              </div>
            )}

            {/* ── Finish — only for types that have finish ──────────────── */}
            {showFinish && (
              <>
                <div>
                  <Label>Finish *</Label>
                  <Select
                    value={item.finish}
                    onValueChange={(value) => onUpdate(index, {
                      finish: value,
                      finish_custom: value === 'Other' ? '' : undefined,
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select finish" />
                    </SelectTrigger>
                    <SelectContent>
                      {finishOptions?.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Specify Finish — shown when "Other" selected */}
                {item.finish === 'Other' && (
                  <div>
                    <Label>Specify Finish *</Label>
                    <Input
                      value={item.finish_custom || ''}
                      onChange={(e) => onUpdate(index, { finish_custom: e.target.value })}
                      placeholder="Enter custom finish"
                    />
                  </div>
                )}
              </>
            )}

            {/* ── Quantity ─────────────────────────────────────────────── */}
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

            {/* ── Reference Image ───────────────────────────────────────── */}
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
                    <p className="mt-1 text-sm text-slate-600">Click to upload</p>
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
