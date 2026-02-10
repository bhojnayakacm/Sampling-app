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
import { Search, X, AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RequestStatus, Priority } from '@/types';

const PRODUCT_TYPES = ['Marble', 'Tile', 'Magro Stone', 'Quartz', 'Terrazzo'];

interface RequestToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onReset: () => void;
  priority: Priority | null;
  onPriorityChange: (value: Priority | null) => void;
  // Status filter — dropdown renders only when onStatusChange is provided
  status?: RequestStatus | null;
  onStatusChange?: (value: RequestStatus | null) => void;
  // Product Type filter — renders only when onProductTypeChange is provided
  productType?: string | null;
  onProductTypeChange?: (value: string | null) => void;
  // Overdue filter
  overdue?: boolean;
  onOverdueChange?: (value: boolean) => void;
  hideDraftStatus?: boolean;
}

export default function RequestToolbar({
  search,
  onSearchChange,
  onReset,
  priority,
  onPriorityChange,
  status,
  onStatusChange,
  productType,
  onProductTypeChange,
  overdue = false,
  onOverdueChange,
  hideDraftStatus = false,
}: RequestToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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

  const hasActiveFilters = search || status || priority || overdue || productType;
  const filterCount = [status, productType, priority, overdue].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* ========== SINGLE ROW on md+ ========== */}
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
          <Input
            placeholder="Search requests..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10 pr-4 h-10 w-full border-gray-200 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
          />
        </div>

        {/* Mobile Filter Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className={cn(
            'h-10 px-3 md:hidden relative border-gray-200',
            showMobileFilters && 'bg-indigo-50 border-indigo-300 text-indigo-600'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {filterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </Button>

        {/* ---- Desktop Inline Filters (md+) ---- */}

        {/* Status Dropdown (shown only when onStatusChange is provided, e.g. RequestList) */}
        {onStatusChange && (
          <div className="hidden md:block w-[180px] flex-shrink-0">
            <Select
              value={status || 'all'}
              onValueChange={(v) => onStatusChange(v === 'all' ? null : (v as RequestStatus))}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {!hideDraftStatus && <SelectItem value="draft">Draft</SelectItem>}
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
        )}

        {/* Product Type Dropdown (shown only when onProductTypeChange is provided, e.g. CoordinatorDashboard) */}
        {onProductTypeChange && (
          <div className="hidden md:block w-[160px] flex-shrink-0">
            <Select
              value={productType || 'all'}
              onValueChange={(v) => onProductTypeChange(v === 'all' ? null : v)}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {PRODUCT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Priority Dropdown */}
        <div className="hidden md:block w-[150px] flex-shrink-0">
          <Select
            value={priority || 'all'}
            onValueChange={(v) => onPriorityChange(v === 'all' ? null : (v as Priority))}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Overdue Toggle */}
        {onOverdueChange && (
          <Button
            variant={overdue ? 'default' : 'outline'}
            size="sm"
            onClick={() => onOverdueChange(!overdue)}
            className={cn(
              'hidden md:inline-flex h-10 gap-2 whitespace-nowrap flex-shrink-0',
              overdue
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
            )}
          >
            <AlertTriangle className="h-4 w-4" />
            Overdue
          </Button>
        )}

        {/* Clear */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={onReset}
            className="hidden md:inline-flex gap-2 h-10 whitespace-nowrap flex-shrink-0 border-gray-200"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* ========== MOBILE EXPANDED FILTERS ========== */}
      {showMobileFilters && (
        <div className="flex flex-col gap-3 md:hidden">
          {/* Status (only if onStatusChange is provided) */}
          {onStatusChange && (
            <Select
              value={status || 'all'}
              onValueChange={(v) => onStatusChange(v === 'all' ? null : (v as RequestStatus))}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {!hideDraftStatus && <SelectItem value="draft">Draft</SelectItem>}
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
          )}

          {/* Product Type (only if onProductTypeChange is provided) */}
          {onProductTypeChange && (
            <Select
              value={productType || 'all'}
              onValueChange={(v) => onProductTypeChange(v === 'all' ? null : v)}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {PRODUCT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Priority */}
          <Select
            value={priority || 'all'}
            onValueChange={(v) => onPriorityChange(v === 'all' ? null : (v as Priority))}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>

          {/* Overdue */}
          {onOverdueChange && (
            <Button
              variant={overdue ? 'default' : 'outline'}
              size="sm"
              onClick={() => onOverdueChange(!overdue)}
              className={cn(
                'h-10 gap-2 whitespace-nowrap',
                overdue
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              Overdue
            </Button>
          )}

          {/* Clear */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={onReset}
              className="gap-2 h-10 whitespace-nowrap border-gray-200"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-xs text-gray-500">Active:</span>
              {search && (
                <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  "{search.substring(0, 20)}{search.length > 20 ? '...' : ''}"
                </span>
              )}
              {status && (
                <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs capitalize">
                  {status.replace(/_/g, ' ')}
                </span>
              )}
              {productType && (
                <span className="inline-flex items-center px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
                  {productType}
                </span>
              )}
              {priority && (
                <span className="inline-flex items-center px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs capitalize">
                  {priority}
                </span>
              )}
              {overdue && (
                <span className="inline-flex items-center px-2 py-1 bg-red-50 text-red-700 rounded text-xs">
                  Overdue
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
