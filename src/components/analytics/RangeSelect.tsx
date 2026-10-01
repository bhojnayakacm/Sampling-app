import { Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RANGE_DEFS, type RangeKey } from '@/lib/analytics/computeAnalytics';

const RANGE_ORDER: RangeKey[] = ['30d', '90d', '12m', 'all'];

interface RangeSelectProps {
  value: RangeKey;
  onChange: (value: RangeKey) => void;
}

/**
 * The single date-range filter. Presets as rows, nearest first — nobody
 * fights a calendar grid to say "last 30 days". It scopes every period metric
 * below it; the "Pipeline right now" panel is labelled as a live snapshot so
 * readers never assume it moved with the range.
 */
export default function RangeSelect({ value, onChange }: RangeSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as RangeKey)}>
      <SelectTrigger
        aria-label="Date range"
        className="h-10 w-[184px] gap-2 rounded-lg border-slate-200 bg-white text-sm font-medium text-slate-700"
      >
        <Calendar className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-lg">
        {RANGE_ORDER.map((key) => (
          <SelectItem key={key} value={key}>
            {RANGE_DEFS[key].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
