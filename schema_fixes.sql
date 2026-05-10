-- 1. Rider Profiles columns
ALTER TABLE public.rider_profiles 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'paused', 'busy')),
  ADD COLUMN IF NOT EXISTS current_latitude double precision,
  ADD COLUMN IF NOT EXISTS current_longitude double precision;

-- If 'is_online' does not exist, add it
ALTER TABLE public.rider_profiles
  ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;

-- 2. Orders table Policies
-- First, drop existing policies that might conflict
DROP POLICY IF EXISTS "Riders can update their assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Riders can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Riders can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Riders can view delivery missions" ON public.orders;

-- Now create robust policies:

-- All authenticated users can view orders (Since riders need to see available missions, merchants need to see shop orders, etc.)
-- Note: You might want to restrict this further based on your app's security model, 
-- but this guarantees riders can view missions to accept.
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
CREATE POLICY "Anyone can view orders" 
  ON public.orders FOR SELECT 
  USING ( auth.uid() IS NOT NULL );

-- Riders can update their assigned orders, OR they can update if they are accepting the order
CREATE POLICY "Riders can update their assigned orders"
  ON public.orders FOR UPDATE
  USING ( auth.uid() IS NOT NULL ) -- Condition for row selection
  WITH CHECK ( 
    -- Condition for new row validation
    rider_id = auth.uid() OR rider_id IS NULL
  );

-- To fix the 'customer_id' issue - the code uses 'user_id', so ensure that any policy 
-- referring to 'customer_id' is deleted or replaced with 'user_id'.
DROP POLICY IF EXISTS "Customers can see their own orders" ON public.orders;
CREATE POLICY "Customers can see their own orders"
  ON public.orders FOR SELECT
  USING ( user_id = auth.uid() );

-- Ensure inserting orders uses 'user_id'
DROP POLICY IF EXISTS "Customers can insert their own orders" ON public.orders;
CREATE POLICY "Customers can insert their own orders"
  ON public.orders FOR INSERT
  WITH CHECK ( user_id = auth.uid() );
