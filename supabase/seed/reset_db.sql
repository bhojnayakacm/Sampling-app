-- ============================================================
-- FACTORY RESET SCRIPT
-- ============================================================
-- WARNING: This script will DELETE ALL DATA from your database
-- Use this ONLY in development/testing environments
--
-- What this does:
-- 1. Deletes all application data (requests, profiles, history)
-- 2. Deletes all authentication users (auth.users)
-- 3. Resets request_number_seq to 1001
--
-- After running this:
-- - User ID 1 will be available for the next signup
-- - Request SMP-1001 will be the first request created
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Delete all application data
-- ============================================================

-- Truncate application tables in reverse dependency order
-- CASCADE will handle any foreign key constraints automatically

TRUNCATE TABLE public.request_status_history CASCADE;
TRUNCATE TABLE public.requests CASCADE;
TRUNCATE TABLE public.profiles CASCADE;

-- ============================================================
-- STEP 2: Delete all authentication users
-- ============================================================

-- Delete from auth.users (this will trigger the deletion of related profiles via triggers)
-- Note: We use DELETE instead of TRUNCATE because auth.users is a system table
DELETE FROM auth.users;

-- Also clean up any orphaned sessions or tokens
DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;

-- ============================================================
-- STEP 3: Reset sequences
-- ============================================================

-- Reset the request number sequence to 1001
-- Next request will be SMP-1001
ALTER SEQUENCE public.request_number_seq RESTART WITH 1001;

-- ============================================================
-- STEP 4: Verify the reset
-- ============================================================

-- Check that tables are empty
DO $$
DECLARE
  profile_count INTEGER;
  request_count INTEGER;
  user_count INTEGER;
  seq_value INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  SELECT COUNT(*) INTO request_count FROM public.requests;
  SELECT COUNT(*) INTO user_count FROM auth.users;
  SELECT last_value INTO seq_value FROM public.request_number_seq;

  RAISE NOTICE '=== RESET VERIFICATION ===';
  RAISE NOTICE 'Profiles: %', profile_count;
  RAISE NOTICE 'Requests: %', request_count;
  RAISE NOTICE 'Users: %', user_count;
  RAISE NOTICE 'Next Request Number: SMP-%', seq_value;
  RAISE NOTICE '========================';

  IF profile_count = 0 AND request_count = 0 AND user_count = 0 THEN
    RAISE NOTICE 'SUCCESS: Database reset complete!';
  ELSE
    RAISE WARNING 'Some data may still exist. Please check manually.';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- POST-RESET INSTRUCTIONS
-- ============================================================
-- 1. Go to your application signup page
-- 2. Create your first admin user (this will be User ID 1)
-- 3. Create your first request (this will be SMP-1001)
--
-- To verify the reset worked:
-- SELECT * FROM auth.users;  -- Should be empty
-- SELECT * FROM public.profiles;  -- Should be empty
-- SELECT * FROM public.requests;  -- Should be empty
-- SELECT last_value FROM public.request_number_seq;  -- Should be 1001
-- ============================================================
