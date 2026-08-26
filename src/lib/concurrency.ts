/**
 * Bounded-concurrency task runner.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The submit path used to fan every storage upload out at once via
 * `Promise.all`. With the multi-image + document features a single
 * submission can easily be 15+ concurrent PUTs. Mobile browsers cap
 * concurrent connections per host (Chrome ~6, and far fewer on a congested
 * radio); the surplus sockets are queued and, on a flaky 4G/5G handover,
 * killed outright. A killed socket surfaces as an opaque
 * `TypeError: Failed to fetch` with no status attached — which the UI then
 * reported as a generic "Connection Error" even though the network was fine.
 *
 * Running a small, fixed pool instead keeps every request inside the
 * browser's connection budget, so each upload gets a real socket, a real
 * response, and a real error when something is actually wrong.
 */

/**
 * Max simultaneous storage uploads per submission.
 *
 * 2 is deliberately conservative: it is comfortably inside every mobile
 * browser's per-host budget, and it also bounds the CPU cost of the image
 * compression that runs inline with each upload — a low-end phone
 * compressing 6 photos at once will jank or OOM.
 */
export const UPLOAD_CONCURRENCY = 2;

/**
 * Like `Promise.all(items.map(fn))` but with at most `limit` tasks in flight.
 *
 * Results are returned in INPUT order regardless of completion order, so
 * callers can rely on positional mapping.
 *
 * Failure semantics match `Promise.all`: the first rejection propagates. In
 * this codebase that is what we want — a failed upload must abort the
 * submission rather than silently produce a request with missing photos.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  // Each worker pulls the next index off a shared cursor until the queue is
  // drained. Simple, allocation-light, and keeps exactly `limit` in flight
  // instead of processing rigid chunks (which would idle on a slow item).
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: effectiveLimit }, () => worker()));
  return results;
}
