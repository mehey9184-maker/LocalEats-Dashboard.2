-- R3.2 SYNTHETIC_ONLY. Disposable PostgreSQL 17, never Supabase SQL.
-- Reproduces observed pickup_order_command ordering: orders UPDATE then
-- pickup event INSERT, in one transaction. Not a copy of Production DDL.
BEGIN;
CREATE ROLE r32_owner NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r32_worker NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r32_browser NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE SCHEMA r32_pickup;
CREATE SCHEMA r32_private;
REVOKE ALL ON SCHEMA r32_pickup,r32_private FROM PUBLIC;

CREATE TABLE r32_pickup.orders (
 id uuid PRIMARY KEY, shop_id text NOT NULL,customer_uid text NOT NULL,
 merchant_uid text NOT NULL,
 origin text NOT NULL CHECK(origin='server_created_pickup'),
 registered boolean NOT NULL,is_test boolean NOT NULL,
 status text NOT NULL CHECK(status IN ('ready_for_pickup','collected','cancelled')),
 payment_status text NOT NULL CHECK(payment_status IN ('unpaid','paid')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE r32_pickup.checkout_proofs (
 order_id uuid PRIMARY KEY REFERENCES r32_pickup.orders(id),
 shop_id text NOT NULL,customer_uid text NOT NULL,
 programme_version text NOT NULL,
 qualifies_kota boolean NOT NULL,
 eligible_units integer NOT NULL CHECK(eligible_units BETWEEN 0 AND 100),
 enrolled_at_purchase boolean NOT NULL,
 approved_at_purchase boolean NOT NULL,
 captured_at timestamptz NOT NULL
);
CREATE TABLE r32_pickup.command_events (
 order_id uuid NOT NULL REFERENCES r32_pickup.orders(id),
 command_id uuid NOT NULL,
 revision bigint NOT NULL CHECK(revision>0),
 kind text NOT NULL CHECK(kind IN ('payment_confirmed','collected')),
 actor_uid text NOT NULL,occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(order_id,revision),UNIQUE(order_id,command_id),UNIQUE(order_id,kind)
);
CREATE TABLE r32_pickup.refunds (
 refund_id uuid PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES r32_pickup.orders(id),
 reviewed boolean NOT NULL CHECK(reviewed)
);
CREATE TABLE r32_private.programme (
 version text PRIMARY KEY,
 active boolean NOT NULL DEFAULT false,
 starts_at timestamptz NOT NULL,
 budget_minor integer NOT NULL CHECK(budget_minor>=0),
 reserved_minor integer NOT NULL DEFAULT 0
   CHECK(reserved_minor>=0 AND reserved_minor<=budget_minor)
);
INSERT INTO r32_private.programme(version,active,starts_at,budget_minor)
 VALUES('future-v1',false,now()-interval '1 day',0);

CREATE TABLE r32_private.outbox (
 order_id uuid PRIMARY KEY REFERENCES r32_pickup.orders(id),
 collected_command uuid NOT NULL UNIQUE,
 collected_revision bigint NOT NULL,
 state text NOT NULL DEFAULT 'pending'
  CHECK(state IN ('pending','leased','retry','dead_letter','consumed')),
 attempt integer NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 3),
 lease_token uuid,lease_until timestamptz,
 retry_at timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (
  (state='leased' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
  OR (state<>'leased' AND lease_token IS NULL AND lease_until IS NULL)
 ),
 CHECK (state<>'retry' OR retry_at IS NOT NULL)
);
CREATE TABLE r32_private.credit_receipts (
 order_id uuid PRIMARY KEY REFERENCES r32_pickup.orders(id),
 collected_command uuid NOT NULL UNIQUE,
 customer_uid text NOT NULL,
 kota_units integer NOT NULL CHECK(kota_units BETWEEN 1 AND 100),
 reserved_minor integer NOT NULL CHECK(reserved_minor=2500),
 credited_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Synthetic fault injection owned by the lab, not writable by the worker.
CREATE TABLE r32_private.fault_injections (
 order_id uuid PRIMARY KEY REFERENCES r32_pickup.orders(id),
 fault text NOT NULL CHECK(fault='after_credit_before_consume')
);
CREATE TABLE r32_private.deadletter_audit (
 order_id uuid PRIMARY KEY REFERENCES r32_pickup.orders(id),
 reason text NOT NULL,
 attempt integer NOT NULL CHECK(attempt BETWEEN 1 AND 3),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION r32_private.immutable_source() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r32immutable$
BEGIN RAISE EXCEPTION 'R32_IMMUTABLE_SOURCE'; END;
$r32immutable$;
CREATE TRIGGER immutable_checkout BEFORE UPDATE OR DELETE ON r32_pickup.checkout_proofs
 FOR EACH ROW EXECUTE FUNCTION r32_private.immutable_source();
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON r32_pickup.command_events
 FOR EACH ROW EXECUTE FUNCTION r32_private.immutable_source();
CREATE TRIGGER immutable_refunds BEFORE UPDATE OR DELETE ON r32_pickup.refunds
 FOR EACH ROW EXECUTE FUNCTION r32_private.immutable_source();
CREATE TRIGGER immutable_receipts BEFORE UPDATE OR DELETE ON r32_private.credit_receipts
 FOR EACH ROW EXECUTE FUNCTION r32_private.immutable_source();
CREATE TRIGGER immutable_deadletters BEFORE UPDATE OR DELETE ON r32_private.deadletter_audit
 FOR EACH ROW EXECUTE FUNCTION r32_private.immutable_source();

-- The real service updates orders BEFORE inserting the corresponding event.
-- Here the fixture triggers on that event; its INSERT is part of the same
-- transaction as the order revision/status UPDATE and rolls back together.
CREATE FUNCTION r32_private.enqueue_after_collect() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $r32enqueue$
DECLARE o r32_pickup.orders%ROWTYPE;
        proof r32_pickup.checkout_proofs%ROWTYPE;
        paid r32_pickup.command_events%ROWTYPE;
        programme r32_private.programme%ROWTYPE;
BEGIN
 IF NEW.kind<>'collected' THEN RETURN NEW; END IF;
 SELECT * INTO o FROM r32_pickup.orders WHERE id=NEW.order_id;
 SELECT * INTO proof FROM r32_pickup.checkout_proofs WHERE order_id=NEW.order_id;
 SELECT * INTO paid FROM r32_pickup.command_events
  WHERE order_id=NEW.order_id AND kind='payment_confirmed';
 SELECT * INTO programme FROM r32_private.programme WHERE version='future-v1';
 IF o.id IS NULL OR proof.order_id IS NULL OR paid.order_id IS NULL
   OR programme.active IS DISTINCT FROM true OR
   o.created_at<programme.starts_at OR
   o.status<>'collected' OR o.payment_status<>'paid' OR
   o.origin<>'server_created_pickup' OR
   o.registered IS DISTINCT FROM true OR o.is_test IS DISTINCT FROM false OR
   proof.shop_id<>o.shop_id OR proof.customer_uid<>o.customer_uid OR
   proof.programme_version<>programme.version OR
   proof.qualifies_kota IS DISTINCT FROM true OR proof.eligible_units<4 OR
   proof.enrolled_at_purchase IS DISTINCT FROM true OR
   proof.approved_at_purchase IS DISTINCT FROM true OR
   proof.captured_at>o.created_at OR
   NEW.actor_uid<>o.merchant_uid OR NEW.revision<>o.revision OR
   NEW.revision<=paid.revision OR
   NEW.occurred_at<paid.occurred_at
 THEN RETURN NEW; END IF;
 INSERT INTO r32_private.outbox(order_id,collected_command,collected_revision)
 VALUES (o.id,NEW.command_id,NEW.revision)
 ON CONFLICT(order_id) DO NOTHING;
 RETURN NEW;
END;
$r32enqueue$;
CREATE TRIGGER enqueue_collected AFTER INSERT ON r32_pickup.command_events
 FOR EACH ROW EXECUTE FUNCTION r32_private.enqueue_after_collect();

-- Synthetic-only reduced imitation of deployed pickup_order_command:
-- authorized owner, expected revision, server-only UPDATE before event INSERT.
-- Real service includes more state guards, immutable command hashing, etc.
-- No fake worker is given permission to execute this fixture.
CREATE FUNCTION r32_pickup.command(
 p_order uuid,p_uid text,p_action text,p_command uuid,p_expected_rev bigint)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r32command$
DECLARE o r32_pickup.orders%ROWTYPE;
        old r32_pickup.command_events%ROWTYPE;
        k text;
BEGIN
 IF p_order IS NULL OR p_command IS NULL OR p_uid IS NULL OR
    p_expected_rev IS NULL OR p_action NOT IN ('confirm_payment','collect')
 THEN RAISE EXCEPTION 'R32_INVALID_COMMAND'; END IF;
 SELECT * INTO o FROM r32_pickup.orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'R32_ORDER_NOT_FOUND'; END IF;
 IF o.merchant_uid<>p_uid THEN RAISE EXCEPTION 'R32_FORBIDDEN'; END IF;
 k:=CASE p_action WHEN 'confirm_payment' THEN 'payment_confirmed' ELSE 'collected' END;
 SELECT * INTO old FROM r32_pickup.command_events
   WHERE order_id=p_order AND command_id=p_command;
 IF FOUND THEN
   IF old.actor_uid<>p_uid OR old.kind<>k OR old.revision<>p_expected_rev+1
   THEN RAISE EXCEPTION 'R32_REPLAY_CONFLICT'; END IF;
   RETURN 'replayed';
 END IF;
 IF o.revision<>p_expected_rev THEN RAISE EXCEPTION 'R32_REVISION_CHANGED'; END IF;
 IF p_action='confirm_payment' AND
     (o.status<>'ready_for_pickup' OR o.payment_status<>'unpaid')
 THEN RAISE EXCEPTION 'R32_INVALID_TRANSITION'; END IF;
 IF p_action='collect' AND
     (o.status<>'ready_for_pickup' OR o.payment_status<>'paid')
 THEN RAISE EXCEPTION 'R32_INVALID_TRANSITION'; END IF;
 UPDATE r32_pickup.orders SET
   revision=revision+1,
   status=CASE WHEN p_action='collect' THEN 'collected' ELSE status END,
   payment_status=CASE WHEN p_action='confirm_payment' THEN 'paid' ELSE payment_status END
 WHERE id=p_order RETURNING * INTO o;
 INSERT INTO r32_pickup.command_events(order_id,command_id,revision,kind,actor_uid)
 VALUES(p_order,p_command,o.revision,k,p_uid);
 RETURN k;
END;
$r32command$;

-- Finance executor is a restricted SECURITY DEFINER role:
-- worker sees no source rows or accounting table. The only credit entrypoint
-- atomically rechecks order, events, original proof, refunds and budget.
CREATE FUNCTION r32_private.claim_next()
RETURNS TABLE(order_id uuid,command_id uuid,lease_token uuid,attempt integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $r32claim$
DECLARE v r32_private.outbox%ROWTYPE;
BEGIN
 IF session_user<>'r32_worker' THEN RAISE EXCEPTION 'R32_INTERNAL_ROLE_REQUIRED'; END IF;
 -- Exhausted lease moves into quarantine. No auto-redrive.
 WITH expired AS (
  SELECT o.order_id FROM r32_private.outbox o
  WHERE o.state='leased' AND o.lease_until<clock_timestamp() AND o.attempt>=3
  FOR UPDATE SKIP LOCKED
 ), moved AS (
  UPDATE r32_private.outbox o SET state='dead_letter',lease_token=NULL,
    lease_until=NULL,last_error='LEASE_EXHAUSTED'
  FROM expired e WHERE o.order_id=e.order_id
  RETURNING o.order_id,o.attempt
 )
 INSERT INTO r32_private.deadletter_audit(order_id,reason,attempt)
 SELECT order_id,'LEASE_EXHAUSTED',attempt FROM moved
 ON CONFLICT DO NOTHING;
 SELECT * INTO v FROM r32_private.outbox o
   WHERE o.attempt<3 AND (
      o.state='pending' OR
      (o.state='retry' AND o.retry_at<=clock_timestamp()) OR
      (o.state='leased' AND o.lease_until<clock_timestamp())
   )
   ORDER BY o.created_at,o.order_id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF v.order_id IS NULL THEN RETURN; END IF;
 UPDATE r32_private.outbox o
   SET state='leased',attempt=o.attempt+1,lease_token=pg_catalog.gen_random_uuid(),
       lease_until=clock_timestamp()+interval '30 seconds',
       retry_at=NULL,last_error=NULL
 WHERE o.order_id=v.order_id
 RETURNING o.order_id,o.collected_command,o.lease_token,o.attempt
 INTO order_id,command_id,lease_token,attempt;
 RETURN NEXT;
END;
$r32claim$;

CREATE FUNCTION r32_private.fail_job(p_order uuid,p_lease uuid,p_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $r32fail$
DECLARE v r32_private.outbox%ROWTYPE;
        outcome text;
BEGIN
 IF session_user<>'r32_worker' THEN RAISE EXCEPTION 'R32_INTERNAL_ROLE_REQUIRED'; END IF;
 IF p_code NOT IN ('SOURCE_UNAVAILABLE','TRANSIENT_DB','PERMANENT_INVALID_PROOF')
 THEN RAISE EXCEPTION 'R32_UNTRUSTED_FAILURE_CODE'; END IF;
 SELECT * INTO v FROM r32_private.outbox WHERE order_id=p_order FOR UPDATE;
 IF v.state IS DISTINCT FROM 'leased' OR
    v.lease_token IS DISTINCT FROM p_lease OR v.lease_until<clock_timestamp()
 THEN RAISE EXCEPTION 'R32_STALE_LEASE'; END IF;
 outcome:=CASE WHEN v.attempt>=3 OR p_code='PERMANENT_INVALID_PROOF'
      THEN 'dead_letter' ELSE 'retry' END;
 UPDATE r32_private.outbox SET
   state=outcome,lease_token=NULL,lease_until=NULL,last_error=p_code,
   retry_at=CASE WHEN outcome='retry'
     THEN clock_timestamp()+(power(2,v.attempt)*interval '5 seconds')
     ELSE NULL END
 WHERE order_id=p_order;
 IF outcome='dead_letter' THEN
   INSERT INTO r32_private.deadletter_audit(order_id,reason,attempt)
    VALUES(p_order,p_code,v.attempt) ON CONFLICT DO NOTHING;
 END IF;
 RETURN outcome;
END;
$r32fail$;

CREATE FUNCTION r32_private.consume_job(p_order uuid,p_lease uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $r32consume$
DECLARE v r32_private.outbox%ROWTYPE;
        o r32_pickup.orders%ROWTYPE;
        proof r32_pickup.checkout_proofs%ROWTYPE;
        paid r32_pickup.command_events%ROWTYPE;
        collected r32_pickup.command_events%ROWTYPE;
        programme r32_private.programme%ROWTYPE;
        rows_written integer;
BEGIN
 IF session_user<>'r32_worker' THEN RAISE EXCEPTION 'R32_INTERNAL_ROLE_REQUIRED'; END IF;
 SELECT * INTO v FROM r32_private.outbox WHERE order_id=p_order FOR UPDATE;
 IF v.state IS DISTINCT FROM 'leased' OR v.lease_token IS DISTINCT FROM p_lease OR
    v.lease_until<clock_timestamp()
 THEN RAISE EXCEPTION 'R32_STALE_LEASE'; END IF;
 SELECT * INTO programme FROM r32_private.programme
    WHERE version='future-v1' FOR UPDATE;
 SELECT * INTO o FROM r32_pickup.orders WHERE id=p_order;
 SELECT * INTO proof FROM r32_pickup.checkout_proofs WHERE order_id=p_order;
 SELECT * INTO paid FROM r32_pickup.command_events
    WHERE order_id=p_order AND kind='payment_confirmed';
 SELECT * INTO collected FROM r32_pickup.command_events
    WHERE order_id=p_order AND kind='collected';
 IF programme.active IS DISTINCT FROM true OR o.id IS NULL OR proof.order_id IS NULL
    OR paid.order_id IS NULL OR collected.order_id IS NULL OR
    o.origin<>'server_created_pickup' OR o.status<>'collected' OR
    o.payment_status<>'paid' OR o.registered IS DISTINCT FROM true OR
    o.is_test IS DISTINCT FROM false OR proof.customer_uid<>o.customer_uid OR
    proof.shop_id<>o.shop_id OR proof.programme_version<>programme.version OR
    proof.approved_at_purchase IS DISTINCT FROM true OR
    proof.enrolled_at_purchase IS DISTINCT FROM true OR
    proof.qualifies_kota IS DISTINCT FROM true OR proof.eligible_units<4 OR
    programme.starts_at>o.created_at OR proof.captured_at>o.created_at OR
    collected.command_id<>v.collected_command OR
    collected.revision<>v.collected_revision OR
    collected.actor_uid<>o.merchant_uid OR
    paid.revision>=collected.revision OR paid.occurred_at>collected.occurred_at OR
    EXISTS(SELECT 1 FROM r32_pickup.refunds r WHERE r.order_id=p_order)
 THEN RAISE EXCEPTION 'R32_SOURCE_RECHECK_FAILED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM r32_private.credit_receipts WHERE order_id=p_order) THEN
   UPDATE r32_private.programme SET reserved_minor=reserved_minor+2500
      WHERE version=programme.version AND reserved_minor+2500<=budget_minor;
   GET DIAGNOSTICS rows_written=ROW_COUNT;
   IF rows_written<>1 THEN RAISE EXCEPTION 'R32_BUDGET_EXHAUSTED'; END IF;
   INSERT INTO r32_private.credit_receipts
      (order_id,collected_command,customer_uid,kota_units,reserved_minor)
   VALUES(p_order,v.collected_command,o.customer_uid,proof.eligible_units,2500);
 END IF;
 -- Simulates an abrupt crash after financial write, before ACK. Because both
 -- happen inside ONE SQL transaction, even the money reservation rolls back.
 IF EXISTS(SELECT 1 FROM r32_private.fault_injections
     WHERE order_id=p_order AND fault='after_credit_before_consume')
 THEN RAISE EXCEPTION 'R32_SYNTHETIC_CRASH'; END IF;
 UPDATE r32_private.outbox SET state='consumed',lease_token=NULL,
    lease_until=NULL,retry_at=NULL,last_error=NULL
 WHERE order_id=p_order AND lease_token=p_lease;
 GET DIAGNOSTICS rows_written=ROW_COUNT;
 IF rows_written<>1 THEN RAISE EXCEPTION 'R32_STALE_LEASE'; END IF;
 RETURN proof.eligible_units;
END;
$r32consume$;

-- Grant rights to a NOLOGIN, non-superuser, non-BYPASSRLS function owner.
GRANT USAGE ON SCHEMA r32_pickup,r32_private TO r32_owner;
GRANT SELECT ON ALL TABLES IN SCHEMA r32_pickup TO r32_owner;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA r32_private TO r32_owner;
ALTER FUNCTION r32_private.enqueue_after_collect() OWNER TO r32_owner;
ALTER FUNCTION r32_private.claim_next() OWNER TO r32_owner;
ALTER FUNCTION r32_private.fail_job(uuid,uuid,text) OWNER TO r32_owner;
ALTER FUNCTION r32_private.consume_job(uuid,uuid) OWNER TO r32_owner;

DO $r32rls$
DECLARE t record;
BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_catalog.pg_tables
    WHERE schemaname IN ('r32_pickup','r32_private') LOOP
   EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',t.schemaname,t.tablename);
   EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',t.schemaname,t.tablename);
 END LOOP;
END;
$r32rls$;
CREATE POLICY owner_order_select ON r32_pickup.orders
 FOR SELECT TO r32_owner USING(true);
CREATE POLICY owner_proof_select ON r32_pickup.checkout_proofs
 FOR SELECT TO r32_owner USING(true);
CREATE POLICY owner_event_select ON r32_pickup.command_events
 FOR SELECT TO r32_owner USING(true);
CREATE POLICY owner_refund_select ON r32_pickup.refunds
 FOR SELECT TO r32_owner USING(true);
CREATE POLICY owner_programme ON r32_private.programme
 FOR ALL TO r32_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_outbox ON r32_private.outbox
 FOR ALL TO r32_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_receipts ON r32_private.credit_receipts
 FOR ALL TO r32_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_faults ON r32_private.fault_injections
 FOR SELECT TO r32_owner USING(true);
CREATE POLICY owner_deadletter ON r32_private.deadletter_audit
 FOR ALL TO r32_owner USING(true) WITH CHECK(true);

REVOKE ALL ON ALL TABLES IN SCHEMA r32_pickup FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA r32_private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA r32_private FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA r32_private FROM PUBLIC;
GRANT USAGE ON SCHEMA r32_private TO r32_worker;
GRANT EXECUTE ON FUNCTION r32_private.claim_next() TO r32_worker;
GRANT EXECUTE ON FUNCTION r32_private.fail_job(uuid,uuid,text) TO r32_worker;
GRANT EXECUTE ON FUNCTION r32_private.consume_job(uuid,uuid) TO r32_worker;
COMMIT;
