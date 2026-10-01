/**
 * Data access for Reports & Analytics.
 *
 * SHAPE OF THE FETCH
 * ──────────────────
 * Two queries, both cached by TanStack Query:
 *
 *   1. useCategoryAnalyticsRows(category) — every NON-DRAFT request in one
 *      category, with its items embedded in the same round trip. Filtered
 *      server-side on the indexed `requests.category` column, so the Marble
 *      and Magro views never download each other's data.
 *
 *   2. useSubmissionTimes() — the earliest `pending_approval` history row per
 *      request: the true submission moment (see computeAnalytics.ts for why
 *      `created_at` is not good enough). Category-independent, so one cache
 *      entry serves both tabs.
 *
 * All aggregation happens client-side in computeCategoryAnalytics(). That is
 * deliberate: the date range then re-slices data already in memory, so
 * switching ranges is instant and costs no network. At this app's volume
 * (hundreds to low thousands of requests a year) the payload is small; if it
 * ever grows past that, the aggregation can move into a Postgres RPC without
 * changing the compute contract.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  earliestSubmissionTimes,
  type AnalyticsRequestRow,
} from '@/lib/analytics/computeAnalytics';

export type AnalyticsCategory = 'marble' | 'magro';

/**
 * Supabase (PostgREST) caps every response at `max_rows` — 1,000 by default
 * — and truncates SILENTLY. A plain select would make "all time" totals
 * quietly wrong the day a category passed 1,000 requests. We page instead,
 * stopping at the first short page.
 */
const PAGE_SIZE = 1000;

/** Hard stop so a misbehaving filter can never loop forever. */
const MAX_PAGES = 200;

async function fetchAllPages<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
  throw new Error('Analytics query exceeded the page limit — narrow the query or move aggregation server-side.');
}

/** Every non-draft request in a category, items embedded. */
export function useCategoryAnalyticsRows(category: AnalyticsCategory) {
  return useQuery({
    queryKey: ['analytics', 'requests', category],
    queryFn: () =>
      fetchAllPages<AnalyticsRequestRow>((from, to) =>
        supabase
          .from('requests')
          .select(
            'id, status, created_at, completed_at, required_by, pickup_responsibility, ' +
              'items:request_items(quality, quantity, sub_category, is_kit)',
          )
          .eq('category', category)
          .neq('status', 'draft')
          // A total order is required for stable pagination: without the id
          // tie-breaker, rows sharing a created_at could shift between pages
          // and be skipped or double-counted.
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
          .then(({ data, error }) => ({ data: data as unknown as AnalyticsRequestRow[] | null, error })),
      ),
  });
}

/** request_id → earliest pending_approval timestamp (the true submission time). */
export function useSubmissionTimes() {
  return useQuery({
    queryKey: ['analytics', 'submission-times'],
    queryFn: async () => {
      const rows = await fetchAllPages<{ request_id: string; changed_at: string }>((from, to) =>
        supabase
          .from('request_status_history')
          .select('request_id, changed_at')
          .eq('status', 'pending_approval')
          .order('changed_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      );
      return earliestSubmissionTimes(rows);
    },
  });
}
