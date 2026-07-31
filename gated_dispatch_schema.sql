-- ==============================================================================
-- LOCALEATS GATED DISPATCH & FCM PUSH NOTIFICATION DATABASE SCHEMA
-- Phase 1 & 2: Database Optimization, RLS Isolation, & Gated Dispatch Support
-- ==============================================================================

-- 1. ENHANCE SHOPS TABLE FOR ISOLATED RIDER LINKING
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS linked_rider_id UUID,
  ADD COLUMN IF NOT EXISTS allow_external_riders BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS cash_trust_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_look_for_rider BOOLEAN DEFAULT false;

-- 2. ENHANCE ORDERS TABLE FOR GATED DISPATCH LIFECYCLE
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS assigned_rider_id UUID,
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS rider_id TEXT,
  ADD COLUMN IF NOT EXISTS rider_name TEXT,
  ADD COLUMN IF NOT EXISTS rider_phone TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_message TEXT,
  ADD COLUMN IF NOT EXISTS merchant_rating NUMERIC;

-- Create index on shop_id and rider_id for instant query performance
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON public.orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- 3. ENSURE FCM USER PUSH TOKENS TABLE EXISTS
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  device_type TEXT DEFAULT 'web',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can manage their own push tokens" 
  ON public.user_push_tokens FOR ALL 
  TO authenticated 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypass policy for edge function lookups
DROP POLICY IF EXISTS "Allow service role full access to push tokens" ON public.user_push_tokens;
CREATE POLICY "Allow service role full access to push tokens"
  ON public.user_push_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. ENSURE RIDER CONNECTIONS TABLE FOR 24H PAIRING CIPHERS
CREATE TABLE IF NOT EXISTS public.rider_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  rider_id UUID,
  rider_name TEXT,
  rider_phone TEXT,
  connection_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'offline', 'idle', 'busy', 'paused')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_connections_shop_id ON public.rider_connections(shop_id);
CREATE INDEX IF NOT EXISTS idx_rider_connections_code ON public.rider_connections(connection_code);

ALTER TABLE public.rider_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can manage shop connections" ON public.rider_connections;
CREATE POLICY "Merchants can manage shop connections"
  ON public.rider_connections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s 
      WHERE s.id = rider_connections.shop_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Riders can view matched connections" ON public.rider_connections;
CREATE POLICY "Riders can view matched connections"
  ON public.rider_connections FOR SELECT
  TO authenticated
  USING (rider_id = auth.uid());

-- 5. RLS POLICY FOR GATED DISPATCH ISOLATION ON ORDERS
-- Undispatched orders (pending, preparing, ready_for_dispatch) are STRICTLY HIDDEN from riders.
-- Orders ONLY become visible to the rider once the merchant explicitly dispatches them.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can manage shop orders" ON public.orders;
CREATE POLICY "Merchants can manage shop orders"
  ON public.orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = orders.shop_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Riders can view assigned dispatched orders" ON public.orders;
CREATE POLICY "Riders can view assigned dispatched orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    (rider_id::text = auth.uid()::text OR assigned_rider_id = auth.uid())
    AND status IN ('dispatched', 'out_for_delivery', 'accepted', 'picked_up', 'completed')
  );

DROP POLICY IF EXISTS "Customers can view own placed orders" ON public.orders;
CREATE POLICY "Customers can view own placed orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 6. SECURITY HARDENING FOR RIDER AUXILIARY TABLES
-- Note: spatial_ref_sys is an internal PostGIS reference table owned by postgres/extensions.

-- Enable RLS on rider_locations
ALTER TABLE IF EXISTS public.rider_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders can manage own location" ON public.rider_locations;
CREATE POLICY "Riders can manage own location"
  ON public.rider_locations FOR ALL
  TO authenticated
  USING (rider_id = auth.uid())
  WITH CHECK (rider_id = auth.uid());

DROP POLICY IF EXISTS "Merchants can view connected rider locations" ON public.rider_locations;
CREATE POLICY "Merchants can view connected rider locations"
  ON public.rider_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rider_connections rc
      JOIN public.shops s ON s.id = rc.shop_id
      WHERE rc.rider_id = rider_locations.rider_id
        AND s.owner_id = auth.uid()
    )
  );

-- Enable RLS on rider_notifications
ALTER TABLE IF EXISTS public.rider_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders can view own notifications" ON public.rider_notifications;
CREATE POLICY "Riders can view own notifications"
  ON public.rider_notifications FOR SELECT
  TO authenticated
  USING (rider_id = auth.uid());

DROP POLICY IF EXISTS "Merchants can send notifications to connected riders" ON public.rider_notifications;
CREATE POLICY "Merchants can send notifications to connected riders"
  ON public.rider_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = rider_notifications.shop_id AND s.owner_id = auth.uid()
    )
  );

-- 7. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
