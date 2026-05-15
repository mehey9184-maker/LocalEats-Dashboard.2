-- Payments table to store subscription and other payment information
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL, -- 'OTT', '1Voucher', 'Admin Code'
  transaction_id TEXT, -- The voucher PIN or reference
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create policies for payments
-- Allow shop owners to view their own payments
DROP POLICY IF EXISTS "Shop owners can view their own payments" ON payments;
CREATE POLICY "Shop owners can view their own payments"
ON payments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = payments.shop_id
    AND shops.owner_id::text = auth.uid()::text
  )
);

-- Allow shop owners to insert their own payments
DROP POLICY IF EXISTS "Shop owners can record their own payments" ON payments;
CREATE POLICY "Shop owners can record their own payments"
ON payments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = payments.shop_id
    AND shops.owner_id::text = auth.uid()::text
  )
);

-- ==========================================
-- FIX: Rider Live Missions RLS Policies
-- ==========================================

-- Ensure rider_profiles exists
CREATE TABLE IF NOT EXISTS rider_profiles (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rider_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders can manage their own profile" ON rider_profiles;
CREATE POLICY "Riders can manage their own profile"
ON rider_profiles FOR ALL
TO authenticated
USING (id::text = auth.uid()::text)
WITH CHECK (id::text = auth.uid()::text);

-- Enable RLS on rider_connections if not already
ALTER TABLE IF EXISTS rider_connections ENABLE ROW LEVEL SECURITY;

-- Allow shop owners full access to their shop's rider connections
DROP POLICY IF EXISTS "Merchants can manage their rider connections" ON rider_connections;
CREATE POLICY "Merchants can manage their rider connections"
ON rider_connections FOR ALL
TO authenticated
USING (
  shop_id IN (
    SELECT id FROM shops 
    WHERE owner_id::text = auth.uid()::text
  )
)
WITH CHECK (
  shop_id IN (
    SELECT id FROM shops 
    WHERE owner_id::text = auth.uid()::text
  )
);

-- Allow riders to view and update their own connections
DROP POLICY IF EXISTS "Riders can view and update their connections" ON rider_connections;
CREATE POLICY "Riders can view and update their connections"
ON rider_connections FOR SELECT
TO authenticated
USING (
  rider_id IS NULL OR rider_id::text = auth.uid()::text
);

DROP POLICY IF EXISTS "Riders can update their connections" ON rider_connections;
CREATE POLICY "Riders can update their connections"
ON rider_connections FOR UPDATE
TO authenticated
USING (
  -- Riders can only update unassigned connection codes or their own
  rider_id IS NULL OR rider_id::text = auth.uid()::text
)
WITH CHECK (
  rider_id::text = auth.uid()::text
);

-- Enable RLS on shops
ALTER TABLE IF EXISTS shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all shops" ON shops;
CREATE POLICY "Users can view all shops"
ON shops FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Shop owners can manage their shops" ON shops;
CREATE POLICY "Shop owners can manage their shops"
ON shops FOR ALL
TO authenticated
USING (owner_id::text = auth.uid()::text)
WITH CHECK (owner_id::text = auth.uid()::text);

-- ==========================================
-- FIX: Orders RLS Policies for Merchants
-- ==========================================

-- Policy: Shop owners can view orders for their own shops
DROP POLICY IF EXISTS "Shop owners can view their shop orders" ON orders;
CREATE POLICY "Shop owners can view their shop orders"
ON orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = orders.shop_id
    AND shops.owner_id::text = auth.uid()::text
  )
);

-- Policy: Shop owners can update their shop orders
DROP POLICY IF EXISTS "Shop owners can update their shop orders" ON orders;
CREATE POLICY "Shop owners can update their shop orders"
ON orders FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = orders.shop_id
    AND shops.owner_id::text = auth.uid()::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = orders.shop_id
    AND shops.owner_id::text = auth.uid()::text
  )
);

-- Policy: Shop owners can delete their shop orders
DROP POLICY IF EXISTS "Shop owners can delete their shop orders" ON orders;
CREATE POLICY "Shop owners can delete their shop orders"
ON orders FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = orders.shop_id
    AND shops.owner_id::text = auth.uid()::text
  )
);

