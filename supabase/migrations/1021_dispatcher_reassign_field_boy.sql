-- ============================================================
-- Migration 1021: Dispatcher can reassign field boy after dispatch
-- ============================================================
--
-- WHY THIS EXISTS
--   The field boy is chosen at the moment of dispatch (DispatchDialog
--   → dispatch_metadata.field_boy, written together with
--   status='dispatched'). Operations sometimes need to hand a delivery
--   to a different field boy AFTER it has gone out — up until the
--   sample is marked received. There was no way to do that, and no RLS
--   permitted it.
--
-- EXISTING DISPATCHER UPDATE POLICIES (none cover this)
--   * "Dispatchers can dispatch field_boy requests" (970):
--       USING status='ready'+field_boy, WITH CHECK status='dispatched'
--       → only the ready→dispatched flip.
--   * "Dispatchers can message ready field_boy requests" (1019):
--       USING/CHECK status='ready'+field_boy → only a ready→ready edit.
--   Neither allows touching a row that is already `dispatched`.
--
-- WHAT THIS POLICY ALLOWS
--   A dispatcher to UPDATE their in-flight field_boy deliveries while
--   they are `dispatched`. Status is pinned to 'dispatched' on BOTH
--   USING and WITH CHECK, so the policy can only be used for in-place
--   edits of a dispatched row (the reassignment writes
--   dispatch_metadata) and can never flip status or escape the
--   field_boy scope. Once the request becomes `received`, USING no
--   longer matches and the window closes — exactly the requirement.
--
-- NOTE — no dedicated assigned_field_boy_id column
--   Field boys are a hard-coded roster of "Name - Phone" strings (see
--   src/lib/dispatch.ts), not profile rows, so there is no id to store.
--   The assignment lives in requests.dispatch_metadata->>'field_boy'
--   (migration 1016), and the reassignment updates that JSONB field —
--   keeping a single source of truth rather than duplicating it into a
--   new column.
--
-- IDEMPOTENCE
--   DROP POLICY IF EXISTS + CREATE POLICY — safe to re-run.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "Dispatchers can reassign field boy on dispatched requests" ON public.requests;

CREATE POLICY "Dispatchers can reassign field boy on dispatched requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'dispatcher'
    AND status = 'dispatched'
    AND pickup_responsibility = 'field_boy'
  )
  WITH CHECK (
    public.get_my_role() = 'dispatcher'
    AND status = 'dispatched'
    AND pickup_responsibility = 'field_boy'
  );

COMMENT ON POLICY "Dispatchers can reassign field boy on dispatched requests" ON public.requests IS
'Lets a dispatcher edit a dispatched field_boy request (in practice: rewrite '
'dispatch_metadata.field_boy to reassign delivery) until it is received. '
'Status pinned to dispatched on USING + WITH CHECK so it cannot change status '
'or leave the field_boy scope.';

-- ------------------------------------------------------------
-- Sanity verification
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'requests'
       AND policyname = 'Dispatchers can reassign field boy on dispatched requests'
  ) THEN
    RAISE EXCEPTION 'Migration 1021 FAILED — reassign policy was not installed.';
  END IF;

  RAISE NOTICE 'Migration 1021 OK — dispatcher field-boy reassignment policy installed.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, not part of migration)
-- ============================================================
-- DROP POLICY IF EXISTS "Dispatchers can reassign field boy on dispatched requests" ON public.requests;
-- ============================================================
