-- Add schedule warning flag to requests table
-- Set to true when a coordinator changes the required_by date;
-- dismissed by any viewer clicking "acknowledge" on the banner.
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS has_schedule_warning BOOLEAN NOT NULL DEFAULT false;
