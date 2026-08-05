-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Add location_captured_at to rider_profiles for stale data filtering
ALTER TABLE rider_profiles ADD COLUMN IF NOT EXISTS location_captured_at TIMESTAMPTZ;

-- 2. Create the robust update_rider_location function with Stale Data Filter
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

-- 3. Optimize 'rider_profiles' spatial index
CREATE INDEX IF NOT EXISTS idx_rider_profiles_location ON rider_profiles USING GIST (current_location);

-- 4. Single Source of Truth: Ensure orders table has delivery_location
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_location geography(POINT, 4326);

-- 5. get_nearby_shops Spatial Function
-- Drops older conflicting signatures if needed
DROP FUNCTION IF EXISTS get_nearby_shops(double precision, double precision, double precision);
DROP FUNCTION IF EXISTS get_nearby_shops(numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION get_nearby_shops(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 10000
)
RETURNS TABLE (
  id BIGINT,
  name TEXT,
  logo_url TEXT,
  location TEXT,
  category TEXT,
  is_active BOOLEAN,
  lat NUMERIC,
  lng NUMERIC,
  dist_meters DOUBLE PRECISION
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.logo_url,
    s.location,
    s.category,
    s.is_active,
    s.lat,
    s.lng,
    COALESCE(
      ST_DistanceSphere(
        ST_SetSRID(ST_MakePoint(s.lng::double precision, s.lat::double precision), 4326),
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
      ),
      0
    )::double precision AS dist_meters
  FROM shops s
  WHERE s.lat IS NOT NULL 
    AND s.lng IS NOT NULL
    AND ST_DistanceSphere(
      ST_SetSRID(ST_MakePoint(s.lng::double precision, s.lat::double precision), 4326),
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
    ) <= p_radius_meters
  ORDER BY dist_meters ASC;
END;
$$;
