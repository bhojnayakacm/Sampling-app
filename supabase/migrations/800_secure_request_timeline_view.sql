-- ============================================================
-- MIGRATION: Secure request_timeline view
-- Purpose: Keep SECURITY DEFINER but add access restrictions
-- ============================================================

-- Drop the existing view
DROP VIEW IF EXISTS request_timeline;

-- Recreate the view with SECURITY DEFINER and built-in access control
CREATE OR REPLACE VIEW request_timeline
WITH (security_invoker = false)  -- Explicitly keep SECURITY DEFINER
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
  -- ============================================================
  -- ACCESS CONTROL: Only show requests the user can actually access
  -- This mirrors the RLS policies on the requests table
  -- ============================================================
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

-- Grant access to authenticated users
GRANT SELECT ON request_timeline TO authenticated;

-- Add security comment
COMMENT ON VIEW request_timeline IS
'SECURITY DEFINER view that bypasses profile RLS to show approver names, but includes WHERE clause to restrict access to authorized requests only.';

-- ============================================================
-- VERIFICATION QUERY (run this to test)
-- ============================================================
-- This query should only return requests the current user can access
-- SELECT * FROM request_timeline;
