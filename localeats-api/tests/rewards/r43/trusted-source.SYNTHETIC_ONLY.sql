-- LocalPay R4.3 -- synthetic evidence SOURCE test in disposable PG17 ONLY.
-- No migrations, no hosted Supabase, no live API routes, no real auth/payments.
-- R4.2 scratch private schema must already be loaded into the SAME disposable DB.
BEGIN;
CREATE ROLE r43_untrusted NOLOGIN;
CREATE SCHEMA r43_lab;
REVOKE ALL ON SCHEMA r43_lab FROM PUBLIC;

CREATE TABLE r43_lab.customers (
 uid text PRIMARY KEY,
 registered boolean NOT NULL,
 anonymous boolean NOT NULL,
 test_account boolean NOT NULL
);
INSERT INTO r43_lab.customers VALUES('customer-1',true,false,false),('customer-2',true,false,false);
CREATE TABLE r43_lab.shops (
 shop_id text PRIMARY KEY,
 owner_uid text NOT NULL,
 approved boolean NOT NULL,
 participating boolean NOT NULL,
 approved_at timestamptz NOT NULL,
 rewards_start timestamptz NOT NULL
);
INSERT INTO r43_lab.shops VALUES
 ('my-kota','merchant-1',true,true,'2026-10-01T00:00:00Z','2026-11-01T00:00:00Z'),
 ('shop-b','merchant-2',true,true,'2026-10-01T00:00:00Z','2026-11-01T00:00:00Z');
-- Only a future Firebase Admin verified middleware may create corresponding
-- REAL sessions; here every entry is fabricated in the test data fixture.
CREATE TABLE r43_lab.verified_sessions (
 session_id text PRIMARY KEY,
 uid text NOT NULL,
 shop_scope text NOT NULL,
 role_name text NOT NULL,
 verified_source text NOT NULL,
 revoked boolean NOT NULL,
 anonymous boolean NOT NULL,
 verified_at timestamptz NOT NULL
);
INSERT INTO r43_lab.verified_sessions VALUES
 ('sess-owner','merchant-1','my-kota','merchant','firebase-admin-revocation-checked',false,false,'2026-11-07T09:00:00Z'),
 ('sess-other','merchant-2','shop-b','merchant','firebase-admin-revocation-checked',false,false,'2026-11-07T09:00:00Z'),
 ('sess-revoked','merchant-1','my-kota','merchant','firebase-admin-revocation-checked',true,false,'2026-11-07T09:00:00Z'),
 ('sess-browser','merchant-1','my-kota','merchant','self-declared-request-body',false,false,'2026-11-07T09:00:00Z');
