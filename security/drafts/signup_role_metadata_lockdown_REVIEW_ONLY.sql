-- REVIEW-ONLY: LocalEats signup trigger role hardening.
-- Do not apply to Production without explicit owner approval, fresh encrypted
-- backup, independently verified restore, and rechecked dependency inventory.
-- This file is intentionally OUTSIDE supabase/migrations.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $preflight$
DECLARE fn oid; body text;
BEGIN
 SELECT oid,pg_get_functiondef(oid) INTO fn,body
   FROM pg_proc WHERE oid=to_regprocedure('public.handle_new_user()');
 IF fn IS NULL THEN RAISE EXCEPTION 'SIGNUP_REVIEW_DRIFT: function missing'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_proc
    WHERE oid=fn AND prosecdef=true AND proconfig IS NULL
 ) THEN RAISE EXCEPTION 'SIGNUP_REVIEW_DRIFT: function security changed'; END IF;
 IF position('raw_user_meta_data->>''role''' IN body)=0
    OR position('ON CONFLICT (user_id)' IN body)=0 THEN
   RAISE EXCEPTION 'SIGNUP_REVIEW_DRIFT: current function does not match vulnerable baseline';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM pg_trigger t
   WHERE t.tgname='on_auth_user_created'
     AND t.tgrelid='auth.users'::regclass
     AND t.tgfoid=fn AND NOT t.tgisinternal AND t.tgenabled='O'
 ) THEN RAISE EXCEPTION 'SIGNUP_REVIEW_DRIFT: auth.users signup trigger missing'; END IF;
 IF to_regclass('public.profiles') IS NULL THEN
   RAISE EXCEPTION 'SIGNUP_REVIEW_DRIFT: profiles table missing';
 END IF;
END $preflight$;

-- Customer role is SERVER-OWNED. raw_user_meta_data is user-editable and
-- may supply display name/phone but never merchant/admin/rider authority.
-- The pre-existing conflict clause deliberately preserves existing roles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $secure_signup$
BEGIN
    INSERT INTO public.profiles (
        user_id, "fullName", email, phone, role, city, country, updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(trim(NEW.raw_user_meta_data->>'full_name'),''),
            NULLIF(trim(NEW.raw_user_meta_data->>'fullName'),''),
            split_part(NEW.email, '@', 1)
        ),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        'customer',
        'Johannesburg',
        'South Africa',
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        "fullName" = COALESCE(public.profiles."fullName", EXCLUDED."fullName"),
        updated_at = NOW();
    RETURN NEW;
END;
$secure_signup$;

-- Trigger execution is retained. Standalone PUBLIC RPC calls are not needed.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

DO $assert$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure) INTO src;
 IF position('raw_user_meta_data->>''role''' IN src) > 0
   OR position('''customer''' IN src)=0 THEN
  RAISE EXCEPTION 'SIGNUP_POSTCONDITION_FAILED: role remains user-selected';
 END IF;
 IF has_function_privilege('anon','public.handle_new_user()','EXECUTE')
   OR has_function_privilege('authenticated','public.handle_new_user()','EXECUTE')
   OR NOT has_function_privilege('service_role','public.handle_new_user()','EXECUTE') THEN
  RAISE EXCEPTION 'SIGNUP_POSTCONDITION_FAILED: invalid RPC privileges';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM pg_proc
   WHERE oid='public.handle_new_user()'::regprocedure
     AND prosecdef AND 'search_path=pg_catalog, public'=ANY(proconfig)
 ) THEN RAISE EXCEPTION 'SIGNUP_POSTCONDITION_FAILED: search_path not fixed'; END IF;
END $assert$;
COMMIT;
