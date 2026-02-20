import * as React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronsUpDown, Check, Search, X, Star, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// TYPES
// ============================================================

interface MultiSelectComboboxProps {
  options: string[];
  popularOptions?: string[];
  value: string[]; // Array of selected values (verified + custom mixed)
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  maxDisplay?: number; // Ignored (kept for backward compat) — all chips shown
  creatable?: boolean; // Allow creating custom entries by typing
  createLabel?: string; // Label for the create prompt (default: "Add custom")
}

// ============================================================
// CHIP COMPONENT — Mobile-friendly (min 44px tap target for remove)
// ============================================================

interface ChipProps {
  label: string;
  variant?: 'verified' | 'custom';
  onRemove: () => void;
  disabled?: boolean;
  /** Larger remove target for inside the picker panel */
  large?: boolean;
}

function Chip({ label, variant = 'verified', onRemove, disabled, large }: ChipProps) {
  const isCustom = variant === 'custom';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium rounded-md shrink-0',
        large ? 'px-2.5 py-1.5' : 'px-2 py-1',
        isCustom
          ? 'bg-amber-100 text-amber-800 border border-amber-200'
          : 'bg-indigo-100 text-indigo-800'
      )}
    >
      <span className={cn('truncate', large ? 'max-w-[200px]' : 'max-w-[140px]')}>{label}</span>
      {isCustom && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 shrink-0">
          C
        </span>
      )}
      {!disabled && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              e.preventDefault();
              onRemove();
            }
          }}
          className={cn(
            'shrink-0 rounded-full transition-colors cursor-pointer flex items-center justify-center',
            // 44px min touch target on large variant
            large ? 'min-w-[28px] min-h-[28px] p-1' : 'p-0.5',
            isCustom ? 'hover:bg-amber-200 active:bg-amber-300' : 'hover:bg-indigo-200 active:bg-indigo-300'
          )}
          aria-label={`Remove ${label}`}
        >
          <X className={cn(large ? 'h-3.5 w-3.5' : 'h-3 w-3')} />
        </span>
      )}
    </span>
  );
}

// ============================================================
// OPTION ROW — 44px min height for mobile
// ============================================================

interface OptionRowProps {
  label: string;
  isSelected: boolean;
  onToggle: () => void;
}

function OptionRow({ label, isSelected, onToggle }: OptionRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'relative flex w-full select-none items-center rounded-lg py-3 pl-10 pr-3 text-sm outline-none min-h-[44px]',
        'active:bg-slate-100 hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-indigo-50 text-indigo-900'
      )}
    >
      <span className="absolute left-3 flex h-5 w-5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

// ============================================================
// BOTTOM-SHEET PICKER PANEL
// ============================================================

interface PickerPanelProps {
  open: boolean;
  onClose: () => void;
  options: string[];
  popularOptions: string[];
  value: string[];
  onChange: (value: string[]) => void;
  optionsSet: Set<string>;
  searchPlaceholder: string;
  emptyMessage: string;
  creatable: boolean;
  createLabel: string;
}