CREATE TABLE r43_lab.orders (
 order_id text PRIMARY KEY,
 customer_uid text NOT NULL REFERENCES r43_lab.customers(uid),
 shop_id text NOT NULL REFERENCES r43_lab.shops(shop_id),
 order_type text NOT NULL,
 status text NOT NULL,
 payment_status text NOT NULL,
 test_record boolean NOT NULL,
 simulated boolean NOT NULL,
 programme_version text NOT NULL,
 created_at timestamptz NOT NULL,
 server_intent_hash text NOT NULL
);
CREATE TABLE r43_lab.lines (
 order_id text NOT NULL REFERENCES r43_lab.orders(order_id),
 line_id text NOT NULL,
 shop_id text NOT NULL,
 item_id text NOT NULL,
 quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100),
 price_minor integer NOT NULL CHECK (price_minor>0),
 qualifying_kota boolean NOT NULL,
 reward_funded boolean NOT NULL,
 source text NOT NULL,
 snapshot_at timestamptz NOT NULL,
 PRIMARY KEY (order_id,line_id)
);
CREATE TABLE r43_lab.pickup_events (
 order_id text NOT NULL REFERENCES r43_lab.orders(order_id),
 command_id text NOT NULL,
 revision integer NOT NULL CHECK (revision>0),
 kind text NOT NULL,
 session_id text NOT NULL REFERENCES r43_lab.verified_sessions(session_id),
 occurred_at timestamptz NOT NULL,
 PRIMARY KEY(order_id,command_id),
 UNIQUE(order_id,revision),
 UNIQUE(order_id,kind)
);
CREATE TABLE r43_lab.customer_pickup_proofs (
 proof_id text PRIMARY KEY,
 order_id text NOT NULL UNIQUE REFERENCES r43_lab.orders(order_id),
 customer_uid text NOT NULL,
 shop_id text NOT NULL,
 source text NOT NULL,
 verified boolean NOT NULL,
 occurred_at timestamptz NOT NULL
);
CREATE TABLE r43_lab.refund_reviews (
 refund_id text PRIMARY KEY,
 order_id text NOT NULL REFERENCES r43_lab.orders(order_id),
 status text NOT NULL,
 received_at timestamptz NOT NULL
);
CREATE TABLE r43_lab.credit_audit (
 order_id text PRIMARY KEY REFERENCES r43_lab.orders(order_id),
 source text NOT NULL CHECK(source='SYNTHETIC_PRIVATE_SERVER_ORDER_SNAPSHOT'),
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE FUNCTION r43_lab.deny_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN RAISE EXCEPTION 'R43_SOURCE_IMMUTABLE'; END
$fn$;
CREATE TRIGGER no_event_rewrite BEFORE UPDATE OR DELETE ON r43_lab.pickup_events
 FOR EACH ROW EXECUTE FUNCTION r43_lab.deny_mutation();
CREATE TRIGGER no_snapshot_rewrite BEFORE UPDATE OR DELETE ON r43_lab.lines
 FOR EACH ROW EXECUTE FUNCTION r43_lab.deny_mutation();
CREATE TRIGGER no_ack_rewrite BEFORE UPDATE OR DELETE ON r43_lab.customer_pickup_proofs
 FOR EACH ROW EXECUTE FUNCTION r43_lab.deny_mutation();
CREATE TRIGGER no_refund_rewrite BEFORE UPDATE OR DELETE ON r43_lab.refund_reviews
 FOR EACH ROW EXECUTE FUNCTION r43_lab.deny_mutation();
CREATE TRIGGER no_credit_audit_rewrite BEFORE UPDATE OR DELETE ON r43_lab.credit_audit
 FOR EACH ROW EXECUTE FUNCTION r43_lab.deny_mutation();

-- Seed fake server-owned facts. Test owner only, NOT A PUBLIC ENDPOINT.
-- Every p_variant creates a distinct order with one synthetic item line.
CREATE FUNCTION r43_lab.seed_fixture(p_variant text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE oid text:='order-'||p_variant; v_session text:='sess-owner';
BEGIN
 IF p_variant IS NULL OR length(p_variant) NOT BETWEEN 1 AND 60
 OR p_variant !~ '^[a-z-]+$' THEN RAISE EXCEPTION 'R43_INVALID_FIXTURE_NAME'; END IF;
 INSERT INTO r43_lab.orders VALUES
 (oid,CASE WHEN p_variant='race-refund' THEN 'customer-2' ELSE 'customer-1' END,
 CASE WHEN p_variant='other-shop' THEN 'shop-b' ELSE 'my-kota' END,
 CASE WHEN p_variant='delivery' THEN 'delivery' ELSE 'collection' END,
 CASE WHEN p_variant='uncollected' THEN 'ready_for_pickup' ELSE 'collected' END,
 CASE WHEN p_variant='unpaid' THEN 'unpaid' ELSE 'paid' END,
 p_variant='test-account',p_variant='simulated','bronze-only-v1',
 CASE WHEN p_variant='before-programme' THEN '2026-10-30T10:00:00Z'::timestamptz
      ELSE '2026-11-07T10:00:00Z'::timestamptz END,
 repeat('a',64));
 IF p_variant='revoked-session' THEN v_session:='sess-revoked';
 ELSIF p_variant='browser-session' THEN v_session:='sess-browser';
 ELSIF p_variant='wrong-merchant' THEN v_session:='sess-other'; END IF;
 IF p_variant<>'missing-payment' THEN
 INSERT INTO r43_lab.pickup_events
 VALUES(oid,'cmd-pay',CASE WHEN p_variant='reverse-events' THEN 2 ELSE 1 END,
 'payment_confirmed',v_session,'2026-11-07T10:02:00Z');
 END IF;
 IF p_variant<>'missing-handover' THEN
 INSERT INTO r43_lab.pickup_events
 VALUES(oid,'cmd-collect',CASE WHEN p_variant='reverse-events' THEN 1 ELSE 2 END,
 'collected',v_session,'2026-11-07T10:10:00Z');
 END IF;
 IF p_variant<>'missing-code' THEN
 INSERT INTO r43_lab.customer_pickup_proofs VALUES
 ('proof:'||oid,oid,
 CASE WHEN p_variant='wrong-customer-code' THEN 'not-the-customer'
 WHEN p_variant='race-refund' THEN 'customer-2' ELSE 'customer-1' END,
 CASE WHEN p_variant='wrong-shop-code' THEN 'shop-b' ELSE 'my-kota' END,
 CASE WHEN p_variant='request-body-code' THEN 'client-request-body'
 ELSE 'server-verified-one-time-pickup-code' END,
 p_variant<>'unverified-code','2026-11-07T10:09:00Z');
 END IF;
 INSERT INTO r43_lab.lines VALUES
 (oid,'line-1',
 CASE WHEN p_variant='wrong-snapshot-shop' THEN 'shop-b' ELSE
   CASE WHEN p_variant='other-shop' THEN 'shop-b' ELSE 'my-kota' END END,
 'kota-25',4,2500,p_variant<>'ineligible',p_variant='reward-funded',
 CASE WHEN p_variant='client-snapshot' THEN 'client-request-body'
 ELSE 'server-persisted-at-checkout' END,
 '2026-11-07T09:59:00Z');
 IF p_variant='refunded' THEN
 INSERT INTO r43_lab.refund_reviews VALUES('refund:'||oid,oid,'verified','2026-11-07T10:11:00Z');
 END IF;
 RETURN oid;
END
$fn$;

-- The caller passes an ORDER ID only. Every money/identity/status fact is
-- read from PostgreSQL source tables, not p_paid/p_collected/body/shop flags.
-- SECURITY INVOKER scratch owner; NOT a safe public RPC or real Firebase auth.
CREATE FUNCTION r43_lab.credit_from_verified_source(p_order text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE
 o r43_lab.orders%ROWTYPE;
 cust r43_lab.customers%ROWTYPE;
 shop r43_lab.shops%ROWTYPE;
 pay r43_lab.pickup_events%ROWTYPE;
 handover r43_lab.pickup_events%ROWTYPE;
 p_session r43_lab.verified_sessions%ROWTYPE;
 c_session r43_lab.verified_sessions%ROWTYPE;
 ack r43_lab.customer_pickup_proofs%ROWTYPE;
 ln r43_lab.lines%ROWTYPE;
 result text:='NO_KOTA';
BEGIN
 IF p_order IS NULL OR length(p_order) NOT BETWEEN 1 AND 80
 THEN RAISE EXCEPTION 'R43_INVALID_ORDER'; END IF;
 -- Prevent a concurrently recorded refund from passing after eligibility was
 -- checked: both this function and record_refund_fixture lock the ORDER row.
 SELECT * INTO o FROM r43_lab.orders WHERE order_id=p_order FOR UPDATE;
 IF NOT FOUND OR o.order_type<>'collection' OR o.status<>'collected'
 OR o.payment_status<>'paid' OR o.test_record OR o.simulated
 OR o.programme_version<>'bronze-only-v1'
 OR o.server_intent_hash !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'R43_NOT_AUTHENTIC_PAID_COLLECTED_ORDER'; END IF;
 SELECT * INTO cust FROM r43_lab.customers WHERE uid=o.customer_uid FOR SHARE;
 IF NOT FOUND OR NOT cust.registered OR cust.anonymous OR cust.test_account
 THEN RAISE EXCEPTION 'R43_CUSTOMER_NOT_VERIFIED'; END IF;
 SELECT * INTO shop FROM r43_lab.shops WHERE shop_id=o.shop_id FOR SHARE;
 IF NOT FOUND OR NOT shop.approved OR NOT shop.participating
 OR o.created_at < shop.approved_at OR o.created_at < shop.rewards_start
 THEN RAISE EXCEPTION 'R43_SHOP_NOT_ELIGIBLE_AT_PURCHASE'; END IF;
 SELECT * INTO pay FROM r43_lab.pickup_events
 WHERE order_id=p_order AND kind='payment_confirmed';
 SELECT * INTO handover FROM r43_lab.pickup_events
 WHERE order_id=p_order AND kind='collected';
 IF pay.order_id IS NULL OR handover.order_id IS NULL
 OR pay.revision >= handover.revision
 OR pay.occurred_at<o.created_at OR handover.occurred_at<pay.occurred_at
 THEN RAISE EXCEPTION 'R43_PAYMENT_AND_COLLECTION_EVENTS_REQUIRED'; END IF;
 SELECT * INTO p_session FROM r43_lab.verified_sessions
 WHERE session_id=pay.session_id FOR SHARE;
 SELECT * INTO c_session FROM r43_lab.verified_sessions
 WHERE session_id=handover.session_id FOR SHARE;
 IF p_session.session_id IS NULL OR c_session.session_id IS NULL
 OR p_session.uid<>shop.owner_uid OR c_session.uid<>shop.owner_uid
 OR p_session.shop_scope<>o.shop_id OR c_session.shop_scope<>o.shop_id
 OR p_session.role_name<>'merchant' OR c_session.role_name<>'merchant'
 OR p_session.verified_source<>'firebase-admin-revocation-checked'
 OR c_session.verified_source<>'firebase-admin-revocation-checked'
 OR p_session.revoked OR c_session.revoked
 OR p_session.anonymous OR c_session.anonymous
 OR p_session.verified_at>pay.occurred_at OR c_session.verified_at>handover.occurred_at
 THEN RAISE EXCEPTION 'R43_AUTHENTICATED_SHOP_ACTOR_REQUIRED'; END IF;
 SELECT * INTO ack FROM r43_lab.customer_pickup_proofs WHERE order_id=p_order;
 IF NOT FOUND OR ack.customer_uid<>o.customer_uid OR ack.shop_id<>o.shop_id
 OR NOT ack.verified OR ack.source<>'server-verified-one-time-pickup-code'
 OR ack.occurred_at<pay.occurred_at OR ack.occurred_at>handover.occurred_at
 THEN RAISE EXCEPTION 'R43_CUSTOMER_HANDOVER_CONFIRMATION_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM r43_lab.refund_reviews WHERE order_id=p_order)
 THEN RAISE EXCEPTION 'R43_REFUND_OR_DISPUTE_REQUIRES_REVIEW'; END IF;
 FOR ln IN SELECT * FROM r43_lab.lines WHERE order_id=p_order ORDER BY line_id LOOP
  IF ln.shop_id<>o.shop_id OR ln.source<>'server-persisted-at-checkout'
  OR ln.snapshot_at>o.created_at OR ln.price_minor<=0 OR ln.reward_funded
  THEN RAISE EXCEPTION 'R43_IMMUTABLE_PAID_ITEM_EVIDENCE_REQUIRED'; END IF;
  IF ln.qualifying_kota THEN
   result:=r42_lab.credit_paid_collected(o.order_id,ln.line_id,o.customer_uid,o.shop_id,
     ln.quantity,true,true,false,false,false);
  END IF;
 END LOOP;
 IF result='NO_KOTA' THEN RAISE EXCEPTION 'R43_NO_QUALIFYING_BOUGHT_KOTA'; END IF;
 INSERT INTO r43_lab.credit_audit(order_id,source)
 VALUES(p_order,'SYNTHETIC_PRIVATE_SERVER_ORDER_SNAPSHOT')
 ON CONFLICT(order_id) DO NOTHING;
 RETURN result;
END
$fn$;
CREATE FUNCTION r43_lab.record_refund_fixture(p_order text,p_ref text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN
 PERFORM 1 FROM r43_lab.orders WHERE order_id=p_order FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'R43_UNKNOWN_ORDER'; END IF;
 INSERT INTO r43_lab.refund_reviews VALUES(p_ref,p_order,'pending_manual_review',transaction_timestamp());
 RETURN 'REFUND_REVIEW_OPEN';
END
$fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA r43_lab FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA r43_lab FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA r43_lab FROM PUBLIC;
COMMIT;
