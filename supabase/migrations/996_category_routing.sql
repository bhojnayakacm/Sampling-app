-- ============================================================
-- Migration 996: Category-Based Request Routing & Submission Splitting
-- ============================================================
-- This migration implements a 2-category system (Marble vs. Magro)
-- with dedicated coordinator roles for each category.
--
-- Changes:
--   1. Extend user_role enum (marble_coordinator, magro_coordinator)
--   2. Add 'category' column to requests
--   3. Update request_items: new product_type constraint + sub_category
--   4. Add RLS policies for new coordinator roles
--   5. Update handle_new_user() trigger
--   6. Recreate request_timeline view for new roles
--   7. Create create_split_requests() RPC (atomic dual-request insert)
-- ============================================================

-- ============================================================
-- STEP 1: EXTEND user_role ENUM
-- ============================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'marble_coordinator';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'magro_coordinator';

-- NOTE: 'coordinator' is kept in the enum for backward compatibility
-- (no users have it; admin UI will no longer offer it for new accounts)

-- ============================================================
-- STEP 2: ADD CATEGORY COLUMN TO REQUESTS
-- ============================================================

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS category TEXT
  CHECK (category IN ('marble', 'magro'));

-- Index for fast coordinator dashboard filtering by category
CREATE INDEX IF NOT EXISTS idx_requests_category ON public.requests(category);

COMMENT ON COLUMN public.requests.category IS
'Top-level product category for this request. Set at submission time. '
'NULL for drafts that contain mixed items (split happens at final Submit). '
'Determines which coordinator dashboard the request appears on.';

-- ============================================================
-- STEP 3: REBUILD request_items PRODUCT_TYPE CONSTRAINT
-- ============================================================

-- Drop the old CHECK constraint that allowed 5 values
-- (original constraint was named 'valid_product_type')
ALTER TABLE public.request_items DROP CONSTRAINT IF EXISTS valid_product_type;
ALTER TABLE public.request_items DROP CONSTRAINT IF EXISTS request_items_product_type_check;

-- Add new constraint: only 'marble' or 'magro' are valid
ALTER TABLE public.request_items
  ADD CONSTRAINT request_items_product_type_check
  CHECK (product_type IN ('marble', 'magro'));

-- ============================================================
-- STEP 4: ADD sub_category COLUMN TO request_items
-- ============================================================

ALTER TABLE public.request_items
  ADD COLUMN IF NOT EXISTS sub_category TEXT
  CHECK (sub_category IN ('tile', 'stone', 'quartz', 'terrazzo'));

-- Business rule: marble items must NOT have a sub_category,
-- magro items MUST have one
ALTER TABLE public.request_items
  ADD CONSTRAINT request_items_subcategory_rule
  CHECK (
    (product_type = 'marble' AND sub_category IS NULL) OR
    (product_type = 'magro' AND sub_category IS NOT NULL)
  );

-- Index for filtering items by sub_category
CREATE INDEX IF NOT EXISTS idx_request_items_subcategory ON public.request_items(sub_category);

COMMENT ON COLUMN public.request_items.sub_category IS
'Magro sub-category: tile | stone | quartz | terrazzo. NULL for marble items.';

-- ============================================================
-- STEP 5: UPDATE RLS POLICIES FOR NEW COORDINATOR ROLES
-- (Add parallel policies — do not drop existing ones)
-- ============================================================

-- PROFILES: new coordinator roles can view all profiles (same as coordinator)
CREATE POLICY "Marble and Magro coordinators can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('marble_coordinator', 'magro_coordinator'));

-- REQUESTS: new coordinator roles can view all non-draft requests
CREATE POLICY "Marble and Magro coordinators can view all requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('marble_coordinator', 'magro_coordinator'));

-- REQUESTS: new coordinator roles can update all requests (approve, assign, etc.)
CREATE POLICY "Marble and Magro coordinators can update all requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('marble_coordinator', 'magro_coordinator'))
  WITH CHECK (public.get_my_role() IN ('marble_coordinator', 'magro_coordinator'));

-- REQUEST_ITEMS: new coordinator roles can view all items
CREATE POLICY "Marble and Magro coordinators can view all request items"
  ON public.request_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('marble_coordinator', 'magro_coordinator')
    )
  );

-- REQUEST_ITEMS: new coordinator roles can update all items
CREATE POLICY "Marble and Magro coordinators can update all request items"
  ON public.request_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('marble_coordinator', 'magro_coordinator')
    )
  );

