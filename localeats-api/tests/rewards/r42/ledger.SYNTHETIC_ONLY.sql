-- LocalPay Rewards R4.2: SCRATCH PostgreSQL 17 ONLY.
-- DO NOT ADD TO MIGRATIONS, APPLY IN SUPABASE, OR EXPOSE AS AN API.
-- All "paid", "collected", bank evidence and identities are synthetic fixtures.
BEGIN;
CREATE ROLE r42_untrusted NOLOGIN;
CREATE SCHEMA r42_lab;
REVOKE ALL ON SCHEMA r42_lab FROM PUBLIC;
CREATE TABLE r42_lab.pool (
  id int PRIMARY KEY CHECK(id=1),
  funded_minor bigint NOT NULL CHECK(funded_minor=50000),
  uncommitted_minor bigint NOT NULL CHECK(uncommitted_minor>=0),
  reserved_minor bigint NOT NULL CHECK(reserved_minor>=0),
  customer_minor bigint NOT NULL CHECK(customer_minor>=0),
  held_minor bigint NOT NULL CHECK(held_minor>=0),
  payable_minor bigint NOT NULL CHECK(payable_minor>=0),
  paid_out_minor bigint NOT NULL CHECK(paid_out_minor>=0),
  admissions int NOT NULL CHECK(admissions BETWEEN 0 AND 12),
  CHECK (uncommitted_minor+reserved_minor+customer_minor+
    held_minor+payable_minor+paid_out_minor=funded_minor)
);
INSERT INTO r42_lab.pool VALUES (1,50000,50000,0,0,0,0,0,0);
CREATE TABLE r42_lab.shops(shop_id text PRIMARY KEY);
INSERT INTO r42_lab.shops VALUES('my-kota'),('shop-b');
CREATE TABLE r42_lab.customers (
  customer_id text PRIMARY KEY,
  bought_units int NOT NULL DEFAULT 0 CHECK(bought_units>=0),
  bronze_issued boolean NOT NULL DEFAULT false
);
CREATE TABLE r42_lab.purchases (
  order_id text NOT NULL,line_id text NOT NULL,
  customer_id text NOT NULL REFERENCES r42_lab.customers(customer_id),
  shop_id text NOT NULL REFERENCES r42_lab.shops(shop_id),
  qty int NOT NULL CHECK(qty BETWEEN 1 AND 100),
  PRIMARY KEY(order_id,line_id)
);
CREATE TABLE r42_lab.grants (
  grant_id text PRIMARY KEY,
  customer_id text NOT NULL UNIQUE REFERENCES r42_lab.customers(customer_id),
  cap_minor int NOT NULL DEFAULT 2500 CHECK(cap_minor=2500),
  available_minor int NOT NULL CHECK(available_minor>=0),
  held_minor int NOT NULL CHECK(held_minor>=0),
  redeemed boolean NOT NULL DEFAULT false,
  CHECK(available_minor+held_minor<=cap_minor)
);
CREATE TABLE r42_lab.holds(
  hold_id text PRIMARY KEY,
  order_id text NOT NULL UNIQUE,
  grant_id text NOT NULL REFERENCES r42_lab.grants(grant_id),
  shop_id text NOT NULL REFERENCES r42_lab.shops(shop_id),
  amount_minor int NOT NULL CHECK(amount_minor BETWEEN 1 AND 2500),
  status text NOT NULL DEFAULT 'held' CHECK(status IN('held','cancelled','captured')),
  handover_id text UNIQUE
);
CREATE TABLE r42_lab.handover_proofs (
  handover_id text PRIMARY KEY,
  hold_id text NOT NULL UNIQUE,
  shop_id text NOT NULL,
  paid_remainder boolean NOT NULL,
  collected boolean NOT NULL,
  proof_source text NOT NULL CHECK(proof_source='SYNTHETIC_PRIVATE_DB_FIXTURE')
);
CREATE TABLE r42_lab.payables (
  payable_id text PRIMARY KEY,
  hold_id text NOT NULL UNIQUE REFERENCES r42_lab.holds(hold_id),
  handover_id text NOT NULL UNIQUE REFERENCES r42_lab.handover_proofs(handover_id),
  shop_id text NOT NULL REFERENCES r42_lab.shops(shop_id),
  amount_minor int NOT NULL CHECK(amount_minor BETWEEN 1 AND 2500),
  status text NOT NULL CHECK(status IN('owed','sent','confirmed','disputed'))
);
CREATE TABLE r42_lab.bank_proofs(
  bank_reference text PRIMARY KEY,
  transfer_id text NOT NULL UNIQUE,
  amount_minor int NOT NULL CHECK(amount_minor>0),
  proof_source text NOT NULL CHECK(proof_source='SYNTHETIC_BANK_FIXTURE')
);
CREATE TABLE r42_lab.transfers(
  transfer_id text PRIMARY KEY,
  payable_id text NOT NULL UNIQUE REFERENCES r42_lab.payables(payable_id),
  bank_reference text NOT NULL UNIQUE REFERENCES r42_lab.bank_proofs(bank_reference),
  amount_minor int NOT NULL CHECK(amount_minor>0),
  admin_id text NOT NULL
);
CREATE TABLE r42_lab.receipts(
  receipt_id text PRIMARY KEY,
  payable_id text NOT NULL UNIQUE REFERENCES r42_lab.payables(payable_id),
  shop_id text NOT NULL,
  decision text NOT NULL CHECK(decision IN('received','disputed'))
);
CREATE TABLE r42_lab.journal(
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL, ref text NOT NULL,
  source_bucket text NOT NULL, target_bucket text NOT NULL,
  minor int NOT NULL CHECK(minor>0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE FUNCTION r42_lab.deny_history_mutation() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN RAISE EXCEPTION 'R42_APPEND_ONLY'; END
$fn$;
CREATE TRIGGER purchases_immutable BEFORE UPDATE OR DELETE ON r42_lab.purchases
 FOR EACH ROW EXECUTE FUNCTION r42_lab.deny_history_mutation();
CREATE TRIGGER handover_proofs_immutable BEFORE UPDATE OR DELETE ON r42_lab.handover_proofs
 FOR EACH ROW EXECUTE FUNCTION r42_lab.deny_history_mutation();
CREATE TRIGGER bank_proofs_immutable BEFORE UPDATE OR DELETE ON r42_lab.bank_proofs
 FOR EACH ROW EXECUTE FUNCTION r42_lab.deny_history_mutation();
CREATE TRIGGER transfers_immutable BEFORE UPDATE OR DELETE ON r42_lab.transfers
 FOR EACH ROW EXECUTE FUNCTION r42_lab.deny_history_mutation();
CREATE TRIGGER receipts_immutable BEFORE UPDATE OR DELETE ON r42_lab.receipts
 FOR EACH ROW EXECUTE FUNCTION r42_lab.deny_history_mutation();
CREATE TRIGGER journal_immutable BEFORE UPDATE OR DELETE ON r42_lab.journal
 FOR EACH ROW EXECUTE FUNCTION r42_lab.deny_history_mutation();

-- These functions are SECURITY INVOKER and private to a scratch owner.
-- Never interpret caller arguments as real trusted payment/pickup evidence.
CREATE FUNCTION r42_lab.admit(p_customer text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE v r42_lab.pool%ROWTYPE;
BEGIN
  IF p_customer IS NULL OR length(p_customer) NOT BETWEEN 1 AND 80
    THEN RAISE EXCEPTION 'R42_BAD_CUSTOMER'; END IF;
  SELECT * INTO STRICT v FROM r42_lab.pool WHERE id=1 FOR UPDATE;
  IF EXISTS(SELECT 1 FROM r42_lab.customers WHERE customer_id=p_customer)
    THEN RETURN 'REPLAY'; END IF;
  IF v.admissions>=12 THEN RAISE EXCEPTION 'R42_COHORT_FULL'; END IF;
  IF v.uncommitted_minor<2500 THEN RAISE EXCEPTION 'R42_BUDGET_FULL'; END IF;
  INSERT INTO r42_lab.customers(customer_id) VALUES(p_customer);
  UPDATE r42_lab.pool SET admissions=admissions+1,
    uncommitted_minor=uncommitted_minor-2500,reserved_minor=reserved_minor+2500 WHERE id=1;
  INSERT INTO r42_lab.journal(kind,ref,source_bucket,target_bucket,minor)
    VALUES('enroll',p_customer,'uncommitted','reserved',2500);
  RETURN 'ADMITTED';
END
$fn$;
CREATE FUNCTION r42_lab.credit_paid_collected(
  p_order text,p_line text,p_customer text,p_shop text,p_qty int,
  p_paid boolean,p_collected boolean,p_test boolean,p_refunded boolean,
  p_reward_funded boolean
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE old r42_lab.purchases%ROWTYPE; v r42_lab.customers%ROWTYPE;
BEGIN
  IF p_order IS NULL OR p_line IS NULL OR length(p_order) NOT BETWEEN 1 AND 80
    OR length(p_line) NOT BETWEEN 1 AND 80 OR p_qty NOT BETWEEN 1 AND 100
    OR p_paid IS DISTINCT FROM true OR p_collected IS DISTINCT FROM true
    OR p_test IS DISTINCT FROM false OR p_refunded IS DISTINCT FROM false
    OR p_reward_funded IS DISTINCT FROM false
    THEN RAISE EXCEPTION 'R42_NOT_VALID_PAID_COLLECTED_PURCHASE'; END IF;
  PERFORM 1 FROM r42_lab.pool WHERE id=1 FOR UPDATE;
  SELECT * INTO old FROM r42_lab.purchases WHERE order_id=p_order AND line_id=p_line;
  IF FOUND THEN
    IF (old.customer_id,old.shop_id,old.qty) IS DISTINCT FROM (p_customer,p_shop,p_qty)
      THEN RAISE EXCEPTION 'R42_PURCHASE_REPLAY_CONFLICT'; END IF;
    RETURN 'REPLAY';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM r42_lab.shops WHERE shop_id=p_shop)
    THEN RAISE EXCEPTION 'R42_SHOP_NOT_PARTICIPATING'; END IF;
  SELECT * INTO v FROM r42_lab.customers WHERE customer_id=p_customer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'R42_NOT_ENROLLED'; END IF;
  INSERT INTO r42_lab.purchases VALUES(p_order,p_line,p_customer,p_shop,p_qty);
  UPDATE r42_lab.customers SET bought_units=bought_units+p_qty WHERE customer_id=p_customer;
  IF NOT v.bronze_issued AND v.bought_units+p_qty >= 4 THEN
    INSERT INTO r42_lab.grants(grant_id,customer_id,available_minor,held_minor)
      VALUES('bronze:'||p_customer,p_customer,2500,0);
    UPDATE r42_lab.customers SET bronze_issued=true WHERE customer_id=p_customer;
    UPDATE r42_lab.pool SET reserved_minor=reserved_minor-2500,
      customer_minor=customer_minor+2500 WHERE id=1;
    INSERT INTO r42_lab.journal(kind,ref,source_bucket,target_bucket,minor)
      VALUES('bronze-earned',p_customer,'reserved','customer',2500);
    RETURN 'BRONZE_ONCE';
  END IF;
  RETURN 'COUNTED';
END
$fn$;
CREATE FUNCTION r42_lab.reserve_gift(
  p_hold text,p_order text,p_customer text,p_shop text,p_minor int
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE g r42_lab.grants%ROWTYPE; h r42_lab.holds%ROWTYPE;
BEGIN
  IF p_hold IS NULL OR p_order IS NULL OR p_customer IS NULL OR p_shop IS NULL
   OR length(p_hold) NOT BETWEEN 1 AND 80 OR length(p_order) NOT BETWEEN 1 AND 80
   OR p_minor NOT BETWEEN 1 AND 2500
   THEN RAISE EXCEPTION 'R42_BAD_HOLD'; END IF;
  PERFORM 1 FROM r42_lab.pool WHERE id=1 FOR UPDATE;
  SELECT * INTO h FROM r42_lab.holds WHERE hold_id=p_hold;
  IF FOUND THEN
    IF (h.order_id,h.grant_id,h.shop_id,h.amount_minor)
       IS DISTINCT FROM(p_order,'bronze:'||p_customer,p_shop,p_minor)
      THEN RAISE EXCEPTION 'R42_HOLD_REPLAY_CONFLICT'; END IF;
    RETURN 'REPLAY';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM r42_lab.shops WHERE shop_id=p_shop)
     THEN RAISE EXCEPTION 'R42_SHOP_NOT_PARTICIPATING'; END IF;
  SELECT * INTO g FROM r42_lab.grants WHERE grant_id='bronze:'||p_customer FOR UPDATE;
  IF NOT FOUND OR g.redeemed OR g.held_minor>0 OR g.available_minor<p_minor
    THEN RAISE EXCEPTION 'R42_GIFT_ALREADY_SPENT_OR_HELD'; END IF;
  INSERT INTO r42_lab.holds(hold_id,order_id,grant_id,shop_id,amount_minor)
    VALUES(p_hold,p_order,g.grant_id,p_shop,p_minor);
  UPDATE r42_lab.grants SET available_minor=available_minor-p_minor,
    held_minor=held_minor+p_minor WHERE grant_id=g.grant_id;
  UPDATE r42_lab.pool SET customer_minor=customer_minor-p_minor,
    held_minor=held_minor+p_minor WHERE id=1;
  INSERT INTO r42_lab.journal(kind,ref,source_bucket,target_bucket,minor)
    VALUES('hold',p_hold,'customer','held',p_minor);
  RETURN 'HELD';
END
$fn$;
CREATE FUNCTION r42_lab.cancel_gift(p_hold text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE h r42_lab.holds%ROWTYPE;
BEGIN
 PERFORM 1 FROM r42_lab.pool WHERE id=1 FOR UPDATE;
 SELECT * INTO h FROM r42_lab.holds WHERE hold_id=p_hold FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'R42_HOLD_MISSING'; END IF;
 IF h.status='cancelled' THEN RETURN 'REPLAY'; END IF;
 IF h.status<>'held' THEN RAISE EXCEPTION 'R42_HOLD_ALREADY_CAPTURED'; END IF;
 UPDATE r42_lab.holds SET status='cancelled' WHERE hold_id=p_hold;
 UPDATE r42_lab.grants SET held_minor=held_minor-h.amount_minor,
   available_minor=available_minor+h.amount_minor WHERE grant_id=h.grant_id;
 UPDATE r42_lab.pool SET held_minor=held_minor-h.amount_minor,
   customer_minor=customer_minor+h.amount_minor WHERE id=1;
 INSERT INTO r42_lab.journal(kind,ref,source_bucket,target_bucket,minor)
 VALUES('cancel',p_hold,'held','customer',h.amount_minor);
 RETURN 'CANCELLED';
END
$fn$;
CREATE FUNCTION r42_lab.capture_gift(p_hold text,p_handover text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE h r42_lab.holds%ROWTYPE; g r42_lab.grants%ROWTYPE;
        proof r42_lab.handover_proofs%ROWTYPE;
BEGIN
 PERFORM 1 FROM r42_lab.pool WHERE id=1 FOR UPDATE;
 SELECT * INTO h FROM r42_lab.holds WHERE hold_id=p_hold FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'R42_HOLD_MISSING'; END IF;
 IF h.status='captured' THEN
   IF h.handover_id=p_handover THEN RETURN 'REPLAY'; END IF;
   RAISE EXCEPTION 'R42_HANDOVER_REPLAY_CONFLICT';
 END IF;
 IF h.status<>'held' THEN RAISE EXCEPTION 'R42_GIFT_CANCELLED'; END IF;
 SELECT * INTO proof FROM r42_lab.handover_proofs WHERE handover_id=p_handover;
 IF NOT FOUND OR proof.hold_id<>p_hold OR proof.shop_id<>h.shop_id
   OR proof.paid_remainder IS DISTINCT FROM true
   OR proof.collected IS DISTINCT FROM true
   THEN RAISE EXCEPTION 'R42_PAYMENT_AND_HANDOVER_PROOF_REQUIRED'; END IF;
 SELECT * INTO STRICT g FROM r42_lab.grants WHERE grant_id=h.grant_id FOR UPDATE;
 IF g.redeemed OR g.held_minor<>h.amount_minor
   THEN RAISE EXCEPTION 'R42_GIFT_NOT_AVAILABLE'; END IF;
 UPDATE r42_lab.holds SET status='captured',handover_id=p_handover WHERE hold_id=p_hold;
 UPDATE r42_lab.grants SET redeemed=true, held_minor=0, available_minor=0 WHERE grant_id=g.grant_id;
 UPDATE r42_lab.pool SET held_minor=held_minor-h.amount_minor,
   payable_minor=payable_minor+h.amount_minor,
   customer_minor=customer_minor-g.available_minor,
   uncommitted_minor=uncommitted_minor+g.available_minor WHERE id=1;
 INSERT INTO r42_lab.payables(payable_id,hold_id,handover_id,shop_id,amount_minor,status)
   VALUES('payable:'||p_hold,p_hold,p_handover,h.shop_id,h.amount_minor,'owed');
 INSERT INTO r42_lab.journal(kind,ref,source_bucket,target_bucket,minor)
   VALUES('handover',p_handover,'held','payable',h.amount_minor);
 IF g.available_minor>0 THEN
 INSERT INTO r42_lab.journal(kind,ref,source_bucket,target_bucket,minor)
   VALUES('bronze-unused-cap',p_handover,'customer','uncommitted',g.available_minor);
 END IF;
 RETURN 'PAYABLE_CREATED';
END
$fn$;
CREATE FUNCTION r42_lab.record_bank_fixture(
 p_payable text,p_transfer text,p_ref text,p_amount int,p_admin text
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE payable r42_lab.payables%ROWTYPE; proof r42_lab.bank_proofs%ROWTYPE;
        prior r42_lab.transfers%ROWTYPE;
BEGIN
 IF p_admin IS DISTINCT FROM 'synthetic-owner-admin'
  THEN RAISE EXCEPTION 'R42_ADMIN_NOT_VERIFIED'; END IF;
 PERFORM 1 FROM r42_lab.pool WHERE id=1 FOR UPDATE;
 SELECT * INTO payable FROM r42_lab.payables WHERE payable_id=p_payable FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'R42_PAYABLE_MISSING'; END IF;
 SELECT * INTO prior FROM r42_lab.transfers WHERE payable_id=p_payable;
 IF FOUND THEN
   IF (prior.transfer_id,prior.bank_reference,prior.amount_minor,prior.admin_id)
      IS DISTINCT FROM(p_transfer,p_ref,p_amount,p_admin)
      THEN RAISE EXCEPTION 'R42_PAYMENT_REPLAY_CONFLICT'; END IF;
   RETURN 'REPLAY';
 END IF;
 IF payable.status<>'owed' OR payable.amount_minor IS DISTINCT FROM p_amount
   THEN RAISE EXCEPTION 'R42_PAYMENT_NOT_OWED_OR_AMOUNT_WRONG'; END IF;
 SELECT * INTO proof FROM r42_lab.bank_proofs WHERE bank_reference=p_ref;
 IF NOT FOUND OR proof.transfer_id<>p_transfer OR proof.amount_minor<>p_amount
    THEN RAISE EXCEPTION 'R42_BANK_PROOF_UNAVAILABLE'; END IF;
 INSERT INTO r42_lab.transfers VALUES(p_transfer,p_payable,p_ref,p_amount,p_admin);
 UPDATE r42_lab.payables SET status='sent' WHERE payable_id=p_payable;
 UPDATE r42_lab.pool SET payable_minor=payable_minor-p_amount,
   paid_out_minor=paid_out_minor+p_amount WHERE id=1;
 INSERT INTO r42_lab.journal(kind,ref,source_bucket,target_bucket,minor)
   VALUES('bank-evidence',p_transfer,'payable','paid_out',p_amount);
 RETURN 'SENT_NOT_CONFIRMED';
END
$fn$;
CREATE FUNCTION r42_lab.record_merchant_receipt(
 p_payable text,p_shop text,p_receipt text,p_decision text
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE payable r42_lab.payables%ROWTYPE; receipt r42_lab.receipts%ROWTYPE;
BEGIN
 IF p_decision NOT IN ('received','disputed') OR p_decision IS NULL
   THEN RAISE EXCEPTION 'R42_BAD_RECEIPT'; END IF;
 PERFORM 1 FROM r42_lab.pool WHERE id=1 FOR UPDATE;
 SELECT * INTO payable FROM r42_lab.payables WHERE payable_id=p_payable FOR UPDATE;
 IF NOT FOUND OR payable.shop_id IS DISTINCT FROM p_shop
   THEN RAISE EXCEPTION 'R42_WRONG_MERCHANT'; END IF;
 SELECT * INTO receipt FROM r42_lab.receipts WHERE payable_id=p_payable;
 IF FOUND THEN
   IF (receipt.receipt_id,receipt.shop_id,receipt.decision)
      IS DISTINCT FROM (p_receipt,p_shop,p_decision)
      THEN RAISE EXCEPTION 'R42_RECEIPT_REPLAY_CONFLICT'; END IF;
   RETURN 'REPLAY';
 END IF;
 IF payable.status<>'sent' THEN RAISE EXCEPTION 'R42_TRANSFER_NOT_SENT'; END IF;
 INSERT INTO r42_lab.receipts VALUES(p_receipt,p_payable,p_shop,p_decision);
 UPDATE r42_lab.payables SET status=CASE WHEN p_decision='received' THEN 'confirmed'
                                      ELSE 'disputed' END WHERE payable_id=p_payable;
 RETURN 'RECEIPT_RECORDED';
END
$fn$;
CREATE FUNCTION r42_lab.reconcile() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $fn$
SELECT p.uncommitted_minor+p.reserved_minor+p.customer_minor+
       p.held_minor+p.payable_minor+p.paid_out_minor=p.funded_minor
 AND p.admissions=(SELECT count(*) FROM r42_lab.customers)
 AND p.reserved_minor=2500*(SELECT count(*) FROM r42_lab.customers WHERE bronze_issued=false)
 AND p.customer_minor=(SELECT coalesce(sum(available_minor),0) FROM r42_lab.grants)
 AND p.held_minor=(SELECT coalesce(sum(held_minor),0) FROM r42_lab.grants)
 AND p.payable_minor=(SELECT coalesce(sum(amount_minor),0) FROM r42_lab.payables WHERE status='owed')
 AND p.paid_out_minor=(SELECT coalesce(sum(amount_minor),0) FROM r42_lab.transfers)
 FROM r42_lab.pool p WHERE p.id=1;
$fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA r42_lab FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA r42_lab FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA r42_lab FROM PUBLIC;
COMMIT;
