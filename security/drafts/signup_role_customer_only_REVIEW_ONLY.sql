-- REVIEW ONLY: DO NOT APPLY TO LIVE SUPABASE WITHOUT SEPARATE APPROVAL.
-- Source precondition matches inspected production on November 6, 2026.
-- This file belongs under security/drafts, never automatic migrations.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='15s';

DO $preflight$
DECLARE
 fn oid := to_regprocedure('public.handle_new_user()');
 expected_grantees text[] := ARRAY['PUBLIC','anon','authenticated','postgres','service_role'];
BEGIN
 IF fn IS NULL THEN
   RAISE EXCEPTION 'SIGNUP_ROLE_REVIEW_FUNCTION_MISSING';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_proc p
   WHERE p.oid=fn AND p.prosecdef AND p.proconfig IS NULL
     AND p.proowner='postgres'::regrole AND p.prorettype='trigger'::regtype
     AND encode(sha256(convert_to(regexp_replace(replace(p.prosrc, E'\r\n', E'\n'), E'[ \t]+(?=\n)', '', 'g'), 'UTF8')), 'hex')
         = 'c66b32834618c45eaec3429556e405115ce57dc38bc8a30698605b83d70d42f7'
     AND (SELECT array_agg(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END ORDER BY
                 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END COLLATE "C")
          FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          WHERE a.privilege_type='EXECUTE') = expected_grantees
     AND NOT EXISTS (
          SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          WHERE a.privilege_type='EXECUTE' AND a.is_grantable AND a.grantee<>p.proowner)
 )
 OR NOT EXISTS (
   SELECT 1 FROM pg_trigger
   WHERE tgfoid=fn AND tgrelid=to_regclass('auth.users')
     AND tgname='on_auth_user_created' AND tgenabled='O' AND tgtype=5
     AND NOT tgisinternal AND tgnargs=0 AND tgqual IS NULL
 )
 OR (SELECT count(*) FROM pg_trigger WHERE tgfoid=fn) <> 1
 THEN
   RAISE EXCEPTION 'SIGNUP_ROLE_REVIEW_SCHEMA_DRIFT';
 END IF;
END $preflight$;

-- Default role is invariant, independent of caller-editable raw_user_meta_data.
-- A merchant/admin/rider role must be granted only by a verified server-side
-- approval process. Do not make signup role adjustable in a client form.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $handler$
BEGIN
  INSERT INTO public.profiles (
    user_id, "fullName", email, phone, role, city, country, updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'fullName',
             split_part(NEW.email,'@',1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone',''),
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
$handler$;

-- Trigger functions must not also be exposed as a general RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;

DO $assert$
DECLARE f text;
BEGIN
 SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure) INTO f;
 IF position('''customer''' in f)=0 OR position('raw_user_meta_data->>''role''' in f)>0
    OR NOT EXISTS (select 1 from pg_trigger where tgname='on_auth_user_created'
      and tgfoid='public.handle_new_user()'::regprocedure and not tgisinternal)
    OR has_function_privilege('anon','public.handle_new_user()','EXECUTE')
    OR has_function_privilege('authenticated','public.handle_new_user()','EXECUTE')
    OR NOT has_function_privilege('service_role','public.handle_new_user()','EXECUTE')
 THEN RAISE EXCEPTION 'SIGNUP_ROLE_REVIEW_POSTCONDITION_FAILED';
 END IF;
END $assert$;
COMMIT;
