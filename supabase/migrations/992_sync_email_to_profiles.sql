-- ============================================================
-- MIGRATION: Sync email from auth.users into public.profiles
-- Description: Stores email directly in profiles table so the
--   frontend can read it via a simple SELECT instead of needing
--   a SECURITY DEFINER RPC that joins auth.users.
-- ============================================================

-- STEP 1: Add email column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- STEP 2: Backfill existing profiles with email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

-- STEP 3: Update handle_new_user() to also insert the email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  role_value TEXT;
BEGIN
  role_value := LOWER(NEW.raw_user_meta_data->>'role');

  IF role_value IS NULL OR role_value NOT IN ('admin', 'coordinator', 'requester', 'maker', 'dispatcher') THEN
    role_value := 'requester';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role, department, email, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    role_value::public.user_role,
    NEW.raw_user_meta_data->>'department',
    NEW.email,
    true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 4: Drop the now-unnecessary RPC function
DROP FUNCTION IF EXISTS public.get_users_with_email();

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
