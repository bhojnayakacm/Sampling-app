/**
 * Pure aggregation for the Reports & Analytics view.
 *
 * Everything here is a deterministic function of (rows, submission times,
 * range, now) — no Supabase, no React, no path aliases. That keeps every
 * metric unit-testable in plain Node and means the dashboard can switch
 * date ranges instantly: changing the range re-runs this over data already
 * in memory instead of issuing a new query.
 *
 * METRIC DEFINITIONS (shown to users in the UI subtitles, kept in sync here)
 * ─────────────────────────────────────────────────────────────────────────
 *   Submitted at  — the request's FIRST transition into `pending_approval`
 *                   (from request_status_history). `created_at` is only the
 *                   fallback: a request that sat as a draft for a week before
 *                   submission was created a week early, and using created_at
 *                   would inflate every turnaround figure by that idle time.
 *   Completed at  — `completed_at`, stamped when the sample reaches `ready`.
 *   Turnaround    — completed − submitted, in days. Production time: the part
 *                   of the journey the sampling team actually controls.
 *   On time       — completed at or before the request's `required_by`.
 *   Drafts        — excluded everywhere. They are unsubmitted, private to the
 *                   requester, and carry no category (it is set at submit).
 */

import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

// ─── Inputs ──────────────────────────────────────────────────────────────

export interface AnalyticsItemRow {
  quality: string | null;
  quantity: number | null;
  sub_category: string | null;
  is_kit?: boolean | null;
}

export interface AnalyticsRequestRow {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  required_by: string | null;
  pickup_responsibility: string | null;
  items: AnalyticsItemRow[] | null;
}

export type RangeKey = '30d' | '90d' | '12m' | 'all';
export type Granularity = 'day' | 'week' | 'month';

