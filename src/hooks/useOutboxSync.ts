import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { runSubmission } from '@/lib/submitRequest';
import { isNetworkError } from '@/lib/networkErrors';
import {
  MAX_OUTBOX_ATTEMPTS,
  deleteEntry,
  getAllEntries,
  getPendingEntries,
  isOutboxSupported,
  recordFailure,
  type OutboxEntry,
} from '@/lib/outbox';

/**
 * Module-level lock. The hook may be mounted more than once (or re-run by
 * Strict Mode in dev), and two concurrent drains would replay the same entry
 * twice — creating duplicate requests. A plain module flag is enough because
 * every mount shares one JS realm.
 */
let isDraining = false;

/** Background retry cadence for flaky links where 'online' never fires. */
const RETRY_INTERVAL_MS = 60_000;

export interface OutboxSyncState {
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  /** Force a drain now (used by the manual "Retry" affordance). */
  sync: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Drains the offline Outbox whenever the device looks online.
 *
 * TRIGGERS (belt and braces — any one of them is enough):
 *   • mount, so a queued request goes out as soon as the app is reopened;
 *   • the window 'online' event;
 *   • returning to the foreground (visibilitychange) — mobile browsers often
 *     freeze timers in a backgrounded tab and never fire 'online';
 *   • a slow interval, for "connected but useless" links where the browser
 *     never reports an offline→online transition at all.
 */
export function useOutboxSync(): OutboxSyncState {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(async () => {
    if (!isOutboxSupported()) return;
    const all = await getAllEntries();
    setPendingCount(all.filter((e) => e.status === 'pending').length);
    setFailedCount(all.filter((e) => e.status === 'failed').length);
  }, []);

  const sync = useCallback(async () => {
    if (!isOutboxSupported() || isDraining) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (!profile?.id) return; // Writes are RLS-scoped; wait for the session.

    const pending = await getPendingEntries();
    if (pending.length === 0) {
      await refresh();
      return;
    }

    isDraining = true;
    setIsSyncing(true);
    let succeeded = 0;

    try {
      // Sequential on purpose: each entry already runs its own bounded upload
      // pool, and draining several at once would multiply concurrent sockets
      // right after a reconnect — the exact condition that broke submits.
      for (const entry of pending) {
        // Never replay someone else's queued work on a shared device.
        if (entry.plan.userId !== profile.id) continue;

        try {
          await runSubmission(entry.plan);
          await deleteEntry(entry.id);
          succeeded += 1;
        } catch (error) {
          const updated: OutboxEntry = await recordFailure(entry, error);

          if (isNetworkError(error)) {
            // Still offline — stop the drain and leave the rest queued.
            break;
          }
          if (updated.status === 'failed') {
            toast.error(
              `A queued request could not be submitted after ${MAX_OUTBOX_ATTEMPTS} attempts. Open the Outbox to review it.`,
              { duration: 8000 },
            );
          }
        }
      }
    } finally {
      isDraining = false;
      setIsSyncing(false);
      await refresh();
    }

    if (succeeded > 0) {
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['all-requests-stats'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      toast.success(
        succeeded === 1
          ? 'Your saved request has been submitted.'
          : `${succeeded} saved requests have been submitted.`,
        { duration: 6000 },
      );
    }
  }, [profile?.id, queryClient, refresh]);

  useEffect(() => {
    if (!isOutboxSupported()) return;

    void sync();

    const onOnline = () => void sync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync();
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => void sync(), RETRY_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [sync]);

  return { pendingCount, failedCount, isSyncing, sync, refresh };
}
