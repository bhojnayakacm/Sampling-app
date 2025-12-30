import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { ChevronsUpDown, Check, Search, X, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComboboxProps {
  options: string[];
  popularOptions?: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  popularOptions = [],
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number>(0);

  // Filter options based on search
  const isSearching = search.trim().length > 0;
  const lowerSearch = search.toLowerCase();

  const filteredPopular = React.useMemo(() => {
    if (!isSearching) return popularOptions;
    return popularOptions.filter((option) =>
      option.toLowerCase().includes(lowerSearch)
    );
  }, [popularOptions, isSearching, lowerSearch]);

  const filteredOptions = React.useMemo(() => {
    // When searching, filter all options (excluding popular ones to avoid duplicates)
    const allOptions = isSearching
      ? options.filter((opt) => !popularOptions.includes(opt))
      : options.filter((opt) => !popularOptions.includes(opt));

    if (!isSearching) return allOptions;
    return allOptions.filter((option) =>
      option.toLowerCase().includes(lowerSearch)
    );
  }, [options, popularOptions, isSearching, lowerSearch]);

  const totalFiltered = filteredPopular.length + filteredOptions.length;

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

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    } else if (e.key === 'Enter' && totalFiltered === 1) {
      const singleResult = filteredPopular.length === 1 ? filteredPopular[0] : filteredOptions[0];
      if (singleResult) {
        onChange(singleResult);
        setOpen(false);
        setSearch('');
      }
    }
  };

  const handleSelect = (option: string) => {
    onChange(option);
    setOpen(false);
    setSearch('');
  };

  // Show section headers only when not searching
  const showSections = !isSearching && popularOptions.length > 0;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button - Exact same styling as SelectTrigger */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1'
        )}
      >
        <span className={cn(!value && 'text-muted-foreground')}>
          {value || placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          style={{ width: triggerWidth > 0 ? triggerWidth : '100%', minWidth: '200px' }}
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

          {/* Options List */}
          <div className="max-h-[280px] overflow-y-auto p-1">
            {totalFiltered === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
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
                    {filteredPopular.map((option) => (
                      <button
                        key={`popular-${option}`}
                        type="button"
                        onClick={() => handleSelect(option)}
                        className={cn(
                          'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
                          'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                          value === option && 'bg-accent/50'
                        )}
                      >
                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                          {value === option && <Check className="h-4 w-4 text-primary" />}
                        </span>
                        <span className="truncate">{option}</span>
                      </button>
                    ))}
                  </>
                )}

                {/* Separator between Popular and All */}
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
                    {filteredOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleSelect(option)}
                        className={cn(
                          'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
                          'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                          value === option && 'bg-accent/50'
                        )}
                      >
                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                          {value === option && <Check className="h-4 w-4 text-primary" />}
                        </span>
                        <span className="truncate">{option}</span>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer with count */}
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            {isSearching ? (
              <span>{totalFiltered} result{totalFiltered !== 1 ? 's' : ''}</span>
            ) : (
              <span>{options.length} qualities available</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
