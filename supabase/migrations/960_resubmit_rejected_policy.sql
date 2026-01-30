-- ============================================================
-- Allow Requesters to Resubmit Rejected Requests
-- ============================================================
-- This migration adds RLS policies so a requester can update
-- their own rejected request (editing fields + resetting status
-- to pending_approval) and replace its items.
-- ============================================================

-- 1. requests table: Allow requester to update own rejected requests
CREATE POLICY "Requesters can update own rejected requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester' AND
    status = 'rejected'
  )
  WITH CHECK (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester'
  );

COMMENT ON POLICY "Requesters can update own rejected requests" ON public.requests IS
'Allows requesters to edit and resubmit their own rejected requests.';

-- 2. request_items table: Allow requester to update items of rejected requests
CREATE POLICY "Users can update their own rejected request items"
  ON public.request_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_items.request_id
      AND r.created_by = auth.uid()
      AND r.status = 'rejected'
    )
  );

-- 3. request_items table: Allow requester to delete items of rejected requests
--    (needed because updateRequestWithItems deletes old items before inserting new ones)
CREATE POLICY "Users can delete their own rejected request items"
  ON public.request_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_items.request_id
      AND r.created_by = auth.uid()
      AND r.status = 'rejected'
    )
  );
