-- Disposable PG17 fixture and deterministic assertions. DO NOT run against any hosted database.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE rewards_lab_untrusted NOLOGIN;
INSERT INTO reward_lab.shops VALUES('shop-1'),('shop-2');
INSERT INTO reward_lab.catalogue(shop_id,item_id,item_kind,price_minor) VALUES
 ('shop-1','bronze-kota','standard_kota',2500),
 ('shop-1','other-24','other_food',2400),
 ('shop-1','other-25','other_food',2500),
 ('shop-1','silver-meal','bundle',12500),
 ('shop-1','gold-meal','bundle',20000),
 ('shop-2','other-shop-meal','bundle',12500);
-- All records are synthetic: owner test shops/accounts do not count in Production.
UPDATE reward_lab.program SET active=true,limit_minor=35000,allocated_minor=0 WHERE id=1;
INSERT INTO reward_lab.order_line_facts(
 order_id,line_id,customer_id,shop_id,quantity,paid,collected,eligible_kota,test_record,refunded
) VALUES
 ('synthetic-all','line-1','customer-1','shop-1',64,true,true,true,false,false),
 ('not-paid','line-1','customer-2','shop-1',4,false,true,true,false,false),
 ('not-collected','line-1','customer-2','shop-1',4,true,false,true,false,false),
 ('test-record','line-1','customer-2','shop-1',4,true,true,true,true,false),
 ('refund','line-1','customer-2','shop-1',4,true,true,true,false,true),
 ('not-kota','line-1','customer-2','shop-1',4,true,true,false,false,false),
 ('other-shop','line-1','customer-2','shop-missing',4,true,true,true,false,false);
COMMIT;

DO $$
DECLARE v_units integer;
BEGIN
  v_units:=reward_lab.credit_paid_order('synthetic-all');
  IF v_units<>64 THEN RAISE EXCEPTION '64 units expected, got %',v_units; END IF;
  IF reward_lab.credit_paid_order('synthetic-all')<>0 THEN RAISE EXCEPTION 'REPLAY_DUPLICATED'; END IF;
  IF (SELECT rank FROM reward_lab.progress WHERE customer_id='customer-1')<>'platinum' OR
     (SELECT stage_units FROM reward_lab.progress WHERE customer_id='customer-1')<>0 OR
     (SELECT lifetime_units FROM reward_lab.progress WHERE customer_id='customer-1')<>64
  THEN RAISE EXCEPTION 'RANK_PROGRESSION_FAILED'; END IF;
  IF (SELECT count(*) FROM reward_lab.grants)<>3 OR
     (SELECT allocated_minor FROM reward_lab.program WHERE id=1)<>35000
  THEN RAISE EXCEPTION 'RANK_GRANTS_OR_BUDGET_FAILED'; END IF;
  IF (SELECT count(*) FROM reward_lab.payables)<>0 THEN
    RAISE EXCEPTION 'MILESTONE_CREATED_FALSE_DEBT'; END IF;
  FOR v_units IN 1..7 LOOP
    IF reward_lab.credit_paid_order((ARRAY['not-paid','not-collected','test-record','refund','not-kota','other-shop','not-paid'])[v_units])<>0 THEN
      RAISE EXCEPTION 'UNTRUSTED_EVENT_CREDITED';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM reward_lab.credited_lines)<>1 THEN
    RAISE EXCEPTION 'DISQUALIFIED_PURCHASE_CREDITED'; END IF;
END;
$$;

-- An invalid Bronze alternative cannot produce a payable; a failed SQL
-- procedure rolls back its own event and leaves the grant earned.
DO $$
BEGIN
  BEGIN
    PERFORM reward_lab.fulfil_grant('reward:customer-1:bronze','customer-1','shop-1','other-25','handover-bad');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ALTERNATIVE_FOOD_MUST_COST_BELOW_R25%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM reward_lab.payables) THEN RAISE EXCEPTION 'PAYABLE_BEFORE_HANDOVER'; END IF;
  IF (SELECT status FROM reward_lab.grants WHERE grant_id='reward:customer-1:bronze')<>'earned'
    THEN RAISE EXCEPTION 'FAILED_HANDOVER_MODIFIED_GRANT'; END IF;
END;
$$;

