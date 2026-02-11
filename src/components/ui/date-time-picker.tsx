import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  getDay,
  isToday,
  isSameDay,
  isBefore,
  startOfDay,
} from 'date-fns';

interface DateTimePickerProps {
  value: string; // ISO string or empty
  onChange: (iso: string) => void;
  error?: boolean;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10,...55
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DateTimePicker({ value, onChange, error }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  // Parse existing value into local state when dialog opens
  const parsed = value ? new Date(value) : null;

  const [viewMonth, setViewMonth] = useState<Date>(parsed || new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(parsed);
  const [hour, setHour] = useState<number>(parsed ? (parsed.getHours() % 12 || 12) : 7);
  const [minute, setMinute] = useState<number>(parsed ? roundToNearest5(parsed.getMinutes()) : 0);
  const [period, setPeriod] = useState<'AM' | 'PM'>(
    parsed ? (parsed.getHours() >= 12 ? 'PM' : 'AM') : 'PM'
  );

  // Format display value for trigger button
  const displayValue = useMemo(() => {
    if (!parsed) return '';
    const datePart = format(parsed, 'dd-MM-yyyy');
    const timePart = format(parsed, 'hh:mm a');
    return `${datePart}, ${timePart}`;
  }, [parsed]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const leadingBlanks = getDay(monthStart); // 0=Sun, 1=Mon, etc.
    return { days, leadingBlanks };
  }, [viewMonth]);

  // Reset local state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      const p = value ? new Date(value) : null;
      setViewMonth(p || new Date());
      setSelectedDate(p);
      setHour(p ? (p.getHours() % 12 || 12) : 7);
      setMinute(p ? roundToNearest5(p.getMinutes()) : 0);
      setPeriod(p ? (p.getHours() >= 12 ? 'PM' : 'AM') : 'PM');
    }
    setOpen(isOpen);
  };

  const handleSet = () => {
    if (!selectedDate) return;

    let h = hour;
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;

    const result = new Date(selectedDate);
    result.setHours(h, minute, 0, 0);
    onChange(result.toISOString());
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const today = startOfDay(new Date());

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 w-full h-12 px-3 mt-1.5 rounded-md border text-left text-sm transition-colors ${
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-slate-200 hover:border-slate-300 focus:ring-indigo-500'
          } focus:outline-none focus:ring-1 bg-white`}
        >
          <CalendarDays className="h-4 w-4 text-slate-400 flex-shrink-0" />
          {displayValue ? (
            <span className="text-slate-800">{displayValue}</span>
          ) : (
            <span className="text-slate-400">Select date & time</span>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-slate-100">
          <DialogTitle className="text-base font-semibold text-slate-800">
            Select Date & Time
          </DialogTitle>
        </DialogHeader>

        {/* Calendar Section */}
        <div className="px-4 pt-3 pb-2">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-slate-800">
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7">
            {/* Leading blanks */}
            {Array.from({ length: calendarDays.leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {/* Days */}
            {calendarDays.days.map((day) => {
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isPast = isBefore(day, today);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={isPast}
                  onClick={() => setSelectedDate(day)}
                  className={`h-9 w-full text-sm rounded-md transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-semibold'
                      : isPast
                      ? 'text-slate-300 cursor-not-allowed'
                      : isTodayDate
                      ? 'bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Section */}
        <div className="px-4 py-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">Time</p>
          <div className="flex items-center gap-2">
            {/* Hour */}
            <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
              <SelectTrigger className="h-10 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-slate-400 font-bold text-lg">:</span>

            {/* Minute */}
            <Select value={String(minute)} onValueChange={(v) => setMinute(Number(v))}>
              <SelectTrigger className="h-10 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {String(m).padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* AM/PM */}
            <Select value={period} onValueChange={(v) => setPeriod(v as 'AM' | 'PM')}>
              <SelectTrigger className="h-10 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Clear
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedDate}
              onClick={handleSet}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Set
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function roundToNearest5(min: number): number {
  return Math.round(min / 5) * 5;
}
