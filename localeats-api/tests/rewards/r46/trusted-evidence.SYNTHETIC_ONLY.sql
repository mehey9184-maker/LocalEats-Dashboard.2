-- R4.6 LOCALEATS / LOCALPAY -- DISPOSABLE PostgreSQL 17 EVIDENCE SCHEMA ONLY.
-- Do NOT copy to Supabase migrations, live Rewards SQL, RPC or any real server.
-- Requires separate disposable R4.2 r42_lab schema for fake R500/12 participant cap.
-- All owner funds, Firebase identities, merchant cash and customer code samples
-- are synthetic mock facts. Nothing here grants redeemable credit.
BEGIN;
CREATE ROLE r46_browser NOLOGIN;
CREATE SCHEMA r46_lab;
REVOKE ALL ON SCHEMA r46_lab FROM PUBLIC;

CREATE TABLE r46_lab.programme (
 version text PRIMARY KEY,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 published_terms_hash text NOT NULL CHECK(published_terms_hash ~ '^[0-9a-f]{64}$'),
 budget_minor int NOT NULL CHECK(budget_minor=50000),
 participant_limit int NOT NULL CHECK(participant_limit=12),
 bronze_cap_minor int NOT NULL CHECK(bronze_cap_minor=2500),
 gold_active boolean NOT NULL DEFAULT false CHECK(gold_active=false),
 platinum_active boolean NOT NULL DEFAULT false CHECK(platinum_active=false)
);
INSERT INTO r46_lab.programme VALUES
 ('bronze-only-v1','2026-11-01 00:00Z','2027-01-01 00:00Z',
  repeat('a',64),50000,12,2500,false,false);
CREATE TABLE r46_lab.shops (
 shop_id text PRIMARY KEY,
 owner_uid text NOT NULL,
 approved boolean NOT NULL,
 opted_in_at timestamptz NOT NULL,
 programme_version text NOT NULL REFERENCES r46_lab.programme(version)
);
INSERT INTO r46_lab.shops VALUES
 ('my-kota','merchant-1',true,'2026-11-02 00:00Z','bronze-only-v1'),
 ('shop-b','merchant-2',true,'2026-11-02 00:00Z','bronze-only-v1');
