import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ProductItem, RequestCategory } from '@/types';
import { KIT_SIZE_OPTIONS } from '@/types';

interface KitItemCardProps {
  item: ProductItem;
  index: number;
  canDelete: boolean;
  onUpdate: (index: number, updates: Partial<ProductItem>) => void;
  onRemove: (index: number) => void;
}

export default function KitItemCard({
  item,
  index,
  canDelete,
  onUpdate,
  onRemove,
}: KitItemCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCategoryChange = (newCategory: RequestCategory) => {
    onUpdate(index, {
      category: newCategory,
      sub_category: '',
      selected_qualities: [],
      quality: '',
      sample_size: '',
      sample_size_custom: '',
      thickness: '',
      finish: '',
    });
  };

  const kitLabel = item.category
    ? `${item.category === 'marble' ? 'Marble' : 'Magro'} Kit`
    : 'New Kit';

  return (
    <Card className="border-amber-200 shadow-sm overflow-hidden border-l-4 border-l-amber-400">
      {/* Card Header */}
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-3 text-left flex-1 min-w-0"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-semibold text-sm flex-shrink-0">
              {index + 1}
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Package className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span className="text-sm sm:text-base font-semibold text-amber-900 truncate">
                {kitLabel}
              </span>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                Kit
              </span>
              {item.sample_size && (
                <span className="text-xs text-amber-600 truncate hidden sm:inline">
                  • {item.sample_size === 'Other' ? (item.sample_size_custom || 'Custom') : item.sample_size}
                </span>
              )}
              {item.quantity > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">
                  Qty: {item.quantity}
                </span>
              )}
            </div>
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4 text-amber-400 ml-auto flex-shrink-0" />
            ) : (
              <ChevronUp className="h-4 w-4 text-amber-400 ml-auto flex-shrink-0" />
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
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            A Kit is a standard presentation box. You only pick the type and size — the Coordinator will decide the exact qualities based on current stock.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Kit Type Toggle */}
            <div>
              <Label>Kit Type *</Label>
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
                    {cat === 'marble' ? 'Marble' : 'Magro'}
                  </button>
                ))}
              </div>
            </div>

            {/* Kit Size */}
            <div>
              <Label>Kit Size *</Label>
              <Select
                value={item.sample_size}
                onValueChange={(value) => onUpdate(index, {
                  sample_size: value,
                  sample_size_custom: value === 'Other' ? '' : undefined,
                })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {KIT_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div>
              <Label>Quantity *</Label>
              <Input
                type="number"
                min="1"
                value={item.quantity || ''}
                onChange={(e) => onUpdate(index, { quantity: parseInt(e.target.value) || 0 })}
                placeholder="1"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Custom size input when "Other" */}
          {item.sample_size === 'Other' && (
            <div>
              <Label>Specify Size *</Label>
              <Input
                value={item.sample_size_custom || ''}
                onChange={(e) => onUpdate(index, { sample_size_custom: e.target.value })}
                placeholder="Enter custom kit size"
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
