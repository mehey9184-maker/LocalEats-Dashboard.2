-- Disposable PostgreSQL 17 only. The real staging Supabase project is
-- NEVER a target. This is a synthetic P5 compatibility + pickup rehearsal.

-- Remove only the explicitly INSECURE synthetic legacy browser order policy
-- supplied by the existing historical pickup test fixture. Future connected
-- staging schema must be secure from inception; this is NOT a deployable DDL.
DROP POLICY legacy_browser ON public.orders;
REVOKE ALL ON public.orders FROM PUBLIC,anon,authenticated;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops FORCE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.shops,public.menu_items,public.rider_profiles FROM PUBLIC,anon,authenticated;

INSERT INTO public.admin_users(firebase_uid,role,is_active)
VALUES ('synthetic-stage-admin','super_admin',true);

UPDATE public.shops
  SET approval_status='pending',is_active=false,location='Pretoria',approval_reason=null
WHERE id='shop';

DO $check$
DECLARE last_fingerprint text;
BEGIN
 SELECT signature INTO last_fingerprint FROM test_support.profile_contract_baseline LIMIT 1;
 IF last_fingerprint IS DISTINCT FROM test_support.p5_signature()
    OR (SELECT count(*) FROM public.profiles)<>1
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id='synthetic-stage-customer-a'
                   AND role='customer' AND "fullName"='Synthetic P5 Account')
 THEN RAISE EXCEPTION 'P5_PROFILE_CONTRACT_WAS_CHANGED'; END IF;

 IF has_table_privilege('anon','public.profiles','SELECT')
    OR has_table_privilege('authenticated','public.profiles','UPDATE')
    OR NOT has_table_privilege('service_role','public.profiles','SELECT')
    OR NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
            WHERE oid='public.profiles'::regclass)
 THEN RAISE EXCEPTION 'P5_PROFILE_SECURITY_WAS_CHANGED'; END IF;

 IF has_table_privilege('anon','public.orders','SELECT')
    OR has_table_privilege('authenticated','public.orders','INSERT')
    OR has_table_privilege('authenticated','public.shops','UPDATE')
    OR has_table_privilege('anon','public.admin_users','SELECT')
    OR has_table_privilege('authenticated','public.pickup_order_events','INSERT')
    OR has_function_privilege('anon','public.transition_shop_approval(text,text,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.pickup_create_order(text,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'STAGING_BROWSER_ACCESS_NOT_CLOSED'; END IF;

 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.orders'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.shops'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.menu_items'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.shop_approval_events'::regclass)
 THEN RAISE EXCEPTION 'STAGING_MISSING_RLS'; END IF;

 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('profiles','orders','shops','menu_items','rider_profiles')
    AND (qual='true' OR with_check='true'))
 THEN RAISE EXCEPTION 'STAGING_PERMISSIVE_BROWSER_RLS_POLICY'; END IF;
END $check$;

SET ROLE service_role;

DO $journey$
DECLARE r jsonb;
  rev bigint;
  k uuid;
  rec jsonb;
  result jsonb;
  replay jsonb;
  err text;
