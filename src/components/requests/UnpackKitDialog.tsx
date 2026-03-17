import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Package, Plus, Trash2, Loader2, Pencil, Copy } from 'lucide-react';
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
import { useUnpackKit, useUpdateKitContents } from '@/lib/api/requests';

// ============================================================
// TYPES
// ============================================================

interface UnpackKitDialogProps {
  kitItem: RequestItemDB;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnpacked?: () => void;
  /** Pass existing children to open in "edit" mode */
  existingChildren?: RequestItemDB[];
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
// REVERSE-MAP: DB children → UnpackEntry[] for edit mode
// ============================================================
// Groups children by (sub_category, thickness, finish) so the
// coordinator sees the same "entry groups" they originally created.

function childrenToEntries(
  children: RequestItemDB[],
  isMarble: boolean,
): UnpackEntry[] {
  if (children.length === 0) return [createEmptyEntry()];

  const groups = new Map<string, UnpackEntry>();

  for (const child of children) {
    // Detect "Other" thickness
    const optionsKey: OptionsKey | null = isMarble
      ? 'marble'
      : child.sub_category
        ? (getOptionsKey('magro', child.sub_category as SubCategory) as OptionsKey)
        : null;

    const thicknessOptions = optionsKey ? PRODUCT_THICKNESS_OPTIONS[optionsKey] : [];
    const finishOptionsList = optionsKey ? (PRODUCT_FINISH_OPTIONS[optionsKey] ?? []) : [];

    const isCustomThickness = child.thickness != null && !thicknessOptions.includes(child.thickness);
    const isCustomFinish = child.finish != null && child.finish !== '' && !finishOptionsList.includes(child.finish);

    const resolvedThickness = isCustomThickness ? 'Other' : (child.thickness || '');
    const resolvedFinish = isCustomFinish ? 'Other' : (child.finish || '');

    const key = [
      child.sub_category || '',
      resolvedThickness,
      isCustomThickness ? child.thickness : '',
      resolvedFinish,
      isCustomFinish ? child.finish : '',
    ].join('||');

    const existing = groups.get(key);
    if (existing) {
      // Add quality to the existing group (if not already present)
      if (child.quality && !existing.selected_qualities.includes(child.quality)) {
        existing.selected_qualities.push(child.quality);
      }
      // Keep the quantity from the first child (they should all match within a group)
    } else {
      groups.set(key, {
        id: crypto.randomUUID(),
        sub_category: (child.sub_category || '') as SubCategory | '',
        selected_qualities: child.quality ? [child.quality] : [],
        thickness: resolvedThickness,
        thickness_custom: isCustomThickness ? (child.thickness || '') : '',
        finish: resolvedFinish,
        finish_custom: isCustomFinish ? (child.finish || '') : '',
        quantity: child.quantity,
      });
    }
  }

  return Array.from(groups.values());
}

// ============================================================
// CONSOLIDATE: merge duplicate items before sending to RPC
// ============================================================

interface UnpackPayloadItem {
  quality: string;
  sub_category: string | null;
  thickness: string;
  finish: string | null;
  quantity: number;
}

function consolidateItems(items: UnpackPayloadItem[]): UnpackPayloadItem[] {
  const map = new Map<string, UnpackPayloadItem>();

  for (const item of items) {
    const key = [
      item.quality,
      item.sub_category || '',
      item.thickness,
      item.finish || '',
    ].join('||');

    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, { ...item });
    }
  }

  return Array.from(map.values());
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
            {entry.thickness === 'Other' && (
              <Input
                value={entry.thickness_custom}
                onChange={(e) => onUpdate({ thickness_custom: e.target.value })}
                placeholder="e.g. 25mm"
                className="mt-1"
              />
            )}
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
              {entry.finish === 'Other' && (
                <Input
                  value={entry.finish_custom}
                  onChange={(e) => onUpdate({ finish_custom: e.target.value })}
                  placeholder="e.g. Honed"
                  className="mt-1"
                />
              )}
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
    </div>
  );
}

// ============================================================
// VALIDATE a set of entries
// ============================================================

function validateEntries(entries: UnpackEntry[], isMarble: boolean): boolean {
  return (
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
    })
  );
}

