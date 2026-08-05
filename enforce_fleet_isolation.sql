-- 1. DROP CONFLICTING "SIDE DOOR" RLS POLICIES ON ORDERS
DROP POLICY IF EXISTS "Riders can view missions assigned or available orders" ON public.orders;
DROP POLICY IF EXISTS "Riders can view unassigned live missions" ON public.orders;

-- 2. CREATE THE SINGLE TRUTH ISOLATION POLICY ON ORDERS
-- This guarantees a rider can ONLY see an order if:
-- A) They are already assigned to it (rider_id = auth.uid()) OR
-- B) They are actively paired to the shop that created the order
DROP POLICY IF EXISTS "Strict Isolated Rider Dispatch" ON public.orders;
CREATE POLICY "Strict Isolated Rider Dispatch" ON public.orders
FOR SELECT
TO authenticated
USING (
    (rider_id = auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.rider_connections
        WHERE rider_connections.shop_id = orders.shop_id
        AND rider_connections.rider_id = auth.uid()
        AND rider_connections.status = 'active'
        AND rider_connections.expires_at > now()
    )
);

-- 3. SECURE THE PAIRING TABLE (rider_connections)
-- Drop the completely open policies that allow anyone to manipulate links
DROP POLICY IF EXISTS "Public Insert Connections" ON public.rider_connections;
DROP POLICY IF EXISTS "Public Update Connections" ON public.rider_connections;
DROP POLICY IF EXISTS "Public Delete Connections" ON public.rider_connections;
DROP POLICY IF EXISTS "Public Select Connections" ON public.rider_connections;

-- Allow merchants to see/manage connections for their own shops
CREATE POLICY "Merchants manage their shop connections" ON public.rider_connections
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shops 
    WHERE shops.id = rider_connections.shop_id 
    AND shops.owner_id = auth.uid()
  )
);

-- Allow riders to claim an unassigned connection code
CREATE POLICY "Riders can claim pairing codes" ON public.rider_connections
FOR UPDATE
TO authenticated
USING (rider_id IS NULL AND connection_code IS NOT NULL)
WITH CHECK (rider_id = auth.uid());

-- Allow riders to view connections assigned to them
CREATE POLICY "Riders can view their own connections" ON public.rider_connections
FOR SELECT
TO authenticated
USING (rider_id = auth.uid());
