-- ============================================================
-- Add 'draft' status to request_status enum
-- ============================================================
-- This allows requesters to save incomplete requests as drafts
-- ============================================================

-- Add 'draft' to the request_status enum
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'draft';

-- Note: In PostgreSQL, enum values are added to the end by default
-- The order will be: pending_approval, approved, assigned, in_production, ready, dispatched, rejected, draft

-- Update the default status for new requests (still pending_approval for submitted requests)
-- Drafts will be explicitly set when saving as draft

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
