import type { ReactNode } from 'react';
import { CHART } from './chartTokens';

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  /** Extra context for the hover/focus tooltip, e.g. "38% of total · in 12 requests". */
  detail?: string;
}

interface BarListProps {
  items: BarListItem[];
  /** Names the list for screen readers, e.g. "Top qualities by samples". */
  ariaLabel: string;
  /** Unit appended in the accessible label, e.g. "samples". */
  unit: string;
  emptyMessage: string;
  formatValue?: (value: number) => string;
  footer?: ReactNode;
}

/** Leaves room past the longest bar for its tip label. */
const MAX_BAR_PERCENT = 86;

/**
 * Horizontal single-series bar list — magnitude across nominal categories.
 *
 * One hue for every bar: the categories (qualities, delivery modes) carry no
 * order, so coloring bars by value would just re-encode their length and burn
 * the color channel. Every value is printed at its bar's tip, so the list is
 * fully readable without hovering; the tooltip only ADDS context (share,
 * secondary counts, full names that were truncated). Each row is focusable
 * and shows the same tooltip on keyboard focus as on hover.
 *
 * Mark spec: ≤ 24px thick (10px here), 4px rounded data-end, square at the
 * baseline.
 */
export default function BarList({ items, ariaLabel, unit, emptyMessage, formatValue = String, footer }: BarListProps) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div>
      <ul aria-label={ariaLabel} className="space-y-1">
        {items.map((item) => {
          const width = (item.value / max) * MAX_BAR_PERCENT;
          return (
            <li
              key={item.key}
              tabIndex={0}
              aria-label={`${item.label}: ${formatValue(item.value)} ${unit}${item.detail ? `, ${item.detail}` : ''}`}
              className="group relative flex min-h-[32px] items-center gap-3 rounded-md px-1.5 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {/* 42% on phones: at a 360px viewport this is ~119px, the minimum
                  that fits "Pending approval" untruncated. Longer names still
                  ellipsize, with the full name in the tooltip and aria-label. */}
              <span className="w-[42%] shrink-0 truncate text-sm text-slate-600 sm:w-36" aria-hidden="true">
                {item.label}
              </span>

              <span className="flex min-w-0 flex-1 items-center gap-2" aria-hidden="true">
                {item.value > 0 && (
                  <span
                    className="h-2.5 rounded-r-[4px] transition-[width,filter] duration-500 group-hover:brightness-110"
                    // Floor at 2px so a tiny-but-real value never vanishes.
                    style={{ width: `max(2px, ${width}%)`, backgroundColor: CHART.series1 }}
                  />
                )}
                <span className={item.value > 0 ? 'text-sm font-semibold text-slate-900' : 'text-sm text-slate-500'}>
                  {formatValue(item.value)}
                </span>
              </span>

              {/* Tooltip — enhancement only; every value above is already visible.
                  Width-capped and wrapping: an invisible (opacity-0) absolute
                  element still counts toward scroll overflow, so an unbounded
                  nowrap tooltip with a long custom quality name could widen the
                  whole page on a phone. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max max-w-[16rem] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                <span className="block font-semibold text-white">
                  {formatValue(item.value)} {unit}
                </span>
                <span className="block text-slate-300">{item.label}</span>
                {item.detail && <span className="block text-slate-300">{item.detail}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {footer && <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">{footer}</div>}
    </div>
  );
}
