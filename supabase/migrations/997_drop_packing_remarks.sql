-- Migration: Drop packing_remarks column from requests table
-- Custom packing instructions are now stored directly in packing_details (Hybrid Input pattern)

ALTER TABLE requests DROP COLUMN IF EXISTS packing_remarks;
