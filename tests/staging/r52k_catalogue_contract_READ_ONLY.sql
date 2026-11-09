-- R5.2K CONTRACT VERIFICATION (READ-ONLY).
-- Only run after loading the R5.2K draft migration and optional fixture in a
-- DISPOSABLE local PostgreSQL instance, or after separately approved staging setup.
-- This script never creates records or modifies the schema.

BEGIN;
DO $checks$
DECLARE
 missing text[];
 role_name text;
BEGIN
 IF to_regclass('public.shops') IS NULL OR
    to_regclass('public.menu_items') IS NULL OR
    to_regclass('public.shops_with_availability') IS NULL THEN
   RAISE EXCEPTION 'R52K_CATALOGUE_OBJECTS_MISSING';
 END IF;
 IF (SELECT relrowsecurity FROM pg_class WHERE oid='public.shops'::regclass) IS DISTINCT FROM true
    OR (SELECT relrowsecurity FROM pg_class WHERE oid='public.menu_items'::regclass) IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'R52K_TABLE_RLS_NOT_ENABLED';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.shops_with_availability'::regclass
     AND 'security_invoker=true'=ANY(reloptions)) THEN
   RAISE EXCEPTION 'R52K_VIEW_SECURITY_INVOKER_MISSING';
 END IF;
 SELECT array_agg(required.col) INTO missing
 FROM unnest(ARRAY[
   'effective_is_active','availability_revision','availability_override_until',
   'id','name','description','location','category','logo_url','rating',
   'opening_time','closing_time','is_active','latitude','longitude','lat','lng','story',
   'approval_status','archived_at'
 ]) AS required(col)
 WHERE NOT EXISTS (
   SELECT 1 FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='shops_with_availability'
     AND c.column_name=required.col
 );
 IF missing IS NOT NULL THEN
   RAISE EXCEPTION 'R52K_PUBLIC_CATALOGUE_COLUMNS_MISSING: %',missing;
 END IF;
 SELECT array_agg(required.col) INTO missing
 FROM unnest(ARRAY[
   'id','shop_id','name','price','description','image_url',
   'category','is_available','popularity_score','customizations','created_at'
 ]) AS required(col)
 WHERE NOT EXISTS (
   SELECT 1 FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='menu_items'
     AND c.column_name=required.col
 );
 IF missing IS NOT NULL THEN
   RAISE EXCEPTION 'R52K_PUBLIC_MENU_COLUMNS_MISSING: %',missing;
 END IF;
 IF EXISTS (
   SELECT 1 FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='shops_with_availability'
     AND c.column_name='owner_id'
 ) THEN
   RAISE EXCEPTION 'R52K_OWNER_PRIVATE_FIELD_EXPOSED_IN_VIEW';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
            AND tablename IN ('shops','menu_items')) THEN
   RAISE EXCEPTION 'R52K_UNEXPECTED_BROWSER_RLS_POLICY';
 END IF;
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF has_table_privilege(role_name,'public.shops','SELECT')
      OR has_table_privilege(role_name,'public.menu_items','SELECT')
      OR has_table_privilege(role_name,'public.shops_with_availability','SELECT') THEN
     RAISE EXCEPTION 'R52K_BROWSER_TABLE_ACCESS_ALLOWED: %',role_name;
   END IF;
   IF has_function_privilege(role_name,
      'public.shop_effective_open(public.shops,timestamptz)','EXECUTE') THEN
     RAISE EXCEPTION 'R52K_BROWSER_AVAILABILITY_FUNCTION_ACCESS_ALLOWED: %',role_name;
   END IF;
 END LOOP;
 IF NOT has_table_privilege('service_role','public.shops_with_availability','SELECT')
    OR NOT has_table_privilege('service_role','public.shops','SELECT')
    OR NOT has_table_privilege('service_role','public.menu_items','SELECT') THEN
   RAISE EXCEPTION 'R52K_SERVER_CATALOGUE_SELECT_UNAVAILABLE';
 END IF;
 IF EXISTS (SELECT 1 FROM public.menu_items WHERE price < 0 OR price > 9999.99)
    OR EXISTS (SELECT 1 FROM public.shops
      WHERE id NOT LIKE 'stg-test-shop-%' OR owner_id NOT LIKE 'stg-test-owner-%') THEN
   RAISE EXCEPTION 'R52K_INVALID_SYNTHETIC_ROW';
 END IF;
 RAISE NOTICE 'R52K_SCHEMA_RLS_AND_COLUMN_CONTRACT_PASSED';
END;
$checks$;

-- Requires a service_role with SELECT privileges and bypassrls, as in Supabase.
SET LOCAL ROLE service_role;
SELECT id, name, effective_is_active, availability_revision, lat, lng
  FROM public.shops_with_availability
  WHERE approval_status='approved' AND archived_at IS NULL
  ORDER BY id;
SELECT shop_id, id, name, price
  FROM public.menu_items ORDER BY id;
RESET ROLE;

DO $fixture_checks$
DECLARE
 c integer;
BEGIN
 SELECT count(*) INTO c FROM public.shops;
 IF c<>0 AND c<>5 THEN
   RAISE EXCEPTION 'R52K_FIXTURE_UNEXPECTED_ROW_COUNT: %',c;
 END IF;
 IF c=5 THEN
   IF (SELECT count(*) FROM public.shops_with_availability
       WHERE approval_status='approved' AND archived_at IS NULL) <> 3 THEN
     RAISE EXCEPTION 'R52K_SHOP_APPROVAL_ARCHIVE_FILTER_FAILED';
   END IF;
   IF NOT (SELECT public.shop_effective_open(s,
       '2026-11-09T11:00:00+02'::timestamptz)
       FROM public.shops s WHERE id='stg-test-shop-open') THEN
     RAISE EXCEPTION 'R52K_OPEN_SHOP_AVAILABILITY_FAILED';
   END IF;
   IF (SELECT public.shop_effective_open(s,
       '2026-11-09T11:00:00+02'::timestamptz)
       FROM public.shops s WHERE id='stg-test-shop-closed') THEN
     RAISE EXCEPTION 'R52K_CLOSED_SHOP_MUST_STAY_CLOSED';
   END IF;
   IF NOT EXISTS (SELECT 1 FROM public.menu_items
       WHERE shop_id='stg-test-shop-closed' AND price=25.00) THEN
     RAISE EXCEPTION 'R52K_CLOSED_SHOP_MENU_NOT_BROWSEABLE';
   END IF;
   IF (SELECT count(*) FROM public.menu_items)<>3 THEN
     RAISE EXCEPTION 'R52K_SYNTHETIC_MENU_COUNT_MISMATCH';
   END IF;
 END IF;
 RAISE NOTICE 'R52K_FIXTURE_READ_CHECKS_PASSED';
END;
$fixture_checks$;
ROLLBACK;
