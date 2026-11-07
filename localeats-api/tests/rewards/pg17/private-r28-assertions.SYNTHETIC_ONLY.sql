-- R2.8 SYNTHETIC_ONLY. This file runs ONLY in disposable postgres:17-alpine.
\set ON_ERROR_STOP on
BEGIN;
UPDATE r28_private.programme SET active=true,budget_minor=50000 WHERE version='pilot-v1';
INSERT INTO r28_private.customers(customer_uid,registered,is_test)
  VALUES('alice',true,false),('bob',true,false),('carol',true,false),
        ('guest',false,false),('test-user',true,true);
INSERT INTO r28_private.shops(shop_id,owner_uid,approval_status)
  VALUES('shop-1','merchant-1','approved'),('shop-2','merchant-2','approved');
INSERT INTO r28_private.shop_enrolments(shop_id,version,enrolled_at,enabled)
  VALUES('shop-1','pilot-v1',now()-interval '1 day',true),
        ('shop-2','pilot-v1',now()-interval '1 day',false);
INSERT INTO r28_private.menu_current(shop_id,item_id,revision,unit_minor,eligible_kota,kind)
  VALUES('shop-1','kota',1,2500,true,'standard_kota'),
        ('shop-1','soda',1,1000,false,'other_food'),
        ('shop-1','standard',1,2400,false,'standard_kota'),
        ('shop-1','other',1,2400,false,'other_food'),
        ('shop-1','expensive-other',1,2500,false,'other_food'),
        ('shop-1','bundle',1,12000,false,'bundle');
INSERT INTO r28_private.admins(uid,role,active)
  VALUES('admin-1','super_admin',true),('admin-disabled','super_admin',false);
COMMIT;

DO $r28assert$
DECLARE
 v_count integer;
 v_replay integer;
 v_payable text;
 v_payable_replay text;
