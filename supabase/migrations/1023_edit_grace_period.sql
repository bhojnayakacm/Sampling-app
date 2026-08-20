-- ============================================================
-- Migration 1023: 10-Minute Edit Grace Period
-- ============================================================
--
-- A requester may edit their own request for 10 minutes after
-- created_at, while it is still pending_approval or approved.
-- If a coordinator approved it during that window and the
-- requester then edits, the approval is revoked automatically.
--
--   STEP 1.  requests   — UPDATE policy for the grace window.
--   STEP 2.  request_items — UPDATE + DELETE policies for the same
--            window (updateRequestWithItems deletes the old items
--            before inserting the new set, so DELETE is required).
--   STEP 3.  BEFORE UPDATE trigger that forces an approved request
--            back to pending_approval when its own requester edits it.
--
-- WHY BOTH A POLICY AND A TRIGGER
--   The policy decides WHETHER the write is allowed; the trigger
--   decides WHAT the resulting status is. Neither alone is enough:
--   a policy cannot rewrite a column, and a trigger cannot stop an
--   out-of-window write.
--
-- SECURITY NOTE — the WITH CHECK on STEP 1 pins the outgoing status
--   to 'pending_approval'. Without that pin a requester could send
--   status='approved' on a pending_approval row and self-approve,
--   because the trigger's revert only arms when the row was ALREADY
--   approved. The pin closes that escalation.
--
-- IDEMPOTENCE
--   DROP POLICY / DROP TRIGGER IF EXISTS + CREATE OR REPLACE
--   throughout, so this file is safe to re-apply.
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1 — requests: requester UPDATE inside the grace window
-- ============================================================
-- USING  : which existing rows may be targeted.
-- CHECK  : what the row is allowed to look like afterwards.
--
-- Both sides re-assert the deadline so the window cannot be
-- straddled: a form opened at 09:50 and submitted at 10:05 is
-- rejected by the WITH CHECK even though USING passed on read.

DROP POLICY IF EXISTS "Requesters can edit own requests during grace period" ON public.requests;

CREATE POLICY "Requesters can edit own requests during grace period"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND public.get_my_role() = 'requester'
    AND status IN ('pending_approval', 'approved')
    AND now() <= created_at + INTERVAL '10 minutes'
  )
  WITH CHECK (
    created_by = auth.uid()
    AND public.get_my_role() = 'requester'
    -- Outgoing status is pinned: an edit always lands on
    -- pending_approval (the STEP 3 trigger guarantees this even if
    -- the client sends something else).
    AND status = 'pending_approval'
    AND now() <= created_at + INTERVAL '10 minutes'
  );

COMMENT ON POLICY "Requesters can edit own requests during grace period" ON public.requests IS
'10-minute post-submission edit window. Lets a requester revise their own '
'pending_approval/approved request for 10 minutes after created_at. The '
'WITH CHECK pins the outgoing status to pending_approval so this policy '
'can never be used to self-approve, and re-checks the deadline so a stale '
'form cannot be submitted after the window closes.';

-- ============================================================
-- STEP 2 — request_items: same window
-- ============================================================
-- updateRequestWithItems() DELETEs every existing item and
-- re-INSERTs the new set. The delete runs while the parent is
-- still pending_approval/approved, so both policies below key off
-- the parent's status and created_at.
--
-- INSERT is already covered by the existing policy "Users can
-- insert their own request items" (owner check, no status gate),
-- so no new INSERT policy is needed.

DROP POLICY IF EXISTS "Requesters can update own request items during grace period" ON public.request_items;

CREATE POLICY "Requesters can update own request items during grace period"
  ON public.request_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
       WHERE r.id = request_items.request_id
         AND r.created_by = auth.uid()
         AND r.status IN ('pending_approval', 'approved')
         AND now() <= r.created_at + INTERVAL '10 minutes'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requests r
       WHERE r.id = request_items.request_id
         AND r.created_by = auth.uid()
         AND r.status IN ('pending_approval', 'approved')
         AND now() <= r.created_at + INTERVAL '10 minutes'
    )
  );

DROP POLICY IF EXISTS "Requesters can delete own request items during grace period" ON public.request_items;

CREATE POLICY "Requesters can delete own request items during grace period"
  ON public.request_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
       WHERE r.id = request_items.request_id
         AND r.created_by = auth.uid()
         AND r.status IN ('pending_approval', 'approved')
         AND now() <= r.created_at + INTERVAL '10 minutes'
    )
  );

