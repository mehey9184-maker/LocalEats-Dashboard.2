-- R3.5 payment-contract PRE-E2E, synthetic PostgreSQL 17 only.
\set ON_ERROR_STOP on

DO $r35pre$
DECLARE name text; expected text; actual text;
BEGIN
 FOR name,expected IN SELECT * FROM (VALUES
   ('pickup_payment_method_guard','adcd87f7cb49525cd18876c8b2cd057a'),
   ('merchant_set_pickup_payment_methods','149d5a7fbe51f29561800479b1c2ca2c')
 ) v(function_name,expected_canonical_md5)
 LOOP
   SELECT md5(regexp_replace(btrim(p.prosrc),'[[:space:]]+',' ','g'))
     INTO actual
   FROM pg_catalog.pg_proc p
   JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname=name;
   IF actual IS DISTINCT FROM expected
   THEN RAISE EXCEPTION 'R35_EFFECTIVE_PAYMENT_SOURCE_DRIFT:% expected=% got=%',
     name,expected,actual; END IF;
 END LOOP;
 IF (SELECT pg_catalog.format_type(a.atttypid,a.atttypmod)
   FROM pg_catalog.pg_attribute a WHERE a.attrelid='public.shops'::regclass
   AND a.attname='pickup_payment_methods') IS DISTINCT FROM 'text[]'
 THEN RAISE EXCEPTION 'R35_PAYMENT_COLUMN_MISSING'; END IF;
 IF (SELECT convalidated FROM pg_catalog.pg_constraint
    WHERE conrelid='public.shops'::regclass
      AND conname='shops_pickup_payment_methods_valid') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'R35_OBSERVED_NOT_VALID_CHECK_DRIFT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid='public.orders'::regclass
    AND t.tgname='pickup_payment_method_before_insert' AND t.tgenabled='O')
 THEN RAISE EXCEPTION 'R35_INSERT_GUARD_MISSING'; END IF;
 IF has_function_privilege('anon','public.pickup_payment_method_guard()','EXECUTE')
  OR has_function_privilege('authenticated',
       'public.merchant_set_pickup_payment_methods(text,text,text[],text[])','EXECUTE')
  OR EXISTS(
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('pickup_payment_method_guard','merchant_set_pickup_payment_methods')
      AND p.prosecdef)
 THEN RAISE EXCEPTION 'R35_UNSAFE_PAYMENT_FUNCTION_ACCESS'; END IF;

 -- The merchant must configure accepted payment methods before ANY new
 -- pickup order succeeds, while the old order path remains otherwise unchanged.
 BEGIN
   PERFORM public.pickup_create_order('fake-customer',repeat('a',64),
     r34_fixture.make_record('00000000-0000-4000-8000-000000009001'::uuid));
   RAISE EXCEPTION 'R35_MISSING_PAYMENT_CONFIGURATION_ALLOWED_ORDER';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%PAYMENT_METHOD_CONFIGURATION_UNAVAILABLE%' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.orders)
 THEN RAISE EXCEPTION 'R35_FAILED_PAYMENT_VALIDATION_LEFT_ORDER'; END IF;

 BEGIN
   PERFORM public.merchant_set_pickup_payment_methods('forged-merchant',
    'my-kota-synthetic',ARRAY['cash'],NULL);
   RAISE EXCEPTION 'R35_FORGED_MERCHANT_SET_METHODS';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%FORBIDDEN%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.merchant_set_pickup_payment_methods('synthetic-merchant',
    'my-kota-synthetic',ARRAY['online_card'],NULL);
   RAISE EXCEPTION 'R35_UNSUPPORTED_METHOD_CONFIGURED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%INVALID_PAYMENT_METHODS%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.merchant_set_pickup_payment_methods('synthetic-merchant',
    'my-kota-synthetic',ARRAY['cash','cash'],NULL);
   RAISE EXCEPTION 'R35_DUPLICATE_METHODS_CONFIGURED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%INVALID_PAYMENT_METHODS%' THEN RAISE; END IF;
 END;
 -- This is a synthetic shop only; no remote shop settings are changed.
 PERFORM public.merchant_set_pickup_payment_methods('synthetic-merchant',
    'my-kota-synthetic',ARRAY['cash','card_machine'],NULL);
 IF (SELECT pickup_payment_methods FROM public.shops
   WHERE id='my-kota-synthetic') IS DISTINCT FROM ARRAY['cash','card_machine']::text[]
 THEN RAISE EXCEPTION 'R35_MERCHANT_METHOD_SETUP_FAILED'; END IF;
 BEGIN
   PERFORM public.merchant_set_pickup_payment_methods('synthetic-merchant',
     'my-kota-synthetic',ARRAY['cash'],NULL);
   RAISE EXCEPTION 'R35_STALE_METHODS_WRITE_SUCCEEDED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%PAYMENT_METHODS_CHANGED%' THEN RAISE; END IF;
 END;
END;
$r35pre$;
\echo R35_EFFECTIVE_PAYMENT_METHODS_PRECHECK_PASS
