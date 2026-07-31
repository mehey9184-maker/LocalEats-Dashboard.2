-- ==============================================================================
-- LOCAL EATS RLS & REMOTE ERROR LOGGING FIXES
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Create Remote App Errors & Logs Tables (for remote debugging)
CREATE TABLE IF NOT EXISTS public.app_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  context TEXT,
  message TEXT,
  exception TEXT,
  code TEXT,
  details TEXT,
  user_agent TEXT,
  page_url TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert app_errors" ON public.app_errors;
CREATE POLICY "Anyone can insert app_errors"
ON public.app_errors FOR INSERT
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can view app_errors" ON public.app_errors;
CREATE POLICY "Authenticated can view app_errors"
ON public.app_errors FOR SELECT
TO authenticated
USING (true);

CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  context TEXT,
  message TEXT,
  code TEXT,
  details TEXT,
  user_agent TEXT,
  page_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can insert error logs" ON public.app_error_logs;
CREATE POLICY "Anyone authenticated can insert error logs"
ON public.app_error_logs FOR INSERT
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Only authenticated users can view error logs" ON public.app_error_logs;
CREATE POLICY "Only authenticated users can view error logs"
ON public.app_error_logs FOR SELECT
TO authenticated
USING (true);

-- 2. Fix rider_profiles RLS
ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;

-- Drop all potentially conflicting policies to avoid ERROR: 42710
DROP POLICY IF EXISTS "Allow public select on rider_profiles" ON public.rider_profiles;
DROP POLICY IF EXISTS "Anyone can view online riders" ON public.rider_profiles;
DROP POLICY IF EXISTS "Riders can view own profile" ON public.rider_profiles;
DROP POLICY IF EXISTS "Riders can update own profile" ON public.rider_profiles;
DROP POLICY IF EXISTS "Riders can insert own profile" ON public.rider_profiles;
DROP POLICY IF EXISTS "Riders can manage their own profiles" ON public.rider_profiles;
DROP POLICY IF EXISTS "Merchants can view connected riders profiles" ON public.rider_profiles;

-- Create singular, correct policies for rider_profiles
CREATE POLICY "Riders can view own profile" 
ON public.rider_profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Riders can update own profile" 
ON public.rider_profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Riders can insert own profile" 
ON public.rider_profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Merchants can view connected riders profiles" 
ON public.rider_profiles FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.rider_connections rc
    JOIN public.shops s ON s.id = rc.shop_id
    WHERE rc.rider_id = rider_profiles.id 
      AND s.owner_id = auth.uid()
  )
);

-- 3. Fix rider_notifications RLS
ALTER TABLE public.rider_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders can view own notifications" ON public.rider_notifications;
DROP POLICY IF EXISTS "Riders can update own notifications" ON public.rider_notifications;
DROP POLICY IF EXISTS "Merchants can insert notifications for connected riders" ON public.rider_notifications;

CREATE POLICY "Riders can view own notifications" 
ON public.rider_notifications FOR SELECT 
TO authenticated 
USING (rider_id = auth.uid());

CREATE POLICY "Riders can update own notifications" 
ON public.rider_notifications FOR UPDATE 
TO authenticated 
USING (rider_id = auth.uid());

CREATE POLICY "Merchants can insert notifications for connected riders" 
ON public.rider_notifications FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rider_connections rc
    JOIN public.shops s ON s.id = rc.shop_id
    WHERE rc.rider_id = rider_notifications.rider_id 
      AND rc.shop_id = rider_notifications.shop_id
      AND s.owner_id = auth.uid()
  )
);

-- 4. Fix rider_locations RLS
ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read rider locations" ON public.rider_locations;
DROP POLICY IF EXISTS "Riders can view own location" ON public.rider_locations;
DROP POLICY IF EXISTS "Riders can update their own location" ON public.rider_locations;
DROP POLICY IF EXISTS "Riders can insert their own location" ON public.rider_locations;
DROP POLICY IF EXISTS "Merchants can view connected riders locations" ON public.rider_locations;

CREATE POLICY "Riders can view own location" 
ON public.rider_locations FOR SELECT 
TO authenticated 
USING (rider_id = auth.uid());

CREATE POLICY "Riders can insert their own location" 
ON public.rider_locations FOR INSERT 
TO authenticated 
WITH CHECK (rider_id = auth.uid());

CREATE POLICY "Riders can update their own location" 
ON public.rider_locations FOR UPDATE 
TO authenticated 
USING (rider_id = auth.uid());

CREATE POLICY "Merchants can view connected riders locations" 
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

NOTIFY pgrst, 'reload schema';
