-- R2.3 SYNTHETIC recovery assertions in the same disposable PostgreSQL 17 container.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO reward_lab.shops(shop_id) VALUES('shop-1'),('shop-2');
INSERT INTO reward_lab.catalogue(shop_id,item_id,item_kind,price_minor) VALUES
 ('shop-1','kota-25','standard_kota',2500),
 ('shop-1','kota-24','standard_kota',2400),
 ('shop-1','other-24','other_food',2400);
UPDATE reward_lab.program SET active=true,limit_minor=20000,allocated_minor=0 WHERE id=1;
INSERT INTO reward_lab.order_line_facts
(order_id,line_id,customer_id,shop_id,quantity,paid,collected,eligible_kota,test_record,refunded)
VALUES
 ('refund-a','line','user-a','shop-1',4,true,true,true,false,false),
 ('refund-a-later','line','user-a','shop-1',1,true,true,true,false,false),
 ('refund-b','line','user-b','shop-1',4,true,true,true,false,false),
 ('refund-c','line','user-c','shop-1',4,true,true,true,false,false),
 ('refund-d','line','user-d','shop-1',4,true,true,true,false,false);
COMMIT;

DO $$
BEGIN
  PERFORM reward_lab.credit_paid_order('refund-a');
  PERFORM reward_lab.credit_paid_order('refund-b');
  PERFORM reward_lab.credit_paid_order('refund-c');
  PERFORM reward_lab.credit_paid_order('refund-d');
  IF (SELECT allocated_minor FROM reward_lab.program WHERE id=1)<>10000
    THEN RAISE EXCEPTION 'INITIAL_BUDGET_RESERVATION_FAILED'; END IF;

  -- Refund BEFORE handover. Entitlement stays earned, budget stays reserved.
  PERFORM reward_lab.record_verified_refund('refund-event-a','BANK-REFUND-A','refund-a','line',1,'Customer refunded one kota');
  IF reward_lab.record_verified_refund('refund-event-a','BANK-REFUND-A','refund-a','line',1,'Customer refunded one kota')<>'refund-event-a'
    THEN RAISE EXCEPTION 'REFUND_REPLAY_FAILED'; END IF;
  IF (SELECT rank FROM reward_lab.progress WHERE customer_id='user-a')<>'silver' OR
     (SELECT status FROM reward_lab.grants WHERE grant_id='reward:user-a:bronze')<>'earned' OR
     (SELECT allocated_minor FROM reward_lab.program WHERE id=1)<>10000
     THEN RAISE EXCEPTION 'REFUND_ERASED_RANK_OR_RESERVATION'; END IF;
  IF NOT EXISTS(SELECT 1 FROM reward_lab.customer_holds WHERE customer_id='user-a')
    THEN RAISE EXCEPTION 'REFUND_HOLD_MISSING'; END IF;
  BEGIN
    PERFORM reward_lab.fulfil_grant('reward:user-a:bronze','user-a','shop-1','kota-25','handover-blocked');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CUSTOMER_REWARDS_ON_REFUND_HOLD%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM reward_lab.credit_paid_order('refund-a-later');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CUSTOMER_REWARDS_ON_REFUND_HOLD%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM reward_lab.credited_lines WHERE order_id='refund-a-later')
    THEN RAISE EXCEPTION 'HELD_CUSTOMER_RECEIVED_NEW_CREDIT'; END IF;
  IF EXISTS(SELECT 1 FROM reward_lab.payables WHERE grant_id='reward:user-a:bronze')
    THEN RAISE EXCEPTION 'HELD_REWARD_CREATED_FALSE_PAYABLE'; END IF;
  BEGIN
    PERFORM reward_lab.record_verified_refund('refund-event-a','OTHER-REF','refund-a','line',1,'Customer refunded one kota');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%REFUND_REPLAY_CONFLICT%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM reward_lab.record_verified_refund('refund-event-too-many','OTHER-REF2','refund-a','line',4,'Over-refund');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%REFUND_UNITS_EXCEED_QUALIFIED_QUANTITY%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM reward_lab.record_verified_refund('refund-unknown','UNKNOWN','not-credited','line',1,'Unknown source');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%UNVERIFIED_REFUND_SOURCE%' THEN RAISE; END IF;
  END;

  -- Cancel a pickup attempt BEFORE food exchange. Keep entitlement, no payable.
  PERFORM reward_lab.cancel_uncollected_attempt('attempt-c','reward:user-c:bronze','user-c','Shop closed before pickup');
  PERFORM reward_lab.cancel_uncollected_attempt('attempt-c','reward:user-c:bronze','user-c','Shop closed before pickup');
  IF (SELECT status FROM reward_lab.grants WHERE grant_id='reward:user-c:bronze')<>'earned'
    OR EXISTS(SELECT 1 FROM reward_lab.payables WHERE grant_id='reward:user-c:bronze')
    THEN RAISE EXCEPTION 'UNHANDED_CANCEL_CREATED_DEBT_OR_REMOVED_REWARD'; END IF;
  BEGIN
    PERFORM reward_lab.cancel_uncollected_attempt('attempt-c','reward:user-c:bronze','user-c','Different reason');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CANCELLATION_REPLAY_CONFLICT%' THEN RAISE; END IF;
  END;

  -- After actual handover, later customer refund must NEVER clear merchant debt.
  PERFORM reward_lab.fulfil_grant('reward:user-b:bronze','user-b','shop-1','kota-24','handover-b');
  IF (SELECT amount_minor FROM reward_lab.payables WHERE grant_id='reward:user-b:bronze')<>2400
    THEN RAISE EXCEPTION 'PAYABLE_WRONG_AMOUNT'; END IF;
  PERFORM reward_lab.record_verified_refund('refund-event-b','BANK-REFUND-B','refund-b','line',4,'Full refund following collection');
  IF (SELECT amount_minor FROM reward_lab.payables WHERE grant_id='reward:user-b:bronze')<>2400 OR
     (SELECT status FROM reward_lab.payables WHERE grant_id='reward:user-b:bronze')<>'owed'
    THEN RAISE EXCEPTION 'CUSTOMER_REFUND_CLEARED_MERCHANT_DEBT'; END IF;

  PERFORM reward_lab.record_transfer('payable:reward:user-b:bronze','transfer-b','admin-trusted','BANK-B',2400);
  PERFORM reward_lab.confirm_merchant_receipt('payable:reward:user-b:bronze','shop-1','merchant-dispute-b','disputed');
  PERFORM reward_lab.document_dispute_resolution('resolution-b','payable:reward:user-b:bronze',
    'admin-trusted','Verified bank confirmation submitted for merchant review');
  IF (SELECT status FROM reward_lab.payables WHERE grant_id='reward:user-b:bronze')<>'disputed'
    THEN RAISE EXCEPTION 'ADMIN_MARKED_DISPUTE_SETTLED_WITHOUT_MERCHANT'; END IF;
  BEGIN
    PERFORM reward_lab.merchant_acknowledge_dispute_resolution('ack-wrong','resolution-b','shop-2');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%MERCHANT_FORBIDDEN%' THEN RAISE; END IF;
  END;
  PERFORM reward_lab.merchant_acknowledge_dispute_resolution('ack-b','resolution-b','shop-1');
  PERFORM reward_lab.merchant_acknowledge_dispute_resolution('ack-b','resolution-b','shop-1');
  IF (SELECT status FROM reward_lab.payables WHERE grant_id='reward:user-b:bronze')<>'confirmed'
    THEN RAISE EXCEPTION 'MERCHANT_CONFIRMATION_NOT_SETTLED'; END IF;
  IF (SELECT outcome FROM reward_lab.receipts WHERE payable_id='payable:reward:user-b:bronze')<>'disputed'
    THEN RAISE EXCEPTION 'ORIGINAL_MERCHANT_DISPUTE_WAS_REWRITTEN'; END IF;

  -- Wrong bank reference must be corrected with a separate immutable entry.
  PERFORM reward_lab.fulfil_grant('reward:user-d:bronze','user-d','shop-1','kota-25','handover-d');
  PERFORM reward_lab.record_transfer('payable:reward:user-d:bronze','transfer-d','admin-trusted','WRONG-REFERENCE',2500);
  PERFORM reward_lab.correct_transfer_reference('correction-d','transfer-d','admin-trusted',
    'CORRECT-REFERENCE','Corrected typo from bank statement');
  PERFORM reward_lab.correct_transfer_reference('correction-d','transfer-d','admin-trusted',
    'CORRECT-REFERENCE','Corrected typo from bank statement');
  IF (SELECT bank_reference FROM reward_lab.transfers WHERE transfer_id='transfer-d')<>'WRONG-REFERENCE' OR
     (SELECT new_bank_reference FROM reward_lab.transfer_reference_corrections WHERE transfer_id='transfer-d')<>'CORRECT-REFERENCE' OR
     (SELECT count(*) FROM reward_lab.transfers WHERE payable_id='payable:reward:user-d:bronze')<>1
    THEN RAISE EXCEPTION 'BANK_REFERENCE_CORRECTION_OVERWROTE_PAYMENT'; END IF;
  BEGIN
    PERFORM reward_lab.correct_transfer_reference('correction-new','transfer-d','admin-trusted',
      'ANOTHER-REFERENCE','Cannot silently change a correction');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%REFERENCE_CORRECTION_REPLAY_CONFLICT%' THEN RAISE; END IF;
  END;
  PERFORM reward_lab.confirm_merchant_receipt('payable:reward:user-d:bronze','shop-1','ack-d','received');
  BEGIN
    PERFORM reward_lab.correct_transfer_reference('correction-after','transfer-d','admin-trusted',
      'POST-SETTLEMENT','Corrections are closed after merchant confirmation');
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%REFERENCE_CORRECTION_CLOSED%' THEN RAISE; END IF;
  END;

  -- Even after a confirmed merchant payout, an additional customer refund is a
  -- review event, not a merchant chargeback or negative reimbursement.
  UPDATE reward_lab.program SET active=false WHERE id=1;
  PERFORM reward_lab.record_verified_refund('refund-event-d','BANK-REFUND-D','refund-d','line',4,
    'Refund following confirmed merchant reimbursement');
  IF (SELECT status FROM reward_lab.payables WHERE grant_id='reward:user-d:bronze')<>'confirmed'
     THEN RAISE EXCEPTION 'REFUND_REOPENED_PAID_MERCHANT'; END IF;
  IF NOT EXISTS(SELECT 1 FROM reward_lab.customer_holds WHERE customer_id='user-d')
     THEN RAISE EXCEPTION 'INACTIVE_PROGRAMME_BLOCKED_RECOVERY'; END IF;
  IF (SELECT balanced FROM reward_lab.reconcile_allocated_budget()) IS DISTINCT FROM true
     OR (SELECT allocated_minor FROM reward_lab.program WHERE id=1)<>9900
    THEN RAISE EXCEPTION 'BUDGET_RECONCILIATION_FAILED'; END IF;
END;
$$;

-- Recovery event tables are immutable and hidden from the untrusted role.
DO $$
BEGIN
  IF has_table_privilege('rewards_lab_untrusted','reward_lab.refund_events','SELECT') OR
     has_function_privilege('rewards_lab_untrusted',
       'reward_lab.record_verified_refund(text,text,text,text,integer,text)','EXECUTE')
  THEN RAISE EXCEPTION 'RECOVERY_PERMISSION_LEAK'; END IF;
  BEGIN
    UPDATE reward_lab.refund_events SET reason='Changed' WHERE refund_id='refund-event-a';
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%AUDIT_IMMUTABLE%' THEN RAISE; END IF; END;
  BEGIN
    DELETE FROM reward_lab.transfer_reference_corrections WHERE correction_id='correction-d';
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%AUDIT_IMMUTABLE%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM reward_lab.audit WHERE event_type IN(
      'refund_hold','attempt_cancelled','resolution_documented',
      'merchant_resolution_ack','reference_corrected'))<>7
  THEN RAISE EXCEPTION 'RECOVERY_AUDIT_EVENT_COUNT_WRONG'; END IF;
END;
$$;
\echo R23_PG17_REFUND_AND_SETTLEMENT_ASSERTIONS_PASS
