-- ============================================================
-- MIGRATION: Admin function to fetch users with email addresses
-- Description: Provides a SECURITY DEFINER function that joins
--   public.profiles with auth.users so admins can see emails.
--   The client-side Supabase SDK doesn't have admin privileges,
--   so auth.admin.listUsers() fails. This RPC bridges that gap.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_users_with_email()
RETURNS TABLE (
  id UUID,
  role TEXT,
  full_name TEXT,
  phone TEXT,
  department TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.role::TEXT,
    p.full_name,
    p.phone,
    p.department,
    p.is_active,
    p.created_at,
    p.updated_at,
    COALESCE(u.email, 'N/A') AS email
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
-- (the function itself checks for admin role)
GRANT EXECUTE ON FUNCTION public.get_users_with_email() TO authenticated;

COMMENT ON FUNCTION public.get_users_with_email() IS
'Admin-only function that returns all user profiles with their email addresses from auth.users.
Used by the User Management page since the client SDK cannot call auth.admin.listUsers().';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
