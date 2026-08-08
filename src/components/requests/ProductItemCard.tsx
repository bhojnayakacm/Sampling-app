import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Trash2, Upload, X, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { ProductImage, ProductItem, RequestCategory, SubCategory } from '@/types';
import {
  MAX_IMAGES_PER_SLOT,
  MAX_IMAGE_BYTES,
  cardImages,
  newImageId,
  previewSrc,
  qualityImages,
} from '@/lib/productImages';
import {
  PRODUCT_SIZE_OPTIONS,
  PRODUCT_FINISH_OPTIONS,
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

/**
 * Horizontal strip of attached-image thumbnails with per-image remove.
 * Shared by the single dropzone and every per-quality slot so both modes
 * look and behave identically.
 */
function ThumbnailRow({
  images,
  altPrefix,
  onRemove,
  compact = false,
}: {
  images: ProductImage[];
  altPrefix: string;
  onRemove: (imageId: string) => void;
  compact?: boolean;
}) {
  const size = compact ? 'h-14 w-14' : 'h-20 w-20';
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {images.map((image, i) => {
        const src = previewSrc(image);
        return (
          <div key={image.id} className="relative shrink-0">
            {src ? (
              <img
                src={src}
                alt={`${altPrefix} ${i + 1}`}
                className={`${size} object-cover rounded-md border border-slate-200 bg-white`}
              />
            ) : (
              // Preview unavailable (FileReader failed) — the file is still
              // attached and will upload, so show a neutral placeholder.
              <div
                className={`${size} rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center`}
              >
                <Upload className="h-4 w-4 text-slate-400" />
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(image.id)}
              aria-label={`Remove ${altPrefix} ${i + 1}`}
              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-md"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

interface ProductItemCardProps {
  item: ProductItem;
  index: number;
  canDelete: boolean;
  // Accepts a plain patch, or an updater receiving the current item — the
  // async image handlers use the latter so a slow FileReader can't clobber a
  // concurrent pick in another slot.
  onUpdate: (
    index: number,
    updates: Partial<ProductItem> | ((prev: ProductItem) => Partial<ProductItem>),
  ) => void;
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

  // Deduped, ordered list of selected qualities — drives the per-quality image
  // slots. 2+ qualities = "multi" mode (one slot each); 0–1 = the single
  // dropzone. Deduped so a stray duplicate can't render two slots / two keys.
  const selectedQualities = useMemo(
    () => [...new Set(item.selected_qualities)],
    [item.selected_qualities],
  );
  const isMultiQuality = selectedQualities.length > 1;

  // ── Image handling ──────────────────────────────────────────
  // Both the single dropzone and each per-quality slot accept MULTIPLE files
  // and store an ordered ProductImage[]. Reading the files is async
  // (FileReader), so we resolve them all before one single state update —
  // updating per-file would drop images, since each onUpdate would be built
  // from the same stale `item`.
  const readFilesAsImages = async (files: File[]): Promise<ProductImage[]> =>
    Promise.all(
      files.map(
        (file) =>
          new Promise<ProductImage>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () =>
              resolve({
                id: newImageId(),
                file,
                preview: reader.result as string,
                url: null,
              });
            // A preview failure must not block attaching the file itself.
            reader.onerror = () =>
              resolve({ id: newImageId(), file, preview: null, url: null });
            reader.readAsDataURL(file);
          }),
      ),
    );

  /**
   * Validate a picked FileList against the per-file size cap and the
   * remaining room in the slot. Returns the files to actually add.
   */
  const acceptFiles = (fileList: FileList | null, existingCount: number): File[] => {
    const picked = Array.from(fileList ?? []);
    if (picked.length === 0) return [];

    const withinSize = picked.filter((f) => {
      if (f.size > MAX_IMAGE_BYTES) {
        toast.error(`"${f.name}" is larger than 10MB and was skipped.`);
        return false;
      }
      return true;
    });

    const room = MAX_IMAGES_PER_SLOT - existingCount;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_IMAGES_PER_SLOT} images here.`);
      return [];
    }
    if (withinSize.length > room) {
      toast.error(`Only ${room} more image${room > 1 ? 's' : ''} can be added here.`);
      return withinSize.slice(0, room);
    }
    return withinSize;
  };

  // Single / zero-quality card
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const current = cardImages(item);
    const files = acceptFiles(e.target.files, current.length);
    // Reset the input so re-picking the same file still fires onChange.
    e.target.value = '';
    if (files.length === 0) return;

    const added = await readFilesAsImages(files);
    // Re-read from the CURRENT card (not the captured one) so a concurrent
    // pick elsewhere isn't lost. Migrating off the legacy single fields:
    // clear them as we adopt `images`.
    onUpdate(index, (prev) => ({
      images: [...cardImages(prev), ...added].slice(0, MAX_IMAGES_PER_SLOT),
      image_file: null,
      image_preview: null,
      image_url: null,
    }));
  };

  const removeImage = (imageId: string) => {
    onUpdate(index, {
      images: cardImages(item).filter((img) => img.id !== imageId),
      image_file: null,
      image_preview: null,
      image_url: null,
    });
  };

  // ── Per-quality image handling (batch items with 2+ qualities) ──────
  const handleQualityImageChange = async (
    quality: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const current = qualityImages(item, quality);
    const files = acceptFiles(e.target.files, current.length);
    e.target.value = '';
    if (files.length === 0) return;

    const added = await readFilesAsImages(files);
    onUpdate(index, (prev) => ({
      quality_images: {
        ...(prev.quality_images || {}),
        [quality]: [...qualityImages(prev, quality), ...added].slice(0, MAX_IMAGES_PER_SLOT),
      },
    }));
  };

  const removeQualityImage = (quality: string, imageId: string) => {
    const next: Record<string, ProductImage[]> = { ...(item.quality_images || {}) };
    const remaining = qualityImages(item, quality).filter((img) => img.id !== imageId);
    if (remaining.length > 0) {
      next[quality] = remaining;
    } else {
      delete next[quality];
    }
    onUpdate(index, { quality_images: next });
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
      quality_images: {},
      sample_size: '',
      sample_size_custom: '',
      finish: '',
      finish_custom: '',
    });
  };

  // ── Sub-category change — resets specs below ────────────────
  const handleSubCategoryChange = (newSubCategory: SubCategory) => {
    const newOptionsKey = newSubCategory as OptionsKey;
    const hasFinish = PRODUCT_FINISH_OPTIONS[newOptionsKey] !== null;

    const newSizeOptions   = PRODUCT_SIZE_OPTIONS[newOptionsKey]   || [];
    const newFinishOptions = PRODUCT_FINISH_OPTIONS[newOptionsKey] || [];

    const autoSize   = getAutoSelectValue(newSizeOptions);
    const autoFinish = hasFinish ? getAutoSelectValue(newFinishOptions) : null;

    onUpdate(index, {
      sub_category: newSubCategory,
      selected_qualities: [],
      quality: '',
      quality_images: {},
      sample_size: autoSize || '',
      sample_size_custom: '',
      finish: autoFinish || (hasFinish ? newFinishOptions[0] ?? '' : ''),
      finish_custom: '',
    });
  };

  // Handle quality changes from the multi-select combobox.
  //
  // Beyond updating the selection, this keeps the per-quality image map in
  // sync across the single↔batch boundary so a photo is never silently
  // stranded or uploaded for a deselected quality:
  //   • → batch (2+): drop images for deselected qualities; and when growing
  //     from a single card that had images, migrate that whole set into the
  //     slot for the quality they belonged to.
  //   • → single/zero: promote the surviving quality's images back onto the
  //     single dropzone, then clear the map.
  const handleQualitiesChange = (qualities: string[]) => {
    const prevQualities = [...new Set(item.selected_qualities)];
    const wasSingle = prevQualities.length <= 1;
    const existing: Record<string, ProductImage[]> = item.quality_images || {};
    const single = cardImages(item);

    const updates: Partial<ProductItem> = {
      selected_qualities: qualities,
      quality: qualities[0] || '',
    };

    if (qualities.length > 1) {
      // Keep only images whose quality is still selected.
      const kept: Record<string, ProductImage[]> = {};
      for (const q of qualities) {
        if (existing[q]?.length) kept[q] = existing[q];
      }
      // Growing single→batch: don't strand the single dropzone images — move
      // them into the slot for the quality they were attached to (the old sole
      // quality if still selected, else the first).
      if (wasSingle && single.length > 0) {
        const target =
          prevQualities[0] && qualities.includes(prevQualities[0])
            ? prevQualities[0]
            : qualities[0];
        if (!kept[target]) kept[target] = single;
        updates.images = [];
        updates.image_file = null;
        updates.image_preview = null;
        updates.image_url = null;
      }
      updates.quality_images = kept;
    } else {
      // Collapsing to single/zero: the single dropzone owns the images again.
      // Promote the surviving quality's images if the dropzone is empty.
      const sole = qualities[0];
      const surviving = sole ? existing[sole] : undefined;
      if (surviving?.length && single.length === 0) {
        updates.images = surviving;
        updates.image_file = null;
        updates.image_preview = null;
        updates.image_url = null;
      }
      updates.quality_images = {};
    }

    onUpdate(index, updates);
  };

  // ── Header label ────────────────────────────────────────────
  const getProductLabel = () => {
    if (!item.category) return 'New Item';
    if (item.category === 'marble') return CATEGORY_LABELS.marble;
    if (item.category === 'magro' && item.sub_category) {
      return `${CATEGORY_LABELS.magro} ${SUB_CATEGORY_LABELS[item.sub_category]}`;
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
  const singleImages   = cardImages(item);

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
              <span className="text-sm sm:text-base font-semibold text-slate-800 truncate">
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
                size="icon"
                onClick={() => onRemove(index)}
                className="h-11 w-11 text-red-500 hover:text-red-700 hover:bg-red-50"
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
                  Same specs (Size, Finish, Qty) will apply to all {item.selected_qualities.length} selected qualities.
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

            {/* Thickness field removed in 2026-06 refactor — column still
                exists in the DB (nullable) for legacy rows. */}

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

            {/* ── Reference Image(s) ────────────────────────────────────── */}
            {/* 0–1 quality → one multi-file dropzone. 2+ qualities → a compact
                multi-file slot per quality, each with its own thumbnail row. */}
            <div className="md:col-span-2">
              {!isMultiQuality ? (
                <>
                  <Label>Reference Images (Optional)</Label>
                  <p className="text-xs text-slate-500 mt-1">
                    Attach up to {MAX_IMAGES_PER_SLOT} photos for this sample.
                  </p>
                  {singleImages.length > 0 && (
                    <ThumbnailRow
                      images={singleImages}
                      altPrefix="Sample reference"
                      onRemove={removeImage}
                    />
                  )}
                  {singleImages.length < MAX_IMAGES_PER_SLOT && (
                    <div className="mt-2 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-slate-300 transition-colors">
                      <input
                        id={`image-${item.id}`}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <label htmlFor={`image-${item.id}`} className="cursor-pointer">
                        <Upload className="mx-auto h-8 w-8 text-slate-400" />
                        <p className="mt-1 text-sm text-slate-600">
                          {singleImages.length > 0 ? 'Add more images' : 'Click to upload'}
                        </p>
                        <p className="text-xs text-slate-400">PNG, JPG up to 10MB each</p>
                      </label>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Label className="flex items-center gap-2 flex-wrap">
                    Reference Images (Optional)
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-normal">
                      per quality
                    </span>
                  </Label>
                  <p className="text-xs text-slate-500 mt-1">
                    Attach photos to any of these {selectedQualities.length} qualities
                    (up to {MAX_IMAGES_PER_SLOT} each). Leave a slot empty to send that
                    item without a reference.
                  </p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedQualities.map((q, qIdx) => {
                      const slotImages = qualityImages(item, q);
                      const isCustom = !qualityOptionsSet.has(q);
                      const slotId = `image-${item.id}-${qIdx}`;
                      return (
                        <div key={q} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
                          <p className="text-xs text-slate-600 mb-2 truncate" title={q}>
                            Reference for{' '}
                            <span className="font-semibold text-slate-800">{q}</span>
                            {isCustom && <span className="text-amber-600"> (custom)</span>}
                            {slotImages.length > 0 && (
                              <span className="text-slate-400"> · {slotImages.length}</span>
                            )}
                          </p>

                          {slotImages.length > 0 && (
                            <ThumbnailRow
                              images={slotImages}
                              altPrefix={`Reference for ${q}`}
                              onRemove={(imageId) => removeQualityImage(q, imageId)}
                              compact
                            />
                          )}

                          {slotImages.length < MAX_IMAGES_PER_SLOT && (
                            <>
                              <input
                                id={slotId}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleQualityImageChange(q, e)}
                                className="hidden"
                              />
                              <label
                                htmlFor={slotId}
                                className="mt-2 flex flex-col items-center justify-center gap-1 cursor-pointer border-2 border-dashed border-slate-200 rounded-md py-3 bg-white hover:border-slate-300 transition-colors"
                              >
                                <Upload className="h-5 w-5 text-slate-400" />
                                <span className="text-xs text-slate-500">
                                  {slotImages.length > 0 ? 'Add more' : 'Click to upload'}
                                </span>
                              </label>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
