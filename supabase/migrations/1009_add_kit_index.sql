-- ============================================================
-- Migration 1009: Add kit_index column
-- ============================================================
-- Tracks which physical kit (tab) a child item belongs to when
-- a coordinator unpacks a multi-qty kit using "non-identical" mode.
--
-- NULL  = identical kits / single-qty kit / regular item / kit placeholder
-- 0,1,2 = zero-based tab index for non-identical mode children
-- ============================================================

ALTER TABLE public.request_items
  ADD COLUMN kit_index SMALLINT DEFAULT NULL;

-- ============================================================
-- Update unpack_kit() to persist kit_index
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
      is_kit, is_unpacked, kit_id, kit_index
    ) VALUES (
      v_kit_row.request_id,
      1000 + v_idx,
      v_kit_row.product_type,
      NULLIF(v_item->>'sub_category', ''),
      v_item->>'quality',
      v_kit_row.sample_size,
      NULLIF(v_item->>'thickness', ''),
      NULLIF(v_item->>'finish', ''),
      COALESCE((v_item->>'quantity')::INTEGER, 1),
      FALSE,
      FALSE,
      p_kit_item_id,
      (v_item->>'kit_index')::SMALLINT   -- NULL for identical, 0/1/2 for non-identical
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

GRANT EXECUTE ON FUNCTION public.unpack_kit(UUID, JSONB) TO authenticated;

-- ============================================================
-- Update update_kit_contents() to persist kit_index
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_kit_contents(
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
  v_deleted_count INTEGER;
  v_caller_role   TEXT;
BEGIN
  -- 1. Verify caller is a coordinator / admin
  SELECT p.role INTO v_caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_caller_role IS NULL
     OR v_caller_role NOT IN ('admin','coordinator','marble_coordinator','magro_coordinator')
  THEN
    RAISE EXCEPTION 'Permission denied: only coordinators can edit kit contents';
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

  IF v_kit_row.is_unpacked = FALSE THEN
    RAISE EXCEPTION 'Kit is not unpacked — use unpack_kit instead';
  END IF;

  -- 3. Validate p_items is a non-empty array
  IF p_items IS NULL
     OR jsonb_typeof(p_items) != 'array'
     OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  -- 4. Delete existing children
  DELETE FROM public.request_items
  WHERE kit_id = p_kit_item_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- 5. Insert new children
  v_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.request_items (
      request_id, item_index, product_type, sub_category,
      quality, sample_size, thickness, finish, quantity,
      is_kit, is_unpacked, kit_id, kit_index
    ) VALUES (
      v_kit_row.request_id,
      1000 + v_idx,
      v_kit_row.product_type,
      NULLIF(v_item->>'sub_category', ''),
      v_item->>'quality',
      v_kit_row.sample_size,
      NULLIF(v_item->>'thickness', ''),
      NULLIF(v_item->>'finish', ''),
      COALESCE((v_item->>'quantity')::INTEGER, 1),
      FALSE,
      FALSE,
      p_kit_item_id,
      (v_item->>'kit_index')::SMALLINT
    )
    RETURNING id INTO v_new_id;

    v_inserted_ids := v_inserted_ids || v_new_id;
    v_idx := v_idx + 1;
  END LOOP;

  -- 6. Touch the kit row's updated_at
  UPDATE public.request_items
  SET updated_at = NOW()
  WHERE id = p_kit_item_id;

  RETURN jsonb_build_object(
    'kit_item_id',      p_kit_item_id,
    'deleted_children', v_deleted_count,
    'new_children',     jsonb_array_length(p_items),
    'children_ids',     to_jsonb(v_inserted_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_kit_contents(UUID, JSONB) TO authenticated;
