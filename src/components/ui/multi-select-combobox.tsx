import * as React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronsUpDown, Check, Search, X, Star, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pushOverlay, popOverlay } from '@/lib/overlayStack';

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

  // Sync with browser history so the hardware/browser back button closes the
  // picker instead of navigating away from the form (which would trigger the
  // form's "unsaved changes" exit warning).
  //
  // Strategy:
  // 1. On open  → pushOverlay() + pushState (so back button fires popstate)
  // 2. On back  → popstate fires → close picker, popOverlay()
  // 3. On Done  → close picker (effect cleanup pops overlay + history.back)
  //
  // The form's exit-guard checks hasOpenOverlay() and skips if true.
  const historyPushedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      // Closed via Done button (not back) — clean up the dummy history entry
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        popOverlay();
        window.history.back();
      }
      return;
    }

    // Opening: register on the overlay stack and push a history entry
    pushOverlay();
    window.history.pushState({ pickerOpen: true }, '');
    historyPushedRef.current = true;

    const handlePopState = () => {
      // Back button consumed our dummy entry
      historyPushedRef.current = false;
      popOverlay();
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [open, onClose]);

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
    // Re-focus after adding so user can keep typing
    setTimeout(() => inputRef.current?.focus(), 50);
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
      if (canCreate) {
        handleCreate();
      } else if (totalFiltered === 1) {
        const single = filteredPopular.length === 1 ? filteredPopular[0] : filteredOptions[0];
        if (single && !value.includes(single)) {
          onChange([...value, single]);
          setSearch('');
        }
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

      {/* Panel — bottom-sheet on mobile (fixed height), centered card on desktop */}
      <div
        ref={panelRef}
        className={cn(
          'absolute bg-white flex flex-col shadow-2xl animate-in duration-200',
          // Mobile: fixed-height bottom-sheet so the search bar never jumps
          'bottom-0 left-0 right-0 h-[85dvh] rounded-t-2xl',
          'slide-in-from-bottom-4 fade-in-0',
          // Desktop: centered card with max-height (content-driven is fine on desktop)
          'sm:h-auto sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:w-full sm:max-w-md sm:rounded-2xl sm:max-h-[70vh]'
        )}
      >
        {/* ─── Handle bar (mobile only) ─── */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-slate-100 shrink-0">
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
          <div className="border-b border-slate-100 bg-slate-50/80 shrink-0">
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

        {/* ─── Search Input + inline Add button ─── */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 shrink-0">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 min-w-0"
            autoComplete="off"
            autoCapitalize="off"
          />
          {/* Clear button — only when there's text and no canCreate (otherwise Add button takes priority) */}
          {search && !canCreate && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 shrink-0"
              aria-label="Clear search"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
          {/* Inline Add button — prominent, replaces clear button when custom entry is possible */}
          {canCreate && (
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-amber-500 text-white text-xs font-semibold active:bg-amber-600 hover:bg-amber-600 transition-colors shrink-0"
              aria-label={`Add "${trimmedSearch}" as custom quality`}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          )}
        </div>

        {/* ─── Options List — flex-1 so it always fills remaining panel height ─── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-1 min-h-0">
          {totalFiltered === 0 ? (
            // Empty state
            canCreate ? (
              // Has typed text that doesn't match anything — show a prominent CTA
              <div className="flex flex-col items-center gap-4 py-10 px-6">
                <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
                  <Plus className="h-7 w-7 text-amber-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-800">No matching quality found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Tap the button below to add it as a custom quality
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="flex items-center gap-2 h-12 px-6 rounded-xl bg-amber-500 text-white text-sm font-semibold active:bg-amber-600 hover:bg-amber-600 transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add &ldquo;{trimmedSearch}&rdquo;
                </button>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-slate-400">
                {emptyMessage}
              </div>
            )
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

              {/* Partial-match hint — results exist but typed text isn't an exact match */}
              {canCreate && totalFiltered > 0 && (
                <div className="mx-2 mt-1 mb-2">
                  <div className="h-px bg-slate-100 mb-2" />
                  <p className="px-2 text-xs text-slate-400 mb-1.5">
                    Not what you&apos;re looking for?
                  </p>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="flex w-full items-center gap-2 rounded-lg py-2.5 px-3 text-sm font-medium border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 active:bg-amber-100 transition-colors min-h-[44px]"
                  >
                    <Plus className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="truncate">
                      Add &ldquo;<span className="font-semibold">{trimmedSearch}</span>&rdquo; as custom
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400 flex justify-between items-center shrink-0 bg-white safe-area-pb">
          <span>
            {isSearching
              ? `${totalFiltered} result${totalFiltered !== 1 ? 's' : ''}`
              : `${options.length} qualities available`}
          </span>
          <span className="text-indigo-600 font-medium">
            {creatable ? 'Select or type to add custom' : 'Tap to select'}
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
  // createLabel is no longer used — the Add button label is always "Add"
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
      />
    </>
  );
}
