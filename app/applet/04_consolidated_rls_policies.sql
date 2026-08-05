-- ==============================================================================
-- 04: CONSOLIDATED & OPTIMIZED ROW LEVEL SECURITY (RLS POLICIES)
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

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

SELECT '04_consolidated_rls_policies.sql applied successfully' AS status;
