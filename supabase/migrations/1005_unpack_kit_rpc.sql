-- ============================================================
-- Migration 1005: unpack_kit() RPC
-- ============================================================
-- Atomic operation that "unpacks" a kit placeholder by:
--   1. Validating the caller is a coordinator and the kit is valid
--   2. Inserting child request_items with kit_id pointing to parent
--   3. Setting is_unpacked = TRUE on the kit row
--   4. Returning inserted child item IDs
-- ============================================================

CREATE OR REPLACE FUNCTION public.unpack_kit(
  p_kit_item_id UUID,
  p_items       JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kit_row       public.request_items%ROWTYPE;
  v_item          JSONB;
  v_idx           INTEGER;
  v_inserted_ids  UUID[] := '{}';
  v_new_id        UUID;
  v_caller_role   TEXT;
BEGIN
  -- 1. Verify caller is a coordinator / admin
  SELECT p.role INTO v_caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_caller_role IS NULL
     OR v_caller_role NOT IN ('admin','coordinator','marble_coordinator','magro_coordinator')
  THEN
    RAISE EXCEPTION 'Permission denied: only coordinators can unpack kits';
  END IF;

  -- 2. Fetch and validate the kit row
  SELECT * INTO v_kit_row
  FROM public.request_items
  WHERE id = p_kit_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kit item not found';
  END IF;

  IF v_kit_row.is_kit = FALSE THEN
    RAISE EXCEPTION 'Item is not a kit';
  END IF;

  IF v_kit_row.is_unpacked = TRUE THEN
    RAISE EXCEPTION 'Kit is already unpacked';
  END IF;

  -- 3. Validate p_items is a non-empty array
  IF p_items IS NULL
     OR jsonb_typeof(p_items) != 'array'
     OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'At least one item is required to unpack a kit';
  END IF;

  -- 4. Insert child items
  v_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.request_items (
      request_id, item_index, product_type, sub_category,
      quality, sample_size, thickness, finish, quantity,
      is_kit, is_unpacked, kit_id
    ) VALUES (
      v_kit_row.request_id,
      1000 + v_idx,                                    -- high offset avoids collisions
      v_kit_row.product_type,
      NULLIF(v_item->>'sub_category', ''),
      v_item->>'quality',
      v_kit_row.sample_size,                           -- inherited from kit
      NULLIF(v_item->>'thickness', ''),
      NULLIF(v_item->>'finish', ''),
      COALESCE((v_item->>'quantity')::INTEGER, 1),
      FALSE,
      FALSE,
      p_kit_item_id
    )
    RETURNING id INTO v_new_id;

    v_inserted_ids := v_inserted_ids || v_new_id;
    v_idx := v_idx + 1;
  END LOOP;

  -- 5. Mark kit as unpacked
  UPDATE public.request_items
  SET is_unpacked = TRUE, updated_at = NOW()
  WHERE id = p_kit_item_id;

  RETURN jsonb_build_object(
    'kit_item_id',    p_kit_item_id,
    'children_count', jsonb_array_length(p_items),
    'children_ids',   to_jsonb(v_inserted_ids)
  );
END;
$$;

-- Grant execute to authenticated users (RPC validates role internally)
GRANT EXECUTE ON FUNCTION public.unpack_kit(UUID, JSONB) TO authenticated;
