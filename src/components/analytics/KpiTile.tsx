import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHART } from './chartTokens';

export interface KpiDelta {
  /** Signed display text, e.g. "+18%" or "−0.8 days". */
  text: string;
  direction: 'up' | 'down' | 'flat';
  /**
   * Whether this movement is good, bad or neither. Color = direction × this,
   * so a falling turnaround reads green while a falling on-time rate reads
   * red. Request volume is 'neutral': more demand is neither a win nor a
   * failure for the sampling team, so it is not dressed up as one.
   */
  tone: 'good' | 'bad' | 'neutral';
  /** Named comparison period, e.g. "vs previous 30 days". */
  period: string;
}

interface KpiTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  footnote?: ReactNode;
  delta?: KpiDelta | null;
  /** Renders a meter — for a single ratio against a limit (0–100). */
  meter?: { percent: number; label: string } | null;
}

const TONE_CLASS: Record<KpiDelta['tone'], string> = {
  good: 'text-emerald-700',
  bad: 'text-rose-700',
  neutral: 'text-slate-600',
};

const DIRECTION_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
} as const;

/**
 * Stat tile: label · value · optional delta · optional meter · footnote.
 *
 * The value keeps proportional figures on purpose — tabular-nums gives every
 * digit the width of a 0, which makes a large standalone number like "121"
 * look loose.
 */
export default function KpiTile({ label, value, icon: Icon, footnote, delta, meter }: KpiTileProps) {
  const DeltaIcon = delta ? DIRECTION_ICON[delta.direction] : null;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
      </div>

      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>

      {meter && (
        <div
          role="meter"
          aria-label={meter.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(meter.percent)}
          className="mt-3 h-2 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: CHART.meterTrack }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${Math.max(0, Math.min(100, meter.percent))}%`, backgroundColor: CHART.series1 }}
          />
        </div>
      )}

      {delta && DeltaIcon && (
        // flex-wrap: on a 2-up phone grid a tile has ~126px of content width,
        // so the comparison period drops to its own line rather than
        // crushing word-by-word.
        <p className={cn('mt-2 flex flex-wrap items-center gap-x-1 text-xs font-semibold', TONE_CLASS[delta.tone])}>
          <DeltaIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{delta.text}</span>
          <span className="font-normal text-slate-500">{delta.period}</span>
        </p>
      )}

      {footnote && <p className="mt-auto pt-2 text-xs text-slate-500">{footnote}</p>}
    </div>
  );
}
