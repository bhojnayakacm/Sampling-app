-- ============================================================
-- USER ONBOARDING REFACTOR: Add Department to Profiles
-- ============================================================
-- This migration adds department field to profiles table
-- and updates the trigger to capture it from signup metadata
-- ============================================================

-- Add department column to profiles table
ALTER TABLE public.profiles
ADD COLUMN department TEXT;

-- Update handle_new_user trigger to extract department and phone from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, phone, department)
  VALUES (
    NEW.id,
    'requester',  -- Default role
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'department'  -- Extract department from metadata
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger already exists, this just updates the function
-- The existing trigger will automatically use the updated function

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
