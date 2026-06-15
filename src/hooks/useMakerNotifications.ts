import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Subset of a `requests` row needed to resolve a new-assignment
 * toast. Realtime delivers BOTH the old and new full rows because
 * migration 1010 sets `ALTER TABLE public.requests REPLICA IDENTITY
 * FULL`. We need `before.assigned_to` to distinguish a brand-new
 * assignment from any other UPDATE that happened to touch the row.
 */
interface RequestRow {
  id: string;
  request_number: string;
  assigned_to: string | null;
}

/**
 * Subscribes the signed-in maker to Supabase Realtime UPDATE events
 * on the `requests` table and raises a toast whenever a request's
 * `assigned_to` flips to THIS user's ID.
 *
 * The push-notification side of the same event is dispatched by the
 * `notify_maker_assigned()` trigger (see migration 1014) → the
 * `send-maker-push` edge function. This hook is the in-app twin.
 *
 * Only role === 'maker' subscribes; every other role is a no-op.
 *
 * Filtering strategy
 * ──────────────────
 *   * Server-side filter: `assigned_to=eq.${userId}` — Realtime will
 *     never deliver a row whose new assigned_to isn't this user.
 *     That alone is NOT sufficient, because the filter doesn't see
 *     `before.assigned_to`. If the row was already assigned to this
 *     maker and a different field (e.g., status) was updated, the
 *     channel still delivers the event.
 *   * Handler-side check: `before.assigned_to !== userId && after.assigned_to === userId`
 *     ensures we only toast on the *transition into* this user's
 *     assignment, not on every subsequent edit.
 */
export function useMakerNotifications(): void {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const userId = user?.id;
  const role = profile?.role;

  useEffect(() => {
    if (!userId || role !== 'maker') return;

    const channel = supabase
      .channel(`maker-assignments:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'requests',
          // Strict server-side filter on NEW.assigned_to — but still
          // verify the transition in the handler since the filter
          // can't see OLD.
          filter: `assigned_to=eq.${userId}`,
        },
        (payload) => {
          const before = payload.old as Partial<RequestRow>;
          const after  = payload.new as RequestRow;

          // Defensive: server filter should already guarantee this.
          if (after.assigned_to !== userId) return;
          // Only toast on the transition INTO this user's assignment.
          if (before.assigned_to === userId) return;

          toast('New Assignment', {
            description: `${after.request_number} has been assigned to you.`,
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
