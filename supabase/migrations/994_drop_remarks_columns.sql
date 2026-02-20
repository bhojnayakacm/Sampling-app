-- ============================================================
-- Migration 994: Drop redundant remarks/custom columns
-- ============================================================
-- These columns are being removed because:
-- - pickup_remarks: "Other" pickup is coordinator-only, remarks not needed from requester
-- - client_type_remarks: Custom text will be stored directly in client_type
-- - project_type_custom: Custom text will be stored directly in project_type
-- ============================================================

ALTER TABLE requests DROP COLUMN IF EXISTS pickup_remarks;
ALTER TABLE requests DROP COLUMN IF EXISTS client_type_remarks;
ALTER TABLE requests DROP COLUMN IF EXISTS project_type_custom;