BEGIN
  -- All food and reward eligibility are captured from the current trusted
  -- menu inside one locked transaction, not from price/loyalty client flags.
  PERFORM r28_private.capture_checkout('order-a','alice','shop-1',
    '[{"item_id":"kota","quantity":4},{"item_id":"soda","quantity":1}]'::jsonb);
  PERFORM r28_private.capture_checkout('order-a','alice','shop-1',
    '[{"item_id":"kota","quantity":4},{"item_id":"soda","quantity":1}]'::jsonb);
  IF (SELECT count(*) FROM r28_private.orders WHERE order_id='order-a')<>1 OR
    (SELECT count(*) FROM r28_private.purchase_lines WHERE order_id='order-a')<>2
  THEN RAISE EXCEPTION 'R28_DUPLICATED_CHECKOUT'; END IF;
  BEGIN
    PERFORM r28_private.capture_checkout('order-a','alice','shop-1',
      '[{"item_id":"kota","quantity":5}]'::jsonb);
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_CHECKOUT_REPLAY_CONFLICT%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM r28_private.capture_checkout('fake-input','alice','shop-1',
      '[{"item_id":"kota","quantity":4,"price":0,"qualifies_kota":true}]'::jsonb);
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_INVALID_CHECKOUT_LINE%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM r28_private.orders WHERE order_id='fake-input')
  THEN RAISE EXCEPTION 'R28_PARTIAL_CHECKOUT_WRITE'; END IF;

  -- No paid/collected event means no credit even if the JSON order exists.
  BEGIN
    PERFORM r28_private.credit_collected_order('order-a');
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_NOT_PAID_AND_COLLECTED%' THEN RAISE; END IF;
  END;
  PERFORM r28_private.record_pickup_event('order-a','a-pay','payment_confirmed',1,'merchant-1');
  BEGIN
    PERFORM r28_private.credit_collected_order('order-a');
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_NOT_PAID_AND_COLLECTED%' THEN RAISE; END IF;
  END;
  PERFORM r28_private.record_pickup_event('order-a','a-collected','collected',2,'merchant-1');
  v_count:=r28_private.credit_collected_order('order-a');
  v_replay:=r28_private.credit_collected_order('order-a');
  IF v_count<>4 OR v_replay<>0 OR
    (SELECT rank FROM r28_private.progress WHERE customer_uid='alice')<>'silver' OR
    (SELECT committed_minor FROM r28_private.programme)<>2500 OR
    (SELECT count(*) FROM r28_private.grants)<>1 OR
    EXISTS(SELECT 1 FROM r28_private.payables)
  THEN RAISE EXCEPTION 'R28_CREDIT_OR_IDEMPOTENCE_FAILED'; END IF;

  -- Original price/rule revisions cannot change with merchant menu updates.
  UPDATE r28_private.menu_current
     SET revision=2,unit_minor=3100,eligible_kota=false
     WHERE shop_id='shop-1' AND item_id='kota';
  IF (SELECT unit_minor FROM r28_private.purchase_lines
       WHERE order_id='order-a' AND item_id='kota')<>2500 OR
     (SELECT menu_revision FROM r28_private.purchase_lines
       WHERE order_id='order-a' AND item_id='kota')<>1 OR
     (SELECT qualifies_kota FROM r28_private.purchase_lines
       WHERE order_id='order-a' AND item_id='kota') IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'R28_MENU_EDIT_REWROTE_PURCHASE'; END IF;
  PERFORM r28_private.capture_checkout('order-b-disabled','bob','shop-1',
      '[{"item_id":"kota","quantity":4}]'::jsonb);
  PERFORM r28_private.record_pickup_event('order-b-disabled','b-pay',
      'payment_confirmed',1,'merchant-1');
  PERFORM r28_private.record_pickup_event('order-b-disabled','b-collected',
      'collected',2,'merchant-1');
  IF r28_private.credit_collected_order('order-b-disabled')<>0
  THEN RAISE EXCEPTION 'R28_RETROACTIVE_MENU_AWARD'; END IF;
  UPDATE r28_private.menu_current
     SET revision=3,unit_minor=2700,eligible_kota=true
     WHERE shop_id='shop-1' AND item_id='kota';
  IF r28_private.credit_collected_order('order-b-disabled')<>0
  THEN RAISE EXCEPTION 'R28_REENABLED_MENU_AWARDED_OLD_ORDER'; END IF;

  -- Pre-eligibility account, unapproved merchant or unenrolled shop cannot
  -- create a reward purchase in the synthetic-only server fixture.
  FOR v_count IN 1..2 LOOP
    BEGIN
      PERFORM r28_private.capture_checkout('excluded-'||v_count,
        (ARRAY['guest','test-user'])[v_count],'shop-1',
        '[{"item_id":"kota","quantity":4}]'::jsonb);
      RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%R28_CUSTOMER_NOT_ELIGIBLE%' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    PERFORM r28_private.capture_checkout('unenrolled','carol','shop-2',
      '[{"item_id":"kota","quantity":4}]'::jsonb);
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_SHOP_NOT_ENROLLED%' THEN RAISE; END IF;
  END;

  -- A genuine second 20-unit purchase at the new menu revision advances
  -- the first customer from Silver to Gold, reserving the R125 cap.
  PERFORM r28_private.capture_checkout('order-a-20','alice','shop-1',
      '[{"item_id":"kota","quantity":20}]'::jsonb);
  PERFORM r28_private.record_pickup_event('order-a-20','a20-pay',
      'payment_confirmed',1,'merchant-1');
  PERFORM r28_private.record_pickup_event('order-a-20','a20-collected',
      'collected',2,'merchant-1');
  v_count:=r28_private.credit_collected_order('order-a-20');
  IF v_count<>20 OR
     (SELECT rank FROM r28_private.progress WHERE customer_uid='alice')<>'gold' OR
     (SELECT lifetime_units FROM r28_private.progress WHERE customer_uid='alice')<>24 OR
     (SELECT count(*) FROM r28_private.grants WHERE customer_uid='alice')<>2 OR
     (SELECT committed_minor FROM r28_private.programme)<>15000
  THEN RAISE EXCEPTION 'R28_SILVER_BUDGET_OR_PROGRESS_FAILED'; END IF;

  -- Item must respect food-only caps. Unused cap becomes uncommitted after
  -- actual handover, while merchant debt equals real item price.
  BEGIN
    PERFORM r28_private.fulfil_grant('grant:alice:bronze','shop-1',
      'expensive-other','handover-bad');
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_BRONZE_FOOD_INVALID%' THEN RAISE; END IF;
  END;
  v_payable:=r28_private.fulfil_grant('grant:alice:bronze','shop-1',
        'standard','handover-1');
  v_payable_replay:=r28_private.fulfil_grant('grant:alice:bronze','shop-1',
        'standard','handover-1');
  IF v_payable<>'payable:grant:alice:bronze' OR
    v_payable_replay<>'payable:grant:alice:bronze'
    OR (SELECT committed_minor FROM r28_private.programme)<>14900 OR
    (SELECT amount_minor FROM r28_private.payables WHERE grant_id='grant:alice:bronze')<>2400
  THEN RAISE EXCEPTION 'R28_HANDOVER_DEBT_OR_BUDGET_FAILED'; END IF;
  IF (SELECT balanced FROM r28_private.reconcile_commitment()) IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'R28_COMMITMENT_RECONCILIATION_FAILED'; END IF;

  -- Refund after handover: review hold, no rank erasure and no merchant
  -- chargeback. Same refund can be replayed but changed facts cannot.
  PERFORM r28_private.record_verified_refund('refund-a','order-a','order-a:line:1',
       1,'merchant-1','admin-1','Verified synthetic shop refund');
  PERFORM r28_private.record_verified_refund('refund-a','order-a','order-a:line:1',
       1,'merchant-1','admin-1','Verified synthetic shop refund');
  IF NOT EXISTS(SELECT 1 FROM r28_private.refund_holds WHERE customer_uid='alice')
     OR (SELECT count(*) FROM r28_private.refund_events WHERE refund_id='refund-a')<>1
     OR (SELECT amount_minor FROM r28_private.payables WHERE grant_id='grant:alice:bronze')<>2400
     OR (SELECT committed_minor FROM r28_private.programme)<>14900
  THEN RAISE EXCEPTION 'R28_REFUND_ERASED_DEBT_OR_BUDGET'; END IF;
  BEGIN
    PERFORM r28_private.fulfil_grant('grant:alice:silver','shop-1',
        'bundle','handover-held');
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_REWARD_ON_HOLD%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM r28_private.record_verified_refund('refund-conflict','order-a',
         'order-a:line:1',4,'merchant-1','admin-1','Over original purchased quantity');
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_REFUND_EXCEEDS_PURCHASE%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM r28_private.record_verified_refund('fraud','order-a','order-a:line:1',
       1,'merchant-1','merchant-1','Self approved refund attempt');
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_INDEPENDENT_APPROVAL_REQUIRED%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM r28_private.record_verified_refund('refund-a','order-a','order-a:line:1',
      1,'merchant-1','admin-1','Altered reason');
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_REFUND_REPLAY_CONFLICT%' THEN RAISE; END IF;
  END;

  -- Independent second customer: refund before credit prevents all awards.
  PERFORM r28_private.capture_checkout('order-c','carol','shop-1',
      '[{"item_id":"kota","quantity":4}]'::jsonb);
  PERFORM r28_private.record_pickup_event('order-c','c-pay','payment_confirmed',1,'merchant-1');
  PERFORM r28_private.record_pickup_event('order-c','c-collected','collected',2,'merchant-1');
  PERFORM r28_private.record_verified_refund('refund-c','order-c','order-c:line:1',
      1,'merchant-1','admin-1','Verified cash refund pre-credit');
  BEGIN
    PERFORM r28_private.credit_collected_order('order-c');
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_REFUNDED_OR_HELD%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM r28_private.credits WHERE order_id='order-c')
  THEN RAISE EXCEPTION 'R28_PRE_CREDIT_REFUND_AWARDED'; END IF;

  -- Append-only proves source and financial events cannot be rewritten.
  BEGIN
    UPDATE r28_private.purchase_lines SET qualifies_kota=false
      WHERE order_id='order-a';
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_IMMUTABLE_FACT%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM r28_private.refund_events WHERE refund_id='refund-a';
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_IMMUTABLE_FACT%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM r28_private.audit_events WHERE kind='earned';
    RAISE EXCEPTION 'EXPECTED_FAIL_NOT_THROWN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R28_IMMUTABLE_FACT%' THEN RAISE; END IF;
  END;
