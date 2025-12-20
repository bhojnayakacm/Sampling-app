-- ============================================================
-- FIX: handle_new_user function - Role Case Sensitivity
-- ============================================================
-- This migration fixes the role casting issue where frontend
-- sends capitalized roles ("Coordinator") but enum expects
-- lowercase ("coordinator")
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  role_value TEXT;
BEGIN
  -- Extract role from metadata and convert to lowercase
  role_value := LOWER(NEW.raw_user_meta_data->>'role');

  -- If no role or invalid role, default to 'requester'
  IF role_value IS NULL OR role_value NOT IN ('admin', 'coordinator', 'requester', 'maker') THEN
    role_value := 'requester';
  END IF;

  -- Insert profile with lowercase role
  INSERT INTO public.profiles (id, role, full_name, phone, department)
  VALUES (
    NEW.id,
    role_value::user_role,  -- Now safe to cast since it's lowercase and validated
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'department'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- The trigger already exists, it will automatically use the updated function
