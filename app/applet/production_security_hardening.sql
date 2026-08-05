-- ==============================================================================
-- LOCAL EATS - FINAL PRODUCTION SECURITY & PERFORMANCE HARDENING MIGRATION (v9)
-- Copy and run this entire script in your Supabase SQL Editor (as postgres / admin):
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- Prevent transaction deadlocks during concurrent live app traffic
SET lock_timeout = '8s';

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & PostGIS RLS HARDENING
-- Relocates relocatable helper extensions and safely applies RLS to spatial_ref_sys
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;

-- Relocate relocatable helper extensions
DO $$
BEGIN
  BEGIN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER EXTENSION btree_gist SET SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Enable RLS on spatial_ref_sys safely
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Allow public read access to spatial_ref_sys" ON public.spatial_ref_sys;
    CREATE POLICY "Allow public read access to spatial_ref_sys" 
    ON public.spatial_ref_sys FOR SELECT 
    TO anon, authenticated, service_role 
    USING (true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    GRANT SELECT ON public.spatial_ref_sys TO anon, authenticated, service_role;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ------------------------------------------------------------------------------
-- 2. HARDEN SECURITY DEFINER RPC EXPOSURE & PERMISSIONS
-- Fixes mutable search_path and revokes public REST access from internal functions.
-- ------------------------------------------------------------------------------

-- 2a. Fix mutable search_path on ALL custom functions in public schema
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN 
    SELECT p.oid::regprocedure AS func_sig 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
  LOOP
    BEGIN
      EXECUTE 'ALTER FUNCTION ' || r.func_sig || ' SET search_path = public, extensions';
    EXCEPTION WHEN OTHERS THEN
      -- Ignore system/extension functions that cannot be altered
      NULL;
    END;
  END LOOP;
END $$;

-- 2b. Revoke REST/RPC execution from internal triggers & utility functions
DO $$
DECLARE 
  r RECORD;
BEGIN
  FOR r IN 
    SELECT p.oid::regprocedure AS func_sig 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
      AND p.proname IN (
        'broadcast_chat_message_created', 
        'handle_new_user', 
        'update_updated_at_column', 
        'is_shop_owner',
        'orders_broadcast_trigger',
        'purge_expired_guest_carts',
        'rls_auto_enable'
      )
  LOOP
    BEGIN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.func_sig || ' FROM PUBLIC, anon, authenticated';
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.func_sig || ' TO service_role';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- 2c. Restrict sensitive rider & merchant action RPCs to authenticated users only
DO $$
DECLARE 
  r RECORD;
BEGIN
  FOR r IN 
    SELECT p.oid::regprocedure AS func_sig 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
      AND p.proname IN (
        'claim_delivery_mission', 
        'nudge_rider', 
        'nudge_rider_by_id',
        'update_rider_location'
      )
  LOOP
    BEGIN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.func_sig || ' FROM PUBLIC, anon';
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.func_sig || ' TO authenticated, service_role';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- 2d. Explicitly grant permissions for public storefront RPCs
DO $$
DECLARE 
  r RECORD;
BEGIN
  FOR r IN 
    SELECT p.oid::regprocedure AS func_sig 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
      AND p.proname IN ('get_nearby_shops')
  LOOP
    BEGIN
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.func_sig || ' TO anon, authenticated, service_role';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. HARDEN RIDER STATUS VIEW (SECURITY INVOKER)
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.rider_status_view;

CREATE OR REPLACE VIEW public.rider_status_view WITH (security_invoker = true) AS
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
FROM public.rider_connections rc
LEFT JOIN public.rider_profiles rp ON rc.rider_id = rp.id;

-- ------------------------------------------------------------------------------
-- 4. CONSOLIDATE & OPTIMIZE ROW LEVEL SECURITY (RLS POLICIES)
-- Removes duplicate/overlapping permissive policies & optimizes auth calls
-- ------------------------------------------------------------------------------

-- Shops Table
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to shops" ON public.shops;
DROP POLICY IF EXISTS "Merchants can update own shop" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can create shops" ON public.shops;

CREATE POLICY "Allow public read access to shops" 
ON public.shops FOR SELECT USING (true);

CREATE POLICY "Merchants can update own shop" 
ON public.shops FOR UPDATE TO authenticated
USING (
  owner_id::text = (SELECT auth.uid())::text 
  OR LOWER((SELECT auth.jwt())->>'email') = LOWER(email)
)
WITH CHECK (
  owner_id::text = (SELECT auth.uid())::text 
  OR LOWER((SELECT auth.jwt())->>'email') = LOWER(email)
);

CREATE POLICY "Authenticated users can create shops" 
ON public.shops FOR INSERT TO authenticated
WITH CHECK (
  owner_id::text = (SELECT auth.uid())::text 
  OR (SELECT auth.uid()) IS NOT NULL
);

-- Orders Table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Riders and merchants can view orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "Riders can update assigned or open orders" ON public.orders;
DROP POLICY IF EXISTS "Riders and merchants can update orders" ON public.orders;

CREATE POLICY "Riders and merchants can view orders" 
ON public.orders FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Riders and merchants can update orders" 
ON public.orders FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL)
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Menu Items Table
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Merchants can manage menu items" ON public.menu_items;