/** Open stages, in workflow order. Terminal outcomes are reported separately. */
export const PIPELINE_STAGES = [
  'pending_approval',
  'approved',
  'assigned',
  'in_production',
  'ready',
  'dispatched',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const RANGE_DEFS: Record<RangeKey, { label: string; granularity: Granularity; previousLabel: string }> = {
  '30d': { label: 'Last 30 days', granularity: 'day', previousLabel: 'previous 30 days' },
  '90d': { label: 'Last 90 days', granularity: 'week', previousLabel: 'previous 90 days' },
  '12m': { label: 'Last 12 months', granularity: 'month', previousLabel: 'previous 12 months' },
  all: { label: 'All time', granularity: 'month', previousLabel: '' },
};

/** How many qualities the ranked list shows before folding the rest into a count. */
export const TOP_QUALITY_LIMIT = 8;

// ─── Outputs ─────────────────────────────────────────────────────────────

export interface TrendPoint {
  key: string;
  label: string;
  submitted: number;
  completed: number;
}

export interface RankedEntry {
  key: string;
  label: string;
  value: number;
  /** Secondary count shown in the tooltip (e.g. requests for a quality). */
  secondary?: number;
}

export interface CategoryAnalytics {
  range: RangeKey;
  /** False when the category has never had a submitted request. */
  hasAnyData: boolean;

  requests: {
    allTime: number;
    inRange: number;
    /** Count in the equal-length window before this one; null for All time. */
    previous: number | null;
  };

  /** Snapshot of RIGHT NOW — deliberately not range-scoped. */
  pipeline: { stage: PipelineStage; count: number }[];
  activeCount: number;
  awaitingApproval: number;
  deliveredAllTime: number;
  rejectedAllTime: number;

  turnaround: {
    avgDays: number | null;
    medianDays: number | null;
    sampleSize: number;
    previousAvgDays: number | null;
  };

  onTime: {
    /** 0–100, or null when nothing completed in range. */
    rate: number | null;
    onTimeCount: number;
    measuredCount: number;
    previousRate: number | null;
  };

  trend: TrendPoint[];
  granularity: Granularity;

  topQualities: RankedEntry[];
  /** Distinct qualities beyond the top list. */
  otherQualityCount: number;
  totalSamplesInRange: number;

  fulfilment: RankedEntry[];
  subCategories: RankedEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Collapse internal whitespace so 'Forest  gold' and 'Forest gold' group together. */
function normaliseLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

interface Window {
  start: number | null;
  end: number;
  prevStart: number | null;
  prevEnd: number | null;
}

/**
 * The selected window [start, end] plus the equal-length window before it.
 * Day and month windows are aligned to calendar boundaries so "Last 12
 * months" means twelve whole months including the current one.
 */
export function resolveWindow(range: RangeKey, now: Date): Window {
  const end = now.getTime();
  if (range === 'all') return { start: null, end, prevStart: null, prevEnd: null };

  if (range === '12m') {
    const start = startOfMonth(addMonths(now, -11));
    return {
      start: start.getTime(),
      end,
      prevStart: addMonths(start, -12).getTime(),
      prevEnd: start.getTime(),
    };
  }

  const days = range === '30d' ? 30 : 90;
  const start = addDays(startOfDay(now), -(days - 1));
  return {
    start: start.getTime(),
    end,
    prevStart: addDays(start, -days).getTime(),
    prevEnd: start.getTime(),
  };
}

function inWindow(t: number | null, start: number | null, end: number): boolean {
  if (t === null) return false;
  return (start === null || t >= start) && t <= end;
}

function bucketStart(t: number, granularity: Granularity): Date {
  const d = new Date(t);
  if (granularity === 'day') return startOfDay(d);
  if (granularity === 'week') return startOfWeek(d, { weekStartsOn: 1 }); // Monday
  return startOfMonth(d);
}

function stepBucket(d: Date, granularity: Granularity): Date {
  if (granularity === 'day') return addDays(d, 1);
  if (granularity === 'week') return addWeeks(d, 1);
  return addMonths(d, 1);
}

function bucketLabel(d: Date, granularity: Granularity, now: Date, spansYears: boolean): string {
  if (granularity === 'month') return spansYears || !isSameYear(d, now) ? format(d, "MMM ''yy") : format(d, 'MMM');
  return format(d, 'd MMM');
}

// ─── Main ────────────────────────────────────────────────────────────────

/**
 * @param rows            non-draft requests for ONE category
 * @param submittedAtById earliest `pending_approval` timestamp per request id
 */
export function computeCategoryAnalytics(
  rows: AnalyticsRequestRow[],
  submittedAtById: Map<string, string>,
  range: RangeKey,
  now: Date = new Date(),
): CategoryAnalytics {
  // Defensive: callers already exclude drafts, but the definition must hold
  // even if a future query forgets the filter.
  const submitted = rows.filter((r) => r.status !== 'draft');
  const win = resolveWindow(range, now);
  const { granularity } = RANGE_DEFS[range];

  const enriched = submitted.map((r) => ({
    row: r,
    submittedAt: toTime(submittedAtById.get(r.id)) ?? toTime(r.created_at),
    completedAt: toTime(r.completed_at),
    requiredBy: toTime(r.required_by),
  }));

  // ── Request counts ──────────────────────────────────────────
  const inRange = enriched.filter((e) => inWindow(e.submittedAt, win.start, win.end));
  const previous =
    win.prevStart !== null && win.prevEnd !== null
      ? enriched.filter(
          (e) => e.submittedAt !== null && e.submittedAt >= win.prevStart! && e.submittedAt < win.prevEnd!,
        ).length
      : null;

  // ── Pipeline snapshot (now, not range-scoped) ───────────────
  const stageCounts = new Map<string, number>();
  for (const r of submitted) stageCounts.set(r.status, (stageCounts.get(r.status) ?? 0) + 1);
  const pipeline = PIPELINE_STAGES.map((stage) => ({ stage, count: stageCounts.get(stage) ?? 0 }));
  const activeCount = pipeline.reduce((sum, p) => sum + p.count, 0);

  // ── Turnaround + on-time (completions in window) ────────────
  const completionStats = (start: number | null, end: number, inclusiveEnd: boolean) => {
    const done = enriched.filter(
      (e) =>
        e.completedAt !== null &&
        (start === null || e.completedAt >= start) &&
        (inclusiveEnd ? e.completedAt <= end : e.completedAt < end),
    );
    const durations = done
      .filter((e) => e.submittedAt !== null)
      .map((e) => (e.completedAt! - e.submittedAt!) / DAY_MS)
      // Negative spans are clock/backfill artefacts, not real turnaround.
      .filter((d) => d >= 0);
    const measured = done.filter((e) => e.requiredBy !== null);
    const onTimeCount = measured.filter((e) => e.completedAt! <= e.requiredBy!).length;
    return {
      durations,
      onTimeCount,
      measuredCount: measured.length,
      rate: measured.length > 0 ? (onTimeCount / measured.length) * 100 : null,
    };
  };

  const current = completionStats(win.start, win.end, true);
  const prior =
    win.prevStart !== null && win.prevEnd !== null
      ? completionStats(win.prevStart, win.prevEnd, false)
      : null;

  // ── Trend buckets ───────────────────────────────────────────
  const earliestSubmitted = enriched.reduce<number | null>(
    (min, e) => (e.submittedAt !== null && (min === null || e.submittedAt < min) ? e.submittedAt : min),
    null,
  );
  const trendStartTime = win.start ?? earliestSubmitted;
  const trend: TrendPoint[] = [];

  if (trendStartTime !== null) {
    const firstBucket = bucketStart(trendStartTime, granularity);
    const lastBucket = bucketStart(win.end, granularity);
    const spansYears = !isSameYear(firstBucket, lastBucket);
    const index = new Map<string, TrendPoint>();

    for (let d = firstBucket; d.getTime() <= lastBucket.getTime(); d = stepBucket(d, granularity)) {
      const point: TrendPoint = {
        key: d.toISOString(),
        label: bucketLabel(d, granularity, now, spansYears),
        submitted: 0,
        completed: 0,
      };
      trend.push(point);
      index.set(point.key, point);
    }

    const bump = (t: number | null, field: 'submitted' | 'completed') => {
      if (!inWindow(t, trendStartTime, win.end)) return;
      const point = index.get(bucketStart(t!, granularity).toISOString());
      if (point) point[field] += 1;
    };
    for (const e of enriched) {
      bump(e.submittedAt, 'submitted');
      bump(e.completedAt, 'completed');
    }
  }

  // ── Qualities + sub-categories (items of requests in range) ─
  const qualityAgg = new Map<string, { label: string; samples: number; requestIds: Set<string> }>();
  const subAgg = new Map<string, number>();
  let totalSamplesInRange = 0;

  for (const { row } of inRange) {
    for (const item of row.items ?? []) {
      if (item.is_kit) continue;
      const samples = item.quantity && item.quantity > 0 ? item.quantity : 1;
      totalSamplesInRange += samples;

      if (item.quality) {
        const label = normaliseLabel(item.quality);
        const key = label.toLowerCase();
        const agg = qualityAgg.get(key) ?? { label, samples: 0, requestIds: new Set<string>() };
        agg.samples += samples;
        agg.requestIds.add(row.id);
        qualityAgg.set(key, agg);
      }
      if (item.sub_category) {
        subAgg.set(item.sub_category, (subAgg.get(item.sub_category) ?? 0) + samples);
      }
    }
  }

  const rankedQualities = [...qualityAgg.entries()]
    .map(([key, a]) => ({ key, label: a.label, value: a.samples, secondary: a.requestIds.size }))
    .sort((a, b) => b.value - a.value || (b.secondary ?? 0) - (a.secondary ?? 0) || a.label.localeCompare(b.label));

  // ── Fulfilment mix (requests in range) ──────────────────────
  const fulfilmentAgg = new Map<string, number>();
  for (const { row } of inRange) {
    const key = row.pickup_responsibility || 'unspecified';
    fulfilmentAgg.set(key, (fulfilmentAgg.get(key) ?? 0) + 1);
  }

  const byValueDesc = (a: RankedEntry, b: RankedEntry) => b.value - a.value || a.key.localeCompare(b.key);

  return {
    range,
    hasAnyData: submitted.length > 0,
    requests: { allTime: submitted.length, inRange: inRange.length, previous },
    pipeline,
    activeCount,
    awaitingApproval: stageCounts.get('pending_approval') ?? 0,
    deliveredAllTime: stageCounts.get('received') ?? 0,
    rejectedAllTime: stageCounts.get('rejected') ?? 0,
    turnaround: {
      avgDays: mean(current.durations),
      medianDays: median(current.durations),
      sampleSize: current.durations.length,
      previousAvgDays: prior ? mean(prior.durations) : null,
    },
    onTime: {
      rate: current.rate,
      onTimeCount: current.onTimeCount,
      measuredCount: current.measuredCount,
      previousRate: prior ? prior.rate : null,
    },
    trend,
    granularity,
    topQualities: rankedQualities.slice(0, TOP_QUALITY_LIMIT),
    otherQualityCount: Math.max(0, rankedQualities.length - TOP_QUALITY_LIMIT),
    totalSamplesInRange,
    fulfilment: [...fulfilmentAgg.entries()].map(([key, value]) => ({ key, label: key, value })).sort(byValueDesc),
    subCategories: [...subAgg.entries()].map(([key, value]) => ({ key, label: key, value })).sort(byValueDesc),
  };
}

/**
 * Collapse status-history rows to the earliest `pending_approval` per request.
 * Rows may arrive in any order; resubmissions add later rows and must not
 * move the clock forward.
 */
export function earliestSubmissionTimes(
  rows: { request_id: string; changed_at: string }[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const { request_id, changed_at } of rows) {
    const existing = out.get(request_id);
    if (!existing || new Date(changed_at).getTime() < new Date(existing).getTime()) {
      out.set(request_id, changed_at);
    }
  }
  return out;
}
