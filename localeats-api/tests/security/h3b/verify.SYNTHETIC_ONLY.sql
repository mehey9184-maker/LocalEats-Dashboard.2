-- Runs only after review draft in synthetic PostgreSQL.
\set ON_ERROR_STOP on
CREATE FUNCTION pg_temp.expect_denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
 RAISE EXCEPTION 'H3B_EXPECTED_PERMISSION_DENIED: %',statement;
END $$;
DO $test$
DECLARE target text; actor text; p text;
BEGIN
 FOREACH actor IN ARRAY ARRAY['anon','authenticated'] LOOP
  EXECUTE format('SET LOCAL ROLE %I',actor);
  FOREACH target IN ARRAY ARRAY['shops','menu_items','reviews','announcements'] LOOP
   PERFORM pg_temp.expect_denied(format('SELECT * FROM public.%I',target));
   PERFORM pg_temp.expect_denied(format('INSERT INTO public.%I DEFAULT VALUES',target));
   PERFORM pg_temp.expect_denied(format('UPDATE public.%I SET id=id',target));
   PERFORM pg_temp.expect_denied(format('DELETE FROM public.%I',target));
   PERFORM pg_temp.expect_denied(format('TRUNCATE public.%I',target));
  END LOOP;
  PERFORM pg_temp.expect_denied('SELECT owner_id,approval_reason FROM public.shops');
  PERFORM pg_temp.expect_denied('SELECT order_id FROM public.reviews');
  PERFORM pg_temp.expect_denied('UPDATE public.shops SET is_active=true');
  PERFORM pg_temp.expect_denied('SELECT * FROM public.shops_with_availability');
  RESET ROLE;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid IN ('public.shops'::regclass,'public.menu_items'::regclass,'public.reviews'::regclass,'public.announcements'::regclass)) THEN
  RAISE EXCEPTION 'H3B_POLICY_NOT_REMOVED'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE oid IN ('public.shops'::regclass,'public.menu_items'::regclass,'public.reviews'::regclass,'public.announcements'::regclass) AND relrowsecurity)<>4 THEN
  RAISE EXCEPTION 'H3B_RLS_REMOVED'; END IF;
END $test$;
BEGIN;
SET LOCAL ROLE service_role;
DO $service$
BEGIN
 IF (SELECT count(*) FROM shops_with_availability WHERE approval_status='approved' AND archived_at IS NULL)<>1 THEN RAISE EXCEPTION 'H3B_PUBLIC_CATALOG_FILTER_FAILED'; END IF;
 IF (SELECT name FROM shops_with_availability WHERE id='approved' AND NOT effective_is_active)<>'Public shop' THEN RAISE EXCEPTION 'H3B_CLOSED_SHOP_BROWSE_FAILED'; END IF;
 IF (SELECT price FROM menu_items WHERE shop_id='approved')<>25 THEN RAISE EXCEPTION 'H3B_MENU_READ_FAILED'; END IF;
 IF (SELECT owner_id FROM shops WHERE id='approved')<>'fake-owner' THEN RAISE EXCEPTION 'H3B_MERCHANT_OWNER_READ_FAILED'; END IF;
 INSERT INTO menu_items VALUES ('new','approved','Synthetic new meal',20,true);
 UPDATE menu_items SET price=22 WHERE id='new';
 IF (SELECT price FROM menu_items WHERE id='new')<>22 THEN RAISE EXCEPTION 'H3B_SERVICE_UPDATE_FAILED'; END IF;
 DELETE FROM menu_items WHERE id='new';
 IF EXISTS(SELECT 1 FROM menu_items WHERE id='new') THEN RAISE EXCEPTION 'H3B_SERVICE_DELETE_FAILED'; END IF;
 IF (SELECT count(*) FROM reviews)<>1 OR (SELECT count(*) FROM announcements)<>1 THEN RAISE EXCEPTION 'H3B_SERVER_READ_FAILED'; END IF;
END $service$;
ROLLBACK;
\echo H3B_LEAST_PRIVILEGE_ROLE_ASSERTIONS_PASS
