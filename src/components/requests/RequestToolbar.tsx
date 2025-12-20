import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter } from 'lucide-react';
import { RequestStatus, Priority } from '@/types';

interface RequestToolbarProps {
  search: string;
  status: RequestStatus | null;
  priority: Priority | null;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: RequestStatus | null) => void;
  onPriorityChange: (value: Priority | null) => void;
  onReset: () => void;
}

export default function RequestToolbar({
  search,
  status,
  priority,
  onSearchChange,
  onStatusChange,
  onPriorityChange,
  onReset,
}: RequestToolbarProps) {
  // Local state for search input (for immediate UI updates)
  const [localSearch, setLocalSearch] = useState(search);

  // Debounced search - wait 500ms after typing stops
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 500);

    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  // Sync local search with parent when reset
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const hasActiveFilters = search || status || priority;

  return (
    <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm space-y-3 sm:space-y-4">
      {/* Header (Mobile Only) */}
      <div className="flex items-center justify-between sm:hidden">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">Search & Filter</h3>
        </div>
        {hasActiveFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            className="h-8 gap-1 text-xs"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Search Bar - Full Width on Mobile */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
        <Input
          placeholder="Search requests..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-10 pr-4 h-11 w-full text-base"
        />
      </div>

      {/* Filters - Stack Vertically on Mobile, Horizontal on Desktop */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* Status Filter - Full Width on Mobile */}
        <div className="flex-1 w-full sm:w-auto">
          <Select
            value={status || 'all'}
            onValueChange={(value) => onStatusChange(value === 'all' ? null : (value as RequestStatus))}
          >
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_production">In Production</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Priority Filter - Full Width on Mobile */}
        <div className="flex-1 w-full sm:w-auto">
          <Select
            value={priority || 'all'}
            onValueChange={(value) => onPriorityChange(value === 'all' ? null : (value as Priority))}
          >
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset Button - Full Width on Mobile (if filters active) */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={onReset}
            className="gap-2 h-11 w-full sm:w-auto hidden sm:flex"
          >
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Active Filters Summary (Mobile Only) */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 pt-2 border-t sm:hidden">
          <span className="text-xs text-gray-500">Active:</span>
          {search && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
              Search: "{search.substring(0, 20)}{search.length > 20 ? '...' : ''}"
            </span>
          )}
          {status && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
              Status: {status.replace('_', ' ')}
            </span>
          )}
          {priority && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs">
              Priority: {priority}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
