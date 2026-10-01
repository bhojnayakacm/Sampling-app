import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Table2, TrendingUp } from 'lucide-react';
import type { Granularity, TrendPoint } from '@/lib/analytics/computeAnalytics';
import { CHART } from './chartTokens';

const SERIES = [
  { key: 'submitted', label: 'Submitted', color: CHART.series1 },
  { key: 'completed', label: 'Completed', color: CHART.series2 },
] as const;

const GRANULARITY_NOUN: Record<Granularity, string> = { day: 'day', week: 'week', month: 'month' };

/** Honour the OS "reduce motion" setting for the line draw-in animation. */
function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Only the two props this tooltip reads. Typed structurally rather than as
 * Recharts' TooltipContentProps, whose payload is `ReadonlyArray<any>` — this
 * narrows the untyped payload to TrendPoint at exactly one boundary.
 */
interface ThroughputTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

/**
 * Crosshair tooltip: one readout for every series at the hovered X, so the
 * pointer never has to land on a 2px line. Values lead (strong), names follow;
 * series are keyed with a short line stroke, not a box.
 */
function ThroughputTooltip({ active, payload }: ThroughputTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as TrendPoint | undefined;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-xs font-medium text-slate-500">{point.label}</p>
      {SERIES.map((series) => (
        <div key={series.key} className="flex items-center gap-2 text-sm">
          <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: series.color }} aria-hidden="true" />
          <span className="font-semibold text-slate-900">{point[series.key]}</span>
          <span className="text-slate-500">{series.label.toLowerCase()}</span>
        </div>
      ))}
    </div>
  );
}

interface ThroughputChartProps {
  data: TrendPoint[];
  granularity: Granularity;
}

/**
 * Intake vs. output over time — "are we keeping up?"
 *
 * Two series on ONE shared axis (both are request counts per period, so no
 * second scale is ever needed). A persistent legend carries identity and each
 * series' period total; the tooltip carries per-period values; the table view
 * is the accessible twin that exposes every number without hovering.
 */
export default function ThroughputChart({ data, granularity }: ThroughputChartProps) {
  const [showTable, setShowTable] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  const totals = {
    submitted: data.reduce((sum, p) => sum + p.submitted, 0),
    completed: data.reduce((sum, p) => sum + p.completed, 0),
  };
  const isEmpty = totals.submitted === 0 && totals.completed === 0;

  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Intake vs. completions</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Requests submitted and samples completed (reached Ready), per {GRANULARITY_NOUN[granularity]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {showTable ? <TrendingUp className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </header>

      {/* Legend — always present for two series; carries identity + totals. */}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1" aria-label="Legend">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-2 text-sm">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: series.color }} aria-hidden="true" />
            <span className="text-slate-600">{series.label}</span>
            <span className="font-semibold text-slate-900">{totals[series.key].toLocaleString()}</span>
          </li>
        ))}
      </ul>

      {isEmpty ? (
        <p className="flex flex-1 items-center justify-center py-12 text-sm text-slate-500">
          No requests were submitted or completed in this period.
        </p>
      ) : showTable ? (
        <div className="mt-3 max-h-[260px] overflow-auto rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <caption className="sr-only">Requests submitted and completed per {GRANULARITY_NOUN[granularity]}</caption>
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Period</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Submitted</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Completed</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {data.map((point) => (
                <tr key={point.key} className="border-t border-slate-100">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-slate-600">{point.label}</th>
                  <td className="px-3 py-1.5 text-right text-slate-900">{point.submitted}</td>
                  <td className="px-3 py-1.5 text-right text-slate-900">{point.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Fixed height covers the plot AND the x-axis band, so tick labels are
        // never clipped into a nested scroll.
        <div className="mt-3 h-[260px] w-full" role="img" aria-label={`Line chart: ${totals.submitted} requests submitted and ${totals.completed} completed in this period. Use "Show table" for per-period values.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: CHART.axis }}
                tick={{ fontSize: 11, fill: CHART.inkMuted }}
                interval="preserveStartEnd"
                minTickGap={24}
                tickMargin={8}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: CHART.inkMuted }}
                width={44}
              />
              <Tooltip
                content={(props) => <ThroughputTooltip {...props} />}
                cursor={{ stroke: CHART.crosshair, strokeWidth: 1 }}
              />
              {SERIES.map((series) => (
                <Line
                  key={series.key}
                  // Linear, not monotone: these are discrete per-period counts.
                  // A smoothed curve invents in-between values that don't exist
                  // (it rendered daily 0→3→0 counts as rolling hills).
                  type="linear"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  // r=4 (8px) marker with a 2px surface ring keeps it legible where lines cross.
                  activeDot={{ r: 4, fill: series.color, stroke: CHART.surface, strokeWidth: 2 }}
                  isAnimationActive={!reduceMotion}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
