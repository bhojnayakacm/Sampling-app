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
  maxDisplay?: number; // Max chips to display before showing "+N more"
  creatable?: boolean; // Allow creating custom entries by typing
  createLabel?: string; // Label for the create prompt (default: "Add custom")
}

// ============================================================
// CHIP COMPONENT
// ============================================================

interface ChipProps {
  label: string;
  variant?: 'verified' | 'custom';
  onRemove: () => void;
  disabled?: boolean;
}

function Chip({ label, variant = 'verified', onRemove, disabled }: ChipProps) {
  const isCustom = variant === 'custom';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md max-w-[160px]',
        isCustom
          ? 'bg-amber-100 text-amber-800 border border-amber-200'
          : 'bg-indigo-100 text-indigo-800'
      )}
    >
      <span className="truncate">{label}</span>
      {isCustom && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 shrink-0">
          C
        </span>
      )}
      {!disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'shrink-0 rounded-full p-0.5 transition-colors',
            isCustom ? 'hover:bg-amber-200' : 'hover:bg-indigo-200'
          )}
          aria-label={`Remove ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

// ============================================================
// MULTI-SELECT COMBOBOX COMPONENT (CREATABLE)
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
  maxDisplay = 3,
  creatable = false,
  createLabel = 'Add custom',
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number>(0);

  // Build a Set of all known options for O(1) lookup
  const optionsSet = useMemo(() => new Set(options), [options]);

  // Determine chip variant based on whether value is in verified options
  const getChipVariant = useCallback(
    (val: string): 'verified' | 'custom' => {
      return optionsSet.has(val) ? 'verified' : 'custom';
    },
    [optionsSet]
  );

  // Filter options based on search
  const isSearching = search.trim().length > 0;
  const lowerSearch = search.toLowerCase();

  const filteredPopular = useMemo(() => {
    if (!isSearching) return popularOptions;
    return popularOptions.filter((option) =>
      option.toLowerCase().includes(lowerSearch)
    );
  }, [popularOptions, isSearching, lowerSearch]);

  const filteredOptions = useMemo(() => {
    const allOptions = options.filter((opt) => !popularOptions.includes(opt));
    if (!isSearching) return allOptions;
    return allOptions.filter((option) =>
      option.toLowerCase().includes(lowerSearch)
    );
  }, [options, popularOptions, isSearching, lowerSearch]);

  const totalFiltered = filteredPopular.length + filteredOptions.length;

  // Check if the search text could be a new custom entry
  const trimmedSearch = search.trim();
  const canCreate = creatable &&
    trimmedSearch.length > 0 &&
    !value.includes(trimmedSearch) &&
    !options.some((opt) => opt.toLowerCase() === trimmedSearch.toLowerCase());

  // Update trigger width on open
  useEffect(() => {
    if (open && triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Create a custom entry
  const handleCreate = useCallback(() => {
    if (!canCreate) return;
    onChange([...value, trimmedSearch]);
    setSearch('');
  }, [canCreate, trimmedSearch, value, onChange]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (totalFiltered === 1 && !canCreate) {
        // Exact single match from DB list
        const singleResult = filteredPopular.length === 1 ? filteredPopular[0] : filteredOptions[0];
        if (singleResult && !value.includes(singleResult)) {
          onChange([...value, singleResult]);
          setSearch('');
        }
      } else if (canCreate) {
        // Create custom entry
        handleCreate();
      }
    } else if (e.key === 'Backspace' && search === '' && value.length > 0) {
      // Remove last chip when backspace on empty search
      onChange(value.slice(0, -1));
    }
  };

  const handleToggle = useCallback((option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      onChange([...value, option]);
    }
    setSearch('');
  }, [value, onChange]);

  const handleRemoveChip = useCallback((option: string) => {
    onChange(value.filter((v) => v !== option));
  }, [value, onChange]);

  // Show section headers only when not searching
  const showSections = !isSearching && popularOptions.length > 0;

  // Display chips with overflow handling
  const displayChips = value.slice(0, maxDisplay);
  const overflowCount = value.length - maxDisplay;

  // Count custom entries in selection
  const customCount = value.filter((v) => !optionsSet.has(v)).length;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          value.length === 0 && 'text-muted-foreground'
        )}
      >
        {value.length === 0 ? (
          <span>{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1.5 items-center py-0.5">
            {displayChips.map((item) => (
              <Chip
                key={item}
                label={item}
                variant={getChipVariant(item)}
                onRemove={() => handleRemoveChip(item)}
                disabled={disabled}
              />
            ))}
            {overflowCount > 0 && (
              <span className="text-xs text-muted-foreground font-medium px-1">
                +{overflowCount} more
              </span>
            )}
          </div>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          style={{ width: triggerWidth > 0 ? triggerWidth : '100%', minWidth: '240px' }}
        >
          {/* Search Input */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <X
                className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                onClick={() => setSearch('')}
              />
            )}
          </div>

          {/* Selected Count */}
          {value.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b">
              <span className="text-xs font-medium text-slate-600">
                {value.length} selected
                {customCount > 0 && (
                  <span className="text-amber-600 ml-1">
                    ({customCount} custom)
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-[280px] overflow-y-auto p-1">
            {totalFiltered === 0 && !canCreate ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
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
                      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        <Star className="h-3 w-3" />
                        Popular
                      </div>
                    )}
                    {filteredPopular.map((option) => {
                      const isSelected = value.includes(option);
                      return (
                        <button
                          key={`popular-${option}`}
                          type="button"
                          onClick={() => handleToggle(option)}
                          className={cn(
                            'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
                            'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                            isSelected && 'bg-indigo-50 text-indigo-900'
                          )}
                        >
                          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                            {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
                          </span>
                          <span className="truncate">{option}</span>
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Separator */}
                {showSections && filteredPopular.length > 0 && filteredOptions.length > 0 && (
                  <div className="-mx-1 my-1 h-px bg-muted" />
                )}

                {/* All Qualities Section */}
                {filteredOptions.length > 0 && (
                  <>
                    {showSections && (
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        All Qualities
                      </div>
                    )}
                    {filteredOptions.map((option) => {
                      const isSelected = value.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleToggle(option)}
                          className={cn(
                            'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
                            'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                            isSelected && 'bg-indigo-50 text-indigo-900'
                          )}
                        >
                          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                            {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
                          </span>
                          <span className="truncate">{option}</span>
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Create Custom Option */}
                {canCreate && (
                  <>
                    {totalFiltered > 0 && (
                      <div className="-mx-1 my-1 h-px bg-muted" />
                    )}
                    <button
                      type="button"
                      onClick={handleCreate}
                      className="relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-3 pr-2 text-sm outline-none hover:bg-amber-50 text-amber-800"
                    >
                      <Plus className="h-4 w-4 mr-2 text-amber-600 shrink-0" />
                      <span className="truncate">
                        {createLabel}: "<span className="font-semibold">{trimmedSearch}</span>"
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

          {/* Footer */}
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground flex justify-between">
            <span>
              {isSearching
                ? `${totalFiltered} result${totalFiltered !== 1 ? 's' : ''}${canCreate ? ' + custom' : ''}`
                : `${options.length} qualities available`
              }
            </span>
            <span className="text-indigo-600 font-medium">
              {creatable ? 'Select or type custom' : 'Click to select multiple'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
