-- ============================================================
-- MIGRATION: Sample Tracking & Delivery Confirmation
-- Description: Adds 'received' status, tracking history, and delivery confirmation
-- ============================================================

-- 1. Add 'received' status to the enum
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'received';

-- 2. Add received_at timestamp column to requests table
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE;

-- 3. Create request_status_history table for audit trail
CREATE TABLE IF NOT EXISTS request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  status request_status NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_history_request_id ON request_status_history(request_id);
CREATE INDEX IF NOT EXISTS idx_history_changed_at ON request_status_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_status ON request_status_history(status);

-- 4. Create function to automatically log status changes
CREATE OR REPLACE FUNCTION log_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO request_status_history (
      request_id,
      status,
      changed_at,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.status,
      NOW(),
      auth.uid() -- Current authenticated user
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger on requests table
DROP TRIGGER IF EXISTS trigger_log_status_change ON requests;
CREATE TRIGGER trigger_log_status_change
  AFTER INSERT OR UPDATE OF status ON requests
  FOR EACH ROW
  EXECUTE FUNCTION log_request_status_change();

-- 6. Backfill existing requests with initial history entry
-- This ensures all existing requests have a history record
INSERT INTO request_status_history (request_id, status, changed_at, changed_by)
SELECT
  id,
  status,
  created_at, -- Use created_at as the initial change time
  created_by
FROM requests
WHERE id NOT IN (SELECT DISTINCT request_id FROM request_status_history)
ON CONFLICT DO NOTHING;

-- 7. Enable RLS on request_status_history table
ALTER TABLE request_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view history for requests they have access to
CREATE POLICY "Users can view status history for accessible requests"
  ON request_status_history
  FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM requests
      WHERE
        -- Requester can see their own requests
        created_by = auth.uid()
        -- Maker can see assigned requests
        OR assigned_to = auth.uid()
        -- Admin and coordinator can see all requests
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role IN ('admin', 'coordinator')
        )
    )
  );

-- RLS Policy: System can insert history (via trigger)
CREATE POLICY "System can insert status history"
  ON request_status_history
  FOR INSERT
  WITH CHECK (true);

-- 8. Create a view for easy timeline fetching (optional optimization)
CREATE OR REPLACE VIEW request_timeline AS
SELECT
  r.id as request_id,
  r.request_number,
  r.status as current_status,
  json_agg(
    json_build_object(
      'status', h.status,
      'changed_at', h.changed_at,
      'changed_by', h.changed_by,
      'changer_name', p.full_name
    ) ORDER BY h.changed_at ASC
  ) as history
FROM requests r
LEFT JOIN request_status_history h ON h.request_id = r.id
LEFT JOIN profiles p ON p.id = h.changed_by
GROUP BY r.id, r.request_number, r.status;

-- Grant access to the view
GRANT SELECT ON request_timeline TO authenticated;

-- 9. Add comment for documentation
COMMENT ON TABLE request_status_history IS 'Audit trail for all status changes on requests. Automatically populated by trigger.';
COMMENT ON COLUMN request_status_history.changed_by IS 'User who made the status change. NULL if changed by system.';
COMMENT ON FUNCTION log_request_status_change() IS 'Trigger function that automatically logs status changes to request_status_history table.';
