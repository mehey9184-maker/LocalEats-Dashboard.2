-- R2.9 SYNTHETIC_ONLY: isolated pickup UUID compatibility and role/isolation lab.
-- Strictly Docker PostgreSQL 17; never apply to Supabase or any hosted project.
-- No live schema, public RPC or migration changes.
BEGIN;
CREATE ROLE r29_browser NOLOGIN;
CREATE ROLE r29_observer NOLOGIN;

CREATE SCHEMA r29_source;
CREATE SCHEMA r29_private;
REVOKE ALL ON SCHEMA r29_source,r29_private FROM PUBLIC;
-- Minimal reproduction of *observed type contract*, not the full production DDL.
-- Real pickup orders.id and event order_id are UUID; shops.id and owner_uid
-- and orders.user_id are text; command IDs are UUID; revision is bigint.
CREATE TABLE r29_source.shops (
  id text PRIMARY KEY, owner_id text,
  approval_status text NOT NULL CHECK (approval_status IN ('approved','pending','suspended'))
);
CREATE TABLE r29_source.customers (
  uid text PRIMARY KEY, registered boolean NOT NULL, test_record boolean NOT NULL
);
CREATE TABLE r29_source.menu_items (
  id text PRIMARY KEY, shop_id text NOT NULL REFERENCES r29_source.shops(id),
  price numeric NOT NULL CHECK(price>0 AND price=round(price,2)),
  is_available boolean NOT NULL,
  reward_eligible boolean NOT NULL,
  reward_rule_revision bigint NOT NULL CHECK(reward_rule_revision>0)
);
CREATE TABLE r29_source.orders (
  id uuid PRIMARY KEY,
  shop_id text NOT NULL REFERENCES r29_source.shops(id),
  user_id text NOT NULL REFERENCES r29_source.customers(uid),
  items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','ready_for_pickup','collected','cancelled')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('paid','unpaid')),
  delivery_type text NOT NULL DEFAULT 'collection' CHECK(delivery_type='collection'),
  create_intent_hash text NOT NULL CHECK(create_intent_hash ~ '^[0-9a-f]{64}$'),
  revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(id,shop_id,user_id)
);
CREATE TABLE r29_source.pickup_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES r29_source.orders(id) ON DELETE RESTRICT,
  command_id uuid NOT NULL,
  revision bigint NOT NULL CHECK(revision>0),
  kind text NOT NULL CHECK(kind IN ('payment_confirmed','collected')),
  actor_uid text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(details)='object'),
  UNIQUE(order_id,command_id),UNIQUE(order_id,kind),UNIQUE(order_id,revision)
);

