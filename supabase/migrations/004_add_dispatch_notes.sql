-- ============================================================
-- MIGRATION: Add dispatch_notes column to requests table
-- ============================================================
-- This migration adds support for Coordinators to add optional
-- notes when dispatching a request (e.g., Courier Name, Tracking Number).
-- ============================================================

-- 1. ADD THE DISPATCH_NOTES COLUMN
-- ============================================================

ALTER TABLE requests ADD COLUMN IF NOT EXISTS dispatch_notes TEXT;

-- 2. COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON COLUMN requests.dispatch_notes IS 'Optional notes added by coordinator when dispatching (e.g., Courier name, Tracking number)';

-- ============================================================
-- USAGE EXAMPLE
-- ============================================================
-- When a coordinator marks a request as dispatched, they can optionally
-- add notes like:
-- - "Sent via BlueDart, Tracking: BD123456789"
-- - "Courier: John, Phone: 9876543210"
-- - "Picked up by client representative"
--
-- These notes will be visible to the requester in the request details.
-- ============================================================
