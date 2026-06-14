-- ============================================================
-- Migration 1013: Drop-NOT-NULL on thickness + size-edit audit
-- ============================================================
--
-- WHY THIS EXISTS
--   The frontend "Thickness" attribute is being removed entirely
--   in the 2026-06 UX refactor. Rather than DROP the column —
--   which would break the (deprecated but still defined) kit
--   RPC bodies that reference `request_items.thickness` — we make
--   the column nullable and let new inserts pass NULL. Legacy
--   rows keep their historical thickness values for audit.
--
--   Separately, Coordinators are now allowed to edit the
--   `sample_size` of any item in an existing request — but ONLY
--   with a mandatory written reason. This migration adds the
--   audit columns (`is_size_edited`, `size_edit_reason`,
--   `original_size`) and a SECURITY DEFINER RPC,
--   `coordinator_edit_item_size`, that performs the update under
--   a strict reason-required check.
--
-- WHAT THIS DOES
--   1. ALTER TABLE request_items ALTER COLUMN thickness DROP NOT NULL
--      (idempotent — only acts if currently NOT NULL)
--   2. ALTER TABLE request_items ADD COLUMN
--        is_size_edited  BOOLEAN     DEFAULT FALSE,
--        size_edit_reason TEXT,
--        original_size    TEXT
--      (all idempotent via IF NOT EXISTS)
--   3. CREATE OR REPLACE FUNCTION coordinator_edit_item_size(...)
--      — caller must be a coordinator role
--      — p_reason must be non-empty (length >= 1 after trim)
--      — original_size is captured on the first edit, then sticky
--      — returns the updated row
--   4. GRANT EXECUTE on the RPC to authenticated.
--
-- IDEMPOTENCE
--   All statements are idempotent and safe to re-run.
--
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- STEP 1 — Make request_items.thickness nullable
-- ------------------------------------------------------------
-- The original 920_create_request_items.sql declared this column
-- as NOT NULL. New inserts from the frontend no longer supply a
-- value, so we relax the constraint. Existing rows are unaffected.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = 'request_items'
           AND column_name  = 'thickness'
           AND is_nullable  = 'NO'
    ) THEN
        ALTER TABLE public.request_items
            ALTER COLUMN thickness DROP NOT NULL;
        RAISE NOTICE 'Migration 1013: request_items.thickness is now nullable.';
    ELSE
        RAISE NOTICE 'Migration 1013: request_items.thickness was already nullable — no change.';
    END IF;
END $$;

-- ------------------------------------------------------------
-- STEP 2 — Add size-edit audit columns
-- ------------------------------------------------------------

ALTER TABLE public.request_items
    ADD COLUMN IF NOT EXISTS is_size_edited   BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS size_edit_reason TEXT,
    ADD COLUMN IF NOT EXISTS original_size    TEXT;

COMMENT ON COLUMN public.request_items.is_size_edited   IS
    'TRUE if a coordinator has edited sample_size after submission.';
COMMENT ON COLUMN public.request_items.size_edit_reason IS
    'Mandatory rationale supplied by the coordinator when editing sample_size.';
COMMENT ON COLUMN public.request_items.original_size    IS
    'The sample_size value at the time of the FIRST coordinator edit. Sticky — never overwritten on subsequent edits.';

-- ------------------------------------------------------------
-- STEP 3 — RPC: coordinator_edit_item_size
-- ------------------------------------------------------------
-- SECURITY DEFINER so we can enforce role + reason checks
-- regardless of the caller's RLS posture on request_items.
-- The function still verifies the caller via auth.uid().

CREATE OR REPLACE FUNCTION public.coordinator_edit_item_size(
    p_item_id  UUID,
    p_new_size TEXT,
    p_reason   TEXT
)
RETURNS public.request_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role  TEXT;
    v_existing_row public.request_items%ROWTYPE;
    v_updated_row  public.request_items%ROWTYPE;
    v_clean_size   TEXT;
    v_clean_reason TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    SELECT role
      INTO v_caller_role
      FROM public.profiles
     WHERE id = auth.uid();

    IF v_caller_role NOT IN ('coordinator', 'marble_coordinator', 'magro_coordinator', 'admin') THEN
        RAISE EXCEPTION 'Permission denied: only coordinators may edit item sizes'
            USING ERRCODE = '42501';
    END IF;

    v_clean_size   := NULLIF(TRIM(p_new_size), '');
    v_clean_reason := NULLIF(TRIM(p_reason),   '');

    IF v_clean_size IS NULL THEN
        RAISE EXCEPTION 'New size must not be empty' USING ERRCODE = '22023';
    END IF;

    IF v_clean_reason IS NULL OR length(v_clean_reason) < 1 THEN
        RAISE EXCEPTION 'A reason is required when editing an item size'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
      INTO v_existing_row
      FROM public.request_items
     WHERE id = p_item_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request item % not found', p_item_id
            USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.request_items
       SET sample_size       = v_clean_size,
           size_edit_reason  = v_clean_reason,
           is_size_edited    = TRUE,
           original_size     = COALESCE(v_existing_row.original_size, v_existing_row.sample_size),
           updated_at        = NOW()
     WHERE id = p_item_id
     RETURNING * INTO v_updated_row;

    RETURN v_updated_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.coordinator_edit_item_size(UUID, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- STEP 4 — Sanity verification
-- ------------------------------------------------------------

DO $$
DECLARE
    v_thickness_nullable TEXT;
BEGIN
    SELECT is_nullable
      INTO v_thickness_nullable
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'request_items'
       AND column_name  = 'thickness';

    IF v_thickness_nullable IS DISTINCT FROM 'YES' THEN
        RAISE EXCEPTION 'Migration 1013 FAILED — request_items.thickness is still NOT NULL.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = 'request_items'
           AND column_name  = 'is_size_edited'
    ) THEN
        RAISE EXCEPTION 'Migration 1013 FAILED — is_size_edited column missing.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'coordinator_edit_item_size'
    ) THEN
        RAISE EXCEPTION 'Migration 1013 FAILED — coordinator_edit_item_size RPC missing.';
    END IF;

    RAISE NOTICE 'Migration 1013 OK — thickness nullable, audit columns added, RPC installed.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, not part of migration)
-- ============================================================
-- To reverse:
--   DROP FUNCTION public.coordinator_edit_item_size(UUID, TEXT, TEXT);
--   ALTER TABLE public.request_items
--       DROP COLUMN is_size_edited,
--       DROP COLUMN size_edit_reason,
--       DROP COLUMN original_size;
--   -- Re-asserting NOT NULL on thickness would require backfilling
--   -- any post-1013 inserts that wrote NULL.
-- ============================================================