END;
$r28assert$;

-- Structural privilege evidence from scratch roles, not connected Supabase.
DO $r28permissions$
DECLARE t record;f record;
BEGIN
 IF has_schema_privilege('r28_untrusted','r28_private','USAGE') THEN
   RAISE EXCEPTION 'R28_PRIVATE_SCHEMA_EXPOSED'; END IF;
 FOR t IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='r28_private' LOOP
   IF has_table_privilege('r28_untrusted',format('r28_private.%I',t.tablename),'SELECT')
      OR has_table_privilege('r28_untrusted',format('r28_private.%I',t.tablename),'INSERT')
      OR has_table_privilege('r28_untrusted',format('r28_private.%I',t.tablename),'UPDATE')
      OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='r28_private' AND c.relname=t.tablename AND c.relrowsecurity)
   THEN RAISE EXCEPTION 'R28_PRIVATE_TABLE_EXPOSED: %',t.tablename; END IF;
 END LOOP;
 FOR f IN SELECT p.oid,p.proname,p.prosecdef FROM pg_catalog.pg_proc p
   JOIN pg_catalog.pg_namespace n ON p.pronamespace=n.oid
   WHERE n.nspname='r28_private' LOOP
   IF has_function_privilege('r28_untrusted',f.oid,'EXECUTE') OR f.prosecdef
   THEN RAISE EXCEPTION 'R28_PRIVATE_FUNCTION_EXPOSED: %',f.proname; END IF;
 END LOOP;
 IF (SELECT balanced FROM r28_private.reconcile_commitment()) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'R28_FINAL_RECONCILIATION_FAILED'; END IF;
END;
$r28permissions$;
\echo R28_PRIVATE_PG17_DETERMINISTIC_FINANCE_AND_PRIVILEGES_PASS
