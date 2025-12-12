-- ============================================================
-- FIX: Remove infinite recursion in RLS policies
-- ============================================================
-- This completely rebuilds the profiles policies without recursion

-- 1. DROP ALL existing policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Coordinators and Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert any profile" ON public.profiles;

-- 2. CREATE new policies WITHOUT recursion
-- Simple policy: users can do anything with their own profile
CREATE POLICY "Enable all access for users to own profile"
ON public.profiles
FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. For viewing all profiles, we'll handle permissions in application code
-- This is simpler and avoids recursion
-- All authenticated users can read all profiles (we'll filter in code if needed)
CREATE POLICY "Enable read access for all authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Note: For production, you might want more restrictive policies,
-- but this prevents the infinite recursion issue
