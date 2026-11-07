-- R2.2 SYNTHETIC ONLY. Never apply this file to Supabase, Production, or staging.
-- Loaded only into a disposable PostgreSQL 17 Docker database by CI.
BEGIN;
CREATE SCHEMA reward_lab;
REVOKE ALL ON SCHEMA reward_lab FROM PUBLIC;

CREATE TABLE reward_lab.program (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active boolean NOT NULL DEFAULT false,
  limit_minor bigint NOT NULL CHECK (limit_minor >= 0),
  allocated_minor bigint NOT NULL DEFAULT 0 CHECK (allocated_minor >= 0 AND allocated_minor <= limit_minor)
);
INSERT INTO reward_lab.program (id,limit_minor) VALUES (1,0);

CREATE TABLE reward_lab.shops (shop_id text PRIMARY KEY);
CREATE TABLE reward_lab.catalogue (
  shop_id text NOT NULL REFERENCES reward_lab.shops(shop_id),
  item_id text NOT NULL,
  item_kind text NOT NULL CHECK(item_kind IN ('standard_kota','other_food','bundle')),
  price_minor integer NOT NULL CHECK(price_minor > 0),
  available boolean NOT NULL DEFAULT true,
  PRIMARY KEY(shop_id,item_id)
);
-- In the real integration these rows MUST be sourced from verified server-side
-- paid + collected orders and immutable menu-line price/eligibility snapshots.
CREATE TABLE reward_lab.order_line_facts (
  order_id text NOT NULL,
  line_id text NOT NULL,
  customer_id text NOT NULL,
  shop_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  paid boolean NOT NULL,
  collected boolean NOT NULL,
  eligible_kota boolean NOT NULL,
  test_record boolean NOT NULL,
  refunded boolean NOT NULL,
  PRIMARY KEY(order_id,line_id)
);
CREATE TABLE reward_lab.credited_lines (
  order_id text NOT NULL,
  line_id text NOT NULL,
  customer_id text NOT NULL,
  units integer NOT NULL CHECK(units BETWEEN 1 AND 100),
  PRIMARY KEY(order_id,line_id),
  FOREIGN KEY(order_id,line_id) REFERENCES reward_lab.order_line_facts(order_id,line_id)
);
CREATE TABLE reward_lab.progress (
  customer_id text PRIMARY KEY,
  rank text NOT NULL DEFAULT 'bronze' CHECK(rank IN ('bronze','silver','gold','platinum')),
  stage_units integer NOT NULL DEFAULT 0 CHECK(stage_units>=0),
  lifetime_units bigint NOT NULL DEFAULT 0 CHECK(lifetime_units>=0)
);
CREATE TABLE reward_lab.grants (
  grant_id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES reward_lab.progress(customer_id),
  tier text NOT NULL CHECK(tier IN ('bronze','silver','gold')),
  cap_minor integer NOT NULL CHECK(cap_minor>0),
  status text NOT NULL DEFAULT 'earned' CHECK(status IN ('earned','fulfilled')),
  source_order_id text NOT NULL,
  UNIQUE(customer_id,tier)
);
CREATE TABLE reward_lab.handovers (
  handover_id text PRIMARY KEY,
  grant_id text NOT NULL UNIQUE REFERENCES reward_lab.grants(grant_id),
  customer_id text NOT NULL,
  shop_id text NOT NULL,
  item_id text NOT NULL,
  amount_minor integer NOT NULL CHECK(amount_minor>0)
);
CREATE TABLE reward_lab.payables (
  payable_id text PRIMARY KEY,
  handover_id text NOT NULL UNIQUE REFERENCES reward_lab.handovers(handover_id),
  grant_id text NOT NULL UNIQUE REFERENCES reward_lab.grants(grant_id),
  shop_id text NOT NULL REFERENCES reward_lab.shops(shop_id),
  amount_minor integer NOT NULL CHECK(amount_minor>0),
  status text NOT NULL CHECK(status IN ('owed','sent','confirmed','disputed'))
);
CREATE TABLE reward_lab.transfers (
  transfer_id text PRIMARY KEY,
  payable_id text NOT NULL UNIQUE REFERENCES reward_lab.payables(payable_id),
  admin_id text NOT NULL,
  bank_reference text NOT NULL,
  amount_minor integer NOT NULL CHECK(amount_minor>0)
);
CREATE TABLE reward_lab.receipts (
  receipt_id text PRIMARY KEY,
  payable_id text NOT NULL UNIQUE REFERENCES reward_lab.payables(payable_id),
  shop_id text NOT NULL REFERENCES reward_lab.shops(shop_id),
  outcome text NOT NULL CHECK(outcome IN ('received','disputed'))
);
CREATE TABLE reward_lab.audit (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  subject_id text NOT NULL,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_type,subject_id)
);
CREATE FUNCTION reward_lab.reject_audit_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $$
BEGIN RAISE EXCEPTION 'AUDIT_IMMUTABLE'; END;
$$;
CREATE TRIGGER deny_audit_change BEFORE UPDATE OR DELETE ON reward_lab.audit
FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_audit_change();

