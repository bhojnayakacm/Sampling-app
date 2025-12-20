-- ============================================================
-- COMPLETE CLEAN SLATE: Marble Sampling Management System
-- ============================================================
-- This migration drops everything and rebuilds from scratch
-- WARNING: ALL DATA WILL BE DELETED
-- ============================================================

-- ============================================================
-- STEP 1: DROP ALL EXISTING TABLES AND TYPES
-- ============================================================

DROP TABLE IF EXISTS public.request_history CASCADE;
DROP TABLE IF EXISTS public.requests CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.request_status CASCADE;
DROP TYPE IF EXISTS public.priority CASCADE;
DROP TYPE IF EXISTS public.priority_level CASCADE;
DROP TYPE IF EXISTS public.unit_type CASCADE;

DROP FUNCTION IF EXISTS public.delete_user_by_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_request_timestamps() CASCADE;

-- ============================================================
-- STEP 2: CREATE ENUMS
-- ============================================================

-- User Role
CREATE TYPE public.user_role AS ENUM (
  'admin',
  'coordinator',
  'requester',
  'maker'
);

-- Request Status
CREATE TYPE public.request_status AS ENUM (
  'pending_approval',
  'approved',
  'assigned',
  'in_production',
  'ready',
  'dispatched',
  'rejected'
);

-- Priority (simplified)
CREATE TYPE public.priority AS ENUM (
  'urgent',
  'normal'
);

-- ============================================================
-- STEP 3: CREATE PROFILES TABLE
-- ============================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'requester',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  department TEXT,  -- Nullable: Only for requesters
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: CREATE REQUESTS TABLE
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS request_number_seq START 1001;

CREATE TABLE public.requests (
  -- Core fields
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number TEXT UNIQUE NOT NULL DEFAULT 'SMP-' || nextval('request_number_seq'),
  status request_status NOT NULL DEFAULT 'pending_approval',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Section 1: Requester Details (Auto-filled from profile)
  department TEXT NOT NULL,
  mobile_no TEXT NOT NULL,

  -- Section 2: Client Project Details
  client_type TEXT NOT NULL,
  client_type_remarks TEXT,
  client_project_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT,
  company_firm_name TEXT NOT NULL,
  site_location TEXT NOT NULL,

  -- Section 3: Sample Request Details
  priority priority NOT NULL DEFAULT 'normal',
  required_by TIMESTAMP WITH TIME ZONE NOT NULL,
  pickup_responsibility TEXT NOT NULL,
  pickup_remarks TEXT,
  delivery_address TEXT,

  product_type TEXT NOT NULL,
  quality TEXT NOT NULL,
  sample_size TEXT NOT NULL,
  sample_size_remarks TEXT,
  finish TEXT,
  finish_remarks TEXT,
  thickness TEXT NOT NULL,
  thickness_remarks TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  purpose TEXT NOT NULL,
  packing_details TEXT NOT NULL,
  packing_remarks TEXT,

  -- Image
  image_url TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  dispatched_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 5: CREATE SECURITY DEFINER FUNCTION (Prevent RLS Recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- STEP 6: CREATE ADMIN DELETE USER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role user_role;
BEGIN
  -- Get current user's role using the security definer function
  SELECT public.get_my_role() INTO current_user_role;

  -- Check if current user is an admin
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Delete from auth.users (will cascade to profiles due to ON DELETE CASCADE)
  DELETE FROM auth.users WHERE id = target_user_id;

  -- If no rows were deleted, the user didn't exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with ID % not found', target_user_id;
  END IF;
END;
$$;

-- ============================================================
-- STEP 7: CREATE TRIGGERS
-- ============================================================

-- Trigger 1: Auto-create profile on user signup
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger 2: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_requests_updated_at ON public.requests;
CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger 3: Auto-set request timestamps based on status
CREATE OR REPLACE FUNCTION public.update_request_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ready' AND OLD.status != 'ready' THEN
    NEW.completed_at = NOW();
  END IF;

  IF NEW.status = 'dispatched' AND OLD.status != 'dispatched' THEN
    NEW.dispatched_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_request_timestamps ON public.requests;
CREATE TRIGGER set_request_timestamps
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_request_timestamps();

-- ============================================================
-- STEP 8: CREATE RLS POLICIES
-- ============================================================

-- ===== PROFILES POLICIES =====

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Coordinators and Admins can view all profiles
CREATE POLICY "Coordinators and Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('coordinator', 'admin'));

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- Admins can insert profiles
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

-- ===== REQUESTS POLICIES =====

-- Requesters can view their own requests
CREATE POLICY "Requesters can view own requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester'
  );

-- Makers can view assigned requests
CREATE POLICY "Makers can view assigned requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() AND
    public.get_my_role() = 'maker'
  );

-- Coordinators and Admins can view all requests
CREATE POLICY "Coordinators and Admins can view all requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('coordinator', 'admin'));

-- Requesters can insert requests
CREATE POLICY "Requesters can insert requests"
  ON public.requests FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester'
  );

-- Makers can update assigned requests
CREATE POLICY "Makers can update assigned requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() AND
    public.get_my_role() = 'maker'
  )
  WITH CHECK (
    assigned_to = auth.uid() AND
    public.get_my_role() = 'maker'
  );

-- Coordinators can update all requests
CREATE POLICY "Coordinators can update all requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'coordinator')
  WITH CHECK (public.get_my_role() = 'coordinator');

-- ============================================================
-- STEP 9: CREATE INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_requests_created_by ON public.requests(created_by);
CREATE INDEX idx_requests_assigned_to ON public.requests(assigned_to);
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_created_at ON public.requests(created_at DESC);
CREATE INDEX idx_requests_required_by ON public.requests(required_by);

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
