-- ============================================================
-- Migration 1006: repack_kit() RPC
-- ============================================================
-- Allows coordinators to undo an unpack: deletes all child
-- items and resets is_unpacked so the kit can be re-unpacked.
-- ============================================================

CREATE OR REPLACE FUNCTION public.repack_kit(
  p_kit_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kit_row       public.request_items%ROWTYPE;
  v_caller_role   TEXT;
  v_deleted_count INTEGER;
BEGIN
  -- 1. Verify caller is a coordinator / admin
  SELECT p.role INTO v_caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_caller_role IS NULL
     OR v_caller_role NOT IN ('admin','coordinator','marble_coordinator','magro_coordinator')
  THEN
    RAISE EXCEPTION 'Permission denied: only coordinators can re-unpack kits';
  END IF;

  -- 2. Fetch and validate
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
    RAISE EXCEPTION 'Kit is not currently unpacked';
  END IF;

  -- 3. Delete all child items
  DELETE FROM public.request_items
  WHERE kit_id = p_kit_item_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- 4. Reset kit to packed state
  UPDATE public.request_items
  SET is_unpacked = FALSE, updated_at = NOW()
  WHERE id = p_kit_item_id;

  RETURN jsonb_build_object(
    'kit_item_id',      p_kit_item_id,
    'deleted_children', v_deleted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repack_kit(UUID) TO authenticated;