-- Serialized budget reservation and per-order-line credit. All writes in one call
-- roll back atomically if budget cannot cover every newly earned milestone.
CREATE FUNCTION reward_lab.credit_paid_order(p_order_id text) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $$
DECLARE
  v_active boolean;
  v_line reward_lab.order_line_facts%ROWTYPE;
  v_rank text;
  v_stage integer;
  v_lifetime bigint;
  v_threshold integer;
  v_cap integer;
  v_next text;
  v_rows integer;
  v_awarded integer:=0;
  v_seen boolean:=false;
  v_i integer;
BEGIN
  SELECT active INTO v_active FROM reward_lab.program WHERE id=1 FOR UPDATE;
  IF v_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'REWARDS_INACTIVE'; END IF;
  FOR v_line IN SELECT * FROM reward_lab.order_line_facts
    WHERE order_id=p_order_id ORDER BY line_id
  LOOP
    v_seen:=true;
    IF NOT (v_line.paid AND v_line.collected AND v_line.eligible_kota) OR
      v_line.test_record OR v_line.refunded OR
      NOT EXISTS(SELECT 1 FROM reward_lab.shops WHERE shop_id=v_line.shop_id)
    THEN CONTINUE; END IF;

    INSERT INTO reward_lab.credited_lines(order_id,line_id,customer_id,units)
      VALUES(v_line.order_id,v_line.line_id,v_line.customer_id,v_line.quantity)
      ON CONFLICT(order_id,line_id) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows=0 THEN CONTINUE; END IF;
    INSERT INTO reward_lab.progress(customer_id) VALUES(v_line.customer_id)
      ON CONFLICT(customer_id) DO NOTHING;
    SELECT rank,stage_units,lifetime_units INTO v_rank,v_stage,v_lifetime
      FROM reward_lab.progress WHERE customer_id=v_line.customer_id FOR UPDATE;

    FOR v_i IN 1..v_line.quantity LOOP
      IF v_rank = 'platinum' THEN CONTINUE; END IF;
      v_stage:=v_stage+1;
      v_threshold:=CASE v_rank WHEN 'bronze' THEN 4 WHEN 'silver' THEN 20 ELSE 40 END;
      IF v_stage=v_threshold THEN
        v_cap:=CASE v_rank WHEN 'bronze' THEN 2500 WHEN 'silver' THEN 12500 ELSE 20000 END;
        v_next:=CASE v_rank WHEN 'bronze' THEN 'silver' WHEN 'silver' THEN 'gold' ELSE 'platinum' END;
        UPDATE reward_lab.program SET allocated_minor=allocated_minor+v_cap
          WHERE id=1 AND allocated_minor+v_cap<=limit_minor;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows<>1 THEN RAISE EXCEPTION 'REWARD_BUDGET_EXHAUSTED'; END IF;
        INSERT INTO reward_lab.grants(grant_id,customer_id,tier,cap_minor,source_order_id)
          VALUES('reward:'||v_line.customer_id||':'||v_rank,v_line.customer_id,v_rank,v_cap,v_line.order_id);
        INSERT INTO reward_lab.audit(event_type,subject_id,detail)
          VALUES('earned','reward:'||v_line.customer_id||':'||v_rank,v_line.order_id);
        v_stage:=0;
        v_rank:=v_next;
      END IF;
    END LOOP;
    UPDATE reward_lab.progress SET rank=v_rank,stage_units=v_stage,
      lifetime_units=v_lifetime+v_line.quantity WHERE customer_id=v_line.customer_id;
    v_awarded:=v_awarded+v_line.quantity;
  END LOOP;
  IF NOT v_seen THEN RAISE EXCEPTION 'SOURCE_ORDER_NOT_FOUND'; END IF;
  RETURN v_awarded;
