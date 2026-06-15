import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Subset of a `requests` row needed to resolve a ready-for-dispatch
 * toast. Realtime delivers both old and new full rows because
 * migration 1010 set `ALTER TABLE public.requests REPLICA IDENTITY
 * FULL` — we need `before.status` to detect the transition INTO
 * `ready`, not raise a toast for every subsequent edit on a row
 * already in that state.
 */
interface RequestRow {
  id: string;
  request_number: string;
  status: string;
  pickup_responsibility: string | null;
}

/**
 * Subscribes the signed-in dispatcher to Supabase Realtime UPDATE
 * events on the `requests` table and raises a toast whenever a
 * request transitions to status='ready' AND its pickup_responsibility
 * is 'field_boy' (the dispatcher's scope — same filter the
 * Dispatcher Dashboard uses for its work list).
 *
 * The push-notification side of the same event is dispatched by the
 * `notify_dispatcher_ready()` trigger (see migration 1014) → the
 * `send-dispatcher-push` edge function. This hook is the in-app twin.
 *
 * Only role === 'dispatcher' subscribes; every other role is a no-op.
 *
 * Filtering strategy
 * ──────────────────
 *   * No server-side filter on UPDATE — the transition test needs
 *     the previous status (payload.old), and Realtime filters can
 *     only see the new row. All matching is done in the handler.
 *   * REPLICA IDENTITY FULL (migration 1010) is mandatory; without
 *     it before.status is undefined and the toast never fires
 *     (fail-safe: never mis-fires).
 */
export function useDispatcherNotifications(): void {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const userId = user?.id;
  const role = profile?.role;

  useEffect(() => {
    if (!userId || role !== 'dispatcher') return;

    const channel = supabase
      .channel(`dispatcher-ready:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'requests',
        },
        (payload) => {
          const before = payload.old as Partial<RequestRow>;
          const after  = payload.new as RequestRow;

          // Transition INTO ready (not an edit on an already-ready row).
          if (before.status === after.status) return;
          if (after.status !== 'ready') return;
          // Scope to the dispatcher's actual work (matches
          // useFieldBoyReadyRequests + the migration 1014 trigger).
          if (after.pickup_responsibility !== 'field_boy') return;

          toast('Ready for Dispatch', {
            description: `${after.request_number} is ready for delivery.`,
            action: {
              label: 'View',
              onClick: () => navigate(`/requests/${after.id}`),
            },
            duration: 8000,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, role, navigate]);
}