DO $$
DECLARE v_payable text;
BEGIN
  v_payable:=reward_lab.fulfil_grant('reward:customer-1:bronze','customer-1','shop-1','other-24','handover-1');
  IF v_payable<>'payable:reward:customer-1:bronze' THEN RAISE EXCEPTION 'INCORRECT_PAYABLE_ID'; END IF;
  IF reward_lab.fulfil_grant('reward:customer-1:bronze','customer-1','shop-1','other-24','handover-1')<>v_payable THEN
    RAISE EXCEPTION 'HANDOVER_REPLAY_FAILED'; END IF;
  IF (SELECT amount_minor FROM reward_lab.payables WHERE payable_id=v_payable)<>2400 OR
    (SELECT allocated_minor FROM reward_lab.program WHERE id=1)<>34900 THEN
    RAISE EXCEPTION 'PRICE_SNAPSHOT_OR_BUDGET_RELEASE_INCORRECT'; END IF;
  BEGIN
    PERFORM reward_lab.fulfil_grant('reward:customer-1:silver','customer-1','shop-1','silver-meal','handover-1');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    PERFORM reward_lab.fulfil_grant('reward:customer-1:gold','wrong-customer','shop-1','gold-meal','handover-2');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%GRANT_NOT_OWNED%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM reward_lab.payables)<>1 THEN RAISE EXCEPTION 'DUPLICATE_DEBT'; END IF;
END;
$$;

DO $$
DECLARE v_payable text:='payable:reward:customer-1:bronze';
BEGIN
  BEGIN
    PERFORM reward_lab.confirm_merchant_receipt(v_payable,'shop-1','receipt-too-early','received');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%PAYMENT_NOT_SENT%' THEN RAISE; END IF; END;
  PERFORM reward_lab.record_transfer(v_payable,'external-tx-1','admin-1','BANK-REFERENCE-1',2400);
  PERFORM reward_lab.record_transfer(v_payable,'external-tx-1','admin-1','BANK-REFERENCE-1',2400);
  IF (SELECT status FROM reward_lab.payables WHERE payable_id=v_payable)<>'sent'
     THEN RAISE EXCEPTION 'SENT_UNTRUE'; END IF;
  BEGIN
    PERFORM reward_lab.record_transfer(v_payable,'external-tx-2','admin-1','BANK-REFERENCE-1',2400);
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%TRANSFER_REPLAY_CONFLICT%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM reward_lab.confirm_merchant_receipt(v_payable,'shop-2','receipt-wrong','received');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%MERCHANT_FORBIDDEN%' THEN RAISE; END IF; END;
  PERFORM reward_lab.confirm_merchant_receipt(v_payable,'shop-1','receipt-1','received');
  PERFORM reward_lab.confirm_merchant_receipt(v_payable,'shop-1','receipt-1','received');
  IF (SELECT status FROM reward_lab.payables WHERE payable_id=v_payable)<>'confirmed'
    THEN RAISE EXCEPTION 'PAYMENT_SETTLEMENT_UNCONFIRMED'; END IF;
  IF (SELECT allocated_minor FROM reward_lab.program WHERE id=1)<>34900
    THEN RAISE EXCEPTION 'SETTLED_PAYMENT_RESET_SPENDING'; END IF;
END;
$$;

-- Audits are immutable, and there is no direct PUBLIC/anonymous access.
DO $$
BEGIN
  IF has_schema_privilege('rewards_lab_untrusted','reward_lab','USAGE') OR
     has_table_privilege('rewards_lab_untrusted','reward_lab.payables','SELECT') OR
     has_function_privilege('rewards_lab_untrusted','reward_lab.credit_paid_order(text)','EXECUTE') THEN
    RAISE EXCEPTION 'UNTRUSTED_ROLE_HAS_REWARD_ACCESS';
  END IF;
  IF (SELECT count(*) FROM reward_lab.audit)<>6 THEN
    RAISE EXCEPTION 'AUDIT_COUNT_MISMATCH';
  END IF;
  BEGIN
    UPDATE reward_lab.audit SET detail='rewritten' WHERE event_type='earned';
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%AUDIT_IMMUTABLE%' THEN RAISE; END IF; END;
  BEGIN
    DELETE FROM reward_lab.audit WHERE event_type='earned';
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%AUDIT_IMMUTABLE%' THEN RAISE; END IF; END;
END;
$$;
\echo R2_PG17_SERIAL_LEDGER_ASSERTIONS_PASS