-- REQUEST_STATUS_HISTORY: new coordinator roles can view all history
CREATE POLICY "Marble and Magro coordinators can view status history"
  ON public.request_status_history FOR SELECT
  USING (public.get_my_role() IN ('marble_coordinator', 'magro_coordinator'));

-- REQUEST_STATUS_HISTORY: new coordinator roles can insert history entries
CREATE POLICY "Marble and Magro coordinators can insert status history"
  ON public.request_status_history FOR INSERT
  WITH CHECK (public.get_my_role() IN ('marble_coordinator', 'magro_coordinator'));

-- ============================================================
-- STEP 6: UPDATE handle_new_user() TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  role_value TEXT;
BEGIN
  role_value := LOWER(NEW.raw_user_meta_data->>'role');

  IF role_value IS NULL OR role_value NOT IN (
    'admin', 'coordinator', 'requester', 'maker', 'dispatcher',
    'marble_coordinator', 'magro_coordinator'
  ) THEN
    role_value := 'requester';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role, department, is_active, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    role_value::public.user_role,
    NEW.raw_user_meta_data->>'department',
    true,
    NEW.email
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 7: RECREATE request_timeline VIEW FOR NEW ROLES
-- ============================================================

-- Drop and recreate the view so it grants access to new coordinator roles
CREATE OR REPLACE VIEW public.request_timeline
WITH (security_invoker = true) AS
SELECT
  r.id as request_id,
  r.request_number,
  r.status as current_status,
  jsonb_agg(
    jsonb_build_object(
      'status', h.status,
      'changed_at', h.changed_at,
      'changed_by', h.changed_by,
      'changer_name', p.full_name
    ) ORDER BY h.changed_at ASC
  ) as history
FROM public.requests r
LEFT JOIN public.request_status_history h ON h.request_id = r.id
LEFT JOIN public.profiles p ON p.id = h.changed_by
WHERE
  -- ACCESS CONTROL: Only show requests the user can access
  (
    (r.created_by = auth.uid() AND public.get_my_role() = 'requester')
    OR
    (r.assigned_to = auth.uid() AND public.get_my_role() = 'maker')
    OR
    (public.get_my_role() IN ('coordinator', 'admin', 'marble_coordinator', 'magro_coordinator'))
    OR
    (public.get_my_role() = 'dispatcher')
  )
GROUP BY r.id, r.request_number, r.status;

GRANT SELECT ON public.request_timeline TO authenticated;

