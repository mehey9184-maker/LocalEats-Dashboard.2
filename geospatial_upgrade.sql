
-- 1. Add location_captured_at to rider_profiles for stale data filtering
ALTER TABLE rider_profiles 
ADD COLUMN IF NOT EXISTS location_captured_at TIMESTAMPTZ;

-- 2. Create the robust update_rider_location function with Stale Data Filter
-- This prevents race conditions where an older GPS packet arrives after a newer one.
CREATE OR REPLACE FUNCTION update_rider_location(
    p_rider_id UUID,
    p_lat NUMERIC,
    p_lng NUMERIC,
    p_captured_at TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
    UPDATE rider_profiles
    SET 
        current_latitude = p_lat,
        current_longitude = p_lng,
        current_location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        location_captured_at = p_captured_at,
        updated_at = now()
    WHERE id = p_rider_id
    AND (location_captured_at IS NULL OR location_captured_at < p_captured_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Optimize 'riders' view or queries by adding any missing indexes for geo-queries
CREATE INDEX IF NOT EXISTS idx_rider_profiles_location ON rider_profiles USING GIST (current_location);

-- 4. Single Source of Truth: Ensure orders table also uses current_location for delivery point
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_location geography(POINT, 4326);

-- Update trigger or logic to sync delivery_location if address change? 
-- For now, we'll keep it simple and ensure the rider location is the SSOT.
