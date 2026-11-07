-- R2.5 synthetic PG17 assertions. Runs only after the existing R2.2/R2.3 suite.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO reward_lab.purchase_customers(customer_id,registered,is_test)
 VALUES('alice',true,false),('bob',true,false),('carol',true,false),
 ('guest',false,false),('test-customer',true,true);
INSERT INTO reward_lab.shop_programmes(shop_id,programme_version,approved,opted_in,rewards_started_at)
 VALUES('shop-1','pilot-v1',true,true,now()-interval '1 day');
INSERT INTO reward_lab.menu_eligibility_current(shop_id,item_id,revision,unit_minor,qualifies_kota)
 VALUES('shop-1','kota',1,2500,true),('shop-1','soda',1,1000,false);
UPDATE reward_lab.program SET active=true,limit_minor=40000,allocated_minor=0 WHERE id=1;
COMMIT;

DO $$
DECLARE
  v_qty integer;
  v_before integer;
BEGIN
  -- Only client item ID and quantity are accepted; price/eligibility are from
  -- trusted, row-locked server tables at checkout. Duplicate same intent is safe.
  PERFORM reward_lab.capture_purchase_at_checkout(
    'order-alice','alice','shop-1',
    '[{"item_id":"kota","quantity":4},{"item_id":"soda","quantity":1}]'::jsonb);
  PERFORM reward_lab.capture_purchase_at_checkout(
    'order-alice','alice','shop-1',
    '[{"item_id":"kota","quantity":4},{"item_id":"soda","quantity":1}]'::jsonb);
  IF (SELECT count(*) FROM reward_lab.purchase_captures WHERE order_id='order-alice')<>1 OR
     (SELECT count(*) FROM reward_lab.purchase_line_snapshots WHERE order_id='order-alice')<>2
  THEN RAISE EXCEPTION 'CHECKOUT_REPLAY_CREATED_DUPLICATES'; END IF;

  BEGIN
    PERFORM reward_lab.capture_purchase_at_checkout(
      'order-alice','alice','shop-1','[{"item_id":"kota","quantity":5}]'::jsonb);
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CHECKOUT_REPLAY_CONFLICT%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM reward_lab.capture_purchase_at_checkout(
      'bad-input','alice','shop-1','[{"item_id":"kota","quantity":4,"eligible_kota":true,"price":1}]'::jsonb);
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%INVALID_CHECKOUT_LINE%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM reward_lab.purchase_captures WHERE order_id='bad-input')
  THEN RAISE EXCEPTION 'FAILED_INPUT_WROTE_CHECKOUT'; END IF;

  -- Orders cannot earn from a mutable status flag: both immutable persisted
  -- payment-confirmation and later collected events are mandatory.
  BEGIN
    PERFORM reward_lab.credit_snapshotted_pickup('order-alice');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%VERIFIED_PAYMENT_AND_COLLECTION_REQUIRED%' THEN RAISE; END IF;
  END;
  INSERT INTO reward_lab.pickup_source_events(order_id,command_id,revision,kind,actor_uid)
    VALUES('order-alice','a-confirm',1,'payment_confirmed','merchant-a');
  BEGIN
    PERFORM reward_lab.credit_snapshotted_pickup('order-alice');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%VERIFIED_PAYMENT_AND_COLLECTION_REQUIRED%' THEN RAISE; END IF;
  END;
  INSERT INTO reward_lab.pickup_source_events(order_id,command_id,revision,kind,actor_uid)
    VALUES('order-alice','a-collected',2,'collected','merchant-a');
  v_qty:=reward_lab.credit_snapshotted_pickup('order-alice');
  IF v_qty<>4 OR reward_lab.credit_snapshotted_pickup('order-alice')<>0 OR
    (SELECT rank FROM reward_lab.progress WHERE customer_id='alice')<>'silver' OR
    (SELECT allocated_minor FROM reward_lab.program WHERE id=1)<>2500
  THEN RAISE EXCEPTION 'VERIFIED_CREDIT_NOT_IDEMPOTENT'; END IF;

  -- Live merchant price AND eligibility updates must never rewrite old food
  -- purchase snapshots, nor change an already-earned reward.
  UPDATE reward_lab.menu_eligibility_current
    SET revision=2,unit_minor=3100,qualifies_kota=false
    WHERE shop_id='shop-1' AND item_id='kota';
  PERFORM reward_lab.capture_purchase_at_checkout(
    'order-bob-disabled','bob','shop-1','[{"item_id":"kota","quantity":4}]'::jsonb);
  INSERT INTO reward_lab.pickup_source_events(order_id,command_id,revision,kind,actor_uid)
    VALUES('order-bob-disabled','b1-confirm',1,'payment_confirmed','merchant-a'),
          ('order-bob-disabled','b1-collected',2,'collected','merchant-a');
  IF reward_lab.credit_snapshotted_pickup('order-bob-disabled')<>0
  THEN RAISE EXCEPTION 'UNQUALIFIED_MENU_WAS_CREDITED'; END IF;
  UPDATE reward_lab.menu_eligibility_current
    SET revision=3,unit_minor=2700,qualifies_kota=true
    WHERE shop_id='shop-1' AND item_id='kota';
  IF reward_lab.credit_snapshotted_pickup('order-bob-disabled')<>0
  THEN RAISE EXCEPTION 'MENU_REENABLE_RETROACTIVELY_CREDITED'; END IF;
  IF (SELECT unit_minor FROM reward_lab.purchase_line_snapshots
      WHERE order_id='order-alice' AND item_id='kota')<>2500 OR
     (SELECT menu_revision FROM reward_lab.purchase_line_snapshots
      WHERE order_id='order-alice' AND item_id='kota')<>1 OR
     (SELECT qualifying_kota FROM reward_lab.purchase_line_snapshots
      WHERE order_id='order-bob-disabled' AND item_id='kota')<>false OR
     (SELECT unit_minor FROM reward_lab.purchase_line_snapshots
      WHERE order_id='order-bob-disabled' AND item_id='kota')<>3100
  THEN RAISE EXCEPTION 'PURCHASE_SNAPSHOT_CHANGED_AFTER_MENU_EDIT'; END IF;

  -- Future orders use the NEW revision and new price. No copying eligibility
  -- from customer-provided request data or from today's order display.
  PERFORM reward_lab.capture_purchase_at_checkout(
    'order-bob-enabled','bob','shop-1','[{"item_id":"kota","quantity":4}]'::jsonb);
  INSERT INTO reward_lab.pickup_source_events(order_id,command_id,revision,kind,actor_uid)
    VALUES('order-bob-enabled','b2-confirm',1,'payment_confirmed','merchant-a'),
          ('order-bob-enabled','b2-collected',2,'collected','merchant-a');
  IF reward_lab.credit_snapshotted_pickup('order-bob-enabled')<>4 OR
     (SELECT unit_minor FROM reward_lab.purchase_line_snapshots
      WHERE order_id='order-bob-enabled')<>2700 OR
     (SELECT menu_revision FROM reward_lab.purchase_line_snapshots
      WHERE order_id='order-bob-enabled')<>3
  THEN RAISE EXCEPTION 'NEW_MENU_REVISION_NOT_CAPTURED'; END IF;

  -- Guest/test accounts and earlier nonparticipating checkout records stay
  -- nonqualifying even if status or programme rules change later.
  PERFORM reward_lab.capture_purchase_at_checkout(
    'order-guest','guest','shop-1','[{"item_id":"kota","quantity":4}]'::jsonb);
  PERFORM reward_lab.capture_purchase_at_checkout(
    'order-test','test-customer','shop-1','[{"item_id":"kota","quantity":4}]'::jsonb);
  UPDATE reward_lab.shop_programmes SET opted_in=false WHERE shop_id='shop-1';
  PERFORM reward_lab.capture_purchase_at_checkout(
    'order-before-enrol','carol','shop-1','[{"item_id":"kota","quantity":4}]'::jsonb);
  UPDATE reward_lab.shop_programmes SET opted_in=true WHERE shop_id='shop-1';
  FOR v_qty IN 1..3 LOOP
    BEGIN
      PERFORM reward_lab.credit_snapshotted_pickup(
        (ARRAY['order-guest','order-test','order-before-enrol'])[v_qty]);
      RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%PURCHASE_NOT_ELIGIBLE_AT_CHECKOUT%' THEN RAISE; END IF;
    END;
  END LOOP;

  -- A pre-credit refund prevents award even after paid+collected proof exists.
  PERFORM reward_lab.capture_purchase_at_checkout(
    'order-carol-refund','carol','shop-1','[{"item_id":"kota","quantity":4}]'::jsonb);
  INSERT INTO reward_lab.pickup_source_events(order_id,command_id,revision,kind,actor_uid)
    VALUES('order-carol-refund','c-confirm',1,'payment_confirmed','merchant-a'),
          ('order-carol-refund','c-collected',2,'collected','merchant-a');
  PERFORM reward_lab.record_snapshot_refund(
    'src-refund-c','order-carol-refund','order-carol-refund:line:1','CASH-REF-C',2,
    'Merchant verified refund before credit');
  BEGIN
    PERFORM reward_lab.credit_snapshotted_pickup('order-carol-refund');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%REFUND_REQUIRES_REVIEW%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM reward_lab.credited_lines WHERE order_id='order-carol-refund')
  THEN RAISE EXCEPTION 'REFUNDED_SOURCE_WAS_CREDITED'; END IF;

  -- After credit, the same refund source is linked to an immutable R2.3
  -- recovery event and automatically places the customer entitlement on hold.
  PERFORM reward_lab.record_snapshot_refund(
    'src-refund-a','order-alice','order-alice:line:1','CASH-REF-A',1,
    'Merchant verified refund after credit');
  PERFORM reward_lab.record_snapshot_refund(
    'src-refund-a','order-alice','order-alice:line:1','CASH-REF-A',1,
    'Merchant verified refund after credit');
  IF NOT EXISTS(SELECT 1 FROM reward_lab.customer_holds WHERE customer_id='alice') OR
     (SELECT status FROM reward_lab.grants WHERE customer_id='alice')<>'earned' OR
     (SELECT count(*) FROM reward_lab.refund_events WHERE order_id='order-alice')<>1
  THEN RAISE EXCEPTION 'REFUND_DID_NOT_PRESERVE_AND_HOLD_ENTITLEMENT'; END IF;
  BEGIN
    PERFORM reward_lab.record_snapshot_refund(
      'src-refund-a','order-alice','order-alice:line:1','DIFFERENT-REF',1,
      'Merchant verified refund after credit');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%SNAPSHOT_REFUND_REPLAY_CONFLICT%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM reward_lab.record_snapshot_refund(
      'src-refund-excess','order-alice','order-alice:line:1','MORE-UNITS',4,
      'Invalid refund exceeding quantity');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%REFUND_EXCEEDS_PURCHASE_UNITS%' THEN RAISE; END IF;
  END;
  -- A financial debt only appears after actual reward handover, never when
  -- an order qualifies: even after the snapshot+credit the merchant is not owed.
  IF (SELECT count(*) FROM reward_lab.grants)<>2 OR
     (SELECT count(*) FROM reward_lab.payables)<>0 OR
     (SELECT allocated_minor FROM reward_lab.program WHERE id=1)<>5000
  THEN RAISE EXCEPTION 'CREDIT_CREATED_FALSE_MERCHANT_DEBT'; END IF;

  -- Attempts to overwrite purchase-time price, eligibility, programme or
  -- refund/payment proof are rejected by immutable audit triggers.
  BEGIN
    UPDATE reward_lab.purchase_line_snapshots SET qualifying_kota=false
      WHERE order_id='order-alice';
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%AUDIT_IMMUTABLE%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE reward_lab.purchase_captures SET programme_version='another-version'
      WHERE order_id='order-alice';
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%AUDIT_IMMUTABLE%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM reward_lab.pickup_source_events WHERE order_id='order-alice';
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%AUDIT_IMMUTABLE%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM reward_lab.source_refund_notices WHERE order_id='order-alice';
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%AUDIT_IMMUTABLE%' THEN RAISE; END IF;
  END;
  -- An unexpected raw fact for this order, even if paid=true, cannot receive
  -- credit through the verified pipeline.
  PERFORM reward_lab.capture_purchase_at_checkout(
    'order-forged','bob','shop-1','[{"item_id":"kota","quantity":1}]'::jsonb);
  INSERT INTO reward_lab.pickup_source_events(order_id,command_id,revision,kind,actor_uid)
    VALUES('order-forged','f-confirm',1,'payment_confirmed','merchant-a'),
          ('order-forged','f-collected',2,'collected','merchant-a');
  INSERT INTO reward_lab.order_line_facts(
    order_id,line_id,customer_id,shop_id,quantity,paid,collected,eligible_kota,test_record,refunded)
    VALUES('order-forged','injected-line','bob','shop-1',100,true,true,true,false,false);
  BEGIN
    PERFORM reward_lab.credit_snapshotted_pickup('order-forged');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%PERSISTED_FACT_SOURCE_CONFLICT%' THEN RAISE; END IF;
  END;
  IF (SELECT balanced FROM reward_lab.reconcile_allocated_budget()) IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'SNAPSHOT_FINANCIAL_RECONCILIATION_FAILED'; END IF;
END;
$$;
DO $$
BEGIN
  IF has_schema_privilege('rewards_lab_untrusted','reward_lab','USAGE') OR
     has_table_privilege('rewards_lab_untrusted','reward_lab.purchase_line_snapshots','SELECT') OR
     has_function_privilege('rewards_lab_untrusted',
       'reward_lab.credit_snapshotted_pickup(text)','EXECUTE') THEN
    RAISE EXCEPTION 'PURCHASE_SNAPSHOT_PERMISSION_LEAK'; END IF;
END;
$$;
\echo R25_PG17_PURCHASE_TIME_ELIGIBILITY_AND_REFUND_PASS
