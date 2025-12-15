-- ============================================================
-- DATABASE CLEANUP SCRIPT
-- ============================================================
-- WARNING: This will DELETE ALL DATA but preserve the schema
-- Run this script in Supabase SQL Editor to start fresh
-- ============================================================

-- 1. Delete all request history (must delete first due to foreign key)
DELETE FROM public.request_history;

-- 2. Delete all requests
DELETE FROM public.requests;

-- 3. Delete all clients
DELETE FROM public.clients;

-- 4. Delete all user profiles EXCEPT the one you're logged in with
-- (This keeps your admin account)
DELETE FROM public.profiles
WHERE id != auth.uid();

-- Alternative: Delete ALL profiles (uncommment this and comment above if you want to delete everything)
-- WARNING: This will delete your admin account too, you'll need to sign up again
-- DELETE FROM public.profiles;

-- 5. Reset the request number sequence to start from 1001 again
ALTER SEQUENCE request_number_seq RESTART WITH 1001;

-- 6. Clean up storage bucket (sample images)
-- NOTE: This doesn't delete actual files, just the database records
-- You'll need to manually delete files from Storage UI or use the separate script below
DELETE FROM storage.objects WHERE bucket_id = 'sample-images';

-- ============================================================
-- VERIFICATION QUERIES (Optional - run these to check cleanup)
-- ============================================================
-- SELECT COUNT(*) as request_count FROM public.requests;
-- SELECT COUNT(*) as history_count FROM public.request_history;
-- SELECT COUNT(*) as client_count FROM public.clients;
-- SELECT COUNT(*) as profile_count FROM public.profiles;
-- SELECT COUNT(*) as storage_count FROM storage.objects WHERE bucket_id = 'sample-images';
