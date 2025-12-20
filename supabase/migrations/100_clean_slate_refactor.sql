-- ============================================================
-- CLEAN SLATE REFACTOR: Marble Sampling Management System
-- ============================================================
-- This migration completely rebuilds the database schema
-- WARNING: ALL DATA WILL BE DELETED
-- ============================================================

-- ============================================================
-- STEP 1: DROP ALL EXISTING TABLES (in correct order)
-- ============================================================

DROP TABLE IF EXISTS public.request_history CASCADE;
DROP TABLE IF EXISTS public.requests CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================
-- STEP 2: DROP ALL EXISTING TYPES/ENUMS
-- ============================================================

DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.request_status CASCADE;
DROP TYPE IF EXISTS public.priority_level CASCADE;
DROP TYPE IF EXISTS public.unit_type CASCADE;

-- ============================================================
-- STEP 3: CREATE NEW ENUMS
-- ============================================================

-- User Role: Changed 'marketing' to 'requester'
CREATE TYPE public.user_role AS ENUM (
  'admin',
  'coordinator',
  'requester',  -- Changed from 'marketing'
  'maker'
);

-- Request Status: Keep existing workflow
CREATE TYPE public.request_status AS ENUM (
  'pending_approval',
  'approved',
  'assigned',
  'in_production',
  'ready',
  'dispatched',
  'rejected'
);

-- Priority: Simplified to urgent/normal
CREATE TYPE public.priority AS ENUM (
  'urgent',
  'normal'
);

-- ============================================================
-- STEP 4: RECREATE PROFILES TABLE
-- ============================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'requester',  -- Changed default from 'marketing'
  full_name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4B: CREATE SECURITY DEFINER FUNCTION TO PREVENT INFINITE RECURSION
-- ============================================================

-- This function bypasses RLS when checking the current user's role
-- Prevents infinite recursion in RLS policies that need to check roles
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
-- STEP 5: CREATE NEW REQUESTS TABLE WITH NEW SCHEMA
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS request_number_seq START 1001;

CREATE TABLE public.requests (
  -- Core fields
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number TEXT UNIQUE NOT NULL DEFAULT 'SMP-' || nextval('request_number_seq'),
  status request_status NOT NULL DEFAULT 'pending_approval',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Section 1: Requester Details
  department TEXT NOT NULL,  -- Sales, Marketing, Logistics
  mobile_no TEXT NOT NULL,
  pickup_responsibility TEXT NOT NULL,  -- self_pickup, courier, company_vehicle, 3rd_party, other
  pickup_remarks TEXT,
  delivery_address TEXT,  -- Not required if self_pickup
  required_by TIMESTAMP WITH TIME ZONE NOT NULL,
  priority priority NOT NULL DEFAULT 'normal',

  -- Section 2: Client Project Details
  client_type TEXT NOT NULL,  -- retail, architect, project, others
  client_type_remarks TEXT,
  client_project_name TEXT NOT NULL,  -- Client/Architect/Project Name
  client_phone TEXT NOT NULL,
  client_email TEXT,
  company_firm_name TEXT NOT NULL,  -- Company Firm Name
  site_location TEXT NOT NULL,

  -- Section 3: Sample Request Details
  product_type TEXT NOT NULL,  -- marble, tile, terrazzo, quartz
  quality TEXT NOT NULL,  -- standard, premium
  sample_size TEXT NOT NULL,
  sample_size_remarks TEXT,
  finish TEXT,  -- Nullable (not required for terrazzo/quartz)
  finish_remarks TEXT,
  thickness TEXT NOT NULL,
  thickness_remarks TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  purpose TEXT NOT NULL,  -- new_launch, client_presentation, mock_up, approval
  packing_details TEXT NOT NULL,  -- wooden_crate, cardboard, bubble_wrap, foam, custom
  packing_remarks TEXT,

  -- Image
  image_url TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  dispatched_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on requests
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 6: CREATE TRIGGERS
-- ============================================================

-- Trigger 1: Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES (
    NEW.id,
    'requester',  -- Changed default from 'marketing'
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
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

-- Trigger 3: Auto-set timestamps based on status
CREATE OR REPLACE FUNCTION public.update_request_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set completed_at when status changes to 'ready'
  IF NEW.status = 'ready' AND OLD.status != 'ready' THEN
    NEW.completed_at = NOW();
  END IF;

  -- Set dispatched_at when status changes to 'dispatched'
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
-- STEP 7: CREATE RLS POLICIES
-- ============================================================

-- ===== PROFILES POLICIES =====

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy: Coordinators and Admins can view all profiles
CREATE POLICY "Coordinators and Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('coordinator', 'admin'));

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Policy: Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- Policy: Admins can insert profiles
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

-- ===== REQUESTS POLICIES =====

-- Policy: Requesters can view their own requests
CREATE POLICY "Requesters can view own requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester'
  );

-- Policy: Makers can view assigned requests
CREATE POLICY "Makers can view assigned requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() AND
    public.get_my_role() = 'maker'
  );

-- Policy: Coordinators and Admins can view all requests
CREATE POLICY "Coordinators and Admins can view all requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('coordinator', 'admin'));

-- Policy: Requesters can insert requests
CREATE POLICY "Requesters can insert requests"
  ON public.requests FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester'
  );

-- Policy: Makers can update assigned requests (status changes only)
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

-- Policy: ONLY Coordinators can update all requests (approve, assign, dispatch)
CREATE POLICY "Coordinators can update all requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'coordinator')
  WITH CHECK (public.get_my_role() = 'coordinator');

-- ============================================================
-- STEP 8: CREATE INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_requests_created_by ON public.requests(created_by);
CREATE INDEX idx_requests_assigned_to ON public.requests(assigned_to);
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_created_at ON public.requests(created_at DESC);
CREATE INDEX idx_requests_required_by ON public.requests(required_by);

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

-- Next steps for user:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Delete existing test users from Authentication > Users
-- 3. Update frontend TypeScript types
-- 4. Rebuild NewRequest.tsx component
-- 5. Update all other components
-- 6. Create fresh test users via signup
