-- ============================================================
-- Migration 995: Drop redundant remarks/custom columns from request_items
-- ============================================================
-- These columns are being removed because custom text will now be
-- stored directly in the primary columns (quality, sample_size,
-- thickness, finish). The "Other" hybrid pattern replaces the
-- separate "Custom" + remarks approach.
-- ============================================================

ALTER TABLE request_items DROP COLUMN IF EXISTS quality_custom;
ALTER TABLE request_items DROP COLUMN IF EXISTS sample_size_remarks;
ALTER TABLE request_items DROP COLUMN IF EXISTS thickness_remarks;
ALTER TABLE request_items DROP COLUMN IF EXISTS finish_remarks;