function PickerPanel({
  open,
  onClose,
  options,
  popularOptions,
  value,
  onChange,
  optionsSet,
  searchPlaceholder,
  emptyMessage,
  creatable,
  createLabel,
}: PickerPanelProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset search when opening
  useEffect(() => {
    if (open) {
      setSearch('');
      // Delay focus slightly so the animation completes
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [open]);

  const getChipVariant = useCallback(
    (val: string): 'verified' | 'custom' => optionsSet.has(val) ? 'verified' : 'custom',
    [optionsSet]
  );

  // Filter logic
  const isSearching = search.trim().length > 0;
  const lowerSearch = search.toLowerCase();

  const filteredPopular = useMemo(() => {
    if (!isSearching) return popularOptions;
    return popularOptions.filter((o) => o.toLowerCase().includes(lowerSearch));
  }, [popularOptions, isSearching, lowerSearch]);

  const filteredOptions = useMemo(() => {
    const rest = options.filter((o) => !popularOptions.includes(o));
    if (!isSearching) return rest;
    return rest.filter((o) => o.toLowerCase().includes(lowerSearch));
  }, [options, popularOptions, isSearching, lowerSearch]);

  const totalFiltered = filteredPopular.length + filteredOptions.length;

  const trimmedSearch = search.trim();
  const canCreate =
    creatable &&
    trimmedSearch.length > 0 &&
    !value.includes(trimmedSearch) &&
    !options.some((o) => o.toLowerCase() === trimmedSearch.toLowerCase());

  const showSections = !isSearching && popularOptions.length > 0;
  const customCount = value.filter((v) => !optionsSet.has(v)).length;

  const handleToggle = useCallback(
    (option: string) => {
      if (value.includes(option)) {
        onChange(value.filter((v) => v !== option));
      } else {
        onChange([...value, option]);
      }
      setSearch('');
    },
    [value, onChange]
  );

  const handleCreate = useCallback(() => {
    if (!canCreate) return;
    onChange([...value, trimmedSearch]);
    setSearch('');
  }, [canCreate, trimmedSearch, value, onChange]);

  const handleRemoveChip = useCallback(
    (option: string) => {
      onChange(value.filter((v) => v !== option));
    },
    [value, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (totalFiltered === 1 && !canCreate) {
        const single = filteredPopular.length === 1 ? filteredPopular[0] : filteredOptions[0];
        if (single && !value.includes(single)) {
          onChange([...value, single]);
          setSearch('');
        }
      } else if (canCreate) {
        handleCreate();
      }
    } else if (e.key === 'Backspace' && search === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      {/* Panel — bottom-sheet on mobile, centered card on desktop */}
      <div
        ref={panelRef}
        className={cn(
          'absolute bg-white flex flex-col shadow-2xl animate-in duration-200',
          // Mobile: bottom-sheet, full width, rounded top
          'bottom-0 left-0 right-0 max-h-[85dvh] rounded-t-2xl',
          'slide-in-from-bottom-4 fade-in-0',
          // Desktop: centered card
          'sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:w-full sm:max-w-md sm:rounded-2xl sm:max-h-[70vh]'
        )}
      >
        {/* ─── Handle bar (mobile only) ─── */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Select Qualities</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {value.length > 0 ? (
                <>
                  {value.length} selected
                  {customCount > 0 && (
                    <span className="text-amber-600 ml-1">({customCount} custom)</span>
                  )}
                </>
              ) : (
                'Tap to select or type custom'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-lg bg-indigo-600 text-white text-sm font-semibold active:bg-indigo-700 hover:bg-indigo-700 transition-colors"
          >
            Done
          </button>
        </div>

        {/* ─── Selected Chips Strip ─── */}
        {value.length > 0 && (
          <div className="border-b border-slate-100 bg-slate-50/80">
            <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto scrollbar-hide">
              {value.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  variant={getChipVariant(item)}
                  onRemove={() => handleRemoveChip(item)}
                  large
                />
              ))}
            </div>
            {value.length > 1 && (
              <div className="px-4 pb-2">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs text-red-500 hover:text-red-700 font-medium active:text-red-800"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Search Input ─── */}
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-2.5">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            autoComplete="off"
            autoCapitalize="off"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 shrink-0"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* ─── Options List ─── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-1">
          {totalFiltered === 0 && !canCreate ? (
            <div className="py-10 text-center text-sm text-slate-400">
              {creatable
                ? 'No match found. Press Enter to add as custom.'
                : emptyMessage}
            </div>
          ) : (
            <>
              {/* Popular Section */}
              {filteredPopular.length > 0 && (
                <>
                  {showSections && (
                    <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-xs font-medium text-slate-400 uppercase tracking-wide">
                      <Star className="h-3 w-3" />
                      Popular
                    </div>
                  )}
                  {filteredPopular.map((option) => (
                    <OptionRow
                      key={`popular-${option}`}
                      label={option}
                      isSelected={value.includes(option)}
                      onToggle={() => handleToggle(option)}
                    />
                  ))}
                </>
              )}

              {/* Separator */}
              {showSections && filteredPopular.length > 0 && filteredOptions.length > 0 && (
                <div className="mx-2 my-1 h-px bg-slate-100" />
              )}

              {/* All Qualities Section */}
              {filteredOptions.length > 0 && (
                <>
                  {showSections && (
                    <div className="px-3 pt-2 pb-1 text-xs font-medium text-slate-400 uppercase tracking-wide">
                      All Qualities
                    </div>
                  )}
                  {filteredOptions.map((option) => (
                    <OptionRow
                      key={option}
                      label={option}
                      isSelected={value.includes(option)}
                      onToggle={() => handleToggle(option)}
                    />
                  ))}
                </>
              )}

              {/* Create Custom Option */}
              {canCreate && (
                <>
                  {totalFiltered > 0 && <div className="mx-2 my-1 h-px bg-slate-100" />}
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="flex w-full items-center rounded-lg py-3 pl-4 pr-3 text-sm outline-none min-h-[44px] active:bg-amber-50 hover:bg-amber-50 text-amber-800"
                  >
                    <Plus className="h-4 w-4 mr-2 text-amber-600 shrink-0" />
                    <span className="truncate">
                      {createLabel}: &ldquo;<span className="font-semibold">{trimmedSearch}</span>&rdquo;
                    </span>
                    <span className="ml-auto text-[10px] font-medium text-amber-500 uppercase tracking-wider shrink-0 pl-2">
                      Custom
                    </span>
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400 flex justify-between items-center shrink-0 bg-white safe-area-pb">
          <span>
            {isSearching
              ? `${totalFiltered} result${totalFiltered !== 1 ? 's' : ''}${canCreate ? ' + custom' : ''}`
              : `${options.length} qualities available`}
          </span>
          <span className="text-indigo-600 font-medium">
            {creatable ? 'Select or type custom' : 'Tap to select'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MULTI-SELECT COMBOBOX — Main Component
// ============================================================

export function MultiSelectCombobox({
  options,
  popularOptions = [],
  value,
  onChange,
  placeholder = 'Select qualities...',
  searchPlaceholder = 'Type to search or add custom...',
  emptyMessage = 'No matching quality',
  className,
  disabled = false,
  // maxDisplay is no longer used — all chips are shown
  creatable = false,
  createLabel = 'Add custom',
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);

  // Build a Set of all known options for O(1) lookup
  const optionsSet = useMemo(() => new Set(options), [options]);

  // Determine chip variant
  const getChipVariant = useCallback(
    (val: string): 'verified' | 'custom' => optionsSet.has(val) ? 'verified' : 'custom',
    [optionsSet]
  );

  const handleRemoveChip = useCallback(
    (option: string) => {
      onChange(value.filter((v) => v !== option));
    },
    [value, onChange]
  );

  return (
    <>
      {/* ─── Trigger Button ─── */}
      <div className={cn('relative', className)}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => !disabled && setOpen(true)}
          className={cn(
            'flex min-h-12 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            value.length === 0 && 'text-muted-foreground'
          )}
        >
          {value.length === 0 ? (
            <span className="text-sm">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1.5 items-center py-0.5 max-w-[calc(100%-28px)]">
              {value.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  variant={getChipVariant(item)}
                  onRemove={() => handleRemoveChip(item)}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </div>

      {/* ─── Picker Panel (Bottom-sheet on mobile, centered on desktop) ─── */}
      <PickerPanel
        open={open}
        onClose={() => setOpen(false)}
        options={options}
        popularOptions={popularOptions}
        value={value}
        onChange={onChange}
        optionsSet={optionsSet}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
        creatable={creatable}
        createLabel={createLabel}
      />
    </>
  );
}
