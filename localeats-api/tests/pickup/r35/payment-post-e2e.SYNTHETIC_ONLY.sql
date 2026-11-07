-- R3.5 payment method regression AFTER R3.4 creates and collects fake orders.
\set ON_ERROR_STOP on
DO $r35post$
DECLARE original_count integer; r jsonb;
BEGIN
 SELECT count(*) INTO original_count FROM public.orders;
 IF original_count<>2 OR
    (SELECT count(*) FROM public.pickup_order_events)<>7
 THEN RAISE EXCEPTION 'R35_PREVIOUS_PICKUP_E2E_NOT_RUN'; END IF;
 PERFORM public.merchant_set_pickup_payment_methods('synthetic-merchant',
   'my-kota-synthetic',ARRAY['cash'],ARRAY['cash','card_machine']);
 IF (SELECT pickup_payment_methods FROM public.shops
    WHERE id='my-kota-synthetic') IS DISTINCT FROM ARRAY['cash']::text[]
 THEN RAISE EXCEPTION 'R35_CASH_ONLY_SETTINGS_NOT_SAVED'; END IF;
 -- A real-style checkout must not use a payment method disabled by shop.
 BEGIN
   PERFORM public.pickup_create_order('synthetic-customer',repeat('a',64),
      r34_fixture.make_record(
        '00000000-0000-4000-8000-000000009011'::uuid,
        25,25,0,'my-kota-synthetic',-26.0100,28.1900,'card_machine'));
   RAISE EXCEPTION 'R35_DISABLED_CARD_MACHINE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%UNSUPPORTED_PAYMENT_METHOD%' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.orders)<>original_count
 THEN RAISE EXCEPTION 'R35_REJECTED_PAYMENT_LEFT_GHOST_ORDER'; END IF;

 -- Customers may still pay cash. No online payment gateway is invoked.
 r:=public.pickup_create_order('synthetic-customer',repeat('b',64),
   r34_fixture.make_record('00000000-0000-4000-8000-000000009012'::uuid));
 IF (r->'order'->>'payment_method')<>'cash' OR
    (r->'order'->>'payment_status')<>'unpaid' OR
    (r->'order'->>'service_fee')::numeric<>0 OR
    r->>'replayed'<>'false'
 THEN RAISE EXCEPTION 'R35_CASH_CHECKOUT_BROKEN'; END IF;

 BEGIN
   UPDATE public.shops
    SET pickup_payment_methods=ARRAY['cash','cash']
    WHERE id='my-kota-synthetic';
   RAISE EXCEPTION 'R35_INVALID_DIRECT_METHOD_ARRAY_ALLOWED';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
   UPDATE public.shops SET pickup_payment_methods=ARRAY['cash','online_card']
    WHERE id='my-kota-synthetic';
   RAISE EXCEPTION 'R35_UNSUPPORTED_DIRECT_METHOD_ARRAY_ALLOWED';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (SELECT pickup_payment_methods FROM public.shops
    WHERE id='my-kota-synthetic') IS DISTINCT FROM ARRAY['cash']::text[]
 THEN RAISE EXCEPTION 'R35_SETTINGS_CORRUPTED_AFTER_BAD_ARRAY'; END IF;
 IF (SELECT count(*) FROM public.pickup_order_events e
     JOIN public.orders o ON o.id=e.order_id
     WHERE o.payment_method='card_machine' AND o.status='cancelled')<>2
 THEN -- exactly one cancelled event + its created event
   RAISE EXCEPTION 'R35_PREVIOUS_CARD_MACHINE_HISTORY_LOST'; END IF;
 IF to_regnamespace('rewards_private') IS NOT NULL
 THEN RAISE EXCEPTION 'R35_REWARDS_ACTIVATION_LEAK'; END IF;
END;
$r35post$;
\echo R35_EFFECTIVE_PAYMENT_METHODS_AND_PICKUP_E2E_PASS
