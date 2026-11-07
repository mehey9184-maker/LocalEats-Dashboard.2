-- R2.8 SYNTHETIC_ONLY. DO NOT APPLY TO ANY HOSTED/CONNECTED SUPABASE DB.
-- Self-contained private-schema proof inside disposable Docker postgres:17-alpine.
-- Deliberately NOT in supabase/migrations or an API route.
BEGIN;
CREATE ROLE r28_untrusted NOLOGIN;
CREATE SCHEMA r28_private;
REVOKE ALL ON SCHEMA r28_private FROM PUBLIC;

CREATE TABLE r28_private.programme (
  version text PRIMARY KEY CHECK (length(version) BETWEEN 1 AND 80),
  active boolean NOT NULL DEFAULT false,
  budget_minor bigint NOT NULL CHECK (budget_minor>=0),
  committed_minor bigint NOT NULL DEFAULT 0
    CHECK (committed_minor>=0 AND committed_minor<=budget_minor)
);
INSERT INTO r28_private.programme(version,budget_minor) VALUES('pilot-v1',0);
CREATE TABLE r28_private.customers (
  customer_uid text PRIMARY KEY,registered boolean NOT NULL,is_test boolean NOT NULL
);
CREATE TABLE r28_private.shops (
  shop_id text PRIMARY KEY,owner_uid text NOT NULL,
  approval_status text NOT NULL CHECK(approval_status IN ('approved','pending','suspended'))
);
CREATE TABLE r28_private.shop_enrolments (
  shop_id text NOT NULL REFERENCES r28_private.shops(shop_id),
  version text NOT NULL REFERENCES r28_private.programme(version),
  enrolled_at timestamptz NOT NULL,
  enabled boolean NOT NULL,
  PRIMARY KEY(shop_id,version)
);
-- This current menu may be edited by the merchant in the synthetic lab;
-- purchase evidence below is strictly append-only.
CREATE TABLE r28_private.menu_current (
  shop_id text NOT NULL REFERENCES r28_private.shops(shop_id),
  item_id text NOT NULL,
  revision integer NOT NULL CHECK(revision>0),
  unit_minor integer NOT NULL CHECK(unit_minor>0),
  eligible_kota boolean NOT NULL,
  kind text NOT NULL CHECK(kind IN ('standard_kota','other_food','bundle')),
  PRIMARY KEY(shop_id,item_id)
);
CREATE TABLE r28_private.admins (
  uid text PRIMARY KEY,role text NOT NULL CHECK(role='super_admin'),
  active boolean NOT NULL
);
CREATE TABLE r28_private.orders (
  order_id text PRIMARY KEY,
  customer_uid text NOT NULL REFERENCES r28_private.customers(customer_uid),
  shop_id text NOT NULL REFERENCES r28_private.shops(shop_id),
  programme_version text NOT NULL REFERENCES r28_private.programme(version),
  origin text NOT NULL CHECK(origin='server_authoritative_pickup'),
  checkout_intent jsonb NOT NULL CHECK(jsonb_typeof(checkout_intent)='array'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE r28_private.purchase_lines (
  order_id text NOT NULL REFERENCES r28_private.orders(order_id),
  line_index integer NOT NULL CHECK(line_index BETWEEN 1 AND 100),
  line_id text NOT NULL,
  item_id text NOT NULL,
  menu_revision integer NOT NULL CHECK(menu_revision>0),
  unit_minor integer NOT NULL CHECK(unit_minor>0),
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
  qualifies_kota boolean NOT NULL,
  kind text NOT NULL,
  programme_version text NOT NULL,
  PRIMARY KEY(order_id,line_index),
  UNIQUE(order_id,line_id),
  UNIQUE(order_id,item_id)
);
CREATE TABLE r28_private.pickup_events (
  order_id text NOT NULL REFERENCES r28_private.orders(order_id),
  command_id text NOT NULL,
  revision integer NOT NULL CHECK(revision>0),
  kind text NOT NULL CHECK(kind IN ('payment_confirmed','collected')),
  actor_uid text NOT NULL CHECK(length(actor_uid)>0),
  occurred_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY(order_id,command_id),
  UNIQUE(order_id,revision),
  UNIQUE(order_id,kind)
);
CREATE TABLE r28_private.credits (
  order_id text NOT NULL,
  line_id text NOT NULL,
  customer_uid text NOT NULL,
  units integer NOT NULL CHECK(units BETWEEN 1 AND 100),
  PRIMARY KEY(order_id,line_id),
  FOREIGN KEY(order_id,line_id) REFERENCES r28_private.purchase_lines(order_id,line_id)
);
CREATE TABLE r28_private.progress (
  customer_uid text PRIMARY KEY REFERENCES r28_private.customers(customer_uid),
  rank text NOT NULL DEFAULT 'bronze' CHECK(rank IN ('bronze','silver','gold','platinum')),
  stage_units integer NOT NULL DEFAULT 0 CHECK(stage_units>=0),
  lifetime_units bigint NOT NULL DEFAULT 0 CHECK(lifetime_units>=0)
);
CREATE TABLE r28_private.grants (
  grant_id text PRIMARY KEY,
  customer_uid text NOT NULL REFERENCES r28_private.progress(customer_uid),
  tier text NOT NULL CHECK(tier IN ('bronze','silver','gold')),
  cap_minor integer NOT NULL CHECK(cap_minor IN (2500,12500,20000)),
  status text NOT NULL DEFAULT 'earned' CHECK(status IN ('earned','fulfilled')),
  source_order_id text NOT NULL REFERENCES r28_private.orders(order_id),
  UNIQUE(customer_uid,tier)
);
CREATE TABLE r28_private.handovers (
  handover_id text PRIMARY KEY,
  grant_id text NOT NULL UNIQUE REFERENCES r28_private.grants(grant_id),
  customer_uid text NOT NULL,
  shop_id text NOT NULL REFERENCES r28_private.shops(shop_id),
  item_id text NOT NULL,
  amount_minor integer NOT NULL CHECK(amount_minor>0)
);
CREATE TABLE r28_private.payables (
  payable_id text PRIMARY KEY,
  grant_id text NOT NULL UNIQUE REFERENCES r28_private.grants(grant_id),
  handover_id text NOT NULL UNIQUE REFERENCES r28_private.handovers(handover_id),
  shop_id text NOT NULL REFERENCES r28_private.shops(shop_id),
  amount_minor integer NOT NULL CHECK(amount_minor>0),
  status text NOT NULL DEFAULT 'owed' CHECK(status IN ('owed','sent','disputed','confirmed'))
);
CREATE TABLE r28_private.transfer_evidence (
  transfer_id text PRIMARY KEY,
  payable_id text NOT NULL UNIQUE REFERENCES r28_private.payables(payable_id),
  recorded_by_admin text NOT NULL REFERENCES r28_private.admins(uid),
  bank_reference text NOT NULL,
  amount_minor integer NOT NULL CHECK(amount_minor>0),
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE r28_private.merchant_receipts (
  receipt_id text PRIMARY KEY,
  payable_id text NOT NULL UNIQUE REFERENCES r28_private.payables(payable_id),
  confirmed_by_shop text NOT NULL REFERENCES r28_private.shops(shop_id),
  outcome text NOT NULL CHECK(outcome IN ('received','disputed'))
);
CREATE TABLE r28_private.refund_events (
  refund_id text PRIMARY KEY,
  order_id text NOT NULL,
  line_id text NOT NULL,
  customer_uid text NOT NULL,
  shop_id text NOT NULL,
  units integer NOT NULL CHECK(units>0),
  verified_by_merchant text NOT NULL,
  verified_by_admin text NOT NULL,
  reason text NOT NULL,
  FOREIGN KEY(order_id,line_id) REFERENCES r28_private.purchase_lines(order_id,line_id)
);
CREATE TABLE r28_private.refund_holds (
  customer_uid text PRIMARY KEY REFERENCES r28_private.customers(customer_uid),
  first_refund_id text NOT NULL REFERENCES r28_private.refund_events(refund_id)
);
CREATE TABLE r28_private.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL,
  ref text NOT NULL,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(kind,ref)
);
CREATE FUNCTION r28_private.immutable_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r28guard$
BEGIN RAISE EXCEPTION 'R28_IMMUTABLE_FACT'; END;
$r28guard$;
-- Only immutable source and financial evidence is append-only; progress/grant
-- state is a controlled projection updated inside serialized functions.
CREATE TRIGGER immutable_orders BEFORE UPDATE OR DELETE ON r28_private.orders
  FOR EACH ROW EXECUTE FUNCTION r28_private.immutable_guard();
CREATE TRIGGER immutable_lines BEFORE UPDATE OR DELETE ON r28_private.purchase_lines
  FOR EACH ROW EXECUTE FUNCTION r28_private.immutable_guard();
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON r28_private.pickup_events
  FOR EACH ROW EXECUTE FUNCTION r28_private.immutable_guard();
CREATE TRIGGER immutable_credits BEFORE UPDATE OR DELETE ON r28_private.credits
  FOR EACH ROW EXECUTE FUNCTION r28_private.immutable_guard();
CREATE TRIGGER immutable_handovers BEFORE UPDATE OR DELETE ON r28_private.handovers
  FOR EACH ROW EXECUTE FUNCTION r28_private.immutable_guard();
CREATE TRIGGER immutable_refunds BEFORE UPDATE OR DELETE ON r28_private.refund_events
  FOR EACH ROW EXECUTE FUNCTION r28_private.immutable_guard();
CREATE TRIGGER immutable_transfers BEFORE UPDATE OR DELETE ON r28_private.transfer_evidence
  FOR EACH ROW EXECUTE FUNCTION r28_private.immutable_guard();
CREATE TRIGGER immutable_receipts BEFORE UPDATE OR DELETE ON r28_private.merchant_receipts
  FOR EACH ROW EXECUTE FUNCTION r28_private.immutable_guard();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON r28_private.audit_events
  FOR EACH ROW EXECUTE FUNCTION r28_private.immutable_guard();

-- TRUST BOUNDARY: p_order/p_customer/p_shop and p_items are already verified
-- synthetic server assertions here. This function does NOT verify Firebase.
-- Do not expose it to a browser, merchant client, or public RPC in the future.
CREATE FUNCTION r28_private.capture_checkout(
  p_order text,p_customer text,p_shop text,p_items jsonb)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r28checkout$
DECLARE
  v_p r28_private.programme%ROWTYPE;
  v_old r28_private.orders%ROWTYPE;
  v_c r28_private.customers%ROWTYPE;
  v_shop r28_private.shops%ROWTYPE;
  v_enrolled r28_private.shop_enrolments%ROWTYPE;
  v_item jsonb;
  v_m r28_private.menu_current%ROWTYPE;
  v_name text;
  v_qty integer;
  v_index integer:=0;
BEGIN
  IF p_order IS NULL OR length(p_order) NOT BETWEEN 1 AND 160
     OR p_customer IS NULL OR length(p_customer) NOT BETWEEN 1 AND 160
     OR p_shop IS NULL OR length(p_shop) NOT BETWEEN 1 AND 160
     OR p_items IS NULL OR jsonb_typeof(p_items)<>'array'
     OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'R28_INVALID_CHECKOUT'; END IF;
  SELECT * INTO v_p FROM r28_private.programme WHERE version='pilot-v1' FOR UPDATE;
  IF NOT FOUND OR NOT v_p.active THEN RAISE EXCEPTION 'R28_REWARDS_OFF'; END IF;
  SELECT * INTO v_old FROM r28_private.orders WHERE order_id=p_order;
  IF FOUND THEN
    IF (v_old.customer_uid,v_old.shop_id,v_old.checkout_intent)
       IS DISTINCT FROM (p_customer,p_shop,p_items) THEN
      RAISE EXCEPTION 'R28_CHECKOUT_REPLAY_CONFLICT';
    END IF;
    RETURN p_order;
  END IF;
  SELECT * INTO v_c FROM r28_private.customers WHERE customer_uid=p_customer;
  IF NOT FOUND OR NOT v_c.registered OR v_c.is_test THEN
    RAISE EXCEPTION 'R28_CUSTOMER_NOT_ELIGIBLE'; END IF;
  SELECT * INTO v_shop FROM r28_private.shops WHERE shop_id=p_shop;
  SELECT * INTO v_enrolled FROM r28_private.shop_enrolments
    WHERE shop_id=p_shop AND version=v_p.version;
  IF v_shop.approval_status IS DISTINCT FROM 'approved' OR
    v_enrolled.enabled IS DISTINCT FROM true OR
    v_enrolled.enrolled_at>transaction_timestamp()
  THEN RAISE EXCEPTION 'R28_SHOP_NOT_ENROLLED'; END IF;
  INSERT INTO r28_private.orders(order_id,customer_uid,shop_id,
      programme_version,origin,checkout_intent)
    VALUES(p_order,p_customer,p_shop,v_p.version,'server_authoritative_pickup',p_items);
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_index:=v_index+1;
    IF jsonb_typeof(v_item)<>'object' OR
       (SELECT count(*) FROM jsonb_object_keys(v_item))<>2 OR
       NOT(v_item ? 'item_id' AND v_item ? 'quantity') OR
       jsonb_typeof(v_item->'item_id')<>'string' OR
       jsonb_typeof(v_item->'quantity')<>'number' OR
       COALESCE(v_item->>'quantity','')!~'^[0-9]{1,3}$'
    THEN RAISE EXCEPTION 'R28_INVALID_CHECKOUT_LINE'; END IF;
    v_name:=v_item->>'item_id';
    v_qty:=(v_item->>'quantity')::integer;
    IF length(v_name) NOT BETWEEN 1 AND 160 OR v_qty NOT BETWEEN 1 AND 100
    THEN RAISE EXCEPTION 'R28_INVALID_CHECKOUT_LINE'; END IF;
    -- Prevent changing price, rule or revision while the snapshot is captured.
    SELECT * INTO v_m FROM r28_private.menu_current
       WHERE shop_id=p_shop AND item_id=v_name FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'R28_MENU_SOURCE_MISSING'; END IF;
    INSERT INTO r28_private.purchase_lines(order_id,line_index,line_id,item_id,
       menu_revision,unit_minor,quantity,qualifies_kota,kind,programme_version)
      VALUES(p_order,v_index,p_order||':line:'||v_index,v_name,
       v_m.revision,v_m.unit_minor,v_qty,v_m.eligible_kota,v_m.kind,v_p.version);
  END LOOP;
  INSERT INTO r28_private.audit_events(kind,ref,detail)
    VALUES('checkout',p_order,p_shop);
  RETURN p_order;
END;
$r28checkout$;

-- The source pickup-event writer is a synthetic trusted fixture. It is not
-- proof that the real order service has been wired to immutable evidence.
CREATE FUNCTION r28_private.record_pickup_event(
  p_order text,p_command text,p_kind text,p_revision integer,p_actor text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r28event$
DECLARE v_old r28_private.pickup_events%ROWTYPE;
BEGIN
  IF p_order IS NULL OR p_command IS NULL OR p_actor IS NULL OR length(p_actor)=0 OR
     p_kind NOT IN ('payment_confirmed','collected') OR p_revision IS NULL OR p_revision<=0
  THEN RAISE EXCEPTION 'R28_BAD_PICKUP_PROOF'; END IF;
  SELECT * INTO v_old FROM r28_private.pickup_events
    WHERE order_id=p_order AND command_id=p_command;
  IF FOUND THEN
    IF (v_old.kind,v_old.revision,v_old.actor_uid)
      IS DISTINCT FROM (p_kind,p_revision,p_actor)
    THEN RAISE EXCEPTION 'R28_EVENT_REPLAY_CONFLICT'; END IF;
    RETURN p_command;
  END IF;
  INSERT INTO r28_private.pickup_events(order_id,command_id,kind,revision,actor_uid)
     VALUES(p_order,p_command,p_kind,p_revision,p_actor);
  RETURN p_command;
END;
$r28event$;

CREATE FUNCTION r28_private.credit_collected_order(p_order text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r28credit$
DECLARE
  v_program r28_private.programme%ROWTYPE;
  v_order r28_private.orders%ROWTYPE;
  v_payment r28_private.pickup_events%ROWTYPE;
  v_collected r28_private.pickup_events%ROWTYPE;
  v_line r28_private.purchase_lines%ROWTYPE;
  v_rank text; v_stage integer; v_total bigint;
  v_threshold integer;v_cap integer;v_next text;
  v_i integer;v_rows integer;v_count integer:=0;v_seen boolean:=false;
BEGIN
  -- Singleton programme lock serializes all funding and refund decisions,
  -- so two workers cannot promise the same remaining campaign funds.
  SELECT * INTO v_program FROM r28_private.programme
     WHERE version='pilot-v1' FOR UPDATE;
  IF NOT FOUND OR NOT v_program.active THEN RAISE EXCEPTION 'R28_REWARDS_OFF'; END IF;
  SELECT * INTO v_order FROM r28_private.orders WHERE order_id=p_order;
  IF NOT FOUND THEN RAISE EXCEPTION 'R28_MISSING_PURCHASE'; END IF;
  IF v_order.programme_version<>v_program.version THEN
    RAISE EXCEPTION 'R28_VERSION_MISMATCH'; END IF;
  SELECT * INTO v_payment FROM r28_private.pickup_events
    WHERE order_id=p_order AND kind='payment_confirmed';
  SELECT * INTO v_collected FROM r28_private.pickup_events
    WHERE order_id=p_order AND kind='collected';
  IF v_payment.command_id IS NULL OR v_collected.command_id IS NULL OR
    v_payment.revision>=v_collected.revision OR
    v_payment.occurred_at<v_order.created_at OR
    v_collected.occurred_at<v_payment.occurred_at
  THEN RAISE EXCEPTION 'R28_NOT_PAID_AND_COLLECTED'; END IF;
  IF EXISTS(SELECT 1 FROM r28_private.refund_events WHERE order_id=p_order) OR
     EXISTS(SELECT 1 FROM r28_private.refund_holds WHERE customer_uid=v_order.customer_uid)
  THEN RAISE EXCEPTION 'R28_REFUNDED_OR_HELD'; END IF;
  FOR v_line IN SELECT * FROM r28_private.purchase_lines
      WHERE order_id=p_order ORDER BY line_index LOOP
    v_seen:=true;
    IF NOT v_line.qualifies_kota THEN CONTINUE; END IF;
    INSERT INTO r28_private.credits(order_id,line_id,customer_uid,units)
      VALUES(p_order,v_line.line_id,v_order.customer_uid,v_line.quantity)
      ON CONFLICT(order_id,line_id) DO NOTHING;
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows=0 THEN CONTINUE; END IF;
    INSERT INTO r28_private.progress(customer_uid) VALUES(v_order.customer_uid)
      ON CONFLICT(customer_uid) DO NOTHING;
    SELECT rank,stage_units,lifetime_units INTO v_rank,v_stage,v_total
      FROM r28_private.progress WHERE customer_uid=v_order.customer_uid FOR UPDATE;
    FOR v_i IN 1..v_line.quantity LOOP
      IF v_rank='platinum' THEN CONTINUE; END IF;
      v_stage:=v_stage+1;
      v_threshold:=CASE v_rank WHEN 'bronze' THEN 4 WHEN 'silver' THEN 20 ELSE 40 END;
      IF v_stage=v_threshold THEN
        v_cap:=CASE v_rank WHEN 'bronze' THEN 2500 WHEN 'silver' THEN 12500 ELSE 20000 END;
        v_next:=CASE v_rank WHEN 'bronze' THEN 'silver' WHEN 'silver' THEN 'gold' ELSE 'platinum' END;
        UPDATE r28_private.programme
           SET committed_minor=committed_minor+v_cap
           WHERE version=v_program.version AND committed_minor+v_cap<=budget_minor;
        GET DIAGNOSTICS v_rows=ROW_COUNT;
        IF v_rows<>1 THEN RAISE EXCEPTION 'R28_REWARD_BUDGET_EXHAUSTED'; END IF;
        INSERT INTO r28_private.grants(grant_id,customer_uid,tier,cap_minor,source_order_id)
          VALUES('grant:'||v_order.customer_uid||':'||v_rank,
            v_order.customer_uid,v_rank,v_cap,p_order);
        INSERT INTO r28_private.audit_events(kind,ref,detail)
          VALUES('earned','grant:'||v_order.customer_uid||':'||v_rank,p_order);
        v_stage:=0;v_rank:=v_next;
      END IF;
    END LOOP;
    UPDATE r28_private.progress SET rank=v_rank,stage_units=v_stage,
      lifetime_units=v_total+v_line.quantity WHERE customer_uid=v_order.customer_uid;
    v_count:=v_count+v_line.quantity;
  END LOOP;
  IF NOT v_seen THEN RAISE EXCEPTION 'R28_NO_PURCHASE_LINES'; END IF;
  RETURN v_count;
END;
$r28credit$;

CREATE FUNCTION r28_private.record_verified_refund(
  p_refund text,p_order text,p_line text,p_units integer,
  p_merchant_uid text,p_admin_uid text,p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r28refund$
DECLARE
  v_line r28_private.purchase_lines%ROWTYPE;
  v_order r28_private.orders%ROWTYPE;
  v_shop r28_private.shops%ROWTYPE;
  v_admin r28_private.admins%ROWTYPE;
  v_old r28_private.refund_events%ROWTYPE;
  v_total integer;
BEGIN
  IF p_refund IS NULL OR length(p_refund) NOT BETWEEN 1 AND 160 OR
     p_units IS NULL OR p_units<1 OR p_reason IS NULL OR
     length(p_reason) NOT BETWEEN 3 AND 500
  THEN RAISE EXCEPTION 'R28_INVALID_REFUND'; END IF;
  PERFORM 1 FROM r28_private.programme WHERE version='pilot-v1' FOR UPDATE;
  SELECT * INTO v_old FROM r28_private.refund_events WHERE refund_id=p_refund;
  IF FOUND THEN
    IF (v_old.order_id,v_old.line_id,v_old.units,v_old.verified_by_merchant,
        v_old.verified_by_admin,v_old.reason)
       IS DISTINCT FROM (p_order,p_line,p_units,p_merchant_uid,p_admin_uid,p_reason)
    THEN RAISE EXCEPTION 'R28_REFUND_REPLAY_CONFLICT'; END IF;
    RETURN p_refund;
  END IF;
  SELECT * INTO v_line FROM r28_private.purchase_lines
    WHERE order_id=p_order AND line_id=p_line;
  SELECT * INTO v_order FROM r28_private.orders WHERE order_id=p_order;
  IF v_line.line_id IS NULL OR v_order.order_id IS NULL
  THEN RAISE EXCEPTION 'R28_REFUND_SOURCE_MISSING'; END IF;
  SELECT * INTO v_shop FROM r28_private.shops WHERE shop_id=v_order.shop_id;
  SELECT * INTO v_admin FROM r28_private.admins WHERE uid=p_admin_uid;
  IF p_merchant_uid IS NULL OR p_merchant_uid=p_admin_uid OR
     v_shop.owner_uid IS DISTINCT FROM p_merchant_uid OR
     v_admin.active IS DISTINCT FROM true OR v_admin.role IS DISTINCT FROM 'super_admin'
  THEN RAISE EXCEPTION 'R28_INDEPENDENT_APPROVAL_REQUIRED'; END IF;
  SELECT COALESCE(sum(units),0)::integer INTO v_total
    FROM r28_private.refund_events WHERE order_id=p_order AND line_id=p_line;
  IF v_total+p_units>v_line.quantity THEN RAISE EXCEPTION 'R28_REFUND_EXCEEDS_PURCHASE'; END IF;
  INSERT INTO r28_private.refund_events(refund_id,order_id,line_id,customer_uid,shop_id,
        units,verified_by_merchant,verified_by_admin,reason)
    VALUES(p_refund,p_order,p_line,v_order.customer_uid,v_order.shop_id,
        p_units,p_merchant_uid,p_admin_uid,p_reason);
  IF EXISTS(SELECT 1 FROM r28_private.credits WHERE order_id=p_order AND line_id=p_line)
  THEN
    INSERT INTO r28_private.refund_holds(customer_uid,first_refund_id)
      VALUES(v_order.customer_uid,p_refund)
      ON CONFLICT(customer_uid) DO NOTHING;
  END IF;
  INSERT INTO r28_private.audit_events(kind,ref,detail)
    VALUES('refund',p_refund,p_order);
  RETURN p_refund;
END;
$r28refund$;

CREATE FUNCTION r28_private.fulfil_grant(
  p_grant text,p_shop text,p_item text,p_handover text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r28fulfil$
DECLARE
 v_g r28_private.grants%ROWTYPE;
 v_order r28_private.orders%ROWTYPE;
 v_shop r28_private.shops%ROWTYPE;
 v_menu r28_private.menu_current%ROWTYPE;
 v_old r28_private.handovers%ROWTYPE;
 v_p r28_private.programme%ROWTYPE;
 v_payable text;
BEGIN
 SELECT * INTO v_p FROM r28_private.programme WHERE version='pilot-v1' FOR UPDATE;
 IF NOT FOUND OR NOT v_p.active THEN RAISE EXCEPTION 'R28_REWARDS_OFF'; END IF;
 SELECT * INTO v_g FROM r28_private.grants WHERE grant_id=p_grant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'R28_GRANT_MISSING'; END IF;
 SELECT * INTO v_old FROM r28_private.handovers WHERE grant_id=p_grant;
 IF FOUND THEN
   IF (v_old.handover_id,v_old.shop_id,v_old.item_id) IS DISTINCT FROM
      (p_handover,p_shop,p_item) THEN RAISE EXCEPTION 'R28_HANDOVER_REPLAY_CONFLICT'; END IF;
   RETURN 'payable:'||p_grant;
 END IF;
 IF EXISTS(SELECT 1 FROM r28_private.refund_holds WHERE customer_uid=v_g.customer_uid)
 THEN RAISE EXCEPTION 'R28_REWARD_ON_HOLD'; END IF;
 IF v_g.status<>'earned' THEN RAISE EXCEPTION 'R28_GRANT_ALREADY_FULFILLED'; END IF;
 SELECT * INTO v_shop FROM r28_private.shops WHERE shop_id=p_shop;
 IF v_shop.approval_status IS DISTINCT FROM 'approved' OR
    NOT EXISTS(SELECT 1 FROM r28_private.shop_enrolments e
      WHERE e.shop_id=p_shop AND e.version=v_p.version AND e.enabled)
 THEN RAISE EXCEPTION 'R28_SHOP_NOT_ENROLLED'; END IF;
 SELECT * INTO v_menu FROM r28_private.menu_current
   WHERE shop_id=p_shop AND item_id=p_item FOR SHARE;
 IF NOT FOUND OR v_menu.unit_minor>v_g.cap_minor THEN RAISE EXCEPTION 'R28_REWARD_PRICE_INVALID'; END IF;
 IF v_g.tier='bronze' THEN
   IF v_menu.kind NOT IN ('standard_kota','other_food') OR
     (v_menu.kind='other_food' AND v_menu.unit_minor>=2500) THEN
     RAISE EXCEPTION 'R28_BRONZE_FOOD_INVALID'; END IF;
 ELSE
   IF v_menu.kind<>'bundle' THEN RAISE EXCEPTION 'R28_BUNDLE_REQUIRED'; END IF;
 END IF;
 INSERT INTO r28_private.handovers(handover_id,grant_id,customer_uid,shop_id,item_id,amount_minor)
   VALUES(p_handover,p_grant,v_g.customer_uid,p_shop,p_item,v_menu.unit_minor);
 UPDATE r28_private.grants SET status='fulfilled' WHERE grant_id=p_grant;
 v_payable:='payable:'||p_grant;
 INSERT INTO r28_private.payables(payable_id,grant_id,handover_id,shop_id,amount_minor)
   VALUES(v_payable,p_grant,p_handover,p_shop,v_menu.unit_minor);
 UPDATE r28_private.programme SET committed_minor=committed_minor-v_g.cap_minor+v_menu.unit_minor
   WHERE version=v_p.version;
 INSERT INTO r28_private.audit_events(kind,ref,detail)
   VALUES('handover',p_handover,v_payable);
 RETURN v_payable;
END;
$r28fulfil$;

CREATE FUNCTION r28_private.reconcile_commitment()
RETURNS TABLE(committed_minor bigint, expected_minor bigint, balanced boolean)
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog STABLE AS $r28reconcile$
 SELECT p.committed_minor,
 (COALESCE((SELECT sum(g.cap_minor) FROM r28_private.grants g WHERE g.status='earned'),0)
   +COALESCE((SELECT sum(x.amount_minor) FROM r28_private.payables x),0))::bigint,
 p.committed_minor=
 (COALESCE((SELECT sum(g.cap_minor) FROM r28_private.grants g WHERE g.status='earned'),0)
   +COALESCE((SELECT sum(x.amount_minor) FROM r28_private.payables x),0))
 FROM r28_private.programme p WHERE p.version='pilot-v1'
$r28reconcile$;

-- Defense in depth. Not exposed and no actual Firebase/HTTP access exists.
-- Deliberately do NOT grant schema, table, or function access to any client role.
DO $r28rls$
DECLARE t record;
BEGIN
 FOR t IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='r28_private'
 LOOP
   EXECUTE format('ALTER TABLE r28_private.%I ENABLE ROW LEVEL SECURITY',t.tablename);
 END LOOP;
END;
$r28rls$;
REVOKE ALL ON ALL TABLES IN SCHEMA r28_private FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA r28_private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA r28_private FROM PUBLIC;
COMMIT;
