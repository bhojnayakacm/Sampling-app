-- ============================================================
-- Migration 1018: Requesters can mark own requests as received
-- ============================================================
--
-- WHY THIS EXISTS
--   The 2026-06 UX refactor moved the "Mark as Received" action
--   from the coordinator UI to a sticky bottom bar shown only to
--   the requester (`src/components/requests/ReceiverActions.tsx`).
--   The client wires this through `useMarkAsReceived` in
--   `src/lib/api/requests.ts`, which issues an UPDATE on the
--   `requests` row directly.
--
--   No corresponding RLS policy was ever added. The existing
--   requester-side UPDATE policies cover only:
--     - own DRAFT rows  (migration 301)
--     - own REJECTED rows (migration 960)
--     - dismissing has_schedule_warning (migration 1000)
--
--   None of these allow status='dispatched' (or 'ready'+
--   self_pickup) → 'received'. As a result, every requester
--   "Mark as Received" click triggers a silent RLS rejection,
--   which the client surfaces as:
--
--     "Permission denied: You do not have permission to update
--      this request. Please contact your administrator if you
--      believe this is an error."
--
--   This migration installs a strict, narrowly-scoped UPDATE
--   policy that closes that gap.
--
-- WHAT THIS POLICY ALLOWS
--   Caller role must be 'requester' (NOT admin/coordinator/etc —
--   those have their own broader policies).
--   Caller must own the row (created_by = auth.uid()).
--   Pre-update status must be one of:
--       a) 'dispatched'                       — any delivery method
--       b) 'ready' AND pickup_responsibility = 'self_pickup'
--          (self-pickup skips the dispatch step)
--   Post-update status must be exactly 'received'.
--
--   These bounds mirror the client's `useMarkAsReceived`
--   precondition check (see allowedStatuses logic in
--   src/lib/api/requests.ts), so the policy is the server-side
--   mirror of what the UI already enforces.
--
-- WHAT THIS POLICY EXPLICITLY DOES NOT REFERENCE
--   `required_by`. The reported symptom mentioned overdue
--   deadlines, but no RLS or trigger has ever consulted
--   required_by — that check is purely client-side
--   (RequestActions/MakerActions). Receiving an overdue
--   sample is therefore unblocked by this policy regardless of
--   the deadline.
--
-- WHY THE WITH CHECK IS STRICT (status = 'received')
--   PostgreSQL RLS gates the WHOLE row, not individual columns.
--   Without WITH CHECK status='received', a malicious requester
--   could repurpose this policy to set status to ANY value while
--   their row is in the qualifying pre-state. Pinning the
--   outgoing status to 'received' guarantees the only legitimate
--   workflow transition is allowed.
--
-- IDEMPOTENCE
--   Wrapped in DROP POLICY IF EXISTS + CREATE POLICY so this file
--   is safe to re-run.
--
-- ROLLBACK (manual, not part of migration)
--   DROP POLICY IF EXISTS "Requesters can mark own requests as received" ON public.requests;
--
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "Requesters can mark own requests as received" ON public.requests;

CREATE POLICY "Requesters can mark own requests as received"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND public.get_my_role() = 'requester'
    AND (
      status = 'dispatched'
      OR (status = 'ready' AND pickup_responsibility = 'self_pickup')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND public.get_my_role() = 'requester'
    AND status = 'received'
  );

COMMENT ON POLICY "Requesters can mark own requests as received" ON public.requests IS
'Allows a requester to confirm receipt of their own sample by transitioning '
'status from dispatched (any pickup) or ready+self_pickup to received. The '
'WITH CHECK pins the outgoing status to received so this policy cannot be '
'repurposed for any other status change.';

-- ------------------------------------------------------------
-- Sanity verification
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'requests'
       AND policyname = 'Requesters can mark own requests as received'
  ) THEN
    RAISE EXCEPTION 'Migration 1018 FAILED — policy was not installed.';
  END IF;

  RAISE NOTICE 'Migration 1018 OK — requester mark-received policy installed.';
END $$;

COMMIT;
