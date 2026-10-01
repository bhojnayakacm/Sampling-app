import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck,
  ChevronRight,
  FileSpreadsheet,
  Inbox,
  Layers,
  Lock,
  Package,
  RefreshCw,
  Send,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SUB_CATEGORY_LABELS, type SubCategory } from '@/types';
import {
  computeCategoryAnalytics,
  RANGE_DEFS,
  type CategoryAnalytics,
  type PipelineStage,
  type RangeKey,
} from '@/lib/analytics/computeAnalytics';
import {
  useCategoryAnalyticsRows,
  useSubmissionTimes,
  type AnalyticsCategory,
} from '@/lib/api/analytics';
import CategoryTabs, { panelId, tabId } from '@/components/analytics/CategoryTabs';
import RangeSelect from '@/components/analytics/RangeSelect';
import KpiTile, { type KpiDelta } from '@/components/analytics/KpiTile';
import BarList from '@/components/analytics/BarList';
import ThroughputChart from '@/components/analytics/ThroughputChart';
import AnalyticsSkeleton from '@/components/analytics/AnalyticsSkeleton';

// ─── Labels ──────────────────────────────────────────────────────────────

const CATEGORY_NAME: Record<AnalyticsCategory, string> = { marble: 'Marble', magro: 'Magro' };

const STAGE_LABEL: Record<PipelineStage, string> = {
  pending_approval: 'Pending approval',
  approved: 'Approved',
  assigned: 'Assigned',
  in_production: 'In production',
  ready: 'Ready',
  dispatched: 'Dispatched',
};

const FULFILMENT_LABEL: Record<string, string> = {
  self_pickup: 'Self pickup',
  field_boy: 'Field boy',
  courier: 'Courier',
  company_vehicle: 'Company vehicle',
  '3rd_party': 'Third party',
  other: 'Other',
  unspecified: 'Not specified',
};

// ─── Formatting ──────────────────────────────────────────────────────────

/** True minus sign (U+2212) — a hyphen reads as a dash next to digits. */
const MINUS = '−';

function signed(value: number, digits = 0): string {
  const magnitude = Math.abs(value).toFixed(digits);
  if (Number(magnitude) === 0) return `±${magnitude}`;
  return `${value > 0 ? '+' : MINUS}${magnitude}`;
}

