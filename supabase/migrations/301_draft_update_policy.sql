-- ============================================================
-- Add RLS policy for requesters to update their draft requests
-- ============================================================
-- This allows requesters to edit and submit their draft requests
-- ============================================================

-- Allow requesters to update their own draft requests
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

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
