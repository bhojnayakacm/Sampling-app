-- ============================================================
-- Migration 1003: Add Standardized Kit Support to request_items
-- ============================================================
-- Kits are special request_items where the requester only specifies
-- a kit type (marble/magro), size, and quantity. Coordinators later
-- "unpack" each kit by adding child items with full product specs.
--
-- Changes:
--   1. Add is_kit, is_unpacked, kit_id columns
--   2. Relax NOT NULL on quality/thickness (kit rows have NULL)
--   3. Update subcategory constraint (kit rows exempt)
--   4. Add coordinator INSERT/DELETE policies on request_items
--   5. Add index on kit_id for child lookups
-- ============================================================

-- ============================================================
-- STEP 1: ADD KIT COLUMNS
-- ============================================================

-- Marks requester-created kit placeholders
ALTER TABLE public.request_items
  ADD COLUMN IF NOT EXISTS is_kit BOOLEAN NOT NULL DEFAULT FALSE;

-- TRUE after coordinator has allocated/unpacked the kit contents
ALTER TABLE public.request_items
  ADD COLUMN IF NOT EXISTS is_unpacked BOOLEAN NOT NULL DEFAULT FALSE;

-- Self-referencing FK: child (unpacked) items point to their parent kit
ALTER TABLE public.request_items
  ADD COLUMN IF NOT EXISTS kit_id UUID REFERENCES public.request_items(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.request_items.is_kit IS
  'TRUE for kit placeholder items created by requesters. '
  'Kit rows have NULL quality/thickness — coordinator fills these by unpacking.';

COMMENT ON COLUMN public.request_items.is_unpacked IS
  'TRUE once a coordinator has allocated specific items to this kit. '
  'Only meaningful when is_kit = TRUE.';

COMMENT ON COLUMN public.request_items.kit_id IS
  'For unpacked child items: references the parent kit row in request_items. '
  'NULL for regular items and for kit rows themselves.';

-- ============================================================
-- STEP 2: RELAX NOT NULL ON quality AND thickness
-- ============================================================
-- Kit rows do not have quality or thickness at creation time.
-- Replace hard NOT NULL with conditional CHECK constraints so
-- normal items still require these fields.

ALTER TABLE public.request_items ALTER COLUMN quality DROP NOT NULL;
ALTER TABLE public.request_items ALTER COLUMN thickness DROP NOT NULL;

-- Normal (non-kit) items must still have quality and thickness
ALTER TABLE public.request_items
  ADD CONSTRAINT items_require_quality
  CHECK (is_kit = TRUE OR (quality IS NOT NULL AND quality != ''));

ALTER TABLE public.request_items
  ADD CONSTRAINT items_require_thickness
  CHECK (is_kit = TRUE OR (thickness IS NOT NULL AND thickness != ''));

-- ============================================================
-- STEP 3: UPDATE SUBCATEGORY CONSTRAINT
-- ============================================================
-- Kit rows (both marble and magro) do not have a sub_category —
-- the coordinator chooses sub_category during unpacking for magro kits.

ALTER TABLE public.request_items
  DROP CONSTRAINT IF EXISTS request_items_subcategory_rule;

ALTER TABLE public.request_items
  ADD CONSTRAINT request_items_subcategory_rule
  CHECK (
    is_kit = TRUE
    OR (product_type = 'marble' AND sub_category IS NULL)
    OR (product_type = 'magro' AND sub_category IS NOT NULL)
  );

-- ============================================================
-- STEP 4: ADD KIT INTEGRITY CONSTRAINTS
-- ============================================================

-- is_unpacked only meaningful for kit rows; non-kit rows must be FALSE
ALTER TABLE public.request_items
  ADD CONSTRAINT kit_unpacked_rule
  CHECK (is_kit = TRUE OR is_unpacked = FALSE);

-- kit_id must be NULL for kit rows themselves and for regular items
-- (only unpacked child items reference a parent kit)
ALTER TABLE public.request_items
  ADD CONSTRAINT kit_id_not_self_referencing
  CHECK (kit_id IS NULL OR is_kit = FALSE);

-- ============================================================
-- STEP 5: ADD RLS POLICIES FOR COORDINATOR INSERT/DELETE
-- ============================================================
-- Coordinators need INSERT to create unpacked child items,
-- and DELETE to support re-unpacking (removing children to redo).

CREATE POLICY "Coordinators can insert request items for unpacking"
  ON public.request_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'coordinator', 'marble_coordinator', 'magro_coordinator')
    )
  );

CREATE POLICY "Coordinators can delete request items for re-unpacking"
  ON public.request_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'coordinator', 'marble_coordinator', 'magro_coordinator')
    )
  );

-- ============================================================
-- STEP 6: ADD INDEX FOR KIT CHILD LOOKUPS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_request_items_kit_id
  ON public.request_items(kit_id)
  WHERE kit_id IS NOT NULL;
