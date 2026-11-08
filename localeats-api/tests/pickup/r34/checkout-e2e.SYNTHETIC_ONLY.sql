-- R3.4 SYNTHETIC_ONLY end-to-end PostgreSQL contract regression.
-- Executes the actual repo draft pickup functions, NOT copies of their logic.
\set ON_ERROR_STOP on

-- Canonical deployed function bodies were checked via read-only pg_catalog
-- 2026-11-08. The original drafts and live bodies match after whitespace
-- normalization. These hashes are a strict offline baseline freshness gate.
DO $r34_fingerprint$
DECLARE rec record;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
    ('pickup_create_order','70cb4891b1ff47c5f15cb112e192bad8'),
    ('pickup_order_command','303bef1097192d096ba3340d87c16f02'),
    ('guard_pickup_order','3d4c1851a9a791df1f698af8e36bc5d0')
 ) x(name,expected_md5) LOOP
    IF (SELECT md5(regexp_replace(btrim(p.prosrc),'[[:space:]]+',' ','g'))
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname=rec.name)
      IS DISTINCT FROM rec.expected_md5 THEN
        RAISE EXCEPTION 'R34_DEPLOYED_PICKUP_FUNCTION_DRIFT: %',rec.name;
    END IF;
 END LOOP;
 IF has_function_privilege('anon',
   'public.pickup_create_order(text,text,jsonb)','EXECUTE') OR
    has_function_privilege('authenticated',
   'public.pickup_order_command(text,uuid,text,uuid,bigint,text,text,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'R34_UNTRUSTED_RPC_EXECUTE'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p
   JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
    AND p.proname IN ('pickup_create_order','pickup_order_command')
    AND p.prosecdef) THEN
   RAISE EXCEPTION 'R34_PICKUP_RPC_NOT_INVOKER'; END IF;
END;
$r34_fingerprint$;

DO $r34_e2e$
DECLARE
  order_a uuid;
  order_b uuid;
  response jsonb;
  response2 jsonb;
  notify jsonb;
  created integer;
  rev bigint;
  subscriber uuid;
