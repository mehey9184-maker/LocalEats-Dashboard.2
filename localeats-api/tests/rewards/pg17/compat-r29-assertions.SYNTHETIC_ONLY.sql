-- R2.9 synthetic compatibility assertions ONLY; never on a connected DB.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO r29_source.shops(id,owner_id,approval_status)
  VALUES('shop-a','merchant-a','approved'),('shop-b','merchant-b','approved');
INSERT INTO r29_source.customers(uid,registered,test_record)
  VALUES('alice',true,false),('bob',true,false),('guest',false,false),('test-user',true,true);
INSERT INTO r29_source.menu_items(id,shop_id,price,is_available,reward_eligible,reward_rule_revision)
  VALUES('kota-a','shop-a',25.00,true,true,1),
        ('soda-a','shop-a',10.00,true,false,1),
        ('kota-b','shop-b',25.00,true,true,1);
COMMIT;
DO $r29assert$
DECLARE
  v_status text;
  v_count integer;
  v_order uuid:='00000000-0000-4000-8000-000000000029'::uuid;
  v_old uuid:='00000000-0000-4000-8000-000000000030'::uuid;
  v_bad uuid:='00000000-0000-4000-8000-000000000031'::uuid;
  v_guest uuid:='00000000-0000-4000-8000-000000000032'::uuid;
  v_no_enrol uuid:='00000000-0000-4000-8000-000000000033'::uuid;
  v_refunded uuid:='00000000-0000-4000-8000-000000000034'::uuid;
  v_conflict uuid:='00000000-0000-4000-8000-000000000035'::uuid;