CREATE TABLE r46_lab.customers (
 customer_uid text PRIMARY KEY,
 consented_at timestamptz NOT NULL,
 terms_hash text NOT NULL CHECK(terms_hash ~ '^[0-9a-f]{64}$'),
 programme_version text NOT NULL REFERENCES r46_lab.programme(version),
 registered boolean NOT NULL CHECK(registered=true),
 anonymous boolean NOT NULL CHECK(anonymous=false),
 test_account boolean NOT NULL CHECK(test_account=false)
);
CREATE TABLE r46_lab.orders (
 order_id uuid PRIMARY KEY,
 customer_uid text NOT NULL REFERENCES r46_lab.customers(customer_uid),
 shop_id text NOT NULL REFERENCES r46_lab.shops(shop_id),
 programme_version text NOT NULL REFERENCES r46_lab.programme(version),
 created_at timestamptz NOT NULL,
 intent_hash text NOT NULL CHECK(intent_hash ~ '^[0-9a-f]{64}$'),
 total_minor int NOT NULL CHECK(total_minor>0),
 status text NOT NULL DEFAULT 'ready_for_pickup'
   CHECK(status IN('ready_for_pickup','collected')),
 payment_status text NOT NULL DEFAULT 'unpaid'
   CHECK(payment_status IN('unpaid','paid')),
 revision int NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 999999),
 delivery_type text NOT NULL DEFAULT 'collection'
   CHECK(delivery_type='collection'),
 test_order boolean NOT NULL DEFAULT false CHECK(test_order=false),
 simulated boolean NOT NULL DEFAULT false CHECK(simulated=false)
);
CREATE TABLE r46_lab.purchase_lines (
 order_id uuid NOT NULL REFERENCES r46_lab.orders(order_id) ON DELETE RESTRICT,
 line_index int NOT NULL CHECK(line_index BETWEEN 0 AND 99),
 menu_item_id text NOT NULL,
 quantity int NOT NULL CHECK(quantity BETWEEN 1 AND 100),
 unit_minor int NOT NULL CHECK(unit_minor>0),
 line_total_minor bigint GENERATED ALWAYS AS(quantity::bigint*unit_minor::bigint) STORED,
 programme_version text NOT NULL REFERENCES r46_lab.programme(version),
 qualifying_kota boolean NOT NULL,
 reward_funded boolean NOT NULL CHECK(reward_funded=false),
 frozen_source text NOT NULL CHECK(frozen_source='SYNTHETIC_SAME_ORDER_TX'),
 frozen_at timestamptz NOT NULL,
 PRIMARY KEY(order_id,line_index)
);
CREATE TABLE r46_lab.pickup_events(
 command_id uuid PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES r46_lab.orders(order_id),
 revision int NOT NULL CHECK(revision>0),
 kind text NOT NULL CHECK(kind IN ('payment_confirmed','collected')),
 actor_uid text NOT NULL,
 shop_id text NOT NULL,
 occurred_at timestamptz NOT NULL,
 UNIQUE(order_id,revision),
 UNIQUE(order_id,kind)
);
CREATE TABLE r46_lab.merchant_till(
 order_id uuid PRIMARY KEY REFERENCES r46_lab.orders(order_id),
 payment_command uuid NOT NULL UNIQUE REFERENCES r46_lab.pickup_events(command_id),
 merchant_uid text NOT NULL,
 shop_id text NOT NULL,
 amount_minor int NOT NULL CHECK(amount_minor>0),
 payment_method text NOT NULL CHECK(payment_method IN ('cash','card_machine')),
 receipt_ref text NOT NULL UNIQUE,
 disputed boolean NOT NULL DEFAULT false,
 attested_at timestamptz NOT NULL,
 evidence_source text NOT NULL CHECK(evidence_source='SYNTHETIC_SHOP_TILL_FIXTURE')
);
CREATE TABLE r46_lab.pickup_challenges(
 challenge_id uuid PRIMARY KEY,
 order_id uuid NOT NULL UNIQUE REFERENCES r46_lab.orders(order_id),
 customer_uid text NOT NULL,
 shop_id text NOT NULL,
 secret_digest text NOT NULL UNIQUE CHECK(secret_digest ~ '^[0-9a-f]{64}$'),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 attempts int NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 consumed_at timestamptz,
 consumption_receipt uuid UNIQUE,
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '15 minutes'),
 CHECK ((consumed_at IS NULL AND consumption_receipt IS NULL)
    OR (consumed_at IS NOT NULL AND consumption_receipt IS NOT NULL))
);
CREATE TABLE r46_lab.refund_reviews(
 refund_id uuid PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES r46_lab.orders(order_id),
 received_at timestamptz NOT NULL,
 source text NOT NULL CHECK(source='SYNTHETIC_PRIVATE_REFUND_REPORT'),
 status text NOT NULL CHECK(status IN ('pending','verified','disputed'))
);
CREATE TABLE r46_lab.evidence_decisions(
 order_id uuid PRIMARY KEY REFERENCES r46_lab.orders(order_id),
 status text NOT NULL CHECK(status IN('candidate','review_pending')),
 source_revision int NOT NULL,
 checked_at timestamptz NOT NULL,
 -- A candidate is NEVER a grant, available credit or merchant payable.
 can_grant boolean NOT NULL DEFAULT false CHECK(can_grant=false)
);
CREATE TABLE r46_lab.audit_log(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 action text NOT NULL,
 order_id uuid,
 detail text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
-- Cannot commit a Rewards-source order without its own immutable eligibility
-- snapshot. This is deliberately independent of the real public.orders table.
CREATE FUNCTION r46_lab.require_order_snapshot() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM r46_lab.purchase_lines l
   WHERE l.order_id=NEW.order_id AND l.frozen_at=NEW.created_at
     AND l.programme_version=NEW.programme_version
 ) THEN RAISE EXCEPTION 'R46_ATOMIC_ELIGIBILITY_SNAPSHOT_REQUIRED'; END IF;
 RETURN NULL;
