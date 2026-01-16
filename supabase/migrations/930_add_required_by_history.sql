-- Migration: Add Required By History
-- Purpose: Track all changes to the "required_by" deadline with audit trail
-- Created: 2026-01-16

-- Add JSONB column to store deadline change history
-- Structure: Array of objects { old_date, new_date, reason, changed_by_name, timestamp }
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS required_by_history JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries on history (optional, for future analytics)
CREATE INDEX IF NOT EXISTS idx_requests_required_by_history
ON requests USING gin (required_by_history);

-- Add comment for documentation
COMMENT ON COLUMN requests.required_by_history IS
'Audit trail of deadline changes. Array of objects: { old_date: ISO string, new_date: ISO string, reason: string, changed_by_name: string, timestamp: ISO string }';