BEGIN
  -- A Rewards feature flag must never prevent a valid pickup order.
  v_status:=r29_private.capture_source_order(v_old,'shop-a','alice',repeat('a',64),
     '[{"item_id":"kota-a","quantity":4}]'::jsonb);
  IF v_status<>'pickup-only' OR
    NOT EXISTS(SELECT 1 FROM r29_source.orders WHERE id=v_old) OR
    EXISTS(SELECT 1 FROM r29_private.purchase_snapshots WHERE order_id=v_old)
  THEN RAISE EXCEPTION 'R29_REWARDS_OFF_BLOCKED_PICKUP'; END IF;
  UPDATE r29_private.programme SET active=true,budget_minor=5000
    WHERE version='future-pilot';
  INSERT INTO r29_private.shop_enrolments(shop_id,programme_version,enrolled_at,enabled)
    VALUES('shop-a','future-pilot',now()-interval '1 day',true);

  -- Enabling Rewards later must not retroactively credit an old pickup order.
  BEGIN
    PERFORM r29_private.credit_from_pickup(v_old);
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R29_NO_AUTHORITATIVE_PURCHASE%' THEN RAISE; END IF;
  END;

  -- No reward snapshot for guest/test provenance or unenrolled shops;
  -- checkout still works without a monetary liability.
  v_status:=r29_private.capture_source_order(v_guest,'shop-a','guest',repeat('a',64),
     '[{"item_id":"kota-a","quantity":4}]'::jsonb);
  IF v_status<>'pickup-only' THEN RAISE EXCEPTION 'R29_GUEST_REWARD_SOURCE'; END IF;
  v_status:=r29_private.capture_source_order(v_no_enrol,'shop-b','bob',repeat('b',64),
     '[{"item_id":"kota-b","quantity":4}]'::jsonb);
  IF v_status<>'pickup-only' THEN RAISE EXCEPTION 'R29_UNENROLLED_REWARD_SOURCE'; END IF;
  v_status:=r29_private.capture_source_order(
     '00000000-0000-4000-8000-000000000037'::uuid,
     'shop-a','test-user',repeat('c',64),
     '[{"item_id":"kota-a","quantity":4}]'::jsonb);
  IF v_status<>'pickup-only' THEN RAISE EXCEPTION 'R29_TEST_REWARD_SOURCE'; END IF;

  -- Valid paid-at-shop order and private immutable eligibility are created in
  -- the SAME transaction. This is not a separate after-the-fact HTTP write.
  v_status:=r29_private.capture_source_order(v_order,'shop-a','alice',repeat('d',64),
     '[{"item_id":"kota-a","quantity":4},{"item_id":"soda-a","quantity":1}]'::jsonb);
  IF v_status<>'pickup-with-rewards-source' THEN RAISE EXCEPTION 'R29_NO_SNAPSHOT'; END IF;
  v_status:=r29_private.capture_source_order(v_order,'shop-a','alice',repeat('d',64),
     '[{"item_id":"kota-a","quantity":4},{"item_id":"soda-a","quantity":1}]'::jsonb);
  IF v_status<>'pickup-with-rewards-source' OR
    (SELECT count(*) FROM r29_private.purchase_lines WHERE order_id=v_order)<>2
  THEN RAISE EXCEPTION 'R29_DUPLICATE_SNAPSHOT'; END IF;
  BEGIN
    PERFORM r29_private.capture_source_order(v_order,'shop-a','bob',repeat('d',64),
      '[{"item_id":"kota-a","quantity":4}]'::jsonb);
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R29_ORDER_REPLAY_CONFLICT%' THEN RAISE; END IF;
  END;
  -- Invalid second item aborts the source order AND the first reward snapshot.
  BEGIN
    PERFORM r29_private.capture_source_order(v_bad,'shop-a','alice',repeat('e',64),
      '[{"item_id":"kota-a","quantity":4},{"item_id":"nonexistent","quantity":1}]'::jsonb);
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R29_MENU_SOURCE_UNAVAILABLE%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM r29_source.orders WHERE id=v_bad) OR
     EXISTS(SELECT 1 FROM r29_private.purchase_lines WHERE order_id=v_bad)
  THEN RAISE EXCEPTION 'R29_PARTIAL_CHECKOUT_PERSISTED'; END IF;
  BEGIN
    PERFORM r29_private.capture_source_order(v_bad,'shop-a','alice',repeat('e',64),
      '[{"item_id":"kota-a","quantity":4,"price":0}]'::jsonb);
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R29_INVALID_MENU_INTENT%' THEN RAISE; END IF;
  END;
  -- Wrong order/customer/shop composite mapping and orphaned order cannot
  -- create synthetic financial evidence despite UUID-like identifiers.
  BEGIN
    INSERT INTO r29_private.purchase_snapshots(order_id,shop_id,customer_uid,programme_version)
      VALUES(v_guest,'shop-a','alice','future-pilot');
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO r29_private.purchase_snapshots(order_id,shop_id,customer_uid,programme_version)
      VALUES('00000000-0000-4000-8000-000000000099'::uuid,'shop-a','alice','future-pilot');
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  IF (SELECT price_minor FROM r29_private.purchase_lines WHERE order_id=v_order
       AND item_id='kota-a')<>2500 OR
     (SELECT menu_revision FROM r29_private.purchase_lines WHERE order_id=v_order
       AND item_id='kota-a')<>1 OR
     (SELECT eligible_kota FROM r29_private.purchase_lines WHERE order_id=v_order
       AND item_id='kota-a') IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'R29_PURCHASE_LINE_TYPE_OR_PRICE_DRIFT'; END IF;
  UPDATE r29_source.menu_items SET price=35.00,reward_eligible=false,reward_rule_revision=2
     WHERE id='kota-a';
  IF (SELECT price_minor FROM r29_private.purchase_lines
       WHERE order_id=v_order AND item_id='kota-a')<>2500
  THEN RAISE EXCEPTION 'R29_MENU_EDIT_CHANGED_SNAPSHOT'; END IF;

  -- Even an authentic-looking order has no credit before the real-style paid
  -- and collected command facts are committed.
  BEGIN
    PERFORM r29_private.credit_from_pickup(v_order);
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R29_NO_AUTHORITATIVE_PURCHASE%' THEN RAISE; END IF;
  END;
  PERFORM r29_private.complete_synthetic_pickup(v_order,
    '00000000-0000-4000-8000-000000000041'::uuid,
    '00000000-0000-4000-8000-000000000042'::uuid,'merchant-a');
  v_count:=r29_private.credit_from_pickup(v_order);
  IF v_count<>4 THEN RAISE EXCEPTION 'R29_BRONZE_CREDIT_MISSING'; END IF;
  v_count:=r29_private.credit_from_pickup(v_order);
  IF v_count<>0 OR
    (SELECT count(*) FROM r29_private.credits WHERE order_id=v_order)<>1 OR
    (SELECT lifetime_units FROM r29_private.progress WHERE customer_uid='alice')<>4 OR
    (SELECT cap_minor FROM r29_private.bronze_grants WHERE customer_uid='alice')<>2500 OR
    (SELECT committed_minor FROM r29_private.programme WHERE version='future-pilot')<>2500
  THEN RAISE EXCEPTION 'R29_CREDIT_REPLAY_OR_COMMITMENT_FAILED'; END IF;
  BEGIN
    PERFORM r29_private.complete_synthetic_pickup(v_order,
      '00000000-0000-4000-8000-000000000041'::uuid,
      '00000000-0000-4000-8000-000000000042'::uuid,'merchant-a');
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R29_INVALID_PICKUP_TRANSITION%' THEN RAISE; END IF;
  END;

  -- A verified-refund source placeholder before credit MUST block award;
  -- this remains a synthetic insert, not permission to receive a real refund.
  v_status:=r29_private.capture_source_order(v_refunded,'shop-a','bob',repeat('f',64),
    '[{"item_id":"soda-a","quantity":1}]'::jsonb);
  PERFORM r29_private.complete_synthetic_pickup(v_refunded,
    '00000000-0000-4000-8000-000000000043'::uuid,
    '00000000-0000-4000-8000-000000000044'::uuid,'merchant-a');
  INSERT INTO r29_private.refund_notices(refund_id,order_id,line_index,source_detail)
     VALUES('00000000-0000-4000-8000-000000000045'::uuid,v_refunded,1,'synthetic source only');
  BEGIN
    PERFORM r29_private.credit_from_pickup(v_refunded);
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R29_REFUND_REVIEW_REQUIRED%' THEN RAISE; END IF;
  END;

  -- SOURCE and private purchase evidence are truly UUID FK-bound, never
  -- varchar order IDs or manually mapped customer UUIDs.
  IF (SELECT atttypid FROM pg_catalog.pg_attribute
      WHERE attrelid='r29_source.orders'::regclass AND attname='id')<>'uuid'::regtype OR
     (SELECT atttypid FROM pg_catalog.pg_attribute
      WHERE attrelid='r29_source.pickup_order_events'::regclass AND attname='order_id')<>'uuid'::regtype OR
     (SELECT atttypid FROM pg_catalog.pg_attribute
      WHERE attrelid='r29_private.purchase_snapshots'::regclass AND attname='order_id')<>'uuid'::regtype OR
     (SELECT atttypid FROM pg_catalog.pg_attribute
      WHERE attrelid='r29_source.orders'::regclass AND attname='shop_id')<>'text'::regtype OR
     (SELECT atttypid FROM pg_catalog.pg_attribute
      WHERE attrelid='r29_source.orders'::regclass AND attname='user_id')<>'text'::regtype
  THEN RAISE EXCEPTION 'R29_PICKUP_SCHEMA_IDENTITY_TYPE_MISMATCH'; END IF;

  -- Append-only source and credit integrity is enforced by triggers; a direct
  -- privileged UPDATE cannot silently replace purchase evidence.
  BEGIN
    UPDATE r29_private.purchase_lines SET eligible_kota=false WHERE order_id=v_order;
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R29_IMMUTABLE_PURCHASE_PROOF%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM r29_source.pickup_order_events WHERE order_id=v_order;
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R29_IMMUTABLE_PURCHASE_PROOF%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM r29_private.credits WHERE order_id=v_order;
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R29_IMMUTABLE_PURCHASE_PROOF%' THEN RAISE; END IF;
  END;
  IF (SELECT committed_minor FROM r29_private.programme WHERE version='future-pilot')
      IS DISTINCT FROM (SELECT COALESCE(sum(cap_minor),0) FROM r29_private.bronze_grants)
  THEN RAISE EXCEPTION 'R29_BUDGET_AND_GRANTS_DIVERGED'; END IF;
END;
$r29assert$;

DO $r29roles$
DECLARE t record;f record;
BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_catalog.pg_tables WHERE schemaname='r29_private' LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname=t.schemaname AND c.relname=t.tablename
       AND c.relrowsecurity AND c.relforcerowsecurity)
   THEN RAISE EXCEPTION 'R29_PRIVATE_RLS_OR_FORCE_RLS_MISSING_%',t.tablename; END IF;
 END LOOP;
 FOR f IN SELECT p.oid,p.prosecdef,p.proconfig FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='r29_private' LOOP
   IF f.prosecdef OR f.proconfig IS NULL OR
      NOT ('search_path=pg_catalog'=ANY(f.proconfig)) THEN
     RAISE EXCEPTION 'R29_UNSAFE_FINANCE_FUNCTION'; END IF;
   IF has_function_privilege('r29_browser',f.oid,'EXECUTE') OR
      has_function_privilege('r29_observer',f.oid,'EXECUTE')
   THEN RAISE EXCEPTION 'R29_FINANCE_EXECUTE_LEAK'; END IF;
 END LOOP;
END;
$r29roles$;
\echo R29_UUID_IDENTITY_PRIVATE_RLS_AND_SNAPSHOT_PASS
