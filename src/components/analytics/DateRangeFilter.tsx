import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';

export type DateRange = 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom';

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const rangeLabels: Record<DateRange, string> = {
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    this_year: 'This Year',
    custom: 'Custom Range',
  };

  return (
    <div className="flex items-center gap-3">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={(val) => onChange(val as DateRange)}>
        <SelectTrigger className="w-[180px] h-11 rounded-xl border-2 shadow-premium-sm">
          <SelectValue>{rangeLabels[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="today" className="rounded-lg">
            Today
          </SelectItem>
          <SelectItem value="this_week" className="rounded-lg">
            This Week
          </SelectItem>
          <SelectItem value="this_month" className="rounded-lg">
            This Month
          </SelectItem>
          <SelectItem value="this_year" className="rounded-lg">
            This Year
          </SelectItem>
          <SelectItem value="custom" className="rounded-lg">
            Custom Range
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
