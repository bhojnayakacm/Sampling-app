import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { CATEGORY_LABELS, type RequestCategory, type UserRole } from '@/types';

/**
 * Maps a coordinator role to the request category it is responsible for.
 * Only roles present here receive in-app notifications; every other role
 * (requester, maker, dispatcher, admin) is skipped.
 *
 * `coordinator` is the legacy single-role account — App.tsx routes it to
 * the Marble dashboard, so it is treated as a Marble coordinator here too.
 */
const CATEGORY_BY_ROLE: Partial<Record<UserRole, RequestCategory>> = {
  marble_coordinator: 'marble',
  magro_coordinator: 'magro',
  coordinator: 'marble',
};

/** Subset of a `requests` row used by the notification toast. */
interface RequestRow {
  id: string;
  request_number: string;
  status: string;
  category: RequestCategory | null;
  client_contact_name: string | null;
}

/**
 * Subscribes the signed-in coordinator to Supabase Realtime events on the
 * `requests` table and raises a toast for each new sample request that
 * matches their category. Two submission paths are covered:
 *
 *   - INSERT — a request created directly as a submission.
 *   - UPDATE — a saved draft being submitted, i.e. status transitions
 *     draft -> pending_approval.
 *
 * The UPDATE path inspects `payload.old.status` so it fires ONLY on that
 * exact transition — later edits to an already-submitted request never
 * raise a toast. This requires `requests` to be REPLICA IDENTITY FULL
 * (migration 1010); otherwise `payload.old` carries only the primary key
 * and the draft-submit toast silently never fires (it never mis-fires).
 *
 * Routing is enforced by category; draft rows never raise a toast.
 */
export function useRequestNotifications(): void {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const userId = user?.id;
  const role = profile?.role;

  useEffect(() => {
    if (!userId || !role) return;

    const category = CATEGORY_BY_ROLE[role];
    if (!category) return; // Not a coordinator — nothing to listen for.

    const label = CATEGORY_LABELS[category]; // 'Marble' | 'Magro'

    /** Raise the "new request" toast for a request in this category. */
    const notify = (row: RequestRow) => {
      toast(`New ${label} Request: ${row.request_number}`, {
        description: row.client_contact_name
          ? `Client: ${row.client_contact_name}`
          : 'A new sample request is awaiting your review.',
        action: {
          label: 'View',
          onClick: () => navigate(`/requests/${row.id}`),
        },
        duration: 8000,
      });
    };

    const channel = supabase
      .channel(`request-notifications:${userId}`)
      // ── Path 1: a request created directly as a submission ──
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'requests',
          filter: `category=eq.${category}`,
        },
        (payload) => {
          const row = payload.new as RequestRow;

          // Drafts are inserted before submission — not actionable yet.
          if (row.status === 'draft') return;
          // Defensive: the channel filter should already guarantee this.
          if (row.category !== category) return;

          notify(row);
        }
      )
      // ── Path 2: a saved draft being submitted ───────────────
      // No server-side filter here: the transition test needs the
      // previous status (payload.old), and a draft's category may be
      // set during this same update — so all matching is done in the
      // handler against the full old/new rows.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'requests',
        },
        (payload) => {
          const before = payload.old as Partial<RequestRow>;
          const after = payload.new as RequestRow;

          // Fire ONLY on the draft -> pending_approval transition.
          // Any other edit to a request (approval, status change,
          // field edits) must NOT raise a toast.
          if (before.status !== 'draft') return;
          if (after.status !== 'pending_approval') return;
          if (after.category !== category) return;

          notify(after);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, role, navigate]);
}
