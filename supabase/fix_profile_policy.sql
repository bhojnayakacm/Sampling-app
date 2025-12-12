-- ============================================================
-- FIX: Allow users to create their own profile
-- ============================================================
-- This fixes the issue where email confirmation bypasses the trigger
-- The AuthContext will now auto-create profiles if they don't exist

-- Drop the restrictive admin-only insert policy
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Create new policy: Users can insert their OWN profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Also allow admins to insert profiles for others (for management)
CREATE POLICY "Admins can insert any profile"
ON public.profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
