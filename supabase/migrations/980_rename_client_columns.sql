-- ============================================================
-- Migration: Rename client columns for clarity
-- ============================================================
-- client_project_name → client_contact_name (stores person name, not project title)
-- company_firm_name → firm_name (shorter, cleaner)
-- ============================================================

-- Step 1: Rename client_project_name to client_contact_name
ALTER TABLE public.requests
  RENAME COLUMN client_project_name TO client_contact_name;

-- Step 2: Rename company_firm_name to firm_name
ALTER TABLE public.requests
  RENAME COLUMN company_firm_name TO firm_name;

-- Step 3: Add comments for documentation
COMMENT ON COLUMN public.requests.client_contact_name IS 'Name of the client contact person (Client/Architect/Contacted Person based on client_type)';
COMMENT ON COLUMN public.requests.firm_name IS 'Name of the company or firm';
