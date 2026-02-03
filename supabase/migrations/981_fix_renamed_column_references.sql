-- ============================================================
-- Migration: Fix functions referencing renamed columns
-- ============================================================
-- Columns were renamed in migration 980:
--   client_project_name → client_contact_name
--   company_firm_name → firm_name
--
-- This migration updates all functions still referencing the old names.
-- ============================================================

-- ============================================================
-- FIX 1: validate_submitted_request() trigger function
-- ============================================================
-- This function validates that required fields are present when
-- a request is submitted (status != draft).

CREATE OR REPLACE FUNCTION validate_submitted_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate if status is NOT 'draft'
  IF NEW.status <> 'draft' THEN
    -- Section 1: Requester Details
    IF NEW.department IS NULL THEN
      RAISE EXCEPTION 'Department is required for submitted requests';
    END IF;
    IF NEW.mobile_no IS NULL THEN
      RAISE EXCEPTION 'Mobile number is required for submitted requests';
    END IF;
    IF NEW.pickup_responsibility IS NULL THEN
      RAISE EXCEPTION 'Pickup responsibility is required for submitted requests';
    END IF;
    IF NEW.required_by IS NULL THEN
      RAISE EXCEPTION 'Required by date is required for submitted requests';
    END IF;
    IF NEW.priority IS NULL THEN
      RAISE EXCEPTION 'Priority is required for submitted requests';
    END IF;

    -- Section 2: Client Project Details
    IF NEW.client_type IS NULL THEN
      RAISE EXCEPTION 'Client type is required for submitted requests';
    END IF;
    -- FIXED: client_project_name → client_contact_name
    IF NEW.client_contact_name IS NULL THEN
      RAISE EXCEPTION 'Client contact name is required for submitted requests';
    END IF;
    -- client_phone is optional (removed validation)

    -- FIXED: company_firm_name → firm_name
    -- firm_name: Required for all client types EXCEPT 'retail'
    IF NEW.client_type <> 'retail' AND (NEW.firm_name IS NULL OR NEW.firm_name = '') THEN
      RAISE EXCEPTION 'Firm name is required for non-retail clients';
    END IF;

    IF NEW.site_location IS NULL THEN
      RAISE EXCEPTION 'Site location is required for submitted requests';
    END IF;

    -- Section 3: Sample Request Details
    IF NEW.product_type IS NULL THEN
      RAISE EXCEPTION 'Product type is required for submitted requests';
    END IF;
    IF NEW.quality IS NULL THEN
      RAISE EXCEPTION 'Quality is required for submitted requests';
    END IF;
    IF NEW.sample_size IS NULL THEN
      RAISE EXCEPTION 'Sample size is required for submitted requests';
    END IF;
    IF NEW.thickness IS NULL THEN
      RAISE EXCEPTION 'Thickness is required for submitted requests';
    END IF;
    IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than 0 for submitted requests';
    END IF;
    IF NEW.purpose IS NULL THEN
      RAISE EXCEPTION 'Purpose is required for submitted requests';
    END IF;
    IF NEW.packing_details IS NULL THEN
      RAISE EXCEPTION 'Packing details are required for submitted requests';
    END IF;

    -- Conditional validations
    IF NEW.pickup_responsibility = 'other' AND (NEW.pickup_remarks IS NULL OR NEW.pickup_remarks = '') THEN
      RAISE EXCEPTION 'Pickup remarks are required when pickup responsibility is "other"';
    END IF;

    IF NEW.pickup_responsibility <> 'self_pickup' AND (NEW.delivery_address IS NULL OR NEW.delivery_address = '') THEN
      RAISE EXCEPTION 'Delivery address is required when pickup responsibility is not "self_pickup"';
    END IF;

    IF NEW.client_type = 'others' AND (NEW.client_type_remarks IS NULL OR NEW.client_type_remarks = '') THEN
      RAISE EXCEPTION 'Client type remarks are required when client type is "others"';
    END IF;

    -- Project-specific validations
    IF NEW.client_type = 'project' AND (NEW.project_type IS NULL OR NEW.project_type = '') THEN
      RAISE EXCEPTION 'Project type is required when client type is "project"';
    END IF;

    IF NEW.client_type = 'project' AND NEW.project_type = 'other' AND (NEW.project_type_custom IS NULL OR NEW.project_type_custom = '') THEN
      RAISE EXCEPTION 'Custom project type is required when project type is "other"';
    END IF;

    IF NEW.product_type IN ('marble', 'tile', 'magro_stone') AND (NEW.finish IS NULL OR NEW.finish = '') THEN
      RAISE EXCEPTION 'Finish is required for marble, tile, and magro stone products';
    END IF;

    IF NEW.finish IN ('Custom', 'Customize') AND (NEW.finish_remarks IS NULL OR NEW.finish_remarks = '') THEN
      RAISE EXCEPTION 'Finish remarks are required when finish is "Custom" or "Customize"';
    END IF;

    IF NEW.sample_size = 'Custom' AND (NEW.sample_size_remarks IS NULL OR NEW.sample_size_remarks = '') THEN
      RAISE EXCEPTION 'Sample size remarks are required when sample size is "Custom"';
    END IF;

    IF NEW.thickness = 'Custom' AND (NEW.thickness_remarks IS NULL OR NEW.thickness_remarks = '') THEN
      RAISE EXCEPTION 'Thickness remarks are required when thickness is "Custom"';
    END IF;

    IF NEW.packing_details = 'custom' AND (NEW.packing_remarks IS NULL OR NEW.packing_remarks = '') THEN
      RAISE EXCEPTION 'Packing remarks are required when packing details is "custom"';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_submitted_request() IS
