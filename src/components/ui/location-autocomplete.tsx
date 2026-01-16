import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  hamlet?: string;
  suburb?: string;
  state?: string;
  country?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: NominatimAddress;
}

interface LocationSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'e.g., Mumbai, Maharashtra',
  className,
  error,
  disabled,
}: LocationAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, width: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Calculate dropdown position based on input element
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4, // 4px gap below input
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  // Update position when dropdown opens or window scrolls/resizes
  useEffect(() => {
    if (showDropdown) {
      updateDropdownPosition();

      const handleScrollOrResize = () => {
        updateDropdownPosition();
      };

      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [showDropdown, updateDropdownPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside both input and dropdown
      if (
        inputRef.current &&
        !inputRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      // Use capture phase to handle clicks before they bubble
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }
  }, [showDropdown]);

  // Extract city name from address using priority logic
  const extractCityName = (address: NominatimAddress): string | null => {
    // Priority order for city name
    return (
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.hamlet ||
      address.suburb ||
      null
    );
  };

  // Format location as "City, State" or just "City" if no state
  const formatLocation = (address: NominatimAddress): string | null => {
    const cityName = extractCityName(address);
    if (!cityName) return null;

    const stateName = address.state;
    return stateName ? `${cityName}, ${stateName}` : cityName;
  };

  // Fetch suggestions from Nominatim API
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      // Add India bias for better results
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&countrycodes=in&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch');

      const data: NominatimResult[] = await response.json();

      // Format suggestions and deduplicate
      const seenLocations = new Set<string>();
      const formattedSuggestions: LocationSuggestion[] = [];

      for (const item of data) {
        const formattedName = formatLocation(item.address);

        // Skip if we couldn't format the location or if it's a duplicate
        if (!formattedName || seenLocations.has(formattedName.toLowerCase())) {
          continue;
        }

        seenLocations.add(formattedName.toLowerCase());
        formattedSuggestions.push({
          place_id: item.place_id,
          display_name: formattedName,
          lat: item.lat,
          lon: item.lon,
        });

        // Stop after 5 unique suggestions
        if (formattedSuggestions.length >= 5) break;
      }

      setSuggestions(formattedSuggestions);
      if (formattedSuggestions.length > 0) {
        setShowDropdown(true);
        updateDropdownPosition();
      }
    } catch (error) {
      console.error('Location search error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [updateDropdownPosition]);

  // Debounced search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setHighlightedIndex(-1);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounced search (500ms)
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 500);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    setInputValue(suggestion.display_name);
    onChange(suggestion.display_name);
    setShowDropdown(false);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Render dropdown using Portal to avoid overflow clipping
  const renderDropdown = () => {
    if (!showDropdown || suggestions.length === 0) return null;

    const dropdown = (
      <div
        ref={dropdownRef}
        style={{
          position: 'absolute',
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          zIndex: 9999,
        }}
        className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
      >
        <ul className="py-1 max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.place_id}
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                'px-3 py-2.5 cursor-pointer flex items-center gap-2 text-sm transition-colors',
                highlightedIndex === index
                  ? 'bg-indigo-50 text-indigo-900'
                  : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <MapPin className={cn(
                'h-4 w-4 shrink-0',
                highlightedIndex === index ? 'text-indigo-500' : 'text-slate-400'
              )} />
              <span className="truncate">{suggestion.display_name}</span>
            </li>
          ))}
        </ul>
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100">
          <p className="text-[10px] text-slate-400">
            Powered by OpenStreetMap
          </p>
        </div>
      </div>
    );

    // Render to document.body using Portal
    return createPortal(dropdown, document.body);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              updateDropdownPosition();
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          className={cn('pr-10', className)}
          error={error}
          disabled={disabled}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Dropdown rendered via Portal */}
      {renderDropdown()}
    </div>
  );
}