-- 1. Allow any authenticated rider to VIEW unassigned "finding_rider" missions
DROP POLICY IF EXISTS "Riders can view unassigned live missions" ON orders;
CREATE POLICY "Riders can view unassigned live missions"
ON orders FOR SELECT
TO authenticated
USING (
  delivery_status = 'finding_rider' 
  AND (rider_id IS NULL OR rider_id::text = '' OR rider_id::text = 'null')
  AND (status = 'accepted' OR status = 'preparing')
);

-- ==========================================
-- FIX: Rider Live Missions & Profile Columns
-- ==========================================

-- Ensure rider_profiles has all required columns
CREATE EXTENSION IF NOT EXISTS postgis;

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
ADD COLUMN IF NOT EXISTS location_captured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create the robust update_rider_location function with Stale Data Filter
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

-- Ensure orders has all required delivery columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'delivery',
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS merchant_rating NUMERIC,
ADD COLUMN IF NOT EXISTS merchant_feedback TEXT,
ADD COLUMN IF NOT EXISTS restaurant_name TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Fix check constraint for delivery_status if it's too restrictive
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_status_check;
-- Clean up any legacy data that would violate the constraint
UPDATE orders SET delivery_status = NULL WHERE delivery_status NOT IN ('finding_rider', 'accepted', 'picked_up', 'delivered', 'cancelled');
-- Add the constraint back
ALTER TABLE orders ADD CONSTRAINT orders_delivery_status_check 
CHECK (delivery_status IN ('finding_rider', 'accepted', 'picked_up', 'delivered', 'cancelled') OR delivery_status IS NULL);

-- ensure shop_id is present if it was missed in some contexts
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_id BIGINT REFERENCES shops(id);

-- 2. Allow paired riders to view their shop's live missions
DROP POLICY IF EXISTS "Paired riders can view shop missions" ON orders;
CREATE POLICY "Paired riders can view shop missions"
ON orders FOR SELECT
TO authenticated
USING (
  shop_id IN (
    SELECT shop_id FROM rider_connections 
    WHERE rider_id::text = auth.uid()::text 
    AND expires_at > now()
  )
);

-- 3. Allow riders to view missions assigned to them
DROP POLICY IF EXISTS "Riders can view missions assigned to them" ON orders;
CREATE POLICY "Riders can view missions assigned to them"
ON orders FOR SELECT
TO authenticated
USING (
  rider_id::text = auth.uid()::text
);

-- 4. Allow riders to UPDATE orders to accept them
DROP POLICY IF EXISTS "Riders can update their unassigned or accepted missions" ON orders;
CREATE POLICY "Riders can update their unassigned or accepted missions"
ON orders FOR UPDATE
TO authenticated
USING (
  -- Can update if it's currently looking for a rider OR already assigned to this rider
  (delivery_status = 'finding_rider' AND (rider_id IS NULL OR rider_id::text = '')) 
  OR 
  (rider_id::text = auth.uid()::text)
)
WITH CHECK (
  -- Must set themselves as the rider
  rider_id::text = auth.uid()::text
);

-- ==========================================
-- FIX: Security and Performance Audit Findings
-- ==========================================

-- 1. NOTIFICATIONS RLS FIX
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
CREATE POLICY "Users can view their notifications"
ON notifications FOR SELECT
TO authenticated
USING (user_id::text = auth.uid()::text);

-- 2. PERMISSIVE POLICIES CLEANUP & FIXES

-- Orders: Ensure users can create their own orders safely
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Public Insert Orders" ON orders;
DROP POLICY IF EXISTS "Enable insert for all users" ON orders;
DROP POLICY IF EXISTS "Users can create their own orders safely" ON orders;

-- Note: In a real environment, you'd find the exact name from pg_policies,
-- but dropping typical auto-generated names covers most dashboard clicks.
CREATE POLICY "Users can create their own orders safely"
ON orders FOR INSERT
TO authenticated
WITH CHECK (user_id::text = auth.uid()::text OR user_id IS NULL);

