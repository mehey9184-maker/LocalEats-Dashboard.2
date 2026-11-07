-- R3.0 SYNTHETIC_ONLY. Private executor and trusted source proof in disposable PostgreSQL 17.
-- NOT a Supabase migration. Never apply to hosted Production or staging.
-- Roles have NOLOGIN and are not exposed through PostgREST or app secrets.
BEGIN;
CREATE ROLE r30_finance_owner NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r30_api_executor NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r30_browser NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r30_merchant NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE SCHEMA r30_source;
CREATE SCHEMA r30_private;
REVOKE ALL ON SCHEMA r30_source,r30_private FROM PUBLIC;

-- Source rows model a trusted, independently written pickup order service.
-- The caller executing Rewards has NO INSERT or UPDATE privilege on these rows.
CREATE TABLE r30_source.orders (
  id uuid PRIMARY KEY,
  customer_uid text NOT NULL,
  shop_id text NOT NULL,
  origin text NOT NULL CHECK(origin='server_created_pickup'),
  registered boolean NOT NULL,
  test_order boolean NOT NULL,
  status text NOT NULL CHECK(status IN ('pending','collected','cancelled')),
  payment_status text NOT NULL CHECK(payment_status IN ('unpaid','paid')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE r30_source.purchase_lines (
  order_id uuid NOT NULL REFERENCES r30_source.orders(id),
  line_index integer NOT NULL CHECK(line_index BETWEEN 1 AND 100),
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
  qualifies_kota boolean NOT NULL,
  provenance text NOT NULL CHECK(provenance='immutable_checkout_snapshot'),
  snapshot_at timestamptz NOT NULL,
  PRIMARY KEY(order_id,line_index)
);
CREATE TABLE r30_source.pickup_events (
  order_id uuid NOT NULL REFERENCES r30_source.orders(id),
  revision bigint NOT NULL CHECK(revision>0),
  command_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('payment_confirmed','collected')),
  occurred_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY(order_id,revision),UNIQUE(order_id,command_id),UNIQUE(order_id,kind)
);
CREATE TABLE r30_source.refund_events (
  refund_id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES r30_source.orders(id),
  review_status text NOT NULL CHECK(review_status='verified'),
  approved_by_merchant text NOT NULL,
  approved_by_admin text NOT NULL
);
CREATE TABLE r30_private.programme (
  version text PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  budget_minor integer NOT NULL CHECK(budget_minor>=0),
  committed_minor integer NOT NULL DEFAULT 0 CHECK(committed_minor>=0 AND committed_minor<=budget_minor)
);
INSERT INTO r30_private.programme(version,budget_minor) VALUES('synthetic-v1',0);
CREATE TABLE r30_private.credits (
  order_id uuid NOT NULL,
  line_index integer NOT NULL,
  customer_uid text NOT NULL,
  units integer NOT NULL CHECK(units BETWEEN 1 AND 100),
  PRIMARY KEY(order_id,line_index),
  FOREIGN KEY(order_id,line_index)
    REFERENCES r30_source.purchase_lines(order_id,line_index)
);
CREATE TABLE r30_private.progress (
  customer_uid text PRIMARY KEY,
  lifetime_units integer NOT NULL DEFAULT 0 CHECK(lifetime_units>=0)
);
CREATE TABLE r30_private.bronze_grants (
  customer_uid text PRIMARY KEY REFERENCES r30_private.progress(customer_uid),
  source_order_id uuid NOT NULL REFERENCES r30_source.orders(id),
  cap_minor integer NOT NULL CHECK(cap_minor=2500)
);
CREATE TABLE r30_private.audit_events (
  event_key text PRIMARY KEY,
  event_kind text NOT NULL,
  original_order_id uuid NOT NULL REFERENCES r30_source.orders(id)
);

-- Immutable server source and ledger evidence cannot be edited after capture.
CREATE FUNCTION r30_private.no_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r30guard$
BEGIN RAISE EXCEPTION 'R30_IMMUTABLE_SOURCE'; END;
$r30guard$;
CREATE TRIGGER immutable_source_order BEFORE UPDATE OR DELETE ON r30_source.orders
 FOR EACH ROW EXECUTE FUNCTION r30_private.no_mutation();
CREATE TRIGGER immutable_source_lines BEFORE UPDATE OR DELETE ON r30_source.purchase_lines
 FOR EACH ROW EXECUTE FUNCTION r30_private.no_mutation();
CREATE TRIGGER immutable_source_events BEFORE UPDATE OR DELETE ON r30_source.pickup_events
 FOR EACH ROW EXECUTE FUNCTION r30_private.no_mutation();
CREATE TRIGGER immutable_source_refunds BEFORE UPDATE OR DELETE ON r30_source.refund_events
 FOR EACH ROW EXECUTE FUNCTION r30_private.no_mutation();
CREATE TRIGGER immutable_credit BEFORE UPDATE OR DELETE ON r30_private.credits
 FOR EACH ROW EXECUTE FUNCTION r30_private.no_mutation();
CREATE TRIGGER immutable_grant BEFORE UPDATE OR DELETE ON r30_private.bronze_grants
 FOR EACH ROW EXECUTE FUNCTION r30_private.no_mutation();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON r30_private.audit_events
 FOR EACH ROW EXECUTE FUNCTION r30_private.no_mutation();

-- This is an intentionally narrow, PRIVATE SECURITY DEFINER command:
-- the designated NOLOGIN owner gets ONLY SELECT from immutable source and
-- SELECT/INSERT/UPDATE to its own ledger. The API role may EXECUTE this
-- function, but has zero direct SELECT/WRITE access to source/ledger.
-- No caller supplied eligibility, customer, shop, amount or payout parameters.
-- No settlement, transfers, refunds, hold release or tier changes here.
CREATE FUNCTION r30_private.credit_verified_pickup(p_order uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $r30credit$
DECLARE
  v_campaign r30_private.programme%ROWTYPE;
  v_order r30_source.orders%ROWTYPE;
  v_payment r30_source.pickup_events%ROWTYPE;
  v_collected r30_source.pickup_events%ROWTYPE;
  v_line r30_source.purchase_lines%ROWTYPE;
  v_rows integer;
  v_units integer:=0;
  v_total integer;
BEGIN
  IF p_order IS NULL THEN RAISE EXCEPTION 'R30_INVALID_ORDER'; END IF;
  SELECT * INTO v_campaign FROM r30_private.programme
    WHERE version='synthetic-v1' FOR UPDATE;
  IF NOT FOUND OR NOT v_campaign.active THEN
    RAISE EXCEPTION 'R30_REWARDS_DISABLED'; END IF;
  SELECT * INTO v_order FROM r30_source.orders WHERE id=p_order;
  IF NOT FOUND OR v_order.origin<>'server_created_pickup' OR
     v_order.status<>'collected' OR v_order.payment_status<>'paid' OR
     v_order.registered IS DISTINCT FROM true OR
     v_order.test_order IS DISTINCT FROM false OR
     length(trim(v_order.customer_uid))=0 OR
     length(trim(v_order.shop_id))=0
  THEN RAISE EXCEPTION 'R30_TRUSTED_ORDER_REQUIRED'; END IF;
  SELECT * INTO v_payment FROM r30_source.pickup_events
    WHERE order_id=p_order AND kind='payment_confirmed';
  SELECT * INTO v_collected FROM r30_source.pickup_events
    WHERE order_id=p_order AND kind='collected';
  IF v_payment.command_id IS NULL OR v_collected.command_id IS NULL OR
     v_collected.revision<=v_payment.revision OR
     v_payment.occurred_at<v_order.created_at OR
     v_collected.occurred_at<v_payment.occurred_at
  THEN RAISE EXCEPTION 'R30_PAYMENT_AND_COLLECTION_PROOF_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM r30_source.refund_events WHERE order_id=p_order)
  THEN RAISE EXCEPTION 'R30_REFUND_REVIEW_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM r30_source.purchase_lines WHERE order_id=p_order)
  THEN RAISE EXCEPTION 'R30_SNAPSHOT_REQUIRED'; END IF;
  IF EXISTS(
    SELECT 1 FROM r30_source.purchase_lines
    WHERE order_id=p_order AND (provenance<>'immutable_checkout_snapshot'
      OR snapshot_at>v_order.created_at)
  ) THEN RAISE EXCEPTION 'R30_INVALID_SNAPSHOT'; END IF;

  FOR v_line IN SELECT * FROM r30_source.purchase_lines
    WHERE order_id=p_order AND qualifies_kota ORDER BY line_index LOOP
    INSERT INTO r30_private.credits(order_id,line_index,customer_uid,units)
      VALUES(p_order,v_line.line_index,v_order.customer_uid,v_line.quantity)
      ON CONFLICT(order_id,line_index) DO NOTHING;
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows=0 THEN CONTINUE; END IF;
    INSERT INTO r30_private.progress(customer_uid) VALUES(v_order.customer_uid)
       ON CONFLICT(customer_uid) DO NOTHING;
    UPDATE r30_private.progress
       SET lifetime_units=lifetime_units+v_line.quantity
       WHERE customer_uid=v_order.customer_uid;
    v_units:=v_units+v_line.quantity;
  END LOOP;
  SELECT lifetime_units INTO v_total FROM r30_private.progress
     WHERE customer_uid=v_order.customer_uid;
  IF v_total>=4 AND NOT EXISTS(
    SELECT 1 FROM r30_private.bronze_grants WHERE customer_uid=v_order.customer_uid
  ) THEN
    UPDATE r30_private.programme SET committed_minor=committed_minor+2500
      WHERE version=v_campaign.version AND committed_minor+2500<=budget_minor;
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows<>1 THEN RAISE EXCEPTION 'R30_BUDGET_EXHAUSTED'; END IF;
    INSERT INTO r30_private.bronze_grants(customer_uid,source_order_id,cap_minor)
      VALUES(v_order.customer_uid,p_order,2500);
    INSERT INTO r30_private.audit_events(event_key,event_kind,original_order_id)
      VALUES('bronze:'||v_order.customer_uid,'bronze_earned',p_order);
  END IF;
  RETURN v_units;
END;
$r30credit$;

-- A fixed privileged owner, *not* postgres/superuser and not API executor.
ALTER FUNCTION r30_private.credit_verified_pickup(uuid) OWNER TO r30_finance_owner;
GRANT USAGE ON SCHEMA r30_source,r30_private TO r30_finance_owner;
GRANT SELECT ON ALL TABLES IN SCHEMA r30_source TO r30_finance_owner;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA r30_private TO r30_finance_owner;
-- Owner role has narrow data rights, cannot read arbitrary profiles/payments,
-- update source facts, or claim a browser-supplied Firebase identity.
-- RLS + FORCE applies to all records, including finance owner role.
DO $r30rls$
DECLARE v record;
BEGIN
  FOR v IN SELECT schemaname,tablename FROM pg_catalog.pg_tables
    WHERE schemaname IN ('r30_source','r30_private') LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',v.schemaname,v.tablename);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',v.schemaname,v.tablename);
  END LOOP;
END;
$r30rls$;
CREATE POLICY trusted_source_read ON r30_source.orders
  FOR SELECT TO r30_finance_owner USING(true);
CREATE POLICY trusted_lines_read ON r30_source.purchase_lines
  FOR SELECT TO r30_finance_owner USING(true);
CREATE POLICY trusted_events_read ON r30_source.pickup_events
  FOR SELECT TO r30_finance_owner USING(true);
CREATE POLICY trusted_refunds_read ON r30_source.refund_events
  FOR SELECT TO r30_finance_owner USING(true);
CREATE POLICY owner_programme ON r30_private.programme
  FOR ALL TO r30_finance_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_credits ON r30_private.credits
  FOR ALL TO r30_finance_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_progress ON r30_private.progress
  FOR ALL TO r30_finance_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_grants ON r30_private.bronze_grants
  FOR ALL TO r30_finance_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_audit ON r30_private.audit_events
  FOR ALL TO r30_finance_owner USING(true) WITH CHECK(true);
REVOKE ALL ON ALL TABLES IN SCHEMA r30_source FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA r30_private FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA r30_source FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA r30_private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA r30_private FROM PUBLIC;
GRANT USAGE ON SCHEMA r30_private TO r30_api_executor;
GRANT EXECUTE ON FUNCTION r30_private.credit_verified_pickup(uuid) TO r30_api_executor;
COMMIT;
