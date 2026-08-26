import { CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useOutboxSync } from '@/hooks/useOutboxSync';

/**
 * Mounts the Outbox sync engine and shows a small status pill while anything
 * is queued.
 *
 * Rendering nothing when the queue is empty means this can sit mounted app-
 * wide for its side effect (the sync loop) without costing any UI. It is
 * placed inside the auth + query providers because a replay performs
 * RLS-scoped writes and invalidates React Query caches.
 */
export default function OutboxIndicator() {
  const { profile } = useAuth();
  const { pendingCount, failedCount, isSyncing, sync } = useOutboxSync();

  // Signed-out users have nothing replayable (writes are RLS-scoped).
  if (!profile?.id) return null;

  const total = pendingCount + failedCount;
  if (total === 0) return null;

  const allFailed = pendingCount === 0 && failedCount > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 max-w-[calc(100vw-2rem)]"
    >
      <div
        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 shadow-lg ${
          allFailed
            ? 'bg-red-50 border-red-200'
            : 'bg-white border-slate-200'
        }`}
      >
        {isSyncing ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" />
        ) : (
          <CloudOff
            className={`h-4 w-4 shrink-0 ${allFailed ? 'text-red-500' : 'text-amber-500'}`}
          />
        )}

        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">
            {isSyncing
              ? 'Submitting saved request…'
              : allFailed
              ? `${failedCount} request${failedCount > 1 ? 's' : ''} need attention`
              : `${pendingCount} request${pendingCount > 1 ? 's' : ''} waiting to send`}
          </p>
          <p className="text-xs text-slate-500">
            {isSyncing
              ? 'Please keep the app open.'
              : allFailed
              ? 'Automatic retries were exhausted.'
              : 'Will send automatically when your connection improves.'}
          </p>
        </div>

        {!isSyncing && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void sync()}
            className="shrink-0 h-9 gap-1.5 border-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
