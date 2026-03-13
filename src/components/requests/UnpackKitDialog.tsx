import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Package, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { RequestItemDB, SubCategory, OptionsKey } from '@/types';
import {
  PRODUCT_THICKNESS_OPTIONS,
  PRODUCT_FINISH_OPTIONS,
  MAGRO_SUB_CATEGORIES,
  SUB_CATEGORY_LABELS,
  getOptionsKey,
} from '@/types';
import {
  PRODUCT_QUALITIES_BY_KEY,
  POPULAR_QUALITIES,
  type ProductTypeKey,
} from '@/lib/productData';
import { useUnpackKit } from '@/lib/api/requests';

// ============================================================
// TYPES
// ============================================================

interface UnpackKitDialogProps {
  kitItem: RequestItemDB;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnpacked?: () => void;
}

interface UnpackEntry {
  id: string;
  sub_category: SubCategory | '';
  selected_qualities: string[];
  thickness: string;
  thickness_custom: string;
  finish: string;
  finish_custom: string;
  quantity: number;
}

function createEmptyEntry(): UnpackEntry {
  return {
    id: crypto.randomUUID(),
    sub_category: '',
    selected_qualities: [],
    thickness: '',
    thickness_custom: '',
    finish: '',
    finish_custom: '',
    quantity: 1,
  };
}

// ============================================================
// ENTRY CARD — one allocation group within the unpack dialog
// ============================================================

