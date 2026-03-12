-- Add delivery Point of Contact fields for "Field Boy" pickup responsibility
-- When a requester selects "Field Boy", they must provide the name and contact
-- numbers of the person who will receive the delivery.

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS delivery_poc_name    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_poc_contacts TEXT[] DEFAULT NULL;

-- Allow requesters to write these new columns (already covered by existing INSERT/UPDATE policies)
-- No additional RLS changes needed since requesters can already write to `requests`.

COMMENT ON COLUMN requests.delivery_poc_name IS 'Name of the person receiving the delivery (required when pickup_responsibility = field_boy)';
COMMENT ON COLUMN requests.delivery_poc_contacts IS 'Array of contact numbers for the delivery POC (required when pickup_responsibility = field_boy)';