'Validates that all required fields are present when a request is submitted (status != draft).
Allows partial data for drafts.
Key conditional rules:
- firm_name: Required for architect/project/others, OPTIONAL for retail
- client_phone: Optional for all client types
- project_type: Required when client_type = project
- project_type_custom: Required when project_type = other
Updated: Uses client_contact_name and firm_name (renamed from client_project_name and company_firm_name)';


-- ============================================================
-- FIX 2: check_for_duplicates() RPC function
-- ============================================================
-- This function checks for duplicate requests before submission.

CREATE OR REPLACE FUNCTION check_for_duplicates(
  p_client_name TEXT,
  p_client_phone TEXT,
  p_quality TEXT,
  p_sample_size TEXT,
  p_thickness TEXT,
  p_quantity INTEGER
)
RETURNS TABLE (
  is_duplicate BOOLEAN,
  duplicate_type TEXT,
  existing_request JSONB
) AS $$
DECLARE
  v_cutoff_date TIMESTAMP;
  v_exact_match RECORD;
  v_client_match RECORD;
BEGIN
  -- Calculate cutoff date (14 days ago)
  v_cutoff_date := NOW() - INTERVAL '14 days';

  -- ============================================================
  -- STEP 1: Check for EXACT SAMPLE MATCH (High Priority)
  -- ============================================================
  -- Matches: Client Name AND Client Phone AND Quality AND Size AND Thickness AND Quantity
  -- Status: Not draft or rejected (only active/completed requests)
  SELECT
    r.id,
    r.request_number,
    r.created_at,
    r.status,
    p.full_name AS requester_name,
    r.client_contact_name,  -- FIXED: was client_project_name
    r.product_type,
    r.quality,
    r.sample_size,
    r.thickness,
    r.quantity
  INTO v_exact_match
  FROM requests r
  INNER JOIN profiles p ON r.created_by = p.id
  WHERE
    -- Client info matches (FIXED: client_project_name → client_contact_name)
    LOWER(TRIM(r.client_contact_name)) = LOWER(TRIM(p_client_name))
    AND LOWER(TRIM(r.client_phone)) = LOWER(TRIM(p_client_phone))
    -- Sample specs match
    AND LOWER(TRIM(r.quality)) = LOWER(TRIM(p_quality))
    AND LOWER(TRIM(r.sample_size)) = LOWER(TRIM(p_sample_size))
    AND LOWER(TRIM(r.thickness)) = LOWER(TRIM(p_thickness))
    AND r.quantity = p_quantity
    -- Within last 14 days
    AND r.created_at >= v_cutoff_date
    -- Not draft or rejected
    AND r.status NOT IN ('draft', 'rejected')
  ORDER BY r.created_at DESC
  LIMIT 1;

  -- If exact match found, return immediately
  IF FOUND THEN
    RETURN QUERY
    SELECT
      TRUE AS is_duplicate,
      'exact_match'::TEXT AS duplicate_type,
      jsonb_build_object(
        'request_number', v_exact_match.request_number,
        'created_at', v_exact_match.created_at,
        'requester_name', v_exact_match.requester_name,
        'status', v_exact_match.status,
        'client_contact_name', v_exact_match.client_contact_name,  -- FIXED: JSON key name
        'product_type', v_exact_match.product_type,
        'quality', v_exact_match.quality,
        'sample_size', v_exact_match.sample_size,
        'thickness', v_exact_match.thickness,
        'quantity', v_exact_match.quantity
      ) AS existing_request;
    RETURN;
  END IF;

  -- ============================================================
  -- STEP 2: Check for CLIENT MATCH (Low Priority)
  -- ============================================================
  -- Matches: Client Name AND Client Phone (but different sample specs)
  SELECT
    r.id,
    r.request_number,
    r.created_at,
    r.status,
    p.full_name AS requester_name,
    r.client_contact_name,  -- FIXED: was client_project_name
    r.product_type,
    r.quality,
    r.sample_size,
    r.thickness,
    r.quantity
  INTO v_client_match
  FROM requests r
  INNER JOIN profiles p ON r.created_by = p.id
  WHERE
    -- Client info matches (FIXED: client_project_name → client_contact_name)
    LOWER(TRIM(r.client_contact_name)) = LOWER(TRIM(p_client_name))
    AND LOWER(TRIM(r.client_phone)) = LOWER(TRIM(p_client_phone))
    -- Within last 14 days
    AND r.created_at >= v_cutoff_date
    -- Not draft or rejected
    AND r.status NOT IN ('draft', 'rejected')
  ORDER BY r.created_at DESC
  LIMIT 1;

  -- If client match found, return it
  IF FOUND THEN
    RETURN QUERY
    SELECT
      TRUE AS is_duplicate,
      'client_match'::TEXT AS duplicate_type,
      jsonb_build_object(
        'request_number', v_client_match.request_number,
        'created_at', v_client_match.created_at,
        'requester_name', v_client_match.requester_name,
        'status', v_client_match.status,
        'client_contact_name', v_client_match.client_contact_name,  -- FIXED: JSON key name
        'product_type', v_client_match.product_type,
        'quality', v_client_match.quality,
        'sample_size', v_client_match.sample_size,
        'thickness', v_client_match.thickness,
        'quantity', v_client_match.quantity
      ) AS existing_request;
    RETURN;
  END IF;

  -- ============================================================
  -- STEP 3: No duplicates found
  -- ============================================================
  RETURN QUERY
  SELECT
    FALSE AS is_duplicate,
    NULL::TEXT AS duplicate_type,
    NULL::JSONB AS existing_request;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_for_duplicates(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) IS
'Checks for duplicate requests within the last 14 days.
Returns exact matches (all specs match) or client matches (client info matches but different specs).
Updated: Uses client_contact_name (renamed from client_project_name)';


-- ============================================================
-- VERIFICATION
-- ============================================================
-- Run this query to verify the functions are updated:
--
-- SELECT proname, prosrc
-- FROM pg_proc
-- WHERE proname IN ('validate_submitted_request', 'check_for_duplicates')
-- AND prosrc LIKE '%client_contact_name%';
