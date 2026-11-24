-- Synthetic database only; all fixture changes rolled back.
\set ON_ERROR_STOP on
BEGIN;
DO $geo$
DECLARE
  shop text := 'my-kota-synthetic';
  label text; key uuid; record jsonb; answer jsonb; count_before bigint;
  patched boolean := position('OUTSIDE_PICKUP_PILOT' in (select prosrc from pg_proc where oid=to_regprocedure('public.pickup_create_order(text,text,jsonb)')))=0;
BEGIN
 SELECT count(*) INTO count_before FROM public.orders;
 IF count_before<>3 THEN RAISE EXCEPTION 'H2D1_GEOGRAPHY_REQUIRES_SYNTHETIC_BASELINE'; END IF;
 IF NOT patched THEN
   UPDATE public.shops SET location='Cosmo City' WHERE id=shop;
   BEGIN
     PERFORM public.pickup_create_order('synthetic-customer',repeat('a',64),r34_fixture.make_record(gen_random_uuid()));
     RAISE EXCEPTION 'H2D1_EXPECTED_LEGACY_REJECTION';
   EXCEPTION WHEN OTHERS THEN
     IF SQLERRM NOT LIKE '%OUTSIDE_PICKUP_PILOT%' THEN RAISE; END IF;
   END;
   IF (SELECT count(*) FROM public.orders)<>count_before THEN RAISE EXCEPTION 'H2D1_GHOST_ORDER'; END IF;
   RAISE NOTICE 'H2D1_LEGACY_TOWN_MISMATCH_REPRODUCED';
   RETURN;
 END IF;
 FOREACH label IN ARRAY ARRAY[NULL::text,'','Cosmo City','Soweto','Pretoria','Tembisa'] LOOP
   UPDATE public.shops SET location=label WHERE id=shop;
   key := gen_random_uuid();
   record := r34_fixture.make_record(key,25,25,0,shop,(-26.0100+3.999/6371*180/pi())::numeric,28.1900);
   answer := public.pickup_create_order('synthetic-customer',repeat('b',64),record);
   IF answer->>'replayed' IS DISTINCT FROM 'false' OR
      (answer->'order'->>'total_price')::numeric IS DISTINCT FROM 25 OR
      (answer->'order'->>'service_fee')::numeric IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'H2D1_GEOGRAPHY_VALID_ORDER_REJECTED';
   END IF;
   IF (public.pickup_create_order('synthetic-customer',repeat('b',64),record)->>'replayed') IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'H2D1_GEOGRAPHY_REPLAY_FAILED';
   END IF;
   BEGIN
     PERFORM public.pickup_create_order('synthetic-customer',repeat('c',64),
        r34_fixture.make_record(gen_random_uuid(),25,25,0,shop,(-26.0100+4.001/6371*180/pi())::numeric,28.1900));
     RAISE EXCEPTION 'H2D1_OUTSIDE_RADIUS_ACCEPTED';
   EXCEPTION WHEN OTHERS THEN
     IF SQLERRM NOT LIKE '%OUTSIDE_PICKUP_RADIUS%' THEN RAISE; END IF;
   END;
 END LOOP;
 BEGIN
   PERFORM public.pickup_create_order('synthetic-customer',repeat('d',64),
     r34_fixture.make_record(gen_random_uuid(),25,25,0,shop,91,28.19));
   RAISE EXCEPTION 'H2D1_INVALID_COORDINATE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%SHOP_LOCATION_UNAVAILABLE%' THEN RAISE; END IF;
 END;
 UPDATE public.shops SET approval_status='pending',location='Tembisa' WHERE id=shop;
 BEGIN
   PERFORM public.pickup_create_order('synthetic-customer',repeat('d',64),r34_fixture.make_record(gen_random_uuid()));
   RAISE EXCEPTION 'H2D1_UNAPPROVED_SHOP_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%SHOP_UNAVAILABLE%' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.orders)<>count_before+6 THEN RAISE EXCEPTION 'H2D1_GEOGRAPHY_UNEXPECTED_ORDER_COUNT'; END IF;
 RAISE NOTICE 'H2D1_GEOGRAPHY_PARITY_PASS labels=6 inside_m=3999 outside_m=4001';
END;
$geo$;
ROLLBACK;
