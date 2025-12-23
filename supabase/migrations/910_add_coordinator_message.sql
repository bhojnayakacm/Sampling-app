-- ============================================================
-- MIGRATION: Add coordinator message column
-- Purpose: Allow coordinators to send messages when approving/rejecting requests
-- ============================================================

-- ============================================================
-- STEP 1: Add coordinator_message column to requests table
-- ============================================================

ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS coordinator_message TEXT;

-- ============================================================
-- STEP 2: Add comment for documentation
-- ============================================================

COMMENT ON COLUMN public.requests.coordinator_message IS
'Optional message from coordinator when approving or rejecting a request. Examples: "Estimated delivery: 1 week" or "Rejected: Out of stock".';

-- ============================================================
-- VERIFICATION
-- ============================================================
-- After running this migration:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'requests' AND column_name = 'coordinator_message';
--
-- Expected: coordinator_message | text | YES
-- ============================================================
