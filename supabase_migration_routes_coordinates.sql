-- Supabase Migration: Add Coordinates to Routes Table
-- Execute this SQL in your Supabase SQL Editor

ALTER TABLE routes
ADD COLUMN IF NOT EXISTS origin_lat numeric,
ADD COLUMN IF NOT EXISTS origin_lng numeric,
ADD COLUMN IF NOT EXISTS destination_lat numeric,
ADD COLUMN IF NOT EXISTS destination_lng numeric;

-- Optional: Add comments to the columns for better documentation
COMMENT ON COLUMN routes.origin_lat IS 'Latitude coord for the origin location';
COMMENT ON COLUMN routes.origin_lng IS 'Longitude coord for the origin location';
COMMENT ON COLUMN routes.destination_lat IS 'Latitude coord for the destination location';
COMMENT ON COLUMN routes.destination_lng IS 'Longitude coord for the destination location';
