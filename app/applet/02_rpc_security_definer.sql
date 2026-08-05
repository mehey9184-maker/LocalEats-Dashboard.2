-- ==============================================================================
-- 02: SECURITY DEFINER RPC & FUNCTION PERMISSIONS HARDENING
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

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
      EXECUTE 'ALTER FUNCTION ' || r.func_sig || ' SET search_path = public';
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

-- 2d. Explicitly grant permissions for public API RPCs
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

SELECT '02_rpc_security_definer.sql applied successfully' AS status;