function share(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function direction(diff: number): KpiDelta['direction'] {
  if (diff > 0) return 'up';
  if (diff < 0) return 'down';
  return 'flat';
}

/** Request volume: a % change when there is a base to compare against, else an absolute change. */
function volumeDelta(current: number, previous: number | null, period: string): KpiDelta | null {
  if (previous === null) return null;
  const diff = current - previous;
  const text = previous > 0 ? `${signed((diff / previous) * 100)}%` : signed(diff);
  return { text, direction: direction(diff), tone: 'neutral', period: `vs ${period}` };
}

// ─── View ────────────────────────────────────────────────────────────────

interface ReportsViewProps {
  /**
   * Set when the viewer is a category-scoped coordinator (marble_coordinator /
   * magro_coordinator). The view locks to that category — consistent with the
   * rest of their dashboard — instead of offering the Marble/Magro tabs.
   */
  category?: AnalyticsCategory;
}

export default function ReportsView({ category: lockedCategory }: ReportsViewProps) {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<AnalyticsCategory>(lockedCategory ?? 'marble');
  const [range, setRange] = useState<RangeKey>('30d');

  const category = lockedCategory ?? selectedCategory;
  const rowsQuery = useCategoryAnalyticsRows(category);
  const submissionQuery = useSubmissionTimes();

  // Range changes recompute over data already in memory — instant, no fetch.
  const analytics = useMemo(() => {
    if (!rowsQuery.data || !submissionQuery.data) return null;
    return computeCategoryAnalytics(rowsQuery.data, submissionQuery.data, range);
  }, [rowsQuery.data, submissionQuery.data, range]);

  const error = rowsQuery.error ?? submissionQuery.error;
  const isRefetching = !!analytics && (rowsQuery.isFetching || submissionQuery.isFetching);
  const updatedAt = Math.max(rowsQuery.dataUpdatedAt, submissionQuery.dataUpdatedAt);

  const refresh = () => {
    void rowsQuery.refetch();
    void submissionQuery.refetch();
  };

  const content = (() => {
    if (analytics) {
      return analytics.hasAnyData ? (
        <Dashboard analytics={analytics} category={category} range={range} />
      ) : (
        <EmptyCategory category={category} />
      );
    }
    if (error) return <LoadError message={(error as Error).message} onRetry={refresh} />;
    return <AnalyticsSkeleton showSubCategories={category === 'magro'} />;
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      {/* ── Title + freshness ─────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Reports & Analytics</h2>
          <p className="mt-0.5 text-sm text-slate-500">Live performance from submitted sample requests</p>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt > 0 && (
            <span className="text-xs text-slate-500">
              Updated {new Date(updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={rowsQuery.isFetching || submissionQuery.isFetching}
            aria-label="Refresh analytics"
            className="h-9 w-9 border-slate-200 p-0"
          >
            <RefreshCw className={cn('h-4 w-4 text-slate-600', isRefetching && 'animate-spin')} />
          </Button>
        </div>
      </header>

      {/* ── Controls: category (top-level view) + date range (the one filter) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {lockedCategory ? (
          <span className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-900">
            {CATEGORY_NAME[lockedCategory]}
            <span className="font-normal text-slate-500">· your category</span>
          </span>
        ) : (
          <CategoryTabs value={selectedCategory} onChange={setSelectedCategory} />
        )}
        <RangeSelect value={range} onChange={setRange} />
      </div>

      {error && analytics && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Couldn't refresh — showing the last loaded figures.
        </p>
      )}

      {/* ── Panel. A refetch keeps the current frame at reduced opacity rather
             than flashing back to skeletons. ─────────────────────────────── */}
      <div
        {...(lockedCategory
          ? {}
          : { role: 'tabpanel', id: panelId(category), 'aria-labelledby': tabId(category) })}
        aria-busy={isRefetching}
        className={cn('transition-opacity duration-200', isRefetching && 'opacity-60')}
      >
        {content}
      </div>

      {/* ── Exports ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="text-sm font-medium text-slate-600">Export reports</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/reports/requester')}
              className="h-9 gap-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Requester report
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
            </Button>
            <Button variant="outline" size="sm" disabled className="h-9 gap-2 border-slate-200">
              <Package className="h-3.5 w-3.5" />
              Category report
              <Lock className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard body ──────────────────────────────────────────────────────

function Dashboard({
  analytics: a,
  category,
  range,
}: {
  analytics: CategoryAnalytics;
  category: AnalyticsCategory;
  range: RangeKey;
}) {
  const { label: rangeLabel, previousLabel } = RANGE_DEFS[range];
  const name = CATEGORY_NAME[category];
  const rangeLower = rangeLabel.toLowerCase();

  // Turnaround: falling is good, so tone is inverted against direction.
  const turnaroundDelta: KpiDelta | null =
    a.turnaround.avgDays !== null && a.turnaround.previousAvgDays !== null
      ? (() => {
          const diff = a.turnaround.avgDays - a.turnaround.previousAvgDays;
          return {
            text: `${signed(diff, 1)} days`,
            direction: direction(diff),
            tone: diff < 0 ? 'good' : diff > 0 ? 'bad' : 'neutral',
            period: `vs ${previousLabel}`,
          };
        })()
      : null;

  const onTimeDelta: KpiDelta | null =
    a.onTime.rate !== null && a.onTime.previousRate !== null
      ? (() => {
          const diff = a.onTime.rate - a.onTime.previousRate;
          return {
            text: `${signed(diff)} pts`,
            direction: direction(diff),
            tone: diff > 0 ? 'good' : diff < 0 ? 'bad' : 'neutral',
            period: `vs ${previousLabel}`,
          };
        })()
      : null;

  const totalFulfilment = a.fulfilment.reduce((sum, f) => sum + f.value, 0);
  const totalSubSamples = a.subCategories.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-4">
      {/* ── KPI row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiTile
          label="Requests submitted"
          icon={Send}
          value={a.requests.inRange.toLocaleString()}
          delta={volumeDelta(a.requests.inRange, a.requests.previous, previousLabel)}
          // For All time the headline already IS the all-time total.
          footnote={range === 'all' ? undefined : `${a.requests.allTime.toLocaleString()} submitted all time`}
        />
        <KpiTile
          label="Open requests"
          icon={Layers}
          value={a.activeCount.toLocaleString()}
          footnote={`${a.awaitingApproval.toLocaleString()} awaiting approval · live`}
        />
        <KpiTile
          label="Avg. turnaround"
          icon={Timer}
          value={a.turnaround.avgDays !== null ? `${a.turnaround.avgDays.toFixed(1)} days` : '—'}
          delta={turnaroundDelta}
          footnote={
            a.turnaround.medianDays !== null
              ? `Median ${a.turnaround.medianDays.toFixed(1)} d · ${a.turnaround.sampleSize} completed · submit → ready`
              : 'No samples completed in this period'
          }
        />
        <KpiTile
          label="On-time completion"
          icon={CalendarCheck}
          value={a.onTime.rate !== null ? `${Math.round(a.onTime.rate)}%` : '—'}
          meter={a.onTime.rate !== null ? { percent: a.onTime.rate, label: 'On-time completion rate' } : null}
          delta={onTimeDelta}
          footnote={
            a.onTime.rate !== null
              ? `${a.onTime.onTimeCount} of ${a.onTime.measuredCount} ready by the required date`
              : 'No completions with a due date in this period'
          }
        />
      </div>

      {/* ── Trend + live pipeline ─────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ThroughputChart data={a.trend} granularity={a.granularity} />
        </div>
        <Panel
          title="Pipeline right now"
          subtitle="Open requests by stage — a live snapshot, not affected by the date range"
        >
          <BarList
            ariaLabel={`Open ${name} requests by stage`}
            unit="requests"
            emptyMessage={`No open ${name} requests — the pipeline is clear.`}
            items={
              a.activeCount === 0
                ? []
                : a.pipeline.map((p) => ({
                    key: p.stage,
                    label: STAGE_LABEL[p.stage],
                    value: p.count,
                    detail: `${share(p.count, a.activeCount)}% of open requests`,
                  }))
            }
            footer={`${a.deliveredAllTime.toLocaleString()} delivered · ${a.rejectedAllTime.toLocaleString()} rejected, all time`}
          />
        </Panel>
      </div>

      {/* ── Mix: what is asked for, and how it leaves ─────── */}
      <div className={cn('grid gap-4', category === 'magro' ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
        <Panel title="Top qualities" subtitle={`By samples requested · ${rangeLower}`}>
          <BarList
            ariaLabel={`Top ${name} qualities by samples requested`}
            unit="samples"
            emptyMessage={`No ${name} samples were requested in the ${rangeLower}.`}
            items={a.topQualities.map((q) => ({
              key: q.key,
              label: q.label,
              value: q.value,
              detail: `in ${q.secondary} request${q.secondary === 1 ? '' : 's'} · ${share(q.value, a.totalSamplesInRange)}% of samples`,
            }))}
            footer={
              a.totalSamplesInRange > 0
                ? `${a.totalSamplesInRange.toLocaleString()} samples in total${
                    a.otherQualityCount > 0 ? ` · ${a.otherQualityCount} more qualities not shown` : ''
                  }`
                : undefined
            }
          />
        </Panel>

        <Panel title="Fulfilment mix" subtitle={`How requests leave the studio · ${rangeLower}`}>
          <BarList
            ariaLabel={`${name} requests by fulfilment method`}
            unit="requests"
            emptyMessage={`No ${name} requests were submitted in the ${rangeLower}.`}
            items={a.fulfilment.map((f) => ({
              key: f.key,
              label: FULFILMENT_LABEL[f.key] ?? f.key,
              value: f.value,
              detail: `${share(f.value, totalFulfilment)}% of requests`,
            }))}
          />
        </Panel>

        {/* Magro-only: the sub-category split is meaningless for Marble
            (marble items carry no sub_category by schema rule). */}
        {category === 'magro' && (
          <Panel title="Sub-category mix" subtitle={`Samples by Magro line · ${rangeLower}`}>
            <BarList
              ariaLabel="Magro samples by sub-category"
              unit="samples"
              emptyMessage={`No Magro samples were requested in the ${rangeLower}.`}
              items={a.subCategories.map((s) => ({
                key: s.key,
                label: SUB_CATEGORY_LABELS[s.key as SubCategory] ?? s.key,
                value: s.value,
                detail: `${share(s.value, totalSubSamples)}% of samples`,
              }))}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────────

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </header>
      {children}
    </section>
  );
}

function EmptyCategory({ category }: { category: AnalyticsCategory }) {
  const name = CATEGORY_NAME[category];
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Inbox className="h-6 w-6 text-slate-500" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">No {name} requests yet</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Analytics appear here as soon as the first {name} sample request is submitted. Drafts are not counted.
      </p>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-rose-200 bg-white px-6 py-14 text-center">
      <AlertTriangle className="h-8 w-8 text-rose-600" aria-hidden="true" />
      <h3 className="mt-3 text-base font-semibold text-slate-900">Couldn't load analytics</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-5 h-9 gap-2 border-slate-200">
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </Button>
    </div>
  );
}
