import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { RequestStatus } from '@/types';

/**
 * Subset of a `requests` row needed to resolve a status-change toast.
 * Realtime delivers BOTH the old and new full rows because migration
 * 1010 sets `ALTER TABLE public.requests REPLICA IDENTITY FULL`.
 */
interface RequestRow {
  id: string;
  request_number: string;
  status: RequestStatus;
  created_by: string;
  assigned_to: string | null;
  pickup_responsibility: string | null;
}

/**
 * Resolves the per-transition message exactly as the DB trigger does
 * in migration 1011. Mirrors the rules so the in-app toast and the
 * push notification carry identical text.
 *
 * Returns `null` when the transition isn't one we notify on (so the
 * caller can short-circuit).
 *
 * For the assigned-case the maker's name is fetched from `profiles`
 * because the realtime payload only carries `assigned_to` (a UUID).
 */
async function resolveMessage(
  before: Partial<RequestRow>,
  after: RequestRow,
): Promise<string | null> {
  if (before.status === 'pending_approval' && after.status === 'approved') {
    return `Approved: Your request ${after.request_number} has been approved.`;
  }

  if (before.status === 'pending_approval' && after.status === 'rejected') {
    return `Rejected: Your request ${after.request_number} was rejected.`;
  }

  if (before.status === 'approved' && after.status === 'assigned') {
    let makerName = 'the Maker';
    if (after.assigned_to) {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', after.assigned_to)
        .maybeSingle();
      const name = data?.full_name?.trim();
      if (name) makerName = name;
    }
    return `Assigned: ${after.request_number} has been assigned to ${makerName}.`;
  }

  if (before.status === 'assigned' && after.status === 'in_production') {
    return `In Production: Work has started on ${after.request_number}.`;
  }

  // The trigger's WHEN clause requires OLD.status <> NEW.status, so by the
  // time we land in this hook for an UPDATE the status has already moved.
  // Still, the realtime UPDATE binding fires for any column change — guard
  // explicitly that `before.status` differs so a non-status update can't
  // mis-fire ready/dispatched (which don't constrain the predecessor).
  if (before.status === after.status) return null;

  if (after.status === 'ready' && after.pickup_responsibility === 'self_pickup') {
    return `Ready: ${after.request_number} is ready. You can pick it up now.`;
  }

  if (after.status === 'dispatched' && after.pickup_responsibility !== 'self_pickup') {
    return `Dispatched: ${after.request_number} has been dispatched.`;
  }

  return null;
}

/** Maps a status to the headline shown in the toast. */
function titleFor(status: RequestStatus): string {
  switch (status) {
    case 'approved':      return 'Approved';
    case 'rejected':      return 'Rejected';
    case 'assigned':      return 'Assigned';
    case 'in_production': return 'In Production';
    case 'ready':         return 'Ready';
    case 'dispatched':    return 'Dispatched';
    default:              return 'Request Update';
  }
}

/**
 * Subscribes the signed-in requester to Supabase Realtime UPDATE events on
 * their OWN requests and raises a toast for the six pipeline transitions
 * defined in migration 1011. Only role === 'requester' subscribes; every
 * other role is a no-op (coordinators / makers / dispatchers have their
 * own listeners).
 *
 * Server-side filter: `created_by=eq.<userId>` — the Realtime channel
 * never receives a row that does not belong to this user, so we cannot
 * accidentally surface another requester's status change.
 *
 * Requires `ALTER TABLE public.requests REPLICA IDENTITY FULL` (migration
 * 1010) so `payload.old` carries the full previous row — otherwise
 * `before.status` would be undefined and no toast would ever fire (the
 * hook is fail-safe in that direction: it never mis-fires, just no-ops).
 */
export function useRequesterNotifications(): void {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const userId = user?.id;
  const role = profile?.role;

  useEffect(() => {
    // Only requesters listen — and only once we know their user_id.
    if (!userId || role !== 'requester') return;

    const channel = supabase
      .channel(`requester-status:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'requests',
          // Strict server-side ownership filter.
          filter: `created_by=eq.${userId}`,
        },
        async (payload) => {
          const before = payload.old as Partial<RequestRow>;
          const after = payload.new as RequestRow;

          // Defensive: server filter should already guarantee this.
          if (after.created_by !== userId) return;

          const message = await resolveMessage(before, after);
          if (!message) return;

          toast(titleFor(after.status), {
            description: message,
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
