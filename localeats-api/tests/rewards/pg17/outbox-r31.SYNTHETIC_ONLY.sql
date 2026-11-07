-- R3.1 SYNTHETIC_ONLY. NEVER RUN AGAINST HOSTED SUPABASE/STAGING/PRODUCTION.
-- No schema migration, no actual FCM, payment, bank or Rewards credit.
BEGIN;
CREATE ROLE r31_browser NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r31_worker NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r31_definer NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE SCHEMA r31_pickup;
CREATE SCHEMA r31_private;
REVOKE ALL ON SCHEMA r31_pickup,r31_private FROM PUBLIC;

CREATE TABLE r31_pickup.orders (
  id uuid PRIMARY KEY,
  shop_id text NOT NULL, customer_uid text NOT NULL,
  owner_uid text NOT NULL,
  origin text NOT NULL CHECK(origin='authoritative_pickup'),
  registered boolean NOT NULL,
  is_test boolean NOT NULL,
  status text NOT NULL CHECK(status IN ('pending','collected','cancelled')),
  payment_status text NOT NULL CHECK(payment_status IN ('unpaid','paid')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE r31_pickup.checkout_proofs (
  order_id uuid PRIMARY KEY REFERENCES r31_pickup.orders(id),
  shop_id text NOT NULL, customer_uid text NOT NULL,
  programme_version text NOT NULL,
  eligible_units integer NOT NULL CHECK(eligible_units BETWEEN 0 AND 10000),
  approved_at_purchase boolean NOT NULL,
  enrolled_at_purchase boolean NOT NULL,
  captured_at timestamptz NOT NULL
);
CREATE TABLE r31_pickup.command_events (
  order_id uuid NOT NULL REFERENCES r31_pickup.orders(id),
  command_id uuid NOT NULL,
  revision bigint NOT NULL CHECK(revision>0),
  kind text NOT NULL CHECK(kind IN ('payment_confirmed','collected')),
  actor_uid text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY(order_id,revision),
  UNIQUE(order_id,command_id),
  UNIQUE(order_id,kind)
);
CREATE TABLE r31_private.programme (
  version text PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
INSERT INTO r31_private.programme(version,active,starts_at)
 VALUES('future-v1',false,now()-interval '1 day');
CREATE TABLE r31_private.outbox (
  order_id uuid PRIMARY KEY REFERENCES r31_pickup.orders(id),
  collected_command_id uuid NOT NULL UNIQUE,
  collected_revision bigint NOT NULL,
  state text NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending','leased','consumed')),
  attempt integer NOT NULL DEFAULT 0 CHECK(attempt>=0),
  leased_to text,
  lease_until timestamptz,
  processed_at timestamptz,
  queued_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK ((state='leased' AND leased_to IS NOT NULL AND lease_until IS NOT NULL)
      OR (state IN ('pending','consumed') AND leased_to IS NULL AND lease_until IS NULL))
);
CREATE TABLE r31_private.audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL,
  order_id uuid NOT NULL REFERENCES r31_pickup.orders(id),
  detail text NOT NULL,
  UNIQUE(action,order_id,detail)
);
CREATE FUNCTION r31_private.reject_source_edit() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $r31guard$
BEGIN RAISE EXCEPTION 'R31_IMMUTABLE_PICKUP_SOURCE'; END;
$r31guard$;
CREATE TRIGGER no_checkout_edit BEFORE UPDATE OR DELETE ON r31_pickup.checkout_proofs
 FOR EACH ROW EXECUTE FUNCTION r31_private.reject_source_edit();
CREATE TRIGGER no_event_edit BEFORE UPDATE OR DELETE ON r31_pickup.command_events
 FOR EACH ROW EXECUTE FUNCTION r31_private.reject_source_edit();

-- The trusted pickup command inserts a verified collected event in its OWN
-- transaction. This trigger enqueues at most one pointer when the durable
-- source state and original checkout evidence agree.
-- Invalid/ineligible Rewards do NOT cause a legitimate pickup to fail.
CREATE FUNCTION r31_private.enqueue_collected() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $r31enqueue$
DECLARE v_o r31_pickup.orders%ROWTYPE;
        v_p r31_pickup.checkout_proofs%ROWTYPE;
        v_pay r31_pickup.command_events%ROWTYPE;
        v_policy r31_private.programme%ROWTYPE;
BEGIN
 IF NEW.kind<>'collected' THEN RETURN NEW; END IF;
 SELECT * INTO v_o FROM r31_pickup.orders WHERE id=NEW.order_id;
 SELECT * INTO v_p FROM r31_pickup.checkout_proofs WHERE order_id=NEW.order_id;
 SELECT * INTO v_policy FROM r31_private.programme WHERE version='future-v1';
 SELECT * INTO v_pay FROM r31_pickup.command_events
    WHERE order_id=NEW.order_id AND kind='payment_confirmed';
 IF v_o.id IS NULL OR v_p.order_id IS NULL OR v_pay.order_id IS NULL
     OR v_policy.active IS DISTINCT FROM true
     OR v_o.origin<>'authoritative_pickup'
     OR v_o.status<>'collected' OR v_o.payment_status<>'paid'
     OR v_o.registered IS DISTINCT FROM true OR v_o.is_test IS DISTINCT FROM false
     OR v_p.shop_id<>v_o.shop_id OR v_p.customer_uid<>v_o.customer_uid
     OR v_p.programme_version<>v_policy.version
     OR v_p.approved_at_purchase IS DISTINCT FROM true
     OR v_p.enrolled_at_purchase IS DISTINCT FROM true
     OR v_p.eligible_units<=0
     OR v_p.captured_at>v_o.created_at OR v_o.created_at<v_policy.starts_at
     OR v_pay.revision>=NEW.revision
     OR v_pay.occurred_at>NEW.occurred_at
     OR NEW.actor_uid<>v_o.owner_uid
 THEN RETURN NEW; END IF;
 INSERT INTO r31_private.outbox(order_id,collected_command_id,collected_revision)
 VALUES(NEW.order_id,NEW.command_id,NEW.revision)
 ON CONFLICT(order_id) DO NOTHING;
 RETURN NEW;
END;
$r31enqueue$;
CREATE TRIGGER pickup_collected_outbox AFTER INSERT ON r31_pickup.command_events
 FOR EACH ROW EXECUTE FUNCTION r31_private.enqueue_collected();

-- An outbox worker cannot insert source facts, grant points or move money.
-- Claim returns ONLY the trusted immutable pointer. A future independently
-- authenticated consumer must revalidate source in the SAME DB transaction
-- before any ledger write. No such reward-writing consumer exists here.
CREATE FUNCTION r31_private.claim_next(p_worker text)
RETURNS TABLE(order_id uuid,command_id uuid,attempt integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $r31claim$
DECLARE v r31_private.outbox%ROWTYPE;
BEGIN
 IF p_worker IS NULL OR length(p_worker) NOT BETWEEN 1 AND 80
    OR p_worker !~ '^[a-zA-Z0-9_-]+$'
 THEN RAISE EXCEPTION 'R31_INVALID_WORKER_LABEL'; END IF;
 SELECT * INTO v FROM r31_private.outbox x
  WHERE x.state='pending' OR (x.state='leased' AND x.lease_until<clock_timestamp())
  ORDER BY x.queued_at,x.order_id
  FOR UPDATE SKIP LOCKED LIMIT 1;
 IF v.order_id IS NULL THEN RETURN; END IF;
 UPDATE r31_private.outbox x
   SET state='leased',leased_to=p_worker,lease_until=clock_timestamp()+interval '30 seconds',
       attempt=x.attempt+1
   WHERE x.order_id=v.order_id
   RETURNING x.order_id,x.collected_command_id,x.attempt
     INTO order_id,command_id,attempt;
 RETURN NEXT;
END;
$r31claim$;

CREATE FUNCTION r31_private.acknowledge(p_order uuid,p_command uuid,p_worker text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $r31ack$
DECLARE v_count integer;
BEGIN
 IF p_order IS NULL OR p_command IS NULL OR p_worker IS NULL
 THEN RAISE EXCEPTION 'R31_INVALID_ACK'; END IF;
 UPDATE r31_private.outbox x SET state='consumed',leased_to=NULL,
    lease_until=NULL,processed_at=clock_timestamp()
  WHERE x.order_id=p_order AND x.collected_command_id=p_command
    AND x.state='leased' AND x.leased_to=p_worker
    AND x.lease_until>=clock_timestamp();
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'R31_STALE_OR_FORGED_ACK'; END IF;
 RETURN true;
END;
$r31ack$;

GRANT USAGE ON SCHEMA r31_pickup,r31_private TO r31_definer;
GRANT SELECT ON ALL TABLES IN SCHEMA r31_pickup TO r31_definer;
GRANT SELECT ON r31_private.programme,r31_private.outbox TO r31_definer;
GRANT INSERT,UPDATE ON r31_private.outbox TO r31_definer;
ALTER FUNCTION r31_private.enqueue_collected() OWNER TO r31_definer;
ALTER FUNCTION r31_private.claim_next(text) OWNER TO r31_definer;
ALTER FUNCTION r31_private.acknowledge(uuid,uuid,text) OWNER TO r31_definer;

DO $r31rls$
DECLARE t record;
BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_catalog.pg_tables
   WHERE schemaname IN ('r31_pickup','r31_private')
 LOOP
   EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',t.schemaname,t.tablename);
   EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',t.schemaname,t.tablename);
 END LOOP;
END;
$r31rls$;
CREATE POLICY read_order ON r31_pickup.orders FOR SELECT TO r31_definer USING(true);
CREATE POLICY read_proof ON r31_pickup.checkout_proofs FOR SELECT TO r31_definer USING(true);
CREATE POLICY read_event ON r31_pickup.command_events FOR SELECT TO r31_definer USING(true);
CREATE POLICY read_program ON r31_private.programme FOR SELECT TO r31_definer USING(true);
CREATE POLICY owner_outbox ON r31_private.outbox
 FOR ALL TO r31_definer USING(true) WITH CHECK(true);

REVOKE ALL ON ALL TABLES IN SCHEMA r31_pickup FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA r31_private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA r31_private FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA r31_private FROM PUBLIC;
GRANT USAGE ON SCHEMA r31_private TO r31_worker;
GRANT EXECUTE ON FUNCTION r31_private.claim_next(text) TO r31_worker;
GRANT EXECUTE ON FUNCTION r31_private.acknowledge(uuid,uuid,text) TO r31_worker;
COMMIT;