END;
$$;

-- These are internal-only rehearsal functions. A future API MUST derive trusted
-- merchant identity, authorised handover, catalogue price and grant ownership.
CREATE FUNCTION reward_lab.fulfil_grant(
  p_grant text,p_customer text,p_shop text,p_item text,p_handover text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $$
DECLARE
  v_active boolean;
  v_grant reward_lab.grants%ROWTYPE;
  v_item reward_lab.catalogue%ROWTYPE;
  v_old reward_lab.handovers%ROWTYPE;
  v_payable text;
BEGIN
  SELECT active INTO v_active FROM reward_lab.program WHERE id=1 FOR UPDATE;
  IF v_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'REWARDS_INACTIVE'; END IF;
  SELECT * INTO v_grant FROM reward_lab.grants WHERE grant_id=p_grant FOR UPDATE;
  IF NOT FOUND OR v_grant.customer_id<>p_customer THEN RAISE EXCEPTION 'GRANT_NOT_OWNED'; END IF;
  SELECT * INTO v_old FROM reward_lab.handovers WHERE grant_id=p_grant;
  IF FOUND THEN
    IF v_old.handover_id=p_handover AND v_old.shop_id=p_shop AND v_old.item_id=p_item THEN
      RETURN 'payable:'||p_grant;
    END IF;
    RAISE EXCEPTION 'REDEMPTION_REPLAY_CONFLICT';
  END IF;
  IF v_grant.status<>'earned' THEN RAISE EXCEPTION 'GRANT_ALREADY_FULFILLED'; END IF;
  SELECT * INTO v_item FROM reward_lab.catalogue
    WHERE shop_id=p_shop AND item_id=p_item AND available=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_ELIGIBLE'; END IF;
  IF v_item.price_minor>v_grant.cap_minor THEN RAISE EXCEPTION 'REWARD_PRICE_INVALID'; END IF;
  IF v_grant.tier='bronze' THEN
    IF v_item.item_kind NOT IN ('standard_kota','other_food') THEN
      RAISE EXCEPTION 'BRONZE_ITEM_INVALID';
    END IF;
    IF v_item.item_kind='other_food' AND v_item.price_minor>=2500 THEN
      RAISE EXCEPTION 'ALTERNATIVE_FOOD_MUST_COST_BELOW_R25';
    END IF;
  ELSIF v_item.item_kind<>'bundle' THEN RAISE EXCEPTION 'BUNDLE_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM reward_lab.shops WHERE shop_id=p_shop) THEN
    RAISE EXCEPTION 'SHOP_NOT_PARTICIPATING';
  END IF;

  INSERT INTO reward_lab.handovers(handover_id,grant_id,customer_id,shop_id,item_id,amount_minor)
    VALUES(p_handover,p_grant,p_customer,p_shop,p_item,v_item.price_minor);
  UPDATE reward_lab.grants SET status='fulfilled' WHERE grant_id=p_grant;
  v_payable:='payable:'||p_grant;
  INSERT INTO reward_lab.payables(payable_id,handover_id,grant_id,shop_id,amount_minor,status)
    VALUES(v_payable,p_handover,p_grant,p_shop,v_item.price_minor,'owed');
  UPDATE reward_lab.program SET allocated_minor=allocated_minor-v_grant.cap_minor+v_item.price_minor WHERE id=1;
  INSERT INTO reward_lab.audit(event_type,subject_id,detail)
    VALUES('fulfilled',p_grant,p_handover);
  RETURN v_payable;
END;
$$;

-- An admin records an EXTERNAL transfer; this does not perform the transfer.
CREATE FUNCTION reward_lab.record_transfer(
  p_payable text,p_transfer text,p_admin text,p_bank_reference text,p_amount integer)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $$
DECLARE
  v_payable reward_lab.payables%ROWTYPE;
  v_old reward_lab.transfers%ROWTYPE;
  v_active boolean;
BEGIN
  SELECT active INTO v_active FROM reward_lab.program WHERE id=1;
  IF v_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'REWARDS_INACTIVE'; END IF;
  IF p_transfer IS NULL OR trim(p_transfer)='' OR p_admin IS NULL OR trim(p_admin)='' OR
    p_bank_reference IS NULL OR trim(p_bank_reference)='' THEN
    RAISE EXCEPTION 'INVALID_TRANSFER_REFERENCE';
  END IF;
  SELECT * INTO v_payable FROM reward_lab.payables WHERE payable_id=p_payable FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYABLE_NOT_FOUND'; END IF;
  SELECT * INTO v_old FROM reward_lab.transfers WHERE payable_id=p_payable;
  IF FOUND THEN
    IF v_old.transfer_id=p_transfer AND v_old.admin_id=p_admin AND
      v_old.bank_reference=p_bank_reference AND v_old.amount_minor=p_amount THEN
      RETURN p_transfer;
    END IF;
    RAISE EXCEPTION 'TRANSFER_REPLAY_CONFLICT';
  END IF;
  IF v_payable.status<>'owed' OR v_payable.amount_minor<>p_amount THEN
    RAISE EXCEPTION 'INVALID_TRANSFER_AMOUNT_OR_STATUS';
  END IF;
  INSERT INTO reward_lab.transfers(transfer_id,payable_id,admin_id,bank_reference,amount_minor)
    VALUES(p_transfer,p_payable,p_admin,p_bank_reference,p_amount);
  UPDATE reward_lab.payables SET status='sent' WHERE payable_id=p_payable;
  INSERT INTO reward_lab.audit(event_type,subject_id,detail)
    VALUES('transfer_recorded',p_transfer,p_payable);
  RETURN p_transfer;
END;
$$;

-- Merchant-shop identity is a trusted service assertion in this rehearsal.
-- DO NOT wire browser-supplied p_shop to this procedure in a real API.
CREATE FUNCTION reward_lab.confirm_merchant_receipt(
  p_payable text,p_verified_shop text,p_receipt text,p_decision text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $$
DECLARE
  v_payable reward_lab.payables%ROWTYPE;
  v_old reward_lab.receipts%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('received','disputed') OR p_decision IS NULL THEN
    RAISE EXCEPTION 'RECEIPT_DECISION_INVALID';
  END IF;
  IF p_receipt IS NULL OR trim(p_receipt)='' THEN RAISE EXCEPTION 'RECEIPT_ID_INVALID'; END IF;
  SELECT * INTO v_payable FROM reward_lab.payables WHERE payable_id=p_payable FOR UPDATE;
  IF NOT FOUND OR v_payable.shop_id IS DISTINCT FROM p_verified_shop THEN
    RAISE EXCEPTION 'MERCHANT_FORBIDDEN';
  END IF;
  SELECT * INTO v_old FROM reward_lab.receipts WHERE payable_id=p_payable;
  IF FOUND THEN
    IF v_old.receipt_id=p_receipt AND v_old.outcome=p_decision THEN RETURN p_receipt; END IF;
    RAISE EXCEPTION 'RECEIPT_REPLAY_CONFLICT';
  END IF;
  IF v_payable.status<>'sent' THEN RAISE EXCEPTION 'PAYMENT_NOT_SENT'; END IF;
  INSERT INTO reward_lab.receipts(receipt_id,payable_id,shop_id,outcome)
    VALUES(p_receipt,p_payable,p_verified_shop,p_decision);
  UPDATE reward_lab.payables SET status=CASE WHEN p_decision='received' THEN 'confirmed' ELSE 'disputed' END
    WHERE payable_id=p_payable;
  INSERT INTO reward_lab.audit(event_type,subject_id,detail)
    VALUES('merchant_receipt',p_receipt,p_payable||':'||p_decision);
  RETURN p_receipt;
END;
$$;

-- Fail closed: none of this synthetic accounting schema is accessible to
-- anon/authenticated or the PUBLIC role, even if copied accidentally.
REVOKE ALL ON ALL TABLES IN SCHEMA reward_lab FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA reward_lab FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA reward_lab FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA reward_lab REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