function EntryCard({
  entry,
  index,
  isMarble,
  canRemove,
  onUpdate,
  onRemove,
}: {
  entry: UnpackEntry;
  index: number;
  isMarble: boolean;
  canRemove: boolean;
  onUpdate: (updates: Partial<UnpackEntry>) => void;
  onRemove: () => void;
}) {
  const optionsKey: OptionsKey | null = isMarble
    ? 'marble'
    : entry.sub_category
      ? (getOptionsKey('magro', entry.sub_category as SubCategory) as OptionsKey)
      : null;

  const productTypeKey = optionsKey as ProductTypeKey | null;

  const qualityOptions = useMemo(
    () => (productTypeKey ? PRODUCT_QUALITIES_BY_KEY[productTypeKey] || [] : []),
    [productTypeKey],
  );
  const popularQualities = useMemo(
    () => (productTypeKey ? POPULAR_QUALITIES[productTypeKey] || [] : []),
    [productTypeKey],
  );

  const thicknessOptions = optionsKey ? PRODUCT_THICKNESS_OPTIONS[optionsKey] : [];
  const finishOptions = optionsKey ? PRODUCT_FINISH_OPTIONS[optionsKey] : null;
  const showFinish = finishOptions !== null;

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          Item Group {index + 1}
        </span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Sub-category (magro only) */}
      {!isMarble && (
        <div>
          <Label className="text-xs">Sub-Category *</Label>
          <Select
            value={entry.sub_category}
            onValueChange={(v) =>
              onUpdate({
                sub_category: v as SubCategory,
                selected_qualities: [],
                thickness: '',
                thickness_custom: '',
                finish: '',
                finish_custom: '',
              })
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select sub-category" />
            </SelectTrigger>
            <SelectContent>
              {MAGRO_SUB_CATEGORIES.map((sub) => (
                <SelectItem key={sub} value={sub}>
                  {SUB_CATEGORY_LABELS[sub]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Quality multi-select */}
      {(isMarble || entry.sub_category) && (
        <div>
          <Label className="text-xs">Qualities *</Label>
          <MultiSelectCombobox
            options={qualityOptions}
            popularOptions={popularQualities}
            value={entry.selected_qualities}
            onChange={(v) => onUpdate({ selected_qualities: v })}
            placeholder="Select qualities..."
            className="mt-1"
            creatable
          />
        </div>
      )}

      {/* Thickness + Finish + Quantity */}
      {(isMarble || entry.sub_category) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Thickness *</Label>
            <Select
              value={entry.thickness}
              onValueChange={(v) =>
                onUpdate({ thickness: v, thickness_custom: v === 'Other' ? '' : '' })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {thicknessOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showFinish && (
            <div>
              <Label className="text-xs">Finish *</Label>
              <Select
                value={entry.finish}
                onValueChange={(v) =>
                  onUpdate({ finish: v, finish_custom: v === 'Other' ? '' : '' })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {finishOptions!.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">Qty per quality</Label>
            <Input
              type="number"
              min="1"
              value={entry.quantity || ''}
              onChange={(e) =>
                onUpdate({ quantity: parseInt(e.target.value) || 0 })
              }
              placeholder="1"
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* Custom thickness input */}
      {entry.thickness === 'Other' && (
        <div>
          <Label className="text-xs">Custom Thickness *</Label>
          <Input
            value={entry.thickness_custom}
            onChange={(e) => onUpdate({ thickness_custom: e.target.value })}
            placeholder="Enter custom thickness"
            className="mt-1"
          />
        </div>
      )}

      {/* Custom finish input */}
      {entry.finish === 'Other' && showFinish && (
        <div>
          <Label className="text-xs">Custom Finish *</Label>
          <Input
            value={entry.finish_custom}
            onChange={(e) => onUpdate({ finish_custom: e.target.value })}
            placeholder="Enter custom finish"
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN DIALOG
// ============================================================

export default function UnpackKitDialog({
  kitItem,
  open,
  onOpenChange,
  onUnpacked,
}: UnpackKitDialogProps) {
  const [entries, setEntries] = useState<UnpackEntry[]>([createEmptyEntry()]);
  const unpackKit = useUnpackKit();

  const isMarble = kitItem.product_type === 'marble';
  const kitLabel = isMarble ? 'Marble Kit' : 'Magro Kit';

  // Reset entries when dialog opens
  useEffect(() => {
    if (open) {
      setEntries([createEmptyEntry()]);
    }
  }, [open]);

  const updateEntry = (id: string, updates: Partial<UnpackEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    );
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, createEmptyEntry()]);
  };

  // Validate all entries
  const isValid =
    entries.length > 0 &&
    entries.every((entry) => {
      if (entry.selected_qualities.length === 0) return false;
      if (!entry.thickness) return false;
      if (entry.thickness === 'Other' && !entry.thickness_custom.trim()) return false;
      if (entry.quantity < 1) return false;
      if (!isMarble && !entry.sub_category) return false;

      const optionsKey = isMarble
        ? 'marble'
        : getOptionsKey('magro', entry.sub_category as SubCategory);
      if (optionsKey) {
        const finishOpts = PRODUCT_FINISH_OPTIONS[optionsKey];
        if (finishOpts !== null) {
          if (!entry.finish) return false;
          if (entry.finish === 'Other' && !entry.finish_custom.trim()) return false;
        }
      }
      return true;
    });

  // Total child items that will be created
  const totalItems = entries.reduce(
    (sum, e) => sum + e.selected_qualities.length,
    0,
  );

  const handleConfirm = async () => {
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Explode: each quality in each entry becomes a separate child item
    const items = entries.flatMap((entry) =>
      entry.selected_qualities.map((quality) => ({
        quality,
        sub_category: entry.sub_category || null,
        thickness:
          entry.thickness === 'Other'
            ? entry.thickness_custom
            : entry.thickness,
        finish:
          entry.finish === 'Other'
            ? entry.finish_custom
            : entry.finish || null,
        quantity: entry.quantity,
      })),
    );

    try {
      await unpackKit.mutateAsync({ kitItemId: kitItem.id, items });
      toast.success(
        `Kit unpacked with ${items.length} item${items.length > 1 ? 's' : ''}`,
      );
      onOpenChange(false);
      onUnpacked?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to unpack kit');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-800">
            <Package className="h-5 w-5" />
            Unpack {kitLabel} — {kitItem.sample_size}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Specify the exact qualities and specs for this kit. The size (
            {kitItem.sample_size}) is inherited from the kit. Each selected
            quality becomes a separate item.
          </p>

          {entries.map((entry, idx) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              index={idx}
              isMarble={isMarble}
              canRemove={entries.length > 1}
              onUpdate={(updates) => updateEntry(entry.id, updates)}
              onRemove={() => removeEntry(entry.id)}
            />
          ))}

          <button
            type="button"
            onClick={addEntry}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Another Item Group
          </button>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {totalItems > 0 && (
            <span className="text-xs text-slate-500 mr-auto">
              {totalItems} item{totalItems !== 1 ? 's' : ''} will be created
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={unpackKit.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || unpackKit.isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {unpackKit.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Unpacking...
              </>
            ) : (
              <>
                <Package className="mr-2 h-4 w-4" />
                Confirm Unpack
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
