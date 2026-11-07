-- R3.3 SYNTHETIC_ONLY. This is NOT a Supabase migration.
-- Load only in disposable postgres:17-alpine with synthetic source records.
-- Verified 2026-11-08 metadata: orders.id UUID, shop_id/user_id TEXT,
-- items JSONB, revision BIGINT, create_intent_hash TEXT;
-- pickup_order_events.order_id/command_id UUID, revision BIGINT.
-- Source is a deliberately REDUCED DDL clone, not production parity.
BEGIN;
CREATE ROLE r33_browser NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r33_worker NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE SCHEMA r33_source;
CREATE SCHEMA r33_private;
REVOKE ALL ON SCHEMA r33_source,r33_private FROM PUBLIC;

CREATE TABLE r33_source.shops(
  id text PRIMARY KEY,
  owner_id text
);
CREATE TABLE r33_source.orders(
  id uuid PRIMARY KEY,
  shop_id text NOT NULL REFERENCES r33_source.shops(id),
  user_id text,
  items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'),
  create_intent_hash text,
  revision bigint,
  status text,
  payment_status text,
  payment_method text,
  delivery_type text NOT NULL DEFAULT 'collection',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(id,shop_id,user_id)
);
CREATE TABLE r33_source.pickup_order_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES r33_source.orders(id) ON DELETE RESTRICT,
  command_id uuid NOT NULL,
  revision bigint NOT NULL CHECK(revision>0),
  command_hash text NOT NULL,
  kind text NOT NULL,
  actor_uid text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(order_id,command_id),
  UNIQUE(order_id,revision),
  UNIQUE(order_id,kind)
);
CREATE TABLE r33_private.programme(
  version text PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  budget_minor integer NOT NULL DEFAULT 0 CHECK(budget_minor>=0),
  committed_minor integer NOT NULL DEFAULT 0
    CHECK(committed_minor>=0 AND committed_minor<=budget_minor)
);
INSERT INTO r33_private.programme(version) VALUES('future-v1');
CREATE TABLE r33_private.checkout_snapshots(
  order_id uuid PRIMARY KEY,
  shop_id text NOT NULL,
  customer_uid text NOT NULL,
  programme_version text NOT NULL REFERENCES r33_private.programme(version),
  captured_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  original_shop_approved boolean NOT NULL,
  original_shop_enrolled boolean NOT NULL,
  original_registered_customer boolean NOT NULL,
  FOREIGN KEY(order_id,shop_id,customer_uid)
    REFERENCES r33_source.orders(id,shop_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE r33_private.original_lines(
  order_id uuid NOT NULL REFERENCES r33_private.checkout_snapshots(order_id) ON DELETE RESTRICT,
  line_no integer NOT NULL CHECK(line_no>0),
  item_id text NOT NULL,
  menu_revision bigint NOT NULL CHECK(menu_revision>0),
  unit_minor integer NOT NULL CHECK(unit_minor>=0),
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
  qualifies_kota boolean NOT NULL,
  PRIMARY KEY(order_id,line_no)
);
CREATE TABLE r33_private.outbox(
  order_id uuid PRIMARY KEY REFERENCES r33_private.checkout_snapshots(order_id) ON DELETE RESTRICT,
  collected_event_id uuid NOT NULL UNIQUE REFERENCES r33_source.pickup_order_events(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending','leased','consumed','dead_letter')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE r33_private.financial_obligations(
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES r33_private.checkout_snapshots(order_id) ON DELETE RESTRICT,
  amount_minor integer NOT NULL CHECK(amount_minor>=0),
  status text NOT NULL CHECK(status IN ('reserved','owed','sent','disputed','settled'))
);
CREATE TABLE r33_private.audit_events(
  event_id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES r33_private.checkout_snapshots(order_id) ON DELETE RESTRICT,
  kind text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE FUNCTION r33_private.reject_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $immutable$
BEGIN RAISE EXCEPTION 'R33_APPEND_ONLY_FACT'; END;
$immutable$;
CREATE TRIGGER immutable_snapshots BEFORE UPDATE OR DELETE ON r33_private.checkout_snapshots
 FOR EACH ROW EXECUTE FUNCTION r33_private.reject_immutable();
CREATE TRIGGER immutable_lines BEFORE UPDATE OR DELETE ON r33_private.original_lines
 FOR EACH ROW EXECUTE FUNCTION r33_private.reject_immutable();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON r33_private.audit_events
 FOR EACH ROW EXECUTE FUNCTION r33_private.reject_immutable();

-- A manifest is the minimum pickup schema preflight, not full DDL parity.
-- The actual deployed schema MUST be rechecked independently at rollout.
CREATE TABLE r33_private.expected_source_columns(
 table_name text NOT NULL,
 column_name text NOT NULL,
 expected_pg_type text NOT NULL,
 PRIMARY KEY(table_name,column_name)
);
INSERT INTO r33_private.expected_source_columns(table_name,column_name,expected_pg_type)
 VALUES
 ('orders','id','uuid'),
 ('orders','shop_id','text'),
 ('orders','user_id','text'),
 ('orders','items','jsonb'),
 ('orders','create_intent_hash','text'),
 ('orders','revision','bigint'),
 ('orders','payment_status','text'),
 ('orders','status','text'),
 ('pickup_order_events','id','uuid'),
 ('pickup_order_events','order_id','uuid'),
 ('pickup_order_events','command_id','uuid'),
 ('pickup_order_events','revision','bigint'),
 ('pickup_order_events','command_hash','text'),
 ('pickup_order_events','kind','text'),
 ('pickup_order_events','actor_uid','text'),
 ('shops','id','text'),
 ('shops','owner_id','text');
CREATE FUNCTION r33_private.assert_source_contract()
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $contract$
DECLARE bad integer;
BEGIN
 SELECT count(*) INTO bad FROM r33_private.expected_source_columns e
 LEFT JOIN pg_catalog.pg_class c ON c.oid=to_regclass(format('r33_source.%I',e.table_name))
 LEFT JOIN pg_catalog.pg_attribute a
   ON a.attrelid=c.oid AND a.attname=e.column_name AND a.attnum>0 AND NOT a.attisdropped
 WHERE a.attname IS NULL OR
   pg_catalog.format_type(a.atttypid,a.atttypmod) IS DISTINCT FROM e.expected_pg_type;
 IF bad<>0 THEN RAISE EXCEPTION 'R33_PICKUP_SCHEMA_DRIFT'; END IF;
 IF NOT EXISTS(
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='r33_source.pickup_order_events'::regclass
      AND contype='u' AND pg_catalog.pg_get_constraintdef(oid) LIKE '%(order_id, command_id)%'
 ) OR NOT EXISTS(
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='r33_source.pickup_order_events'::regclass
      AND contype='u' AND pg_catalog.pg_get_constraintdef(oid) LIKE '%(order_id, revision)%'
 ) THEN RAISE EXCEPTION 'R33_PICKUP_UNIQUENESS_DRIFT'; END IF;
 RETURN true;
END;
$contract$;

-- Never destroy a ledger with potentially outstanding or disputed claims.
-- This is a TEST-ONLY operator guard and not a deployable rollback script.
CREATE FUNCTION r33_private.assert_safe_to_remove()
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $safe$
BEGIN
 IF EXISTS(SELECT 1 FROM r33_private.checkout_snapshots)
 OR EXISTS(SELECT 1 FROM r33_private.outbox)
 OR EXISTS(SELECT 1 FROM r33_private.financial_obligations)
 OR EXISTS(SELECT 1 FROM r33_private.audit_events)
 OR EXISTS(SELECT 1 FROM r33_private.original_lines)
 OR EXISTS(SELECT 1 FROM r33_private.programme
   WHERE committed_minor<>0 OR active)
 THEN RAISE EXCEPTION 'R33_PRESERVE_LEDGER_AND_OBLIGATIONS'; END IF;
 RETURN true;
END;
$safe$;

DO $rls$
DECLARE rec record;
BEGIN
 FOR rec IN SELECT schemaname,tablename FROM pg_catalog.pg_tables
  WHERE schemaname IN ('r33_source','r33_private')
 LOOP
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',rec.schemaname,rec.tablename);
  EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',rec.schemaname,rec.tablename);
 END LOOP;
END;
$rls$;
REVOKE ALL ON ALL TABLES IN SCHEMA r33_source FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA r33_private FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA r33_private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA r33_private FROM PUBLIC;
-- No PUBLIC, browser or worker access to tables, functions or schema.
-- Fixture writes and proofs use only the disposable test DB owner.
COMMIT;