-- 3. FUNCTION SEARCH PATH MUTABILITY (SECURITY DEFINER WARNINGS)
-- Securing functions executed with elevated privileges
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
    ALTER FUNCTION handle_new_user() SET search_path = public;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_shop_owner') THEN
    ALTER FUNCTION is_shop_owner(bigint) SET search_path = public;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'orders_broadcast_trigger') THEN
    ALTER FUNCTION orders_broadcast_trigger() SET search_path = public;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable') THEN
    ALTER FUNCTION rls_auto_enable() SET search_path = public;
  END IF;
END
$$;

-- 4. MISSING INDEXES ON FOREIGN KEYS (Performance Fixes)
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_announcements_shop_id ON announcements(shop_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_shop_id ON chat_messages(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_shop_id ON reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_rider_connections_shop_id ON rider_connections(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_followers_user_id ON shop_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_followers_shop_id ON shop_followers(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_coupons_shop_id ON coupons(shop_id);

-- ==========================================
-- FINAL HARDENING: Audit-Driven Security Fixes
-- ==========================================

-- 1. Rider Notifications for Nudges and Alerts
CREATE TABLE IF NOT EXISTS rider_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID REFERENCES rider_profiles(id) ON DELETE CASCADE,
  shop_id BIGINT REFERENCES shops(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'nudge', -- 'order', 'nudge', 'alert'
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on rider_notifications
ALTER TABLE rider_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Riders can view their own notifications
DROP POLICY IF EXISTS "Riders can view their own notifications" ON rider_notifications;
CREATE POLICY "Riders can view their own notifications"
ON rider_notifications FOR SELECT
TO authenticated
USING (rider_id::text = auth.uid()::text);

-- Policy: Merchants can insert notifications for their riders
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

-- 2. Index for online status performance
CREATE INDEX IF NOT EXISTS idx_rider_profiles_online ON rider_profiles(is_online);

-- 3. Rider Status View for easier querying
-- This view joins connections with profiles to get a unified status
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

-- 4. Helper function to nudge a rider safely (Legacy version)
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

-- 5. Helper function: nudge_rider as requested
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

-- 5. Hardening MENU_ITEMS
-- Drop typically permissive auto-generated policies from Dashboard
DROP POLICY IF EXISTS "Enable insert for all users" ON menu_items;
DROP POLICY IF EXISTS "Allow public select" ON menu_items;
DROP POLICY IF EXISTS "Allow public update" ON menu_items;
DROP POLICY IF EXISTS "Allow public delete" ON menu_items;
DROP POLICY IF EXISTS "Shop owners can manage menu items" ON menu_items;

-- Re-enable RLS securely
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view menu items
CREATE POLICY "Public can view menu items"
ON menu_items FOR SELECT
TO authenticated, anon
USING (true);

-- Policy: Only shop owners can manage their items
CREATE POLICY "Shop owners can manage their menu items"
ON menu_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = menu_items.shop_id
    AND shops.owner_id::text = auth.uid()::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = menu_items.shop_id
    AND shops.owner_id::text = auth.uid()::text
  )
);

-- 2. Hardening PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop potentially dangerous legacy policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Everyone can view everyone" ON profiles;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
TO authenticated
USING (user_id::text = auth.uid()::text);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (user_id::text = auth.uid()::text)
WITH CHECK (user_id::text = auth.uid()::text);

-- 3. Hardening RIDER_CONNECTIONS & RIDER_PROFILES (Final Sweep)
DROP POLICY IF EXISTS "Public Connections" ON rider_connections;
DROP POLICY IF EXISTS "Public Profiles" ON rider_profiles;

-- 4. ENSURE ALL TABLES HAVE RLS ENABLED (As per security warning)
ALTER TABLE IF EXISTS shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shop_followers ENABLE ROW LEVEL SECURITY;

-- 5. RE-VALIDATE ORDERS INSERT
DROP POLICY IF EXISTS "Allow public insert" ON orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