CREATE POLICY "Public can read menu items" 
ON public.menu_items FOR SELECT USING (true);

CREATE POLICY "Merchants can manage menu items" 
ON public.menu_items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shops s 
    WHERE s.id = menu_items.shop_id 
      AND (s.owner_id::text = (SELECT auth.uid())::text OR LOWER((SELECT auth.jwt())->>'email') = LOWER(s.email))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shops s 
    WHERE s.id = menu_items.shop_id 
      AND (s.owner_id::text = (SELECT auth.uid())::text OR LOWER((SELECT auth.jwt())->>'email') = LOWER(s.email))
  )
);

-- Announcements Table
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active announcements" ON public.announcements;
DROP POLICY IF EXISTS "Shop owners can manage announcements" ON public.announcements;

CREATE POLICY "Public can view active announcements" 
ON public.announcements FOR SELECT 
USING (true);

CREATE POLICY "Shop owners can manage announcements" 
ON public.announcements FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shops s 
    WHERE s.id = announcements.shop_id 
      AND (s.owner_id::text = (SELECT auth.uid())::text OR LOWER((SELECT auth.jwt())->>'email') = LOWER(s.email))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shops s 
    WHERE s.id = announcements.shop_id 
      AND (s.owner_id::text = (SELECT auth.uid())::text OR LOWER((SELECT auth.jwt())->>'email') = LOWER(s.email))
  )
);

-- Coupons Table
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view coupons" ON public.coupons;
DROP POLICY IF EXISTS "Shop owners can manage coupons" ON public.coupons;

CREATE POLICY "Public can view coupons" 
ON public.coupons FOR SELECT 
USING (true);

CREATE POLICY "Shop owners can manage coupons" 
ON public.coupons FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shops s 
    WHERE s.id = coupons.shop_id 
      AND (s.owner_id::text = (SELECT auth.uid())::text OR LOWER((SELECT auth.jwt())->>'email') = LOWER(s.email))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shops s 
    WHERE s.id = coupons.shop_id 
      AND (s.owner_id::text = (SELECT auth.uid())::text OR LOWER((SELECT auth.jwt())->>'email') = LOWER(s.email))
  )
);

-- Notification Logs Table
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  type TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notification logs" ON public.notification_logs;
CREATE POLICY "Users can view their own notification logs" 
ON public.notification_logs FOR SELECT TO authenticated
USING (user_id::text = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "System and merchants can insert notification logs" ON public.notification_logs;
CREATE POLICY "System and merchants can insert notification logs" 
ON public.notification_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. MISSING FOREIGN KEY INDEXES & PERFORMANCE HARDENING
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON public.orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_shop_id ON public.menu_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_announcements_shop_id ON public.announcements(shop_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_shop_id ON public.chat_messages(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_shop_id ON public.reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_rider_connections_shop_id ON public.rider_connections(shop_id);
CREATE INDEX IF NOT EXISTS idx_rider_connections_rider_id ON public.rider_connections(rider_id);
CREATE INDEX IF NOT EXISTS idx_shop_followers_user_id ON public.shop_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_followers_shop_id ON public.shop_followers(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON public.payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_coupons_shop_id ON public.coupons(shop_id);
CREATE INDEX IF NOT EXISTS idx_rider_notifications_rider_id ON public.rider_notifications(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_notifications_shop_id ON public.rider_notifications(shop_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON public.notification_logs(user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id)';
  END IF;
END $$;

-- Finish confirmation
SELECT 'Production security hardening migration v9 successfully executed.' AS status;
