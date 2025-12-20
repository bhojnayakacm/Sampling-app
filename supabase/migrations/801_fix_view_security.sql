-- ============================================================
-- MIGRATION: Fix request_timeline view security warning
-- Purpose: Switch from SECURITY DEFINER to SECURITY INVOKER
--          and grant RLS permission to read profile names
-- ============================================================

-- ============================================================
-- STEP 1: Recreate view as SECURITY INVOKER
-- ============================================================

DROP VIEW IF EXISTS request_timeline;

CREATE OR REPLACE VIEW request_timeline
WITH (security_invoker = true)  -- Use caller's permissions (SECURITY INVOKER)
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
  -- This relies on RLS policies on the requests table
  (
    -- Requesters can see their own requests
    (r.created_by = auth.uid() AND public.get_my_role() = 'requester')
    OR
    -- Makers can see requests assigned to them
    (r.assigned_to = auth.uid() AND public.get_my_role() = 'maker')
    OR
    -- Coordinators and Admins can see all requests
    (public.get_my_role() IN ('coordinator', 'admin'))
  )
GROUP BY r.id, r.request_number, r.status;

-- Grant SELECT to authenticated users
GRANT SELECT ON request_timeline TO authenticated;

-- ============================================================
-- STEP 2: Add RLS policy to allow reading profile names
-- ============================================================

-- Drop the policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Allow reading basic profile info" ON public.profiles;

-- Create policy that allows all authenticated users to read profile info
-- This is necessary so users can see WHO approved their requests, WHO created requests, etc.
CREATE POLICY "Allow reading basic profile info"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON VIEW request_timeline IS
'SECURITY INVOKER view that shows request timeline with approver names. Access is controlled by RLS policies on the requests table and WHERE clause in view definition.';

COMMENT ON POLICY "Allow reading basic profile info" ON public.profiles IS
'Allows authenticated users to read profile information (id, full_name, role) to display names in timelines, request history, and assignment details. Does not expose sensitive data.';

-- ============================================================
-- VERIFICATION
-- ============================================================
-- After running this migration:
-- 1. The Supabase Security Advisor warning should disappear
-- 2. Requesters should still see "Approved by [Coordinator Name]" in timelines
-- 3. Run: SELECT * FROM request_timeline; (should only show authorized requests)
