-- ============================================================
-- MIGRATION: Add DELETE policy for draft requests
-- Description: Allow requesters to delete their own draft requests
-- ============================================================

-- ============================================================
-- DROP EXISTING DELETE POLICIES (if any)
-- ============================================================
DROP POLICY IF EXISTS "Requesters can delete own drafts" ON public.requests;

-- ============================================================
-- CREATE DELETE POLICY
-- ============================================================
-- Allow requesters to delete their own draft requests ONLY
CREATE POLICY "Requesters can delete own drafts"
  ON public.requests FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester' AND
    status = 'draft'
  );

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================
COMMENT ON POLICY "Requesters can delete own drafts" ON public.requests IS
'Allows requesters to delete only their own draft requests. Submitted requests cannot be deleted for audit trail purposes.';