// ============================================================
// EXPLODE entries → payload items
// ============================================================

function entriesToPayload(entries: UnpackEntry[]): UnpackPayloadItem[] {
  return entries.flatMap((entry) =>
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
}

// ============================================================
// MAIN DIALOG
// ============================================================

export default function UnpackKitDialog({
  kitItem,
  open,
  onOpenChange,
  onUnpacked,
  existingChildren,
}: UnpackKitDialogProps) {
  const isEditMode = !!existingChildren && existingChildren.length > 0;
  const kitQty = kitItem.quantity;
  const showQtyHandling = kitQty > 1;

  const unpackKit = useUnpackKit();
  const updateKitContents = useUpdateKitContents();
  const isMutating = unpackKit.isPending || updateKitContents.isPending;

  const isMarble = kitItem.product_type === 'marble';
  const kitLabel = isMarble ? 'Marble Kit' : 'Magro Kit';

  // ── Qty > 1 handling ──
  const [kitsIdentical, setKitsIdentical] = useState(true);
  // Tab state for non-identical kits: index 0..(kitQty-1)
  const [activeTab, setActiveTab] = useState(0);

  // ── Entries state ──
  // For identical kits (or qty=1): single flat array.
  // For non-identical: array of arrays, one per kit copy.
  const [singleEntries, setSingleEntries] = useState<UnpackEntry[]>([createEmptyEntry()]);
  const [tabbedEntries, setTabbedEntries] = useState<UnpackEntry[][]>([]);

  // ── Initialize on open ──
  useEffect(() => {
    if (!open) return;

    setActiveTab(0);

    if (isEditMode) {
      // Edit mode: pre-fill from existing children
      const prefilled = childrenToEntries(existingChildren!, isMarble);
      setSingleEntries(prefilled);
      setKitsIdentical(true);
      // For tabbed: pre-fill every tab with the same entries (best guess)
      if (kitQty > 1) {
        setTabbedEntries(
          Array.from({ length: kitQty }, () =>
            prefilled.map((e) => ({ ...e, id: crypto.randomUUID() })),
          ),
        );
      }
    } else {
      // Fresh unpack
      setSingleEntries([createEmptyEntry()]);
      setKitsIdentical(true);
      if (kitQty > 1) {
        setTabbedEntries(
          Array.from({ length: kitQty }, () => [createEmptyEntry()]),
        );
      }
    }
  }, [open, isEditMode, isMarble, kitQty, existingChildren]);

  // ── When toggling identical ↔ non-identical, sync data ──
  const handleIdenticalToggle = useCallback(
    (checked: boolean) => {
      if (checked) {
        // Switching TO identical: copy active tab's entries into the single array
        if (tabbedEntries.length > 0 && tabbedEntries[activeTab]) {
          setSingleEntries(
            tabbedEntries[activeTab].map((e) => ({ ...e, id: crypto.randomUUID() })),
          );
        }
      } else {
        // Switching TO non-identical: fan out single entries to all tabs
        setTabbedEntries(
          Array.from({ length: kitQty }, () =>
            singleEntries.map((e) => ({ ...e, id: crypto.randomUUID() })),
          ),
        );
        setActiveTab(0);
      }
      setKitsIdentical(checked);
    },
    [singleEntries, tabbedEntries, activeTab, kitQty],
  );

  // ── Entry CRUD helpers (works on active dataset) ──
  const getActiveEntries = (): UnpackEntry[] => {
    if (!showQtyHandling || kitsIdentical) return singleEntries;
    return tabbedEntries[activeTab] || [];
  };

  const setActiveEntries = (updater: (prev: UnpackEntry[]) => UnpackEntry[]) => {
    if (!showQtyHandling || kitsIdentical) {
      setSingleEntries(updater);
    } else {
      setTabbedEntries((prev) =>
        prev.map((tab, i) => (i === activeTab ? updater(tab) : tab)),
      );
    }
  };

  const updateEntry = (id: string, updates: Partial<UnpackEntry>) => {
    setActiveEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    );
  };

  const removeEntry = (id: string) => {
    setActiveEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const addEntry = () => {
    setActiveEntries((prev) => [...prev, createEmptyEntry()]);
  };

  // ── Validation across all entries ──
  const allEntrySets: UnpackEntry[][] = (() => {
    if (!showQtyHandling || kitsIdentical) return [singleEntries];
    return tabbedEntries;
  })();

  const isValid = allEntrySets.every((entries) => validateEntries(entries, isMarble));

  // ── Total child item count preview ──
  const totalItems = allEntrySets.reduce(
    (sum, entries) =>
      sum +
      entries.reduce((s, e) => s + e.selected_qualities.length, 0),
    0,
  );
  // If identical and qty > 1, multiply
  const displayTotal =
    showQtyHandling && kitsIdentical ? totalItems * kitQty : totalItems;

  // ── Submit ──
  const handleConfirm = async () => {
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    let payload: UnpackPayloadItem[];

    if (!showQtyHandling || kitsIdentical) {
      // Single set — multiply quantities by kit qty
      const raw = entriesToPayload(singleEntries);
      payload = raw.map((item) => ({
        ...item,
        quantity: item.quantity * kitQty,
      }));
    } else {
      // Non-identical: flatten all tabs
      const raw = tabbedEntries.flatMap((tabEntries) =>
        entriesToPayload(tabEntries),
      );
      payload = raw;
    }

    // Consolidate duplicates
    payload = consolidateItems(payload);

    try {
      if (isEditMode) {
        await updateKitContents.mutateAsync({
          kitItemId: kitItem.id,
          items: payload,
        });
        toast.success(
          `Kit updated with ${payload.length} item${payload.length !== 1 ? 's' : ''}`,
        );
      } else {
        await unpackKit.mutateAsync({
          kitItemId: kitItem.id,
          items: payload,
        });
        toast.success(
          `Kit unpacked with ${payload.length} item${payload.length !== 1 ? 's' : ''}`,
        );
      }
      onOpenChange(false);
      onUnpacked?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save kit contents');
    }
  };

  const activeEntries = getActiveEntries();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-800">
            {isEditMode ? (
              <Pencil className="h-5 w-5" />
            ) : (
              <Package className="h-5 w-5" />
            )}
            {isEditMode ? 'Edit' : 'Unpack'} {kitLabel} — {kitItem.sample_size}
            {kitQty > 1 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                ×{kitQty}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {isEditMode
              ? 'Edit the qualities and specs for this kit. Changes replace the current contents.'
              : `Specify the exact qualities and specs for this kit. The size (${kitItem.sample_size}) is inherited from the kit. Each selected quality becomes a separate item.`}
          </p>

          {/* ── Qty > 1: identical toggle ── */}
          {showQtyHandling && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">
                  All {kitQty} kits are identical?
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {kitsIdentical
                    ? 'Fill once — contents are multiplied across all kits.'
                    : `Fill each kit separately using the tabs below.`}
                </p>
              </div>
              <Switch
                checked={kitsIdentical}
                onCheckedChange={handleIdenticalToggle}
              />
            </div>
          )}

          {/* ── Tabs for non-identical kits ── */}
          {showQtyHandling && !kitsIdentical && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {Array.from({ length: kitQty }, (_, i) => {
                const tabValid = validateEntries(tabbedEntries[i] || [], isMarble);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveTab(i)}
                    className={[
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap',
                      activeTab === i
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    Kit {i + 1}
                    {tabValid && (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Entry cards ── */}
          {activeEntries.map((entry, idx) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              index={idx}
              isMarble={isMarble}
              canRemove={activeEntries.length > 1}
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

          {/* ── Copy to all tabs shortcut ── */}
          {showQtyHandling && !kitsIdentical && activeEntries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTabbedEntries((prev) =>
                  prev.map((_, i) =>
                    i === activeTab
                      ? prev[i]
                      : activeEntries.map((e) => ({ ...e, id: crypto.randomUUID() })),
                  ),
                );
                toast.success(`Kit ${activeTab + 1} contents copied to all other tabs`);
              }}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-xs text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy this tab to all other kits
            </button>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {displayTotal > 0 && (
            <span className="text-xs text-slate-500 mr-auto">
              {displayTotal} item{displayTotal !== 1 ? 's' : ''} will be {isEditMode ? 'saved' : 'created'}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMutating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || isMutating}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isMutating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isEditMode ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                Save Changes
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