-- Future private domain: typed, coupled *within the same authoritative order
-- creation transaction*, not a retroactive join to mutable menu items.
CREATE TABLE r29_private.programme (
  version text PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  budget_minor integer NOT NULL CHECK(budget_minor>=0),
  committed_minor integer NOT NULL DEFAULT 0 CHECK(committed_minor>=0 AND committed_minor<=budget_minor)
);
INSERT INTO r29_private.programme(version,budget_minor) VALUES('future-pilot',0);
CREATE TABLE r29_private.shop_enrolments (
  shop_id text NOT NULL REFERENCES r29_source.shops(id),
  programme_version text NOT NULL REFERENCES r29_private.programme(version),
  enrolled_at timestamptz NOT NULL,
  enabled boolean NOT NULL,
  PRIMARY KEY(shop_id,programme_version)
);
CREATE TABLE r29_private.purchase_snapshots (
  order_id uuid PRIMARY KEY,
  shop_id text NOT NULL, customer_uid text NOT NULL,
  programme_version text NOT NULL REFERENCES r29_private.programme(version),
  captured_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  FOREIGN KEY(order_id,shop_id,customer_uid)
     REFERENCES r29_source.orders(id,shop_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE r29_private.purchase_lines (
  order_id uuid NOT NULL REFERENCES r29_private.purchase_snapshots(order_id) ON DELETE RESTRICT,
  line_index integer NOT NULL CHECK(line_index BETWEEN 1 AND 100),
  item_id text NOT NULL, menu_revision bigint NOT NULL CHECK(menu_revision>0),
  price_minor integer NOT NULL CHECK(price_minor>0),
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
  eligible_kota boolean NOT NULL,
  PRIMARY KEY(order_id,line_index),
  UNIQUE(order_id,item_id)
);
CREATE TABLE r29_private.credits (
  order_id uuid NOT NULL,
  line_index integer NOT NULL,
  customer_uid text NOT NULL,
  units integer NOT NULL CHECK(units BETWEEN 1 AND 100),
  PRIMARY KEY(order_id,line_index),
  FOREIGN KEY(order_id,line_index)
     REFERENCES r29_private.purchase_lines(order_id,line_index)
);
CREATE TABLE r29_private.progress (
  customer_uid text PRIMARY KEY REFERENCES r29_source.customers(uid),
  lifetime_units integer NOT NULL DEFAULT 0 CHECK(lifetime_units>=0)
);
CREATE TABLE r29_private.bronze_grants (
  customer_uid text PRIMARY KEY REFERENCES r29_private.progress(customer_uid),
  source_order_id uuid NOT NULL REFERENCES r29_source.orders(id),
  cap_minor integer NOT NULL CHECK(cap_minor=2500)
);
CREATE TABLE r29_private.refund_notices (
  refund_id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  line_index integer NOT NULL,
  source_detail text NOT NULL,
  FOREIGN KEY(order_id,line_index)
     REFERENCES r29_private.purchase_lines(order_id,line_index)
);
CREATE TABLE r29_private.audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL, subject text NOT NULL,
  UNIQUE(kind,subject)
);
-- Separate artificial SERIALIZABLE race budget, independent of real grant budget.
CREATE TABLE r29_private.isolation_budget (
  id smallint PRIMARY KEY CHECK(id=1),
  limit_minor integer NOT NULL CHECK(limit_minor>0),
  reserved_minor integer NOT NULL DEFAULT 0 CHECK(reserved_minor>=0 AND reserved_minor<=limit_minor)
);
INSERT INTO r29_private.isolation_budget(id,limit_minor) VALUES(1,2500);
CREATE TABLE r29_private.isolation_claims (
  claim_id text PRIMARY KEY,
  amount_minor integer NOT NULL CHECK(amount_minor>0)
);

CREATE FUNCTION r29_private.reject_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r29immutable$
BEGIN RAISE EXCEPTION 'R29_IMMUTABLE_PURCHASE_PROOF'; END;
$r29immutable$;
CREATE TRIGGER immutable_purchase_snapshots BEFORE UPDATE OR DELETE ON r29_private.purchase_snapshots
  FOR EACH ROW EXECUTE FUNCTION r29_private.reject_immutable();
CREATE TRIGGER immutable_purchase_lines BEFORE UPDATE OR DELETE ON r29_private.purchase_lines
  FOR EACH ROW EXECUTE FUNCTION r29_private.reject_immutable();
CREATE TRIGGER immutable_pickup_events BEFORE UPDATE OR DELETE ON r29_source.pickup_order_events
  FOR EACH ROW EXECUTE FUNCTION r29_private.reject_immutable();
CREATE TRIGGER immutable_credits BEFORE UPDATE OR DELETE ON r29_private.credits
  FOR EACH ROW EXECUTE FUNCTION r29_private.reject_immutable();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON r29_private.audit
  FOR EACH ROW EXECUTE FUNCTION r29_private.reject_immutable();

-- This models one future *server-owned* order creation transaction. It cannot
-- authenticate Firebase and must NOT be wired to any HTTP API.
-- When programme is OFF or customer/shop is not enrolled, checkout still works
-- but no Rewards snapshot is created. Never break pickup for Rewards.
CREATE FUNCTION r29_private.capture_source_order(
  p_order uuid,p_shop text,p_customer text,p_intent_hash text,p_items jsonb
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $r29capture$
DECLARE
  v_old r29_source.orders%ROWTYPE;
  v_program r29_private.programme%ROWTYPE;
  v_c r29_source.customers%ROWTYPE;
  v_shop r29_source.shops%ROWTYPE;
  v_enabled boolean;
  v_item jsonb;
  v_menu r29_source.menu_items%ROWTYPE;
  v_name text;
  v_count integer:=0;
  v_qty integer;
BEGIN
  IF p_order IS NULL OR p_shop IS NULL OR p_customer IS NULL
    OR p_intent_hash IS NULL OR p_intent_hash !~ '^[0-9a-f]{64}$'
    OR p_items IS NULL OR jsonb_typeof(p_items)<>'array'
    OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'R29_BAD_CHECKOUT_INTENT'; END IF;
  SELECT * INTO v_program FROM r29_private.programme
     WHERE version='future-pilot' FOR UPDATE;
  SELECT * INTO v_old FROM r29_source.orders WHERE id=p_order FOR UPDATE;
  IF FOUND THEN
    IF (v_old.shop_id,v_old.user_id,v_old.create_intent_hash,v_old.items)
      IS DISTINCT FROM (p_shop,p_customer,p_intent_hash,p_items)
    THEN RAISE EXCEPTION 'R29_ORDER_REPLAY_CONFLICT'; END IF;
    RETURN CASE WHEN EXISTS(SELECT 1 FROM r29_private.purchase_snapshots
         WHERE order_id=p_order) THEN 'pickup-with-rewards-source' ELSE 'pickup-only' END;
  END IF;
  SELECT * INTO v_c FROM r29_source.customers WHERE uid=p_customer;
  SELECT * INTO v_shop FROM r29_source.shops WHERE id=p_shop;
  IF v_c.uid IS NULL OR v_shop.id IS NULL OR v_shop.approval_status<>'approved'
  THEN RAISE EXCEPTION 'R29_PICKUP_SOURCE_INVALID'; END IF;
  -- Rewards eligibility cannot gate real pickup. Unenrolled users get pickup.
  SELECT EXISTS(
     SELECT 1 FROM r29_private.shop_enrolments e WHERE e.shop_id=p_shop
       AND e.programme_version=v_program.version
       AND e.enabled AND e.enrolled_at<=transaction_timestamp()
  ) INTO v_enabled;
  INSERT INTO r29_source.orders(id,shop_id,user_id,items,create_intent_hash)
    VALUES(p_order,p_shop,p_customer,p_items,p_intent_hash);
  IF v_program.active AND v_enabled AND v_c.registered AND NOT v_c.test_record THEN
    INSERT INTO r29_private.purchase_snapshots(order_id,shop_id,customer_uid,programme_version)
      VALUES(p_order,p_shop,p_customer,v_program.version);
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_count:=v_count+1;
    IF jsonb_typeof(v_item)<>'object' OR
       (SELECT count(*) FROM jsonb_object_keys(v_item))<>2 OR
       NOT(v_item ? 'item_id' AND v_item ? 'quantity') OR
       jsonb_typeof(v_item->'item_id')<>'string' OR
       jsonb_typeof(v_item->'quantity')<>'number' OR
       COALESCE(v_item->>'quantity','') !~ '^[0-9]{1,3}$'
    THEN RAISE EXCEPTION 'R29_INVALID_MENU_INTENT'; END IF;
    v_name:=v_item->>'item_id';v_qty:=(v_item->>'quantity')::integer;
    IF v_qty NOT BETWEEN 1 AND 100 OR length(v_name) NOT BETWEEN 1 AND 160
    THEN RAISE EXCEPTION 'R29_INVALID_MENU_INTENT'; END IF;
    SELECT * INTO v_menu FROM r29_source.menu_items
      WHERE id=v_name AND shop_id=p_shop AND is_available FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'R29_MENU_SOURCE_UNAVAILABLE'; END IF;
    IF EXISTS(SELECT 1 FROM r29_private.purchase_snapshots WHERE order_id=p_order) THEN
      INSERT INTO r29_private.purchase_lines(order_id,line_index,item_id,menu_revision,
        price_minor,quantity,eligible_kota)
      VALUES(p_order,v_count,v_name,v_menu.reward_rule_revision,
        (v_menu.price*100)::integer,v_qty,v_menu.reward_eligible);
    END IF;
  END LOOP;
  RETURN CASE WHEN EXISTS(SELECT 1 FROM r29_private.purchase_snapshots
       WHERE order_id=p_order) THEN 'pickup-with-rewards-source' ELSE 'pickup-only' END;
END;
$r29capture$;

-- Mimics the *single* authoritative pickup command transaction; no browser
-- can call it in the lab, and no real Firebase actor is supplied or verified.
CREATE FUNCTION r29_private.complete_synthetic_pickup(
  p_order uuid,p_paid_command uuid,p_collected_command uuid,p_actor text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r29complete$
DECLARE v_order r29_source.orders%ROWTYPE;
BEGIN
  IF p_paid_command IS NULL OR p_collected_command IS NULL OR
     p_paid_command=p_collected_command OR p_actor IS NULL OR length(p_actor)=0
  THEN RAISE EXCEPTION 'R29_BAD_PICKUP_COMMAND'; END IF;
  SELECT * INTO v_order FROM r29_source.orders WHERE id=p_order FOR UPDATE;
  IF NOT FOUND OR v_order.delivery_type<>'collection' OR v_order.status<>'pending'
     OR v_order.payment_status<>'unpaid'
  THEN RAISE EXCEPTION 'R29_INVALID_PICKUP_TRANSITION'; END IF;
  INSERT INTO r29_source.pickup_order_events(order_id,command_id,revision,kind,actor_uid)
    VALUES(p_order,p_paid_command,1,'payment_confirmed',p_actor),
          (p_order,p_collected_command,2,'collected',p_actor);
  UPDATE r29_source.orders SET status='collected',payment_status='paid',revision=2
    WHERE id=p_order;
  RETURN p_order;
END;
$r29complete$;

-- Demonstrates one Bronze-only UUID-compatible, idempotent credit. R2.8 is
-- still the multi-tier accounting rehearsal; this tests REAL ID mapping.
CREATE FUNCTION r29_private.credit_from_pickup(p_order uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r29credit$
DECLARE
  v_program r29_private.programme%ROWTYPE;
  v_order r29_source.orders%ROWTYPE;
  v_snapshot r29_private.purchase_snapshots%ROWTYPE;
  v_payment r29_source.pickup_order_events%ROWTYPE;
  v_handover r29_source.pickup_order_events%ROWTYPE;
  v_line r29_private.purchase_lines%ROWTYPE;
  v_credits integer:=0;
  v_rows integer;
  v_total integer;
BEGIN
  SELECT * INTO v_program FROM r29_private.programme
    WHERE version='future-pilot' FOR UPDATE;
  IF NOT FOUND OR NOT v_program.active THEN RAISE EXCEPTION 'R29_REWARDS_OFF'; END IF;
  SELECT * INTO v_order FROM r29_source.orders WHERE id=p_order;
  SELECT * INTO v_snapshot FROM r29_private.purchase_snapshots WHERE order_id=p_order;
  IF v_order.id IS NULL OR v_snapshot.order_id IS NULL OR
     v_order.user_id<>v_snapshot.customer_uid OR
     v_order.shop_id<>v_snapshot.shop_id OR
     v_order.delivery_type<>'collection' OR v_order.status<>'collected' OR
     v_order.payment_status<>'paid'
  THEN RAISE EXCEPTION 'R29_NO_AUTHORITATIVE_PURCHASE'; END IF;
  SELECT * INTO v_payment FROM r29_source.pickup_order_events
     WHERE order_id=p_order AND kind='payment_confirmed';
  SELECT * INTO v_handover FROM r29_source.pickup_order_events
     WHERE order_id=p_order AND kind='collected';
  IF v_payment.id IS NULL OR v_handover.id IS NULL OR
     v_handover.revision<=v_payment.revision OR
     v_payment.occurred_at<v_order.created_at OR
     v_handover.occurred_at<v_payment.occurred_at
  THEN RAISE EXCEPTION 'R29_MISSING_PAID_AND_COLLECTED_PROOF'; END IF;
  IF EXISTS(SELECT 1 FROM r29_private.refund_notices WHERE order_id=p_order)
  THEN RAISE EXCEPTION 'R29_REFUND_REVIEW_REQUIRED'; END IF;
  FOR v_line IN SELECT * FROM r29_private.purchase_lines
    WHERE order_id=p_order AND eligible_kota ORDER BY line_index LOOP
    INSERT INTO r29_private.credits(order_id,line_index,customer_uid,units)
       VALUES(p_order,v_line.line_index,v_order.user_id,v_line.quantity)
       ON CONFLICT(order_id,line_index) DO NOTHING;
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows=0 THEN CONTINUE; END IF;
    INSERT INTO r29_private.progress(customer_uid) VALUES(v_order.user_id)
       ON CONFLICT(customer_uid) DO NOTHING;
    UPDATE r29_private.progress SET lifetime_units=lifetime_units+v_line.quantity
       WHERE customer_uid=v_order.user_id;
    v_credits:=v_credits+v_line.quantity;
  END LOOP;
  SELECT lifetime_units INTO v_total FROM r29_private.progress
     WHERE customer_uid=v_order.user_id;
  IF v_total>=4 AND NOT EXISTS(
    SELECT 1 FROM r29_private.bronze_grants WHERE customer_uid=v_order.user_id
  ) THEN
    UPDATE r29_private.programme SET committed_minor=committed_minor+2500
      WHERE version=v_program.version AND committed_minor+2500<=budget_minor;
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows<>1 THEN RAISE EXCEPTION 'R29_BUDGET_EXHAUSTED'; END IF;
    INSERT INTO r29_private.bronze_grants(customer_uid,source_order_id,cap_minor)
      VALUES(v_order.user_id,p_order,2500);
    INSERT INTO r29_private.audit(kind,subject)
      VALUES('bronze_grant',v_order.user_id);
  END IF;
  RETURN v_credits;
END;
$r29credit$;

-- Independent SERIALIZABLE conflict/retry lab, no financial identity claims.
CREATE FUNCTION r29_private.reserve_isolation_budget(
  p_claim text,p_amount integer
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r29reserve$
DECLARE v_existing r29_private.isolation_claims%ROWTYPE;
v_rows integer;
BEGIN
  IF p_claim IS NULL OR length(p_claim) NOT BETWEEN 1 AND 100 OR
     p_amount IS NULL OR p_amount<1
  THEN RAISE EXCEPTION 'R29_INVALID_RESERVATION'; END IF;
  SELECT * INTO v_existing FROM r29_private.isolation_claims WHERE claim_id=p_claim;
  IF FOUND THEN
    IF v_existing.amount_minor<>p_amount THEN RAISE EXCEPTION 'R29_RESERVATION_REPLAY_CONFLICT'; END IF;
    RETURN p_claim;
  END IF;
  UPDATE r29_private.isolation_budget SET reserved_minor=reserved_minor+p_amount
    WHERE id=1 AND reserved_minor+p_amount<=limit_minor;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows<>1 THEN RAISE EXCEPTION 'R29_ISOLATION_BUDGET_EXHAUSTED'; END IF;
  INSERT INTO r29_private.isolation_claims(claim_id,amount_minor) VALUES(p_claim,p_amount);
  RETURN p_claim;
END;
$r29reserve$;

-- All source and private tables have restrictive RLS in the scratch DB.
DO $r29rls$ DECLARE t record; BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_catalog.pg_tables
  WHERE schemaname IN ('r29_source','r29_private') LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',t.schemaname,t.tablename);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',t.schemaname,t.tablename);
 END LOOP;
END; $r29rls$;

-- An explicitly scoped future-status projection. Observer may see ONLY this
-- constant view, not private data; view is invoker and no source table used.
CREATE VIEW r29_private.safe_status WITH (security_invoker=true)
 AS SELECT 'not-live'::text AS feature_status;
GRANT USAGE ON SCHEMA r29_private TO r29_observer;
GRANT SELECT ON r29_private.safe_status TO r29_observer;
REVOKE ALL ON ALL TABLES IN SCHEMA r29_source FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA r29_private FROM PUBLIC;
-- Re-grant only safe_status because schema-wide REVOKE includes views.
GRANT SELECT ON r29_private.safe_status TO r29_observer;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA r29_source FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA r29_private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA r29_source FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA r29_private FROM PUBLIC;
COMMIT;
