-- Allow requesters to dismiss the schedule change warning on their own requests.
-- This is a narrow policy: the USING clause allows the row to be selected for update
-- only when the warning is currently true, and the WITH CHECK ensures the requester
-- can only set it to false (not modify any other column beyond what RLS controls).
CREATE POLICY "Requesters can dismiss schedule warning on own requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester' AND
    has_schedule_warning = true
  )
  WITH CHECK (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester' AND
    has_schedule_warning = false
  );

COMMENT ON POLICY "Requesters can dismiss schedule warning on own requests" ON public.requests IS
'Allows requesters to acknowledge and dismiss the schedule change warning on their own requests. The WITH CHECK ensures they can only set the flag to false.';
