/**
 * 10-Minute Edit Grace Period.
 *
 * A requester may edit their own request for 10 minutes after `created_at`,
 * while it is still `pending_approval` or `approved`. Once a coordinator
 * moves it to `assigned` (or beyond), editing is closed regardless of time.
 *
 * SINGLE SOURCE OF TRUTH
 *   Three surfaces read this: the requester's countdown + Edit button
 *   (RequestDetail), the coordinator's approval warning (RequestActions), and
 *   the edit-mode gate (NewRequest). Keeping the window and the status list
 *   here stops them from drifting apart.
 *
 * CLIENT CLOCK CAVEAT
 *   Everything here is computed from the browser clock, so a skewed device
 *   can show time remaining after the server has closed the window. That is
 *   why the deadline is ALSO enforced in RLS (`now() <= created_at +
 *   interval '10 minutes'`, migration 1023) — the database is authoritative
 *   and the UI is only an affordance. A late save fails with a clear message
 *   rather than silently writing.
 */

/** Length of the grace window. Mirrors the interval in migration 1023. */
export const EDIT_GRACE_PERIOD_MS = 10 * 60 * 1000;

/**
 * Statuses a requester may edit inside the window. Deliberately excludes
 * `assigned` and everything after it: once a maker is on the job, a silent
 * content change would invalidate work already in progress.
 */
export const GRACE_EDITABLE_STATUSES = ['pending_approval', 'approved'] as const;

export function isGraceEditableStatus(status: string | null | undefined): boolean {
  return !!status && (GRACE_EDITABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Milliseconds left in the window, clamped at 0. Returns 0 for a missing or
 * unparseable timestamp so callers fail closed (no edit affordance).
 */
export function getGraceRemainingMs(
  createdAt: string | null | undefined,
  now: number = Date.now(),
): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, created + EDIT_GRACE_PERIOD_MS - now);
}

/** True when the request is both in an editable status AND inside the window. */
export function isWithinEditGracePeriod(
  status: string | null | undefined,
  createdAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  return isGraceEditableStatus(status) && getGraceRemainingMs(createdAt, now) > 0;
}

/** "MM:SS" for a countdown label. Rounds up so it never shows 00:00 while time remains. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
