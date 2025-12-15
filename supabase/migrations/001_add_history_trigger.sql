-- Auto-log request changes to request_history table
-- This trigger automatically tracks changes to status, assigned_to, and priority fields

CREATE OR REPLACE FUNCTION log_request_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip logging for INSERT operations (only track UPDATEs)
    IF (TG_OP = 'INSERT') THEN RETURN NEW; END IF;

    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO request_history (request_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'status', OLD.status, NEW.status);
    END IF;

    -- Log assignment changes
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        INSERT INTO request_history (request_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'assigned_to',
                COALESCE(OLD.assigned_to::TEXT, 'null'),
                COALESCE(NEW.assigned_to::TEXT, 'null'));
    END IF;

    -- Log priority changes
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO request_history (request_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'priority', OLD.priority, NEW.priority);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after UPDATE on requests table
CREATE TRIGGER track_request_changes
    AFTER UPDATE ON public.requests
    FOR EACH ROW
    EXECUTE FUNCTION log_request_change();

-- Performance indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_request_history_request_id ON request_history(request_id);
CREATE INDEX IF NOT EXISTS idx_request_history_changed_at ON request_history(changed_at DESC);

-- Success message
COMMENT ON FUNCTION log_request_change() IS 'Automatically logs changes to requests table in request_history for audit trail';
