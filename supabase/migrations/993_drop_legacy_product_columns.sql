-- ============================================================
-- MIGRATION: Drop Legacy Product Columns from requests table
-- ============================================================
-- PREREQUISITE: Zero rows in requests/request_items tables
-- SAFE TO RUN: All product data now lives in request_items
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Drop the validate_request_fields trigger & function
-- ============================================================
-- This trigger validates the legacy columns on INSERT/UPDATE.
-- It will error once the columns are gone, so drop it first.

DROP TRIGGER IF EXISTS validate_request_fields_trigger ON public.requests;
DROP FUNCTION IF EXISTS public.validate_request_fields();

-- ============================================================
-- STEP 2: Drop the check_for_duplicates RPC function
-- ============================================================
-- This function queries the legacy columns on requests.
-- It must be rewritten to query request_items instead (separate step).

DROP FUNCTION IF EXISTS public.check_for_duplicates(uuid, text, text, text, integer);

-- ============================================================
-- STEP 3: Drop the 10 legacy columns
-- ============================================================

ALTER TABLE public.requests
DROP COLUMN IF EXISTS product_type,
DROP COLUMN IF EXISTS quality,
DROP COLUMN IF EXISTS sample_size,
DROP COLUMN IF EXISTS sample_size_remarks,
DROP COLUMN IF EXISTS thickness,
DROP COLUMN IF EXISTS thickness_remarks,
DROP COLUMN IF EXISTS finish,
DROP COLUMN IF EXISTS finish_remarks,
DROP COLUMN IF EXISTS quantity,
DROP COLUMN IF EXISTS image_url;

-- ============================================================
-- STEP 4: Verify
-- ============================================================

DO $$
DECLARE
col_count INTEGER;
BEGIN
SELECT COUNT(*) INTO col_count
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'requests'
    AND column_name IN (
    'product_type', 'quality', 'sample_size', 'sample_size_remarks',
    'thickness', 'thickness_remarks', 'finish', 'finish_remarks',
    'quantity', 'image_url'
    );

IF col_count = 0 THEN
    RAISE NOTICE 'SUCCESS: All 10 legacy columns dropped from requests table.';
ELSE
    RAISE WARNING 'UNEXPECTED: % legacy columns still exist!', col_count;
END IF;
END $$;

COMMIT;