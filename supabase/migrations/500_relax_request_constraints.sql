-- ============================================================
-- MIGRATION: Relax Request Constraints for Partial Drafts
-- Description: Makes most columns nullable to support saving incomplete drafts
-- ============================================================

-- ============================================================
-- SECTION 1: REQUESTER DETAILS
-- ============================================================

-- Allow drafts without full requester details
ALTER TABLE requests
  ALTER COLUMN department DROP NOT NULL,
  ALTER COLUMN mobile_no DROP NOT NULL,
  ALTER COLUMN pickup_responsibility DROP NOT NULL,
  ALTER COLUMN required_by DROP NOT NULL,
  ALTER COLUMN priority DROP NOT NULL;

-- delivery_address and pickup_remarks are already nullable

-- ============================================================
-- SECTION 2: CLIENT PROJECT DETAILS
-- ============================================================

-- Allow drafts without full client details
ALTER TABLE requests
  ALTER COLUMN client_type DROP NOT NULL,
  ALTER COLUMN client_project_name DROP NOT NULL,
  ALTER COLUMN client_phone DROP NOT NULL,
  ALTER COLUMN company_firm_name DROP NOT NULL,
  ALTER COLUMN site_location DROP NOT NULL;

-- client_email and client_type_remarks are already nullable

-- ============================================================
-- SECTION 3: SAMPLE REQUEST DETAILS
-- ============================================================

-- Allow drafts without full product details
ALTER TABLE requests
  ALTER COLUMN product_type DROP NOT NULL,
  ALTER COLUMN quality DROP NOT NULL,
  ALTER COLUMN sample_size DROP NOT NULL,
  ALTER COLUMN thickness DROP NOT NULL,
  ALTER COLUMN quantity DROP NOT NULL,
  ALTER COLUMN purpose DROP NOT NULL,
  ALTER COLUMN packing_details DROP NOT NULL;

-- finish, finish_remarks, sample_size_remarks, thickness_remarks, packing_remarks are already nullable

-- ============================================================
-- KEEP CRITICAL FIELDS AS NOT NULL
-- ============================================================
-- These fields MUST always have values:
-- - id (primary key)
-- - request_number (generated, always present)
-- - status (defaults to 'draft' or 'pending_approval')
-- - created_by (foreign key to profiles)
-- - created_at, updated_at (timestamps)

-- ============================================================
-- ADD CHECK CONSTRAINT FOR SUBMITTED REQUESTS
-- ============================================================
-- Ensure that non-draft requests have all required fields filled

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
    IF NEW.client_project_name IS NULL THEN
      RAISE EXCEPTION 'Client project name is required for submitted requests';
    END IF;
    IF NEW.client_phone IS NULL THEN
      RAISE EXCEPTION 'Client phone is required for submitted requests';
    END IF;
    IF NEW.company_firm_name IS NULL THEN
      RAISE EXCEPTION 'Company/firm name is required for submitted requests';
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

    IF NEW.product_type IN ('marble', 'tile') AND (NEW.finish IS NULL OR NEW.finish = '') THEN
      RAISE EXCEPTION 'Finish is required for marble and tile products';
    END IF;

    IF NEW.finish = 'Custom' AND (NEW.finish_remarks IS NULL OR NEW.finish_remarks = '') THEN
      RAISE EXCEPTION 'Finish remarks are required when finish is "Custom"';
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

-- Drop trigger if exists (for rerunning migration)
DROP TRIGGER IF EXISTS trigger_validate_submitted_request ON requests;

-- Create trigger to validate submitted requests
CREATE TRIGGER trigger_validate_submitted_request
  BEFORE INSERT OR UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_submitted_request();

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON FUNCTION validate_submitted_request() IS 'Validates that all required fields are present when a request is submitted (status != draft). Allows partial data for drafts.';
COMMENT ON TRIGGER trigger_validate_submitted_request ON requests IS 'Ensures data integrity by validating submitted requests while allowing partial drafts.';

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- Run this to verify nullable columns:
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'requests'
-- ORDER BY ordinal_position;
