-- Migration 1002: Add delivery_poc_name and delivery_poc_contacts to create_split_requests RPC
-- These fields store the delivery Point of Contact when pickup_responsibility = 'field_boy'.

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
    delivery_address, delivery_poc_name, delivery_poc_contacts,
    required_by,
    client_type, client_contact_name, client_phone, client_email,
    firm_name, site_location,
    supporting_architect_name, architect_firm_name,
    project_type, project_placeholder,
    purpose, packing_details,
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
    NULLIF(p_request_data->>'delivery_poc_name', ''),
    CASE
      WHEN p_request_data->'delivery_poc_contacts' IS NOT NULL
           AND jsonb_typeof(p_request_data->'delivery_poc_contacts') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_request_data->'delivery_poc_contacts'))
      ELSE NULL
    END,
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
    delivery_address, delivery_poc_name, delivery_poc_contacts,
    required_by,
    client_type, client_contact_name, client_phone, client_email,
    firm_name, site_location,
    supporting_architect_name, architect_firm_name,
    project_type, project_placeholder,
    purpose, packing_details,
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
    NULLIF(p_request_data->>'delivery_poc_name', ''),
    CASE
      WHEN p_request_data->'delivery_poc_contacts' IS NOT NULL
           AND jsonb_typeof(p_request_data->'delivery_poc_contacts') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_request_data->'delivery_poc_contacts'))
      ELSE NULL
    END,
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

-- Re-grant execute (idempotent)
GRANT EXECUTE ON FUNCTION public.create_split_requests(JSONB, JSONB, JSONB) TO authenticated;
