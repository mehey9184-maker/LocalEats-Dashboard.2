-- R2.5 SYNTHETIC ONLY. Disposable PostgreSQL 17 CI database, NOT a Supabase migration.
-- This lab captures eligibility and menu price atomically from trusted SERVER tables.
-- Never expose these SECURITY INVOKER functions as public browser RPCs.
BEGIN;

CREATE TABLE reward_lab.purchase_customers (
  customer_id text PRIMARY KEY,
  registered boolean NOT NULL,
  is_test boolean NOT NULL
);
CREATE TABLE reward_lab.shop_programmes (
  shop_id text PRIMARY KEY REFERENCES reward_lab.shops(shop_id),
  programme_version text NOT NULL CHECK(length(programme_version) BETWEEN 1 AND 100),
  approved boolean NOT NULL,
  opted_in boolean NOT NULL,
  rewards_started_at timestamptz NOT NULL DEFAULT '-infinity'::timestamptz
);
CREATE TABLE reward_lab.menu_eligibility_current (
  shop_id text NOT NULL REFERENCES reward_lab.shops(shop_id),
  item_id text NOT NULL,
  revision integer NOT NULL CHECK(revision>=1),
  unit_minor integer NOT NULL CHECK(unit_minor>=0),
  qualifies_kota boolean NOT NULL,
  PRIMARY KEY(shop_id,item_id)
);
CREATE TABLE reward_lab.purchase_captures (
  order_id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES reward_lab.purchase_customers(customer_id),
  shop_id text NOT NULL REFERENCES reward_lab.shops(shop_id),
  programme_version text,
  approved_at_purchase boolean NOT NULL,
  participating_at_purchase boolean NOT NULL,
  registered_at_purchase boolean NOT NULL,
  test_at_purchase boolean NOT NULL,
  checkout_intent jsonb NOT NULL CHECK(jsonb_typeof(checkout_intent)='array'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE reward_lab.purchase_line_snapshots (
  order_id text NOT NULL REFERENCES reward_lab.purchase_captures(order_id),
  line_index integer NOT NULL CHECK(line_index BETWEEN 1 AND 100),
  line_id text NOT NULL,
  item_id text NOT NULL,
  menu_revision integer NOT NULL CHECK(menu_revision>=1),
  unit_minor integer NOT NULL CHECK(unit_minor>=0),
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
  qualifying_kota boolean NOT NULL,
  programme_version text,
  proof_source text NOT NULL CHECK(proof_source='server-persisted-at-purchase'),
  captured_at timestamptz NOT NULL,
  PRIMARY KEY(order_id,line_index),
  UNIQUE(order_id,line_id),
  UNIQUE(order_id,item_id)
);
CREATE TABLE reward_lab.pickup_source_events (
  order_id text NOT NULL REFERENCES reward_lab.purchase_captures(order_id),
  command_id text NOT NULL UNIQUE,
  revision integer NOT NULL CHECK(revision>=1),
  kind text NOT NULL CHECK(kind IN ('payment_confirmed','collected')),
  actor_uid text NOT NULL CHECK(length(trim(actor_uid))>0),
  occurred_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY(order_id,revision),
  UNIQUE(order_id,kind)
);
CREATE TABLE reward_lab.source_refund_notices (
  notice_id text PRIMARY KEY,
  order_id text NOT NULL,
  line_id text NOT NULL,
  refund_reference text NOT NULL UNIQUE,
  units integer NOT NULL CHECK(units>0),
  reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 500),
  received_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  FOREIGN KEY(order_id,line_id) REFERENCES reward_lab.purchase_line_snapshots(order_id,line_id)
);
-- Checkout records, their line-level eligibility and payment/refund evidence are
-- append-only in this rehearsal. Later menu edits affect only current menu state.
CREATE TRIGGER immutable_purchase BEFORE UPDATE OR DELETE ON reward_lab.purchase_captures
  FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_audit_change();
CREATE TRIGGER immutable_purchase_lines BEFORE UPDATE OR DELETE ON reward_lab.purchase_line_snapshots
  FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_audit_change();
CREATE TRIGGER immutable_pickup_source_events BEFORE UPDATE OR DELETE ON reward_lab.pickup_source_events
  FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_audit_change();
CREATE TRIGGER immutable_source_refunds BEFORE UPDATE OR DELETE ON reward_lab.source_refund_notices
  FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_audit_change();

CREATE FUNCTION reward_lab.capture_purchase_at_checkout(
  p_order_id text,p_customer_id text,p_shop_id text,p_items jsonb
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE
  v_old reward_lab.purchase_captures%ROWTYPE;
  v_customer reward_lab.purchase_customers%ROWTYPE;
  v_shop reward_lab.shop_programmes%ROWTYPE;
  v_active boolean;
  v_enrolled boolean;
  v_registered boolean;
  v_test boolean;
  v_item jsonb;
  v_current reward_lab.menu_eligibility_current%ROWTYPE;
  v_count integer:=0;
  v_line_qty integer;
  v_item_id text;
BEGIN
  IF p_order_id IS NULL OR length(trim(p_order_id)) NOT BETWEEN 1 AND 160
     OR p_order_id<>trim(p_order_id) OR p_customer_id IS NULL
     OR length(trim(p_customer_id)) NOT BETWEEN 1 AND 160
     OR p_shop_id IS NULL OR length(trim(p_shop_id)) NOT BETWEEN 1 AND 160
     OR p_items IS NULL OR jsonb_typeof(p_items)<>'array'
     OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'INVALID_CHECKOUT_INPUT'; END IF;

  -- Same programme row lock used by R2.2 credit and R2.3 refunds/handovers;
  -- duplicate checkout is checked after lock acquisition, never before.
  SELECT active INTO v_active FROM reward_lab.program WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROGRAMME_UNAVAILABLE'; END IF;
  SELECT * INTO v_old FROM reward_lab.purchase_captures WHERE order_id=p_order_id;
  IF FOUND THEN
    IF (v_old.customer_id,v_old.shop_id,v_old.checkout_intent)
      IS DISTINCT FROM (p_customer_id,p_shop_id,p_items)
    THEN RAISE EXCEPTION 'CHECKOUT_REPLAY_CONFLICT'; END IF;
    RETURN p_order_id;
  END IF;

  SELECT * INTO v_customer FROM reward_lab.purchase_customers
     WHERE customer_id=p_customer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_SOURCE_UNAVAILABLE'; END IF;
  SELECT * INTO v_shop FROM reward_lab.shop_programmes
     WHERE shop_id=p_shop_id;
  v_enrolled := FOUND AND v_shop.approved AND v_shop.opted_in AND
    v_shop.rewards_started_at<=transaction_timestamp() AND v_active;
  v_registered := v_customer.registered;
  v_test := v_customer.is_test;

  INSERT INTO reward_lab.purchase_captures(
      order_id,customer_id,shop_id,programme_version,
      approved_at_purchase,participating_at_purchase,registered_at_purchase,
      test_at_purchase,checkout_intent)
  VALUES (p_order_id,p_customer_id,p_shop_id,
      CASE WHEN v_enrolled THEN v_shop.programme_version ELSE NULL END,
      COALESCE(v_shop.approved,false),v_enrolled,v_registered,v_test,p_items);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_count := v_count+1;
    IF jsonb_typeof(v_item)<>'object' OR
       (SELECT count(*) FROM jsonb_object_keys(v_item))<>2 OR
       NOT(v_item ? 'item_id' AND v_item ? 'quantity') OR
       jsonb_typeof(v_item->'item_id')<>'string' OR
       jsonb_typeof(v_item->'quantity')<>'number' OR
       COALESCE(v_item->>'quantity','')!~'^[0-9]{1,3}$'
    THEN RAISE EXCEPTION 'INVALID_CHECKOUT_LINE'; END IF;
    v_item_id := v_item->>'item_id';
    v_line_qty := (v_item->>'quantity')::integer;
    IF length(v_item_id) NOT BETWEEN 1 AND 160 OR v_line_qty NOT BETWEEN 1 AND 100
    THEN RAISE EXCEPTION 'INVALID_CHECKOUT_LINE'; END IF;

    -- FOR SHARE prevents a concurrent merchant UPDATE from replacing the
    -- price / eligibility / revision between reading and persisting snapshot.
    SELECT * INTO v_current FROM reward_lab.menu_eligibility_current
       WHERE shop_id=p_shop_id AND item_id=v_item_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MENU_SOURCE_UNAVAILABLE'; END IF;

    INSERT INTO reward_lab.purchase_line_snapshots(
      order_id,line_index,line_id,item_id,menu_revision,unit_minor,
      quantity,qualifying_kota,programme_version,proof_source,captured_at)
    VALUES(p_order_id,v_count,p_order_id||':line:'||v_count,v_item_id,
      v_current.revision,v_current.unit_minor,v_line_qty,
      v_current.qualifies_kota AND v_enrolled AND v_registered AND NOT v_test,
      CASE WHEN v_enrolled THEN v_shop.programme_version ELSE NULL END,
      'server-persisted-at-purchase',transaction_timestamp());
  END LOOP;
  RETURN p_order_id;
END;
$$;

-- Payment and pickup events are immutable assertions written by the trusted
-- synthetic order service, not a client supplied paid/collected boolean.
CREATE FUNCTION reward_lab.credit_snapshotted_pickup(p_order_id text)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE
  v_purchase reward_lab.purchase_captures%ROWTYPE;
  v_payment reward_lab.pickup_source_events%ROWTYPE;
  v_collection reward_lab.pickup_source_events%ROWTYPE;
  v_line reward_lab.purchase_line_snapshots%ROWTYPE;
  v_existing reward_lab.order_line_facts%ROWTYPE;
  v_eligible integer:=0;
BEGIN
  PERFORM id FROM reward_lab.program WHERE id=1 FOR UPDATE;
  SELECT * INTO v_purchase FROM reward_lab.purchase_captures
     WHERE order_id=p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'IMMUTABLE_CHECKOUT_MISSING'; END IF;
  IF v_purchase.programme_version IS NULL OR NOT v_purchase.participating_at_purchase
     OR NOT v_purchase.approved_at_purchase OR NOT v_purchase.registered_at_purchase
     OR v_purchase.test_at_purchase THEN RAISE EXCEPTION 'PURCHASE_NOT_ELIGIBLE_AT_CHECKOUT'; END IF;

  SELECT * INTO v_payment FROM reward_lab.pickup_source_events
     WHERE order_id=p_order_id AND kind='payment_confirmed';
  SELECT * INTO v_collection FROM reward_lab.pickup_source_events
     WHERE order_id=p_order_id AND kind='collected';
  IF v_payment.command_id IS NULL OR v_collection.command_id IS NULL
     OR v_collection.revision<=v_payment.revision
     OR v_collection.occurred_at<v_payment.occurred_at
     OR v_payment.occurred_at<v_purchase.created_at
  THEN RAISE EXCEPTION 'VERIFIED_PAYMENT_AND_COLLECTION_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM reward_lab.source_refund_notices WHERE order_id=p_order_id)
     OR EXISTS(SELECT 1 FROM reward_lab.refund_events WHERE order_id=p_order_id)
  THEN RAISE EXCEPTION 'REFUND_REQUIRES_REVIEW'; END IF;

  -- Reject fabricated extra lines or mismatches even if a legacy actor with
  -- database owner permissions inserted into the old synthetic facts table.
  IF EXISTS(
    SELECT 1 FROM reward_lab.order_line_facts f
    WHERE f.order_id=p_order_id AND NOT EXISTS(
      SELECT 1 FROM reward_lab.purchase_line_snapshots s
      WHERE s.order_id=f.order_id AND s.line_id=f.line_id AND s.qualifying_kota
      AND s.quantity=f.quantity AND s.order_id=p_order_id
      AND f.customer_id=v_purchase.customer_id AND f.shop_id=v_purchase.shop_id
      AND f.paid AND f.collected AND f.eligible_kota AND NOT f.test_record AND NOT f.refunded
    )
  ) THEN RAISE EXCEPTION 'PERSISTED_FACT_SOURCE_CONFLICT'; END IF;

  FOR v_line IN SELECT * FROM reward_lab.purchase_line_snapshots
    WHERE order_id=p_order_id ORDER BY line_index LOOP
    IF NOT v_line.qualifying_kota THEN CONTINUE; END IF;
    v_eligible:=v_eligible+1;
    SELECT * INTO v_existing FROM reward_lab.order_line_facts
      WHERE order_id=p_order_id AND line_id=v_line.line_id;
    IF FOUND THEN
      IF (v_existing.customer_id,v_existing.shop_id,v_existing.quantity,
          v_existing.paid,v_existing.collected,v_existing.eligible_kota,
          v_existing.test_record,v_existing.refunded)
        IS DISTINCT FROM
         (v_purchase.customer_id,v_purchase.shop_id,v_line.quantity,
          true,true,true,false,false)
      THEN RAISE EXCEPTION 'PERSISTED_FACT_SOURCE_CONFLICT'; END IF;
    ELSE
      INSERT INTO reward_lab.order_line_facts(
        order_id,line_id,customer_id,shop_id,quantity,paid,collected,
        eligible_kota,test_record,refunded)
      VALUES (p_order_id,v_line.line_id,v_purchase.customer_id,
        v_purchase.shop_id,v_line.quantity,true,true,true,false,false);
    END IF;
  END LOOP;
  IF v_eligible=0 THEN RETURN 0; END IF;
  -- Existing R2.2 milestone and budget transaction runs inside this call.
  RETURN reward_lab.credit_paid_order(p_order_id);
END;
$$;

-- Reconciles both sides of the refund/credit race. Program-row lock orders this
-- with checkout and reward credit; after a credit this also invokes the R2.3
-- refund-hold procedure in the SAME transaction. All identity inputs are
-- synthetic trusted service facts, never browser-provided.
CREATE FUNCTION reward_lab.record_snapshot_refund(
  p_notice text,p_order text,p_line text,p_ref text,p_units integer,p_reason text)
RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r25refund$
DECLARE
  v_line reward_lab.purchase_line_snapshots%ROWTYPE;
  v_old reward_lab.source_refund_notices%ROWTYPE;
  v_total integer;
BEGIN
  IF p_notice IS NULL OR length(trim(p_notice)) NOT BETWEEN 1 AND 160
     OR p_ref IS NULL OR length(trim(p_ref)) NOT BETWEEN 1 AND 160
     OR p_units IS NULL OR p_units<1
     OR p_reason IS NULL OR length(p_reason) NOT BETWEEN 3 AND 500
  THEN RAISE EXCEPTION 'INVALID_SNAPSHOT_REFUND'; END IF;
  PERFORM id FROM reward_lab.program WHERE id=1 FOR UPDATE;
  SELECT * INTO v_old FROM reward_lab.source_refund_notices WHERE notice_id=p_notice;
  IF FOUND THEN
    IF (v_old.order_id,v_old.line_id,v_old.refund_reference,v_old.units,v_old.reason)
      IS DISTINCT FROM (p_order,p_line,p_ref,p_units,p_reason)
    THEN RAISE EXCEPTION 'SNAPSHOT_REFUND_REPLAY_CONFLICT'; END IF;
    RETURN p_notice;
  END IF;
  SELECT * INTO v_line FROM reward_lab.purchase_line_snapshots
    WHERE order_id=p_order AND line_id=p_line;
  IF NOT FOUND THEN RAISE EXCEPTION 'PURCHASE_LINE_NOT_FOUND'; END IF;
  SELECT COALESCE(sum(units),0)::integer INTO v_total
    FROM reward_lab.source_refund_notices
    WHERE order_id=p_order AND line_id=p_line;
  IF v_total+p_units>v_line.quantity THEN RAISE EXCEPTION 'REFUND_EXCEEDS_PURCHASE_UNITS'; END IF;
  INSERT INTO reward_lab.source_refund_notices(
    notice_id,order_id,line_id,refund_reference,units,reason)
  VALUES(p_notice,p_order,p_line,p_ref,p_units,p_reason);
  IF EXISTS(SELECT 1 FROM reward_lab.credited_lines
            WHERE order_id=p_order AND line_id=p_line)
  THEN
    PERFORM reward_lab.record_verified_refund(
      p_notice,p_ref,p_order,p_line,p_units,p_reason);
  END IF;
  INSERT INTO reward_lab.audit(event_type,subject_id,detail)
    VALUES('purchase_refund_notice',p_notice,p_order||':'||p_line);
  RETURN p_notice;
END;
$r25refund$;

REVOKE ALL ON ALL TABLES IN SCHEMA reward_lab FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA reward_lab FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA reward_lab FROM PUBLIC;
COMMIT;
