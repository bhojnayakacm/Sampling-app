/**
 * Distinguishing "the network died" from "the server said no".
 *
 * This matters because the two get the opposite treatment: a genuine network
 * failure is queued in the offline Outbox and retried automatically, while a
 * server rejection (413, RLS denial, validation error) must be surfaced to
 * the user immediately — queueing it would retry a doomed submission forever.
 *
 * The hard case is that a rejected CORS preflight and a dropped socket look
 * IDENTICAL to `fetch`: both throw `TypeError: Failed to fetch` with no
 * status. We therefore classify conservatively — see `isNetworkError`.
 */

/** Marker for an error we deliberately do NOT want retried by the Outbox. */
export const NON_RETRYABLE = 'NON_RETRYABLE';

/**
 * True when the failure looks like a transport problem rather than a
 * response. Checked in order of confidence:
 *
 *   1. The browser says we're offline — unambiguous.
 *   2. The error is explicitly flagged non-retryable (e.g. a document
 *      rejection we already decoded) — never treat as network.
 *   3. The error carries an HTTP status or a PostgREST code — the server
 *      answered, so this is a rejection, not a dropped connection.
 *   4. A bare `TypeError` whose message matches the browsers' fetch-failure
 *      wording. Chrome: "Failed to fetch". Safari: "Load failed" /
 *      "The network connection was lost". Firefox: "NetworkError when
 *      attempting to fetch resource".
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error || typeof error !== 'object') return false;

  const err = error as Record<string, unknown>;

  // Explicitly decoded, permanent failures never count as network errors.
  if (err.code === NON_RETRYABLE || err.retryable === false) return false;

  // A status/PostgREST code means the server responded — not a transport fault.
  const status = err.status ?? err.statusCode;
  if (typeof status === 'number' && status > 0) return false;
  if (typeof err.code === 'string' && /^(PGRST|22|23|42)/.test(err.code)) return false;

  const name = typeof err.name === 'string' ? err.name : '';
  const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';

  if (name === 'AbortError' || name === 'TimeoutError') return true;
  if (name === 'TypeError' && /fetch|network|load failed/.test(message)) return true;

  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network connection was lost') ||
    message.includes('load failed') ||
    message.includes('network request failed') ||
    message.includes('err_internet_disconnected')
  );
}

/** Tag an error so the Outbox never retries it. */
export function markNonRetryable<E extends Error>(error: E): E {
  (error as unknown as Record<string, unknown>).code = NON_RETRYABLE;
  (error as unknown as Record<string, unknown>).retryable = false;
  return error;
}
