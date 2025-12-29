-- ============================================================
-- MIGRATION: Create request_items table for Multi-Product Support
-- ============================================================
-- This migration implements a Parent-Child (One-to-Many) relationship:
-- - requests (parent): Contains client, project, and requester details
-- - request_items (children): Contains product-specific details
-- ============================================================

-- 1. CREATE THE REQUEST_ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS request_items (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Key to parent request
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,

    -- Item index (for ordering)
    item_index INTEGER NOT NULL DEFAULT 0,

    -- Product Specifications
    product_type TEXT NOT NULL,
    quality TEXT NOT NULL,
    quality_custom TEXT,  -- Custom quality text when "Custom" is selected
    sample_size TEXT NOT NULL,
    sample_size_remarks TEXT,
    thickness TEXT NOT NULL,
    thickness_remarks TEXT,
    finish TEXT,  -- NULL for Terrazzo/Quartz
    finish_remarks TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,

    -- Reference Image
    image_url TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_quantity CHECK (quantity > 0),
    CONSTRAINT valid_product_type CHECK (product_type IN ('marble', 'tile', 'terrazzo', 'quartz'))
);

-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================

-- Index for fast lookups by request_id
CREATE INDEX idx_request_items_request_id ON request_items(request_id);

-- Index for ordering items within a request
CREATE INDEX idx_request_items_ordering ON request_items(request_id, item_index);

-- 3. CREATE TRIGGER FOR updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_request_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_request_items_updated_at
    BEFORE UPDATE ON request_items
    FOR EACH ROW
    EXECUTE FUNCTION update_request_items_updated_at();

-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on the table
ALTER TABLE request_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view items of requests they created
CREATE POLICY "Users can view their own request items"
    ON request_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM requests r
            WHERE r.id = request_items.request_id
            AND r.created_by = auth.uid()
        )
    );

-- Policy: Staff (admin, coordinator, maker) can view all request items
CREATE POLICY "Staff can view all request items"
    ON request_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'coordinator', 'maker')
        )
    );

-- Policy: Users can insert items for their own requests
CREATE POLICY "Users can insert their own request items"
    ON request_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM requests r
            WHERE r.id = request_items.request_id
            AND r.created_by = auth.uid()
        )
    );

-- Policy: Users can update items of their own draft requests
CREATE POLICY "Users can update their own draft request items"
    ON request_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM requests r
            WHERE r.id = request_items.request_id
            AND r.created_by = auth.uid()
            AND r.status = 'draft'
        )
    );

-- Policy: Users can delete items of their own draft requests
CREATE POLICY "Users can delete their own draft request items"
    ON request_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM requests r
            WHERE r.id = request_items.request_id
            AND r.created_by = auth.uid()
            AND r.status = 'draft'
        )
    );

-- Policy: Coordinators can update all request items
CREATE POLICY "Coordinators can update all request items"
    ON request_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'coordinator')
        )
    );

-- 5. ADD HELPER COLUMN TO REQUESTS TABLE
-- ============================================================

-- Add a column to track total item count (denormalized for performance)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS item_count INTEGER DEFAULT 1;

-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON TABLE request_items IS 'Product items belonging to a sample request (One Request → Many Items)';
COMMENT ON COLUMN request_items.request_id IS 'Foreign key to parent request';
COMMENT ON COLUMN request_items.item_index IS 'Order of item within the request (0-based)';
COMMENT ON COLUMN request_items.quality_custom IS 'Custom quality text when quality="Custom"';
COMMENT ON COLUMN request_items.finish IS 'NULL for Terrazzo and Quartz products';

-- ============================================================
-- BACKWARD COMPATIBILITY NOTE
-- ============================================================
-- The following columns in the `requests` table are now DEPRECATED
-- for new requests but kept for backward compatibility with existing data:
-- - product_type
-- - quality
-- - sample_size, sample_size_remarks
-- - thickness, thickness_remarks
-- - finish, finish_remarks
-- - quantity
-- - image_url
--
-- For existing requests without items in request_items table,
-- these columns will continue to be read directly from requests.
-- New requests will store product data ONLY in request_items.
-- ============================================================