END
$fn$;
CREATE CONSTRAINT TRIGGER require_snapshot
 AFTER INSERT ON r46_lab.orders DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION r46_lab.require_order_snapshot();

CREATE FUNCTION r46_lab.no_rewrite() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN RAISE EXCEPTION 'R46_APPEND_ONLY'; END
$fn$;
CREATE TRIGGER purchase_snapshot_no_rewrite BEFORE UPDATE OR DELETE
 ON r46_lab.purchase_lines FOR EACH ROW EXECUTE FUNCTION r46_lab.no_rewrite();
CREATE TRIGGER pickup_events_no_rewrite BEFORE UPDATE OR DELETE
 ON r46_lab.pickup_events FOR EACH ROW EXECUTE FUNCTION r46_lab.no_rewrite();
CREATE TRIGGER refund_reviews_no_rewrite BEFORE UPDATE OR DELETE
 ON r46_lab.refund_reviews FOR EACH ROW EXECUTE FUNCTION r46_lab.no_rewrite();
CREATE TRIGGER evidence_audit_no_rewrite BEFORE UPDATE OR DELETE
 ON r46_lab.audit_log FOR EACH ROW EXECUTE FUNCTION r46_lab.no_rewrite();

-- Owner/merchant/customer roles here are mock fixtures, not identity checks.
-- No direct browser permissions and NO SECURITY DEFINER routines.
CREATE FUNCTION r46_lab.admit_mock_customer(
 p_customer text,p_consented_at timestamptz
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE result text;
BEGIN
 IF p_customer IS NULL OR length(p_customer) NOT BETWEEN 1 AND 80 OR
 p_consented_at IS NULL THEN RAISE EXCEPTION 'R46_BAD_ENROLLMENT'; END IF;
 result:=r42_lab.admit(p_customer); -- atomic R25 commitment under R500 cap
 IF result='REPLAY' THEN RETURN 'REPLAY'; END IF;
 INSERT INTO r46_lab.customers VALUES
 (p_customer,p_consented_at,repeat('a',64),'bronze-only-v1',true,false,false);
 RETURN 'ADMITTED_WITH_MOCK_FUND_RESERVATION';
END
$fn$;

CREATE FUNCTION r46_lab.capture_mock_order_and_line(
 p_order uuid,p_customer text,p_shop text,p_created timestamptz,
 p_quantity int,p_qualifying boolean
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE c r46_lab.customers%ROWTYPE; s r46_lab.shops%ROWTYPE;
        p r46_lab.programme%ROWTYPE;
BEGIN
 IF p_order IS NULL OR p_created IS NULL OR
 p_quantity NOT BETWEEN 1 AND 100 OR p_qualifying IS NULL
 THEN RAISE EXCEPTION 'R46_INVALID_ORDER_OR_LINE'; END IF;
 SELECT * INTO c FROM r46_lab.customers WHERE customer_uid=p_customer FOR SHARE;
 SELECT * INTO s FROM r46_lab.shops WHERE shop_id=p_shop FOR SHARE;
 SELECT * INTO p FROM r46_lab.programme WHERE version='bronze-only-v1' FOR SHARE;
 IF c.customer_uid IS NULL OR s.shop_id IS NULL OR p.version IS NULL OR
 c.programme_version<>p.version OR c.terms_hash<>p.published_terms_hash OR
 s.programme_version<>p.version OR s.approved IS DISTINCT FROM true OR
 c.consented_at>p_created OR s.opted_in_at>p_created OR
 p_created<p.starts_at OR p_created>p.ends_at
 THEN RAISE EXCEPTION 'R46_NO_RETROACTIVE_OR_UNCONSENTED_ELIGIBILITY'; END IF;
 INSERT INTO r46_lab.orders(order_id,customer_uid,shop_id,programme_version,
 created_at,intent_hash,total_minor)
 VALUES(p_order,p_customer,p_shop,p.version,p_created,repeat('b',64),p_quantity*2500);
 INSERT INTO r46_lab.purchase_lines(order_id,line_index,menu_item_id,quantity,
 unit_minor,programme_version,qualifying_kota,reward_funded,frozen_source,frozen_at)
 VALUES(p_order,0,'my-kota',p_quantity,2500,p.version,p_qualifying,false,
 'SYNTHETIC_SAME_ORDER_TX',p_created);
 INSERT INTO r46_lab.audit_log(action,order_id,detail)
 VALUES('order-with-snapshot',p_order,'test-only atomic checkout');
 RETURN 'ORDER_AND_IMMUTABLE_LINE_CAPTURED';
END
$fn$;

CREATE FUNCTION r46_lab.attach_mock_paid_collection(
 p_order uuid,p_pay_cmd uuid,p_collect_cmd uuid,p_merchant text,
 p_paid_at timestamptz,p_collected_at timestamptz,p_receipt text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE o r46_lab.orders%ROWTYPE; sh r46_lab.shops%ROWTYPE;
BEGIN
 SELECT * INTO o FROM r46_lab.orders WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO sh FROM r46_lab.shops WHERE shop_id=o.shop_id FOR SHARE;
 IF o.order_id IS NULL OR p_pay_cmd IS NULL OR p_collect_cmd IS NULL OR
 p_pay_cmd=p_collect_cmd OR p_merchant IS NULL OR p_merchant<>sh.owner_uid OR
 sh.approved IS DISTINCT FROM true OR p_receipt IS NULL OR length(p_receipt)<5 OR
 p_paid_at IS NULL OR p_collected_at IS NULL OR
 p_paid_at<o.created_at OR p_collected_at<=p_paid_at OR
 o.payment_status<>'unpaid' OR o.status<>'ready_for_pickup'
 THEN RAISE EXCEPTION 'R46_MOCK_PAYMENT_COLLECTION_INVALID'; END IF;
 INSERT INTO r46_lab.pickup_events VALUES
 (p_pay_cmd,p_order,1,'payment_confirmed',p_merchant,o.shop_id,p_paid_at),
 (p_collect_cmd,p_order,2,'collected',p_merchant,o.shop_id,p_collected_at);
 INSERT INTO r46_lab.merchant_till VALUES
 (p_order,p_pay_cmd,p_merchant,o.shop_id,o.total_minor,'cash',p_receipt,false,
 p_paid_at,'SYNTHETIC_SHOP_TILL_FIXTURE');
 UPDATE r46_lab.orders SET payment_status='paid',status='collected',revision=2
 WHERE order_id=p_order;
 INSERT INTO r46_lab.audit_log(action,order_id,detail)
 VALUES('mock-paid-collected',p_order,'unverified fixture claims');
 RETURN 'MOCK_EVENTS_ATTACHED_NOT_REAL_PAYMENT';
END
$fn$;

-- The secret is not stored, ONLY its SHA256 digest. Synthetic input provided
-- by caller is UNSAFE for production: a real server must generate >=128-bit
-- random token and use an authenticated keyed hash, secure transport/limits.
CREATE FUNCTION r46_lab.issue_mock_challenge(
 p_id uuid,p_order uuid,p_customer text,p_secret text,
 p_issued timestamptz,p_expires timestamptz
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE o r46_lab.orders%ROWTYPE;
BEGIN
 SELECT * INTO o FROM r46_lab.orders WHERE order_id=p_order FOR UPDATE;
 IF o.order_id IS NULL OR p_id IS NULL OR
 p_customer<>o.customer_uid OR p_secret IS NULL OR length(p_secret)<16 OR
 p_issued<o.created_at OR p_expires<=p_issued OR
 p_expires>p_issued+interval '15 minutes'
 THEN RAISE EXCEPTION 'R46_CHALLENGE_ISSUE_FORBIDDEN'; END IF;
 INSERT INTO r46_lab.pickup_challenges(challenge_id,order_id,customer_uid,shop_id,
 secret_digest,issued_at,expires_at)
 VALUES(p_id,p_order,o.customer_uid,o.shop_id,
 encode(sha256(convert_to(p_secret,'UTF8')),'hex'),p_issued,p_expires);
 RETURN 'MOCK_CHALLENGE_ISSUED_DIGEST_ONLY';
END
$fn$;

-- Return denied states rather than raise so failed guesses can be counted and
-- COMMITTED; cross-connection locking protects single consumption.
CREATE FUNCTION r46_lab.consume_mock_challenge(
 p_order uuid,p_candidate text,p_receipt uuid,p_at timestamptz
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE ch r46_lab.pickup_challenges%ROWTYPE; d text;
BEGIN
 SELECT * INTO ch FROM r46_lab.pickup_challenges WHERE order_id=p_order FOR UPDATE;
 IF NOT FOUND OR p_receipt IS NULL OR p_at IS NULL
 THEN RETURN 'BLOCKED_CHALLENGE_OR_EVIDENCE_MISSING'; END IF;
 IF ch.consumed_at IS NOT NULL THEN
  IF ch.consumption_receipt=p_receipt THEN RETURN 'REPLAY_ONE_CONSUMPTION'; END IF;
  RETURN 'BLOCKED_CHALLENGE_ALREADY_CONSUMED';
 END IF;
 IF p_at<ch.issued_at OR p_at>ch.expires_at OR ch.attempts>=5
 THEN RETURN 'BLOCKED_EXPIRED_OR_ATTEMPT_CAP'; END IF;
 IF p_candidate IS NULL OR length(p_candidate)<16 THEN
  UPDATE r46_lab.pickup_challenges SET attempts=attempts+1 WHERE order_id=p_order;
  RETURN 'BLOCKED_WRONG_CHALLENGE';
 END IF;
 d:=encode(sha256(convert_to(p_candidate,'UTF8')),'hex');
 IF d<>ch.secret_digest THEN
  UPDATE r46_lab.pickup_challenges SET attempts=attempts+1 WHERE order_id=p_order;
  RETURN 'BLOCKED_WRONG_CHALLENGE';
 END IF;
 UPDATE r46_lab.pickup_challenges SET attempts=attempts+1,
 consumed_at=p_at,consumption_receipt=p_receipt WHERE order_id=p_order;
 INSERT INTO r46_lab.audit_log(action,order_id,detail)
 VALUES('mock-challenge-consumed',p_order,'one mock receipt; no secret logged');
 RETURN 'MOCK_SINGLE_USE_HANDOVER_PROVEN';
END
$fn$;

-- REVIEW ONLY. Refund and evidence evaluation lock the same order row.
CREATE FUNCTION r46_lab.inspect_candidate(p_order uuid) RETURNS text
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE o r46_lab.orders%ROWTYPE; s r46_lab.shops%ROWTYPE;
 c r46_lab.customers%ROWTYPE; pr r46_lab.programme%ROWTYPE;
 pay r46_lab.pickup_events%ROWTYPE; collect r46_lab.pickup_events%ROWTYPE;
 till r46_lab.merchant_till%ROWTYPE; ch r46_lab.pickup_challenges%ROWTYPE;
 dec r46_lab.evidence_decisions%ROWTYPE;
BEGIN
 SELECT * INTO o FROM r46_lab.orders WHERE order_id=p_order FOR UPDATE;
 IF NOT FOUND THEN RETURN 'BLOCKED_NO_PRIVATE_ORDER'; END IF;
 IF EXISTS(SELECT 1 FROM r46_lab.refund_reviews WHERE order_id=p_order)
 THEN RETURN 'BLOCKED_REFUND_REVIEW'; END IF;
 SELECT * INTO dec FROM r46_lab.evidence_decisions WHERE order_id=p_order;
 IF FOUND THEN
   IF dec.status='candidate' THEN RETURN 'REPLAY_REVIEW_ONLY'; END IF;
   RETURN 'BLOCKED_REFUND_REVIEW';
 END IF;
 SELECT * INTO s FROM r46_lab.shops WHERE shop_id=o.shop_id FOR SHARE;
 SELECT * INTO c FROM r46_lab.customers WHERE customer_uid=o.customer_uid FOR SHARE;
 SELECT * INTO pr FROM r46_lab.programme WHERE version=o.programme_version FOR SHARE;
 IF s.shop_id IS NULL OR c.customer_uid IS NULL OR pr.version IS NULL OR
 o.payment_status<>'paid' OR o.status<>'collected' OR o.revision<>2 OR
 s.approved IS DISTINCT FROM true OR s.owner_uid IS NULL OR
 o.created_at<s.opted_in_at OR o.created_at<c.consented_at OR
 o.created_at<pr.starts_at OR o.created_at>pr.ends_at OR
 c.terms_hash<>pr.published_terms_hash
 THEN RETURN 'BLOCKED_INVALID_SOURCE_ORDER_OR_CONSENT'; END IF;
 IF (SELECT count(*) FROM r46_lab.purchase_lines WHERE order_id=p_order)<>1
 OR NOT EXISTS(SELECT 1 FROM r46_lab.purchase_lines l WHERE l.order_id=p_order
   AND l.frozen_at=o.created_at AND l.programme_version=o.programme_version
   AND l.qualifying_kota=true AND l.reward_funded=false
   AND l.line_total_minor=o.total_minor)
 THEN RETURN 'BLOCKED_IMMUTABLE_ELIGIBLE_LINES'; END IF;
 SELECT * INTO pay FROM r46_lab.pickup_events
 WHERE order_id=p_order AND kind='payment_confirmed';
 SELECT * INTO collect FROM r46_lab.pickup_events
 WHERE order_id=p_order AND kind='collected';
 SELECT * INTO till FROM r46_lab.merchant_till WHERE order_id=p_order;
 SELECT * INTO ch FROM r46_lab.pickup_challenges WHERE order_id=p_order;
 IF pay.command_id IS NULL OR collect.command_id IS NULL OR
 pay.actor_uid<>s.owner_uid OR collect.actor_uid<>s.owner_uid OR
 pay.shop_id<>o.shop_id OR collect.shop_id<>o.shop_id OR
 pay.revision>=collect.revision OR collect.revision<>o.revision OR
 pay.occurred_at<o.created_at OR collect.occurred_at<=pay.occurred_at OR
 till.order_id IS NULL OR till.payment_command<>pay.command_id OR
 till.amount_minor<>o.total_minor OR till.merchant_uid<>s.owner_uid OR
 till.shop_id<>o.shop_id OR till.disputed OR
 till.attested_at<pay.occurred_at OR till.attested_at>collect.occurred_at OR
 ch.order_id IS NULL OR ch.customer_uid<>o.customer_uid OR ch.shop_id<>o.shop_id OR
 ch.consumed_at IS NULL OR ch.consumption_receipt IS NULL OR
 ch.consumed_at<pay.occurred_at OR ch.consumed_at>collect.occurred_at OR
 ch.consumed_at>ch.expires_at
 THEN RETURN 'BLOCKED_PAYMENT_PICKUP_OR_CODE_PROOF'; END IF;
 INSERT INTO r46_lab.evidence_decisions(order_id,status,source_revision,checked_at)
 VALUES(p_order,'candidate',o.revision,transaction_timestamp());
 INSERT INTO r46_lab.audit_log(action,order_id,detail)
 VALUES('review-only-candidate',p_order,'NOT a grant or a balance');
 RETURN 'PASS_CANDIDATE_REVIEW_ONLY';
END
$fn$;

CREATE FUNCTION r46_lab.report_mock_refund(
 p_order uuid,p_refund uuid,p_received timestamptz
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE o r46_lab.orders%ROWTYPE;
BEGIN
 SELECT * INTO o FROM r46_lab.orders WHERE order_id=p_order FOR UPDATE;
 IF NOT FOUND OR p_refund IS NULL OR p_received IS NULL
 THEN RAISE EXCEPTION 'R46_REFUND_REPORT_INVALID'; END IF;
 INSERT INTO r46_lab.refund_reviews VALUES
 (p_refund,p_order,p_received,'SYNTHETIC_PRIVATE_REFUND_REPORT','pending');
 UPDATE r46_lab.evidence_decisions SET status='review_pending'
 WHERE order_id=p_order;
 INSERT INTO r46_lab.audit_log(action,order_id,detail)
 VALUES('refund-review-open',p_order,'candidate paused; no silent clawback');
 RETURN 'MOCK_REFUND_REVIEW_OPEN';
END
$fn$;

REVOKE ALL ON ALL TABLES IN SCHEMA r46_lab FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA r46_lab FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA r46_lab FROM PUBLIC;
COMMIT;
