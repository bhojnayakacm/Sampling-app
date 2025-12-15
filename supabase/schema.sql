-- ============================================================
-- MARBLE SAMPLING MANAGEMENT SYSTEM - DATABASE SCHEMA (FIXED)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'coordinator', 'marketing', 'maker');

CREATE TYPE request_status AS ENUM (
    'pending_approval', 'approved', 'assigned', 'in_production',
    'ready', 'dispatched', 'rejected'
);

CREATE TYPE priority_level AS ENUM ('high', 'medium', 'low');
CREATE TYPE unit_type AS ENUM ('pieces', 'sqft');

-- ============================================================
-- TABLES
-- ============================================================

-- 1. PROFILES
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'marketing',
    full_name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CLIENTS
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    default_address TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. REQUESTS
CREATE SEQUENCE request_number_seq START 1001;

CREATE TABLE public.requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_number TEXT UNIQUE NOT NULL DEFAULT ('SMP-' || nextval('request_number_seq')::TEXT),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status request_status NOT NULL DEFAULT 'pending_approval',
    priority priority_level NOT NULL DEFAULT 'medium',
    requested_date DATE NOT NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    sample_name TEXT NOT NULL,
    stone_type TEXT NOT NULL,
    dimensions TEXT NOT NULL,
    thickness TEXT NOT NULL,
    finish TEXT NOT NULL,
    edge_profile TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit unit_type NOT NULL,
    remarks TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_quantity CHECK (quantity > 0)
);

-- 4. HISTORY
CREATE TABLE public.request_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- RLS POLICIES (FIXED SECTION)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_history ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Coordinators and Admins can view all profiles" ON public.profiles FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator')));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Requests Policies
CREATE POLICY "Marketing can view own requests" ON public.requests FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Makers can view assigned requests" ON public.requests FOR SELECT USING (auth.uid() = assigned_to);
CREATE POLICY "Coordinators and Admins can view all requests" ON public.requests FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('coordinator', 'admin')));

CREATE POLICY "Marketing can insert requests" ON public.requests FOR INSERT WITH CHECK (auth.uid() = created_by);

-- FIXED POLICY: Makers can update status
CREATE POLICY "Makers can update assigned requests" 
ON public.requests FOR UPDATE 
USING (auth.uid() = assigned_to)
WITH CHECK (auth.uid() = assigned_to); 

-- ONLY coordinators can update requests (assign, approve, dispatch) - NOT admins
CREATE POLICY "Coordinators can update all requests"
ON public.requests FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coordinator'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coordinator'));

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Function to handle new user signup automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role, full_name, phone)
    VALUES (
        NEW.id,
        'marketing',
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage Bucket Setup (Safe to run multiple times)
-- NOTE: Bucket is public so sample images can be viewed by anyone with the URL
INSERT INTO storage.buckets (id, name, public) VALUES ('sample-images', 'sample-images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sample-images');
CREATE POLICY "Public can view sample images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'sample-images');