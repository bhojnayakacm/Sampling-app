-- ============================================================
-- MIGRATION: Update FK constraints for admin hard-delete cascade
-- ============================================================
-- Problem: Deleting a user who has authored requests fails with
--   "violates foreign key constraint requests_created_by_fkey"
-- because created_by uses ON DELETE RESTRICT.
--
-- Solution: Change to ON DELETE CASCADE so hard-deleting a user
-- also removes all their requests (and cascading children:
-- request_items, request_status_history).
-- ============================================================

-- 1. Drop the existing RESTRICT constraint on requests.created_by
ALTER TABLE requests
  DROP CONSTRAINT IF EXISTS requests_created_by_fkey;

-- 2. Re-add with ON DELETE CASCADE
ALTER TABLE requests
  ADD CONSTRAINT requests_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES profiles(id)
  ON DELETE CASCADE;

-- ============================================================
-- Full cascade chain when hard-deleting a user:
--   auth.users  ──CASCADE──>  profiles
--   profiles    ──CASCADE──>  requests        (this migration)
--   requests    ──CASCADE──>  request_items   (already CASCADE)
--   requests    ──CASCADE──>  request_status_history (already CASCADE)
--   profiles    ──CASCADE──>  product_templates (already CASCADE)
--   profiles    ──SET NULL──> requests.assigned_to (already SET NULL)
--   profiles    ──SET NULL──> request_status_history.changed_by (already SET NULL)
-- ============================================================
