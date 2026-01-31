-- ============================================================
-- Add Dispatcher (Field Boy) Role
-- ============================================================
-- Dispatchers are field personnel who pick up ready samples
-- and deliver them. They see requests with status='ready' AND
-- pickup_responsibility='field_boy', and can mark them dispatched.
-- ============================================================

-- STEP 1: Add 'dispatcher' to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'dispatcher';

-- STEP 2: Update handle_new_user() to accept 'dispatcher'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  role_value TEXT;
BEGIN
  role_value := LOWER(NEW.raw_user_meta_data->>'role');

  IF role_value IS NULL OR role_value NOT IN ('admin', 'coordinator', 'requester', 'maker', 'dispatcher') THEN
    role_value := 'requester';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role, department, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    role_value::public.user_role,
    NEW.raw_user_meta_data->>'department',
    true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: RLS — Dispatchers can SELECT requests that are ready + field_boy
--         OR dispatched (to see their own dispatch history)
CREATE POLICY "Dispatchers can view field_boy requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'dispatcher' AND (
      (status = 'ready' AND pickup_responsibility = 'field_boy') OR
      status = 'dispatched' OR
      status = 'received'
    )
  );

-- STEP 4: RLS — Dispatchers can UPDATE ready→dispatched for field_boy requests
CREATE POLICY "Dispatchers can dispatch field_boy requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'dispatcher' AND
    status = 'ready' AND
    pickup_responsibility = 'field_boy'
  )
  WITH CHECK (
    public.get_my_role() = 'dispatcher' AND
    status = 'dispatched'
  );

-- STEP 5: RLS — Dispatchers can view request items for requests they can see
CREATE POLICY "Dispatchers can view field_boy request items"
  ON public.request_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_items.request_id
      AND public.get_my_role() = 'dispatcher'
      AND (
        (r.status = 'ready' AND r.pickup_responsibility = 'field_boy') OR
        r.status = 'dispatched' OR
        r.status = 'received'
      )
    )
  );

-- STEP 6: RLS — Dispatchers can view the status timeline for their requests
CREATE POLICY "Dispatchers can view field_boy request timeline"
  ON public.request_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_status_history.request_id
      AND public.get_my_role() = 'dispatcher'
    )
  );
