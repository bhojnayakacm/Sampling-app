-- ============================================================
-- MIGRATION: Make company_firm_name optional for Retail clients
-- Description: Updates validate_submitted_request() to allow NULL
--              company_firm_name when client_type = 'retail'
-- ============================================================

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
    -- client_phone is now optional (removed validation)

    -- company_firm_name: Required for all client types EXCEPT 'retail'
    IF NEW.client_type <> 'retail' AND (NEW.company_firm_name IS NULL OR NEW.company_firm_name = '') THEN
      RAISE EXCEPTION 'Company/firm name is required for non-retail clients';
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

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON FUNCTION validate_submitted_request() IS
'Validates that all required fields are present when a request is submitted (status != draft).
Allows partial data for drafts.
Key conditional rules:
- company_firm_name: Required for architect/project/others, OPTIONAL for retail
- client_phone: Optional for all client types
- project_type: Required when client_type = project
- project_type_custom: Required when project_type = other';