COMMENT ON POLICY "Requesters can delete own request items during grace period" ON public.request_items IS
'Required by the edit flow: updateRequestWithItems() replaces the item set '
'by deleting the old rows first. Gated on the parent request being owned by '
'the caller, still pending_approval/approved, and inside the 10-minute window.';

-- ============================================================
-- STEP 3 — Auto-revert trigger
-- ============================================================
-- If the requester edits a request that a coordinator already
-- approved, the approval is stale — force it back to
-- pending_approval so the coordinator re-reviews the new content.
--
-- THREE GUARDS, each load-bearing:
--
--   1. public.get_my_role() = 'requester'
--      A coordinator who happens to own a request they created
--      must NOT trip this. Without the role check, a coordinator
--      moving their own request approved -> assigned would be
--      silently bounced back to pending_approval.
--
--   2. auth.uid() = OLD.created_by
--      Only the owner's own edit revokes the approval.
--
--   3. Content actually changed (the jsonb diff below)
--      Requesters have another narrow write path: dismissing the
--      schedule-change warning (migration 1000), which only flips
--      has_schedule_warning. That must not unapprove the request.
--      Comparing the rows as jsonb minus the columns that are
--      allowed to change on their own is precise and, unlike an
--      explicit column list, cannot silently miss a column added
--      by a future migration.
--
-- `status` is excluded from the comparison because it is the value
-- being decided, and `updated_at` because the update_updated_at
-- trigger rewrites it on every UPDATE regardless of ordering.

CREATE OR REPLACE FUNCTION public.revert_approval_on_requester_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
BEGIN
  -- Only arm on an approved row being written by its own requester.
  IF OLD.status <> 'approved'
     OR auth.uid() IS NULL
     OR auth.uid() <> OLD.created_by
     OR public.get_my_role() <> 'requester'
  THEN
    RETURN NEW;
  END IF;

  -- Ignore writes that change nothing but the exempt columns.
  v_old := to_jsonb(OLD) - 'status' - 'updated_at' - 'has_schedule_warning';
  v_new := to_jsonb(NEW) - 'status' - 'updated_at' - 'has_schedule_warning';

  IF v_new IS DISTINCT FROM v_old THEN
    NEW.status := 'pending_approval';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.revert_approval_on_requester_edit IS
'BEFORE UPDATE on requests. When a requester edits their own already-approved '
'request (inside the 10-minute grace window), forces status back to '
'pending_approval so the coordinator re-reviews. No-ops for coordinator/maker '
'writes and for the schedule-warning dismissal, which changes no content.';

DROP TRIGGER IF EXISTS trg_revert_approval_on_requester_edit ON public.requests;
CREATE TRIGGER trg_revert_approval_on_requester_edit
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  WHEN (OLD.status = 'approved')
  EXECUTE FUNCTION public.revert_approval_on_requester_edit();

COMMENT ON TRIGGER trg_revert_approval_on_requester_edit ON public.requests IS
'Revokes a stale approval when the requester edits during the grace period. '
'The WHEN clause keeps the function body out of every UPDATE that does not '
'start from the approved state.';

-- ============================================================
-- STEP 4 — Sanity verification
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'requests'
       AND policyname = 'Requesters can edit own requests during grace period'
  ) THEN
    RAISE EXCEPTION 'Migration 1023 FAILED — requests grace-period policy missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'request_items'
       AND policyname = 'Requesters can delete own request items during grace period'
  ) THEN
    RAISE EXCEPTION 'Migration 1023 FAILED — request_items delete policy missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_revert_approval_on_requester_edit'
  ) THEN
    RAISE EXCEPTION 'Migration 1023 FAILED — auto-revert trigger missing.';
  END IF;

  RAISE NOTICE
    'Migration 1023 OK — grace-period policies on requests + request_items, auto-revert trigger installed.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, not part of migration)
-- ============================================================
-- DROP TRIGGER  IF EXISTS trg_revert_approval_on_requester_edit ON public.requests;
-- DROP FUNCTION IF EXISTS public.revert_approval_on_requester_edit();
-- DROP POLICY   IF EXISTS "Requesters can edit own requests during grace period" ON public.requests;
-- DROP POLICY   IF EXISTS "Requesters can update own request items during grace period" ON public.request_items;
-- DROP POLICY   IF EXISTS "Requesters can delete own request items during grace period" ON public.request_items;
-- ============================================================
