-- ==============================================================================
-- REPAIR SCRIPT: Fixes "Relation not found", "Function not found" and adds new rider fields
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 0. Enable PostGIS for geography support
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Update rider_profiles with new columns
ALTER TABLE rider_profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline',
ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'Road',
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS current_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS current_longitude NUMERIC,
ADD COLUMN IF NOT EXISTS current_location geography(POINT, 4326),
ADD COLUMN IF NOT EXISTS total_earnings NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_deliveries INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Ensure the rider_notifications table exists
CREATE TABLE IF NOT EXISTS rider_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID REFERENCES rider_profiles(id) ON DELETE CASCADE,
  shop_id BIGINT REFERENCES shops(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'nudge', -- 'order', 'nudge', 'alert'
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE rider_notifications ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for Notifications
DROP POLICY IF EXISTS "Riders can view their own notifications" ON rider_notifications;
CREATE POLICY "Riders can view their own notifications"
ON rider_notifications FOR SELECT
TO authenticated
USING (rider_id::text = auth.uid()::text);

DROP POLICY IF EXISTS "Merchants can nudge their riders" ON rider_notifications;
CREATE POLICY "Merchants can nudge their riders"
ON rider_notifications FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = rider_notifications.shop_id
    AND shops.owner_id::text = auth.uid()::text
  )
);

-- 4. Create or Update the Status View
CREATE OR REPLACE VIEW rider_status_view AS
SELECT 
    rc.id as connection_id,
    rc.shop_id,
    rc.rider_id,
    COALESCE(rp.full_name, rc.rider_name) as rider_name,
    COALESCE(rp.is_online, false) as is_online,
    COALESCE(rp.status, 'offline') as status,
    rc.expires_at,
    rc.connection_code,
    CASE 
        WHEN rc.expires_at < now() THEN 'expired'
        WHEN rp.is_online = true THEN 'online'
        ELSE 'offline'
    END as status_derived
FROM rider_connections rc
LEFT JOIN rider_profiles rp ON rc.rider_id = rp.id;

-- 5. Create the nudge_rider function (as requested)
CREATE OR REPLACE FUNCTION nudge_rider(rider_id UUID, message TEXT)
RETURNS VOID AS $$
DECLARE
    merchant_shop_id BIGINT;
BEGIN
    -- Find a shop owned by the current user to associate with the notification
    SELECT id INTO merchant_shop_id FROM shops WHERE owner_id::text = auth.uid()::text LIMIT 1;
    
    INSERT INTO rider_notifications (rider_id, shop_id, message, type)
    VALUES (rider_id, merchant_shop_id, message, 'nudge');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Legacy support function
CREATE OR REPLACE FUNCTION nudge_rider_by_id(
    target_rider_id UUID, 
    target_shop_id BIGINT, 
    nudge_message TEXT DEFAULT 'Wake up! New order incoming.'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO rider_notifications (rider_id, shop_id, message, type)
    VALUES (target_rider_id, target_shop_id, nudge_message, 'nudge');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