BEGIN
 -- Generate only fake source and customer IDs; pay-at-shop CASH, zero fee.
 response:=public.pickup_create_order('synthetic-customer',repeat('a',64),
    r34_fixture.make_record('00000000-0000-4000-8000-000000008910'::uuid));
 order_a:=(response->'order'->>'id')::uuid;
 IF response->>'replayed'<>'false' OR order_a IS NULL OR
    (response->'order'->>'service_fee')::numeric<>0 OR
    (response->'order'->>'total_price')::numeric<>25 OR
    (response->'order'->>'delivery_type')<>'collection' OR
    (response->'order'->>'payment_status')<>'unpaid' OR
    (response->'order'->>'status')<>'pending' OR
    (response->'order'->>'rider_id') IS NOT NULL
 THEN RAISE EXCEPTION 'R34_REAL_ZERO_FEE_CHECKOUT_FAILED'; END IF;
 SELECT count(*) INTO created FROM public.pickup_order_events
  WHERE order_id=order_a AND kind='created' AND revision=0;
 IF created<>1 THEN RAISE EXCEPTION 'R34_NO_CREATED_EVENT'; END IF;
 response2:=public.pickup_create_order('synthetic-customer',repeat('a',64),
    r34_fixture.make_record('00000000-0000-4000-8000-000000008910'::uuid));
 IF response2->>'replayed'<>'true' OR
    (response2->'order'->>'id')::uuid<>order_a
 THEN RAISE EXCEPTION 'R34_DUPLICATED_IDEMPOTENT_CREATE'; END IF;

 -- Same key with forged user or changed server intent must be rejected.
 BEGIN
   PERFORM public.pickup_create_order('another-client',repeat('a',64),
     r34_fixture.make_record('00000000-0000-4000-8000-000000008910'::uuid));
   RAISE EXCEPTION 'R34_FORGED_REPLAY_SUCCEEDED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%IDEMPOTENCY_CONFLICT%' THEN RAISE; END IF;
 END;
 -- Client-supplied subtotal, fee or changed menu price are NOT authoritative.
 BEGIN
   PERFORM public.pickup_create_order('synthetic-customer',repeat('b',64),
     r34_fixture.make_record('00000000-0000-4000-8000-000000008911'::uuid,1,1,0));
   RAISE EXCEPTION 'R34_FAKE_PRICE_WAS_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%PRICE_CHANGED%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.pickup_create_order('synthetic-customer',repeat('b',64),
     r34_fixture.make_record('00000000-0000-4000-8000-000000008912'::uuid,25,27.50,2.50));
   RAISE EXCEPTION 'R34_LEGACY_FEE_WAS_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%PRICE_CHANGED%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.pickup_create_order('synthetic-customer',repeat('b',64),
     r34_fixture.make_record('00000000-0000-4000-8000-000000008913'::uuid,
       25,25,0,'my-kota-synthetic',-27.0000,28.1900));
   RAISE EXCEPTION 'R34_OUT_OF_RANGE_PICKUP_CREATED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%OUTSIDE_PICKUP_RADIUS%' THEN RAISE; END IF;
 END;
 FOR rev IN 1..2 LOOP
   BEGIN
     PERFORM public.pickup_create_order('synthetic-customer',repeat('b',64),
       r34_fixture.make_record(
          CASE WHEN rev=1 THEN '00000000-0000-4000-8000-000000008914'::uuid
          ELSE '00000000-0000-4000-8000-000000008915'::uuid END,
          25,25,0,
          CASE WHEN rev=1 THEN 'shop-closed-synthetic' ELSE 'shop-pending-synthetic' END));
     RAISE EXCEPTION 'R34_CLOSED_OR_UNAPPROVED_SHOP_ORDERED';
   EXCEPTION WHEN OTHERS THEN
     IF SQLERRM NOT LIKE '%SHOP_UNAVAILABLE%' THEN RAISE; END IF;
   END;
 END LOOP;
 IF (SELECT count(*) FROM public.orders)<>1 THEN
   RAISE EXCEPTION 'R34_BAD_CHECKOUT_LEFT_GHOST_ORDER'; END IF;

 -- Unauthorized merchant cannot accept a valid order.
 BEGIN
   PERFORM public.pickup_order_command('attacker',order_a,'accept',
     '00000000-0000-4000-8000-000000008921'::uuid,0);
   RAISE EXCEPTION 'R34_MERCHANT_IMPERSONATION_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%FORBIDDEN%' THEN RAISE; END IF;
 END;
 -- Actual deployed RPC: Accept transitions Pending -> Preparing.
 response:=public.pickup_order_command('synthetic-merchant',order_a,'accept',
    '00000000-0000-4000-8000-000000008922'::uuid,0);
 IF response->'order'->>'status'<>'preparing' OR
   (response->'order'->>'revision')::bigint<>1 OR
   response->'event'->>'kind'<>'accepted'
 THEN RAISE EXCEPTION 'R34_ACCEPT_DID_NOT_PREPARE'; END IF;
 BEGIN
   PERFORM public.pickup_order_command('synthetic-merchant',order_a,'ready',
     '00000000-0000-4000-8000-000000008923'::uuid,0);
   RAISE EXCEPTION 'R34_STALE_REVISION_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%ORDER_STATE_CHANGED%' THEN RAISE; END IF;
 END;

 response:=public.pickup_order_command('synthetic-merchant',order_a,'ready',
    '00000000-0000-4000-8000-000000008924'::uuid,1);
 IF response->'order'->>'status'<>'ready_for_pickup' OR
    response->'event'->>'kind'<>'ready' OR
    response->'event'->>'recipient_uid'<>'synthetic-customer' OR
    (response->'order'->>'revision')::bigint<>2
 THEN RAISE EXCEPTION 'R34_READY_TRANSITION_OR_NOTIFICATION_FAILED'; END IF;
 IF (SELECT count(*) FROM public.pickup_push_outbox x
   JOIN public.pickup_order_events e ON e.id=x.event_id
   JOIN public.pickup_push_subscriptions s ON s.id=x.subscription_id
   WHERE e.order_id=order_a AND e.kind='ready'
     AND e.recipient_uid='synthetic-customer'
     AND s.user_id='synthetic-customer' AND x.state='pending')<>1
 THEN RAISE EXCEPTION 'R34_NOTIFICATION_OUTBOX_NOT_CREATED'; END IF;
 -- Ready replay cannot duplicate a notification or any order event.
 response2:=public.pickup_order_command('synthetic-merchant',order_a,'ready',
    '00000000-0000-4000-8000-000000008924'::uuid,1);
 IF response2->>'replayed'<>'true' OR
    (SELECT count(*) FROM public.pickup_push_outbox)<>1
 THEN RAISE EXCEPTION 'R34_DUPLICATE_READY_NOTIFICATION'; END IF;

 -- Claim / sendability / ack are database-only fake FCM queue events.
 notify:=public.pickup_claim_push('synthetic-customer');
 IF notify IS NULL OR notify->>'token'<>'LOCAL_FAKE_FCM_TOKEN_DO_NOT_SEND' OR
    (notify->>'attempts')::integer<>1 OR
    public.pickup_push_sendable('synthetic-customer',
      (notify->>'id')::uuid,(notify->>'attempts')::integer,
      (notify->>'lease_until')::timestamptz,notify->>'token') IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'R34_PUSH_QUEUE_NOT_SENDABLE'; END IF;
 IF public.pickup_finish_push('synthetic-customer',(notify->>'id')::uuid,
   (notify->>'attempts')::integer,(notify->>'lease_until')::timestamptz,true,false)
   IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'R34_PUSH_ACK_FAILED'; END IF;
 IF (SELECT state FROM public.pickup_push_outbox LIMIT 1)<>'sent'
 THEN RAISE EXCEPTION 'R34_PUSH_OUTBOX_NOT_SENT'; END IF;

 -- No collection before payment and no unverified payment methods.
 BEGIN
   PERFORM public.pickup_order_command('synthetic-merchant',order_a,'collect',
    '00000000-0000-4000-8000-000000008925'::uuid,2,
     null,null,true);
   RAISE EXCEPTION 'R34_COLLECTED_UNPAID_ORDER';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%INVALID_ORDER_TRANSITION%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.pickup_order_command('synthetic-merchant',order_a,'confirm_payment',
    '00000000-0000-4000-8000-000000008926'::uuid,2,
     null,'online_card',false);
   RAISE EXCEPTION 'R34_ONLINE_PAYMENT_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%INVALID_PAYMENT_METHOD%' THEN RAISE; END IF;
 END;

 response:=public.pickup_order_command('synthetic-merchant',order_a,'confirm_payment',
   '00000000-0000-4000-8000-000000008927'::uuid,2,
   null,'cash',false);
 IF response->'order'->>'status'<>'ready_for_pickup' OR
    response->'order'->>'payment_status'<>'paid' OR
    response->'event'->>'kind'<>'payment_confirmed' OR
    response->'event'->'details'->>'currency'<>'ZAR' OR
    response->'event'->'details'->>'method'<>'cash'
 THEN RAISE EXCEPTION 'R34_PAY_AT_SHOP_CONFIRMATION_FAILED'; END IF;
 BEGIN
   PERFORM public.pickup_order_command('synthetic-merchant',order_a,'collect',
    '00000000-0000-4000-8000-000000008928'::uuid,3,
     null,null,false);
   RAISE EXCEPTION 'R34_NO_HANDOVER_COLLECTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%HANDOVER_CONFIRMATION_REQUIRED%' THEN RAISE; END IF;
 END;
 response:=public.pickup_order_command('synthetic-merchant',order_a,'collect',
    '00000000-0000-4000-8000-000000008929'::uuid,3,
    null,null,true);
 IF response->'order'->>'status'<>'collected' OR
    response->'order'->>'payment_status'<>'paid' OR
    (response->'order'->>'revision')::bigint<>4 OR
    response->'event'->>'kind'<>'collected'
 THEN RAISE EXCEPTION 'R34_ORDER_NOT_COLLECTED'; END IF;
 response2:=public.pickup_order_command('synthetic-merchant',order_a,'collect',
    '00000000-0000-4000-8000-000000008929'::uuid,3,
    null,null,true);
 IF response2->>'replayed'<>'true'
   OR (SELECT count(*) FROM public.pickup_order_events WHERE order_id=order_a)<>5
 THEN RAISE EXCEPTION 'R34_COLLECTION_REPLAY_CREATED_DUPLICATE'; END IF;
 IF EXISTS(SELECT 1 FROM public.orders WHERE id=order_a
   AND (delivery_type<>'collection' OR rider_id IS NOT NULL
     OR delivery_fee IS DISTINCT FROM 0 OR service_fee IS DISTINCT FROM 0))
 THEN RAISE EXCEPTION 'R34_DELIVERY_OR_FEE_LEAK'; END IF;

 -- A second customer can cancel before preparation. No fake delivery.
 response:=public.pickup_create_order('synthetic-customer-2',repeat('c',64),
   r34_fixture.make_record('00000000-0000-4000-8000-000000008930'::uuid,
     25,25,0,'my-kota-synthetic',-26.0100,28.1900,'card_machine'));
 order_b:=(response->'order'->>'id')::uuid;
 response2:=public.pickup_order_command('synthetic-customer-2',order_b,'cancel',
   '00000000-0000-4000-8000-000000008931'::uuid,0,'Changed my mind');
 IF response2->'order'->>'status'<>'cancelled'
    OR response2->'event'->>'kind'<>'customer_cancelled'
 THEN RAISE EXCEPTION 'R34_CUSTOMER_CANCELLATION_FAILED'; END IF;
 IF (SELECT count(*) FROM public.pickup_push_outbox)<>1
 THEN RAISE EXCEPTION 'R34_CANCELLED_ORDER_QUEUED_PUSH'; END IF;
 IF (SELECT count(*) FROM public.orders)<>2
 THEN RAISE EXCEPTION 'R34_UNEXPECTED_SYNTHETIC_ORDER_COUNT'; END IF;
 IF to_regnamespace('rewards_private') IS NOT NULL OR
    to_regnamespace('r34_rewards') IS NOT NULL
 THEN RAISE EXCEPTION 'R34_REWARDS_NOT_OFF'; END IF;
END;
$r34_e2e$;
\echo R34_UNMODIFIED_PICKUP_SQL_ZERO_FEE_CREATE_TO_COLLECT_AND_PUSH_PASS
