-- Add received_by column to track who actually received the sample
ALTER TABLE requests ADD COLUMN IF NOT EXISTS received_by TEXT;

-- Add comment for documentation
COMMENT ON COLUMN requests.received_by IS 'Name/details of the person who received the sample (requester, coordinator, or third party)';
