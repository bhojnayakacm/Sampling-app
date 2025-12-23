-- ============================================================
-- MIGRATION: Add 'ready' status to request_status enum
-- Purpose: Introduce intermediate step between 'in_production' and 'dispatched'
--
-- Dependencies to handle:
-- 1. RLS Policies that reference status column
-- 2. Trigger that references status column
-- 3. Trigger function that uses the enum type
-- 4. View that references the enum type
-- ============================================================

-- ============================================================
-- STEP 1: Drop dependent objects (in correct order)
-- ============================================================

-- Drop the view first (depends on enum)
DROP VIEW IF EXISTS request_timeline;

-- Drop the trigger (depends on function and status column)
DROP TRIGGER IF EXISTS trigger_log_status_change ON requests;

-- Drop the trigger function (uses the enum type)
DROP FUNCTION IF EXISTS log_request_status_change();

-- Drop RLS policies that check status = 'draft'
DROP POLICY IF EXISTS "Requesters can update own draft requests" ON public.requests;
DROP POLICY IF EXISTS "Requesters can delete own drafts" ON public.requests;

-- ============================================================
-- STEP 2: Create new enum type with 'ready' status
-- ============================================================

CREATE TYPE request_status_new AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'assigned',
  'in_production',
  'ready',              -- NEW STATUS
  'dispatched',
  'received',
  'rejected'
);

-- ============================================================
-- STEP 3: Alter tables to use the new enum
-- ============================================================

-- Alter requests table
-- First, drop the DEFAULT constraint
ALTER TABLE public.requests
  ALTER COLUMN status DROP DEFAULT;

-- Change to TEXT, then to new enum
ALTER TABLE public.requests
  ALTER COLUMN status TYPE TEXT;

ALTER TABLE public.requests
  ALTER COLUMN status TYPE request_status_new USING status::request_status_new;

-- Alter request_status_history table (no default on this one)
ALTER TABLE public.request_status_history
  ALTER COLUMN status TYPE TEXT;

ALTER TABLE public.request_status_history
  ALTER COLUMN status TYPE request_status_new USING status::request_status_new;

-- ============================================================
-- STEP 4: Drop old enum and rename new one
-- ============================================================

DROP TYPE request_status;
ALTER TYPE request_status_new RENAME TO request_status;

-- ============================================================
-- STEP 4.5: Restore the DEFAULT constraint (after rename)
-- ============================================================

ALTER TABLE public.requests
  ALTER COLUMN status SET DEFAULT 'pending_approval'::request_status;

-- ============================================================
-- STEP 5: Recreate the trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION log_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO request_status_history (
      request_id,
      status,
      changed_at,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.status,
      NOW(),
      auth.uid() -- Current authenticated user
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_request_status_change() IS
'Trigger function that automatically logs status changes to request_status_history table.';

-- ============================================================
-- STEP 6: Recreate the trigger
-- ============================================================

CREATE TRIGGER trigger_log_status_change
  AFTER INSERT OR UPDATE OF status ON requests
  FOR EACH ROW
  EXECUTE FUNCTION log_request_status_change();

-- ============================================================
-- STEP 7: Recreate the RLS policies
-- ============================================================

-- Recreate: Requesters can update own draft requests
CREATE POLICY "Requesters can update own draft requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester' AND
    status = 'draft'
  )
  WITH CHECK (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester'
  );

-- Recreate: Requesters can delete own drafts
CREATE POLICY "Requesters can delete own drafts"
  ON public.requests FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester' AND
    status = 'draft'
  );

COMMENT ON POLICY "Requesters can update own draft requests" ON public.requests IS
'Allows requesters to edit their own draft requests before submission';

COMMENT ON POLICY "Requesters can delete own drafts" ON public.requests IS
'Allows requesters to delete only their own draft requests. Submitted requests cannot be deleted for audit trail purposes.';

-- ============================================================
-- STEP 8: Recreate the view with proper security
-- ============================================================

CREATE OR REPLACE VIEW request_timeline
WITH (security_invoker = true)
AS
SELECT
  r.id as request_id,
  r.request_number,
  r.status as current_status,
  json_agg(
    json_build_object(
      'status', h.status,
      'changed_at', h.changed_at,
      'changed_by', h.changed_by,
      'changer_name', p.full_name
    ) ORDER BY h.changed_at ASC
  ) as history
FROM requests r
LEFT JOIN request_status_history h ON h.request_id = r.id
LEFT JOIN profiles p ON p.id = h.changed_by
WHERE
  -- ACCESS CONTROL: Only show requests the user can access
  (
    (r.created_by = auth.uid() AND public.get_my_role() = 'requester')
    OR
    (r.assigned_to = auth.uid() AND public.get_my_role() = 'maker')
    OR
    (public.get_my_role() IN ('coordinator', 'admin'))
  )
GROUP BY r.id, r.request_number, r.status;

GRANT SELECT ON request_timeline TO authenticated;

COMMENT ON VIEW request_timeline IS
'SECURITY INVOKER view that shows request timeline with approver names. Access is controlled by RLS policies on the requests table and WHERE clause in view definition.';

-- ============================================================
-- STEP 9: Add type comment
-- ============================================================

COMMENT ON TYPE request_status IS
'Request status enum with workflow: draft → pending_approval → approved → assigned → in_production → ready → dispatched → received (rejected is terminal state)';

-- ============================================================
-- VERIFICATION QUERIES (commented out - run manually if needed)
-- ============================================================
-- SELECT enum_range(NULL::request_status);
-- SELECT DISTINCT status FROM requests ORDER BY status;
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'requests';
-- SELECT tgname, tgtype FROM pg_trigger WHERE tgrelid = 'requests'::regclass;
-- SELECT * FROM request_timeline LIMIT 5;
-- ============================================================
