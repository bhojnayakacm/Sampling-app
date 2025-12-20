-- ============================================================
-- MIGRATION: Duplicate Request Detection
-- Description: RPC function to check for duplicate requests before submission
-- ============================================================

-- ============================================================
-- CREATE RPC FUNCTION: check_for_duplicates
-- ============================================================

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
    r.client_project_name,
    r.product_type,
    r.quality,
    r.sample_size,
    r.thickness,
    r.quantity
  INTO v_exact_match
  FROM requests r
  INNER JOIN profiles p ON r.created_by = p.id
  WHERE
    -- Client info matches
    LOWER(TRIM(r.client_project_name)) = LOWER(TRIM(p_client_name))
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
        'client_project_name', v_exact_match.client_project_name,
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
    r.client_project_name,
    r.product_type,
    r.quality,
    r.sample_size,
    r.thickness,
    r.quantity
  INTO v_client_match
  FROM requests r
  INNER JOIN profiles p ON r.created_by = p.id
  WHERE
    -- Client info matches
    LOWER(TRIM(r.client_project_name)) = LOWER(TRIM(p_client_name))
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
        'client_project_name', v_client_match.client_project_name,
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

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION check_for_duplicates(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================
COMMENT ON FUNCTION check_for_duplicates(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) IS
'Checks for duplicate requests within the last 14 days. Returns exact matches (all specs match) or client matches (client info matches but different specs).';

-- ============================================================
-- EXAMPLE USAGE
-- ============================================================
-- SELECT * FROM check_for_duplicates(
--   'ABC Project',           -- client_name
--   '+1234567890',           -- client_phone
--   'premium',               -- quality
--   '12x12',                 -- sample_size
--   '20mm',                  -- thickness
--   5                        -- quantity
-- );

-- ============================================================
-- TEST QUERY (for verification)
-- ============================================================
-- This query will help verify the function works correctly:
--
-- -- Insert test request
-- INSERT INTO requests (
--   request_number, status, created_by,
--   client_project_name, client_phone, company_firm_name,
--   product_type, quality, sample_size, thickness, quantity,
--   purpose, packing_details, site_location, pickup_responsibility,
--   department, mobile_no, priority, required_by
-- ) VALUES (
--   'TEST-001', 'pending_approval', (SELECT id FROM profiles LIMIT 1),
--   'ABC Project', '+1234567890', 'ABC Company',
--   'marble', 'premium', '12x12', '20mm', 5,
--   'approval', 'wooden_crate', 'Test Site', 'self_pickup',
--   'sales', '+1234567890', 'normal', NOW()
-- );
--
-- -- Test exact match
-- SELECT * FROM check_for_duplicates('ABC Project', '+1234567890', 'premium', '12x12', '20mm', 5);
-- Expected: is_duplicate = TRUE, duplicate_type = 'exact_match'
--
-- -- Test client match (different specs)
-- SELECT * FROM check_for_duplicates('ABC Project', '+1234567890', 'standard', '6x6', '18mm', 10);
-- Expected: is_duplicate = TRUE, duplicate_type = 'client_match'
--
-- -- Test no match (different client)
-- SELECT * FROM check_for_duplicates('XYZ Project', '+9876543210', 'premium', '12x12', '20mm', 5);
-- Expected: is_duplicate = FALSE