-- ============================================================
-- STEP 8: CREATE ATOMIC SPLIT REQUEST RPC
-- ============================================================
-- This function creates two separate parent requests in a single
-- database transaction — one for Marble items and one for Magro items.
-- Called when a requester submits a form containing both categories.
--
-- Parameters:
--   p_request_data  JSONB — shared request fields (section 1 + 2 data)
--   p_marble_items  JSONB — array of marble request_item objects
--   p_magro_items   JSONB — array of magro request_item objects
--
-- Returns:
--   JSONB with { marble_id, marble_number, magro_id, magro_number }
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_split_requests(
  p_request_data JSONB,
  p_marble_items JSONB,
  p_magro_items  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marble_id     UUID;
  v_magro_id      UUID;
  v_marble_number TEXT;
  v_magro_number  TEXT;
  v_item          JSONB;
  v_idx           INTEGER;
  v_marble_count  INTEGER;
  v_magro_count   INTEGER;
  v_created_by    UUID;
  v_status        request_status;
  v_priority      priority;
BEGIN
  -- Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_created_by := (p_request_data->>'created_by')::UUID;

  -- Verify caller matches created_by
  IF v_created_by != auth.uid() THEN
    RAISE EXCEPTION 'Permission denied: created_by must match authenticated user';
  END IF;

  v_status       := COALESCE(p_request_data->>'status', 'pending_approval')::request_status;
  v_priority     := COALESCE(p_request_data->>'priority', 'normal')::priority;
  v_marble_count := jsonb_array_length(p_marble_items);
  v_magro_count  := jsonb_array_length(p_magro_items);

  -- ── INSERT MARBLE REQUEST ─────────────────────────────────
  INSERT INTO public.requests (
    created_by, status, category, priority,
    department, mobile_no, pickup_responsibility,
    delivery_address, required_by,
    client_type, client_contact_name, client_phone, client_email,
    firm_name, site_location,
    supporting_architect_name, architect_firm_name,
    project_type, project_placeholder,
    purpose, packing_details, packing_remarks,
    requester_message, item_count
  ) VALUES (
    v_created_by,
    v_status,
    'marble',
    v_priority,
    p_request_data->>'department',
    p_request_data->>'mobile_no',
    p_request_data->>'pickup_responsibility',
    p_request_data->>'delivery_address',
    NULLIF(p_request_data->>'required_by', '')::TIMESTAMPTZ,
    p_request_data->>'client_type',
    p_request_data->>'client_contact_name',
    p_request_data->>'client_phone',
    NULLIF(p_request_data->>'client_email', ''),
    p_request_data->>'firm_name',
    p_request_data->>'site_location',
    NULLIF(p_request_data->>'supporting_architect_name', ''),
    NULLIF(p_request_data->>'architect_firm_name', ''),
    NULLIF(p_request_data->>'project_type', ''),
    NULLIF(p_request_data->>'project_placeholder', ''),
    p_request_data->>'purpose',
    p_request_data->>'packing_details',
    NULLIF(p_request_data->>'packing_remarks', ''),
    NULLIF(p_request_data->>'requester_message', ''),
    v_marble_count
  )
  RETURNING id, request_number INTO v_marble_id, v_marble_number;

  -- Insert marble items
  v_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_marble_items)
  LOOP
    INSERT INTO public.request_items (
      request_id, item_index, product_type, sub_category,
      quality, sample_size, thickness, finish, quantity, image_url
    ) VALUES (
      v_marble_id,
      v_idx,
      'marble',
      NULL,
      v_item->>'quality',
      v_item->>'sample_size',
      v_item->>'thickness',
      NULLIF(v_item->>'finish', ''),
      (v_item->>'quantity')::INTEGER,
      NULLIF(v_item->>'image_url', '')
    );
    v_idx := v_idx + 1;
  END LOOP;

  -- ── INSERT MAGRO REQUEST ──────────────────────────────────
  INSERT INTO public.requests (
    created_by, status, category, priority,
    department, mobile_no, pickup_responsibility,
    delivery_address, required_by,
    client_type, client_contact_name, client_phone, client_email,
    firm_name, site_location,
    supporting_architect_name, architect_firm_name,
    project_type, project_placeholder,
    purpose, packing_details, packing_remarks,
    requester_message, item_count
  ) VALUES (
    v_created_by,
    v_status,
    'magro',
    v_priority,
    p_request_data->>'department',
    p_request_data->>'mobile_no',
    p_request_data->>'pickup_responsibility',
    p_request_data->>'delivery_address',
    NULLIF(p_request_data->>'required_by', '')::TIMESTAMPTZ,
    p_request_data->>'client_type',
    p_request_data->>'client_contact_name',
    p_request_data->>'client_phone',
    NULLIF(p_request_data->>'client_email', ''),
    p_request_data->>'firm_name',
    p_request_data->>'site_location',
    NULLIF(p_request_data->>'supporting_architect_name', ''),
    NULLIF(p_request_data->>'architect_firm_name', ''),
    NULLIF(p_request_data->>'project_type', ''),
    NULLIF(p_request_data->>'project_placeholder', ''),
    p_request_data->>'purpose',
    p_request_data->>'packing_details',
    NULLIF(p_request_data->>'packing_remarks', ''),
    NULLIF(p_request_data->>'requester_message', ''),
    v_magro_count
  )
  RETURNING id, request_number INTO v_magro_id, v_magro_number;

  -- Insert magro items
  v_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_magro_items)
  LOOP
    INSERT INTO public.request_items (
      request_id, item_index, product_type, sub_category,
      quality, sample_size, thickness, finish, quantity, image_url
    ) VALUES (
      v_magro_id,
      v_idx,
      'magro',
      v_item->>'sub_category',
      v_item->>'quality',
      v_item->>'sample_size',
      v_item->>'thickness',
      NULLIF(v_item->>'finish', ''),
      (v_item->>'quantity')::INTEGER,
      NULLIF(v_item->>'image_url', '')
    );
    v_idx := v_idx + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'marble_id',     v_marble_id,
    'marble_number', v_marble_number,
    'magro_id',      v_magro_id,
    'magro_number',  v_magro_number
  );
END;
$$;

-- Grant execute to authenticated users (requester role will call this)
GRANT EXECUTE ON FUNCTION public.create_split_requests(JSONB, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_split_requests IS
'Atomically creates two parent requests (one Marble, one Magro) in a single '
'transaction. Called when a requester submits a form with mixed-category items. '
'Both requests share the same client/project/requester details but have separate '
'request numbers and category-filtered coordinator visibility.';