BEGIN
 -- Super Admin is the trusted actor. Approval leaves merchant CLOSED.
 r := to_jsonb(public.transition_shop_approval('shop','approve','pending','synthetic-stage-admin'));
 IF r->>'approval_status' <> 'approved' OR (r->>'is_active')::boolean
 THEN RAISE EXCEPTION 'STAGING_APPROVAL_AUTO_OPENED_SHOP'; END IF;

 -- Cross-town merchant is still in radius; merchant must open it explicitly
 -- with a fresh expected availability revision.
 SELECT availability_revision INTO rev FROM public.shops WHERE id='shop';
 r := public.merchant_set_availability('merchant','shop',true,true,rev);
 IF NOT (r->>'is_active')::boolean OR NOT (r->>'effective_is_active')::boolean
 THEN RAISE EXCEPTION 'STAGING_MERCHANT_OPEN_FAILED'; END IF;

 k := gen_random_uuid();
 rec := jsonb_build_object(
    'shop_id','shop',
    'idempotency_key',k::text,
    'launch_location',jsonb_build_object('lat',-26.0,'lng',28.0),
    'items',jsonb_build_array(jsonb_build_object(
      'menu_item_id','item','quantity',1,'name','Fixture meal',
      'unit_price',25,'line_total',25)),
    'price',25,'service_fee',0,'total_price',25,
    'payment_method','cash',
    'customer_name','Synthetic Account','phone','0000000000',
    'product_name','Fixture meal');
 result := public.pickup_create_order('synthetic-stage-customer-a',repeat('a',64),rec);
 IF result->>'replayed' <> 'false'
    OR result->'order'->>'user_id' <> 'synthetic-stage-customer-a'
    OR result->'order'->>'delivery_type' <> 'collection'
    OR result->'order'->>'delivery_status' <> 'none'
    OR (result->'order'->>'total_price')::numeric <> 25
 THEN RAISE EXCEPTION 'STAGING_CROSS_TOWN_PICKUP_RESULT_BAD'; END IF;

 replay := public.pickup_create_order('synthetic-stage-customer-a',repeat('a',64),rec);
 IF replay->>'replayed' <> 'true'
    OR replay->'order'->>'id' IS DISTINCT FROM result->'order'->>'id'
 THEN RAISE EXCEPTION 'STAGING_IDEMPOTENCY_REPLAY_BAD'; END IF;

 BEGIN
   PERFORM public.pickup_create_order('synthetic-stage-customer-b',repeat('a',64),rec);
   RAISE EXCEPTION 'STAGING_ACCOUNT_B_TAKES_ACCOUNT_A_KEY';
 EXCEPTION WHEN raise_exception THEN
   GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
   IF err <> 'IDEMPOTENCY_CONFLICT' THEN RAISE; END IF;
 END;

 SELECT availability_revision INTO rev FROM public.shops WHERE id='shop';
 r := public.merchant_set_availability('merchant','shop',false,false,rev);
 IF (r->>'effective_is_active')::boolean
 THEN RAISE EXCEPTION 'STAGING_MERCHANT_CLOSE_FAILED'; END IF;

 rec := jsonb_set(rec,'{idempotency_key}',to_jsonb(gen_random_uuid()::text));
 BEGIN
   PERFORM public.pickup_create_order('synthetic-stage-customer-a',repeat('a',64),rec);
   RAISE EXCEPTION 'STAGING_CLOSED_SHOP_CREATED_ORDER';
 EXCEPTION WHEN raise_exception THEN
   GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
   IF err <> 'SHOP_UNAVAILABLE' THEN RAISE; END IF;
 END;
END $journey$;
RESET ROLE;

DO $final$
BEGIN
 IF (SELECT count(*) FROM public.orders WHERE create_intent_hash IS NOT NULL) <> 1
    OR (SELECT count(*) FROM public.pickup_order_events WHERE kind='created') <> 1
    OR (SELECT count(*) FROM public.shop_approval_events WHERE acted_by='synthetic-stage-admin')<>1
 THEN RAISE EXCEPTION 'STAGING_SYNTHETIC_ORDER_EVENT_OR_AUDIT_COUNT_BAD'; END IF;

 IF (SELECT count(*) FROM public.profiles)<>1
    OR test_support.p5_signature() IS DISTINCT FROM
        (SELECT signature FROM test_support.profile_contract_baseline LIMIT 1)
 THEN RAISE EXCEPTION 'STAGING_PROFILE_CHANGED_AFTER_PICKUP'; END IF;

 IF EXISTS (SELECT 1 FROM public.orders
   WHERE create_intent_hash IS NOT NULL AND
   (rider_id IS NOT NULL OR delivery_fee IS DISTINCT FROM 0
    OR payment_status IS DISTINCT FROM 'unpaid'))
 THEN RAISE EXCEPTION 'STAGING_SYNTHETIC_ORDER_HAS_DELIVERY_OR_PAYMENT'; END IF;
END $final$;

SELECT 'STAGING_P5_PROFILE_PRESERVED_PICKUP_PG17_PASS' AS result;
