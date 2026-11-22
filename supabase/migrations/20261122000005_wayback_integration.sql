-- Migration: Add Wayback Machine integration columns to site_updates
-- Date: 2026-11-22

-- Add Wayback integration columns
ALTER TABLE site_updates 
ADD COLUMN IF NOT EXISTS wayback_url TEXT,
ADD COLUMN IF NOT EXISTS snapshot_timestamps JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_diff TEXT;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_site_updates_wayback_url ON site_updates(wayback_url) 
WHERE wayback_url IS NOT NULL;

COMMENT ON COLUMN site_updates.wayback_url IS 'Original URL for Wayback Machine snapshots';
COMMENT ON COLUMN site_updates.snapshot_timestamps IS 'Array of Wayback snapshot timestamps';
COMMENT ON COLUMN site_updates.last_diff IS 'JSON string of last diff comparison data';