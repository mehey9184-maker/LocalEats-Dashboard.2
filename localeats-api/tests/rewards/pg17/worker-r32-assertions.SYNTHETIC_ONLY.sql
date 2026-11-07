-- R3.2 SYNTHETIC_ONLY PostgreSQL 17 asserted source-order and outbox logic.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO r32_pickup.orders(id,shop_id,customer_uid,merchant_uid,origin,
 registered,is_test,status,payment_status)
VALUES
('00000000-0000-4000-8000-000000000500'::uuid,'shop-1','old-user','owner-1','server_created_pickup',true,false,'ready_for_pickup','unpaid');
INSERT INTO r32_pickup.checkout_proofs(order_id,shop_id,customer_uid,programme_version,
 qualifies_kota,eligible_units,enrolled_at_purchase,approved_at_purchase,captured_at)
SELECT id,shop_id,customer_uid,'future-v1',true,4,true,true,created_at
 FROM r32_pickup.orders;
COMMIT;
DO $r32assert$
DECLARE result text;
BEGIN
 -- Exact observed order: UPDATE status/payment/revision, then INSERT event,
 -- while programme is still OFF. Neither command should enqueue a reward.
 result:=r32_pickup.command('00000000-0000-4000-8000-000000000500'::uuid,
  'owner-1','confirm_payment','00000000-0000-4000-8000-000000000501'::uuid,0);
 IF result<>'payment_confirmed' THEN RAISE EXCEPTION 'R32_PAYMENT_COMMAND_NOT_PERSISTED'; END IF;
 result:=r32_pickup.command('00000000-0000-4000-8000-000000000500'::uuid,
  'owner-1','collect','00000000-0000-4000-8000-000000000502'::uuid,1);
 IF result<>'collected' OR
   (SELECT revision FROM r32_pickup.orders WHERE customer_uid='old-user')<>2 OR
   EXISTS(SELECT 1 FROM r32_private.outbox)
 THEN RAISE EXCEPTION 'R32_REWARDS_OFF_BROKE_PICKUP'; END IF;
 UPDATE r32_private.programme
  SET active=true,budget_minor=2500 WHERE version='future-v1';
 -- No retroactive queue/credits when programme later enabled.
 IF EXISTS(SELECT 1 FROM r32_private.outbox) THEN
   RAISE EXCEPTION 'R32_RETROACTIVE_BACKFILL'; END IF;
END;
$r32assert$;
BEGIN;
INSERT INTO r32_pickup.orders(id,shop_id,customer_uid,merchant_uid,origin,
 registered,is_test,status,payment_status)
VALUES
('00000000-0000-4000-8000-000000000510'::uuid,'shop-1','valid-user','owner-1','server_created_pickup',true,false,'ready_for_pickup','unpaid'),
('00000000-0000-4000-8000-000000000511'::uuid,'shop-1','guest','owner-1','server_created_pickup',false,false,'ready_for_pickup','unpaid'),
('00000000-0000-4000-8000-000000000512'::uuid,'shop-1','test-user','owner-1','server_created_pickup',true,true,'ready_for_pickup','unpaid'),
('00000000-0000-4000-8000-000000000513'::uuid,'shop-1','unenrolled','owner-1','server_created_pickup',true,false,'ready_for_pickup','unpaid'),
('00000000-0000-4000-8000-000000000514'::uuid,'shop-1','not-approved','owner-1','server_created_pickup',true,false,'ready_for_pickup','unpaid'),
('00000000-0000-4000-8000-000000000515'::uuid,'shop-1','no-proof','owner-1','server_created_pickup',true,false,'ready_for_pickup','unpaid'),
('00000000-0000-4000-8000-000000000516'::uuid,'shop-1','nonkota','owner-1','server_created_pickup',true,false,'ready_for_pickup','unpaid');
INSERT INTO r32_pickup.checkout_proofs(order_id,shop_id,customer_uid,programme_version,
 qualifies_kota,eligible_units,enrolled_at_purchase,approved_at_purchase,captured_at)
