-- ==============================================================================
-- 03: RIDER STATUS VIEW (SECURITY INVOKER)
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

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

SELECT '03_rider_status_view.sql applied successfully' AS status;