SELECT id,shop_id,customer_uid,'future-v1',
 CASE WHEN customer_uid='nonkota' THEN false ELSE true END,
 4,customer_uid<>'unenrolled',customer_uid<>'not-approved',created_at
FROM r32_pickup.orders WHERE customer_uid<>'no-proof'
  AND customer_uid<>'old-user';
COMMIT;
DO $r32check$
DECLARE id_num integer; order_id uuid; pay uuid; collect uuid;
BEGIN
 FOR id_num IN 510..516 LOOP
   order_id:=('00000000-0000-4000-8000-000000000'||id_num)::uuid;
   pay:=('00000000-0000-4000-8000-000000000'||(id_num+20))::uuid;
   collect:=('00000000-0000-4000-8000-000000000'||(id_num+30))::uuid;
   PERFORM r32_pickup.command(order_id,'owner-1','confirm_payment',pay,0);
   PERFORM r32_pickup.command(order_id,'owner-1','collect',collect,1);
 END LOOP;
 IF (SELECT count(*) FROM r32_private.outbox)<>1 OR
    NOT EXISTS(SELECT 1 FROM r32_private.outbox
      WHERE order_id='00000000-0000-4000-8000-000000000510'::uuid)
 THEN RAISE EXCEPTION 'R32_UNTRUSTED_ORDERS_ENQUEUED'; END IF;
 IF (SELECT status FROM r32_pickup.orders WHERE customer_uid='guest')<>'collected'
 THEN RAISE EXCEPTION 'R32_GUEST_PICKUP_BLOCKED_BY_REWARDS'; END IF;
 -- Replayed pickup commands must be acknowledged without duplicate enqueue.
 IF r32_pickup.command('00000000-0000-4000-8000-000000000510'::uuid,
    'owner-1','collect','00000000-0000-4000-8000-000000000540'::uuid,1)<>'replayed'
 THEN RAISE EXCEPTION 'R32_COMMAND_REPLAY_FAILED'; END IF;
 IF (SELECT count(*) FROM r32_private.outbox)<>1
 THEN RAISE EXCEPTION 'R32_DUPLICATE_OUTBOX'; END IF;
 BEGIN
   PERFORM r32_pickup.command('00000000-0000-4000-8000-000000000510'::uuid,
     'attacker','collect','00000000-0000-4000-8000-000000000599'::uuid,2);
   RAISE EXCEPTION 'BAD_ACTOR_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%R32_FORBIDDEN%' THEN RAISE; END IF;
 END;
 BEGIN
   UPDATE r32_pickup.checkout_proofs SET eligible_units=99
    WHERE order_id='00000000-0000-4000-8000-000000000510'::uuid;
   RAISE EXCEPTION 'CHECKOUT_EVIDENCE_MUTATED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%R32_IMMUTABLE_SOURCE%' THEN RAISE; END IF;
 END;
 IF (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity)
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('r32_pickup','r32_private') AND c.relkind='r')
    IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'R32_RLS_NOT_FORCED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('r32_owner','r32_worker','r32_browser')
   AND (rolsuper OR rolbypassrls OR rolcanlogin))
 THEN RAISE EXCEPTION 'R32_PRIVILEGED_TEST_ROLE'; END IF;
 IF (SELECT proname FROM pg_catalog.pg_proc
   WHERE oid='r32_private.consume_job(uuid,uuid)'::regprocedure)<>'consume_job' OR
   (SELECT rolname FROM pg_catalog.pg_roles WHERE oid=(
     SELECT proowner FROM pg_catalog.pg_proc
     WHERE oid='r32_private.consume_job(uuid,uuid)'::regprocedure))<>'r32_owner'
 THEN RAISE EXCEPTION 'R32_UNTRUSTED_DEFINER_OWNER'; END IF;
END;
$r32check$;
\echo R32_REAL_ORDER_COMMAND_SEQUENCE_AND_OUTBOX_PASS
