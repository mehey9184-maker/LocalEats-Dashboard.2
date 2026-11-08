-- R3.1 SYNTHETIC_ONLY deterministic event/outbox proof.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO r31_pickup.orders(id,shop_id,customer_uid,owner_uid,origin,
 registered,is_test,status,payment_status)
VALUES
('00000000-0000-4000-8000-000000000401'::uuid,'shop-1','alice','merchant-1','authoritative_pickup',true,false,'collected','paid'),
('00000000-0000-4000-8000-000000000402'::uuid,'shop-1','bob','merchant-1','authoritative_pickup',true,false,'collected','paid'),
('00000000-0000-4000-8000-000000000403'::uuid,'shop-1','guest','merchant-1','authoritative_pickup',false,false,'collected','paid'),
('00000000-0000-4000-8000-000000000404'::uuid,'shop-1','test-user','merchant-1','authoritative_pickup',true,true,'collected','paid'),
('00000000-0000-4000-8000-000000000405'::uuid,'shop-1','unpaid','merchant-1','authoritative_pickup',true,false,'collected','unpaid'),
('00000000-0000-4000-8000-000000000406'::uuid,'shop-1','not-owner','merchant-1','authoritative_pickup',true,false,'collected','paid'),
('00000000-0000-4000-8000-000000000407'::uuid,'shop-1','not-enrolled','merchant-1','authoritative_pickup',true,false,'collected','paid'),
('00000000-0000-4000-8000-000000000408'::uuid,'shop-1','missing-proof','merchant-1','authoritative_pickup',true,false,'collected','paid'),
('00000000-0000-4000-8000-000000000409'::uuid,'shop-1','reverse','merchant-1','authoritative_pickup',true,false,'collected','paid');
INSERT INTO r31_pickup.checkout_proofs(order_id,shop_id,customer_uid,programme_version,
 eligible_units,approved_at_purchase,enrolled_at_purchase,captured_at)
SELECT id,shop_id,customer_uid,'future-v1',4,true,
 CASE WHEN customer_uid='not-enrolled' THEN false ELSE true END,created_at
FROM r31_pickup.orders WHERE customer_uid<>'missing-proof';

-- Rewards disabled: genuine collected pickup still succeeds, no outbox.
INSERT INTO r31_pickup.command_events(order_id,command_id,revision,kind,actor_uid)
VALUES
('00000000-0000-4000-8000-000000000401'::uuid,
 '00000000-0000-4000-8000-000000000411'::uuid,1,'payment_confirmed','merchant-1'),
('00000000-0000-4000-8000-000000000401'::uuid,
 '00000000-0000-4000-8000-000000000412'::uuid,2,'collected','merchant-1');
COMMIT;
DO $r31assert$
DECLARE v_order uuid;v_count integer;v_event uuid;v_rev integer;
BEGIN
 IF EXISTS(SELECT 1 FROM r31_private.outbox)
 THEN RAISE EXCEPTION 'R31_OFF_PROGRAMME_QUEUED'; END IF;
 UPDATE r31_private.programme SET active=true WHERE version='future-v1';
 -- Turning on Rewards doesn't backfill the previously collected record.
 IF EXISTS(SELECT 1 FROM r31_private.outbox WHERE order_id=
   '00000000-0000-4000-8000-000000000401'::uuid)
 THEN RAISE EXCEPTION 'R31_RETROACTIVE_CREDIT_QUEUE'; END IF;
 FOR v_count IN 402..408 LOOP
   v_order:=('00000000-0000-4000-8000-000000000'||v_count)::uuid;
   v_event:=('00000000-0000-4000-8000-000000000'||(v_count+20))::uuid;
   INSERT INTO r31_pickup.command_events(order_id,command_id,revision,kind,actor_uid)
    VALUES(v_order,('00000000-0000-4000-8000-000000000'||(v_count+10))::uuid,
     1,'payment_confirmed','merchant-1');
   INSERT INTO r31_pickup.command_events(order_id,command_id,revision,kind,actor_uid)
    VALUES(v_order,v_event,2,'collected',
      CASE WHEN v_count=406 THEN 'attacker-merchant' ELSE 'merchant-1' END);
 END LOOP;
 -- 402 has all valid evidence; 403–408 each misses a required gate.
 IF (SELECT count(*) FROM r31_private.outbox)<>1 OR
    NOT EXISTS(SELECT 1 FROM r31_private.outbox WHERE order_id=
       '00000000-0000-4000-8000-000000000402'::uuid) OR
    EXISTS(SELECT 1 FROM r31_private.outbox WHERE order_id<>
       '00000000-0000-4000-8000-000000000402'::uuid)
 THEN RAISE EXCEPTION 'R31_OUTBOX_ELIGIBILITY_NOT_FAIL_CLOSED'; END IF;

 -- If collected event precedes payment command, no outbox is issued.
 INSERT INTO r31_pickup.command_events(order_id,command_id,revision,kind,actor_uid)
   VALUES('00000000-0000-4000-8000-000000000409'::uuid,
    '00000000-0000-4000-8000-000000000429'::uuid,1,'collected','merchant-1');
 INSERT INTO r31_pickup.command_events(order_id,command_id,revision,kind,actor_uid)
   VALUES('00000000-0000-4000-8000-000000000409'::uuid,
    '00000000-0000-4000-8000-000000000419'::uuid,2,'payment_confirmed','merchant-1');
 IF EXISTS(SELECT 1 FROM r31_private.outbox WHERE order_id=
    '00000000-0000-4000-8000-000000000409'::uuid)
 THEN RAISE EXCEPTION 'R31_REVERSED_EVENT_AWARDED'; END IF;

 -- Exact event replay is rejected at source; outbox cannot duplicate.
 BEGIN
   INSERT INTO r31_pickup.command_events(order_id,command_id,revision,kind,actor_uid)
    VALUES('00000000-0000-4000-8000-000000000402'::uuid,
     '00000000-0000-4000-8000-000000000422'::uuid,2,'collected','merchant-1');
   RAISE EXCEPTION 'R31_DUPLICATE_EVENT_ACCEPTED';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM r31_private.outbox)<>1
 THEN RAISE EXCEPTION 'R31_DUPLICATE_OUTBOX'; END IF;

 -- Purchase proof and source commands are append-only.
 BEGIN
   UPDATE r31_pickup.checkout_proofs SET eligible_units=500
    WHERE order_id='00000000-0000-4000-8000-000000000402'::uuid;
   RAISE EXCEPTION 'R31_PURCHASE_PROOF_MUTATED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%R31_IMMUTABLE_PICKUP_SOURCE%' THEN RAISE; END IF;
 END;
 BEGIN
   DELETE FROM r31_pickup.command_events WHERE order_id=
    '00000000-0000-4000-8000-000000000402'::uuid;
   RAISE EXCEPTION 'R31_EVENT_DELETED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%R31_IMMUTABLE_PICKUP_SOURCE%' THEN RAISE; END IF;
 END;
 IF (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity)
     FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname IN ('r31_pickup','r31_private') AND c.relkind='r') IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'R31_RLS_NOT_ENFORCED'; END IF;
 IF (SELECT rolname FROM pg_catalog.pg_roles WHERE oid=
    (SELECT proowner FROM pg_catalog.pg_proc
      WHERE oid='r31_private.claim_next(text)'::regprocedure))<>'r31_definer'
 THEN RAISE EXCEPTION 'R31_WRONG_PRIVATE_FUNCTION_OWNER'; END IF;
 IF has_table_privilege('r31_worker','r31_private.outbox','SELECT') OR
    has_table_privilege('r31_worker','r31_private.outbox','INSERT') OR
    has_table_privilege('r31_worker','r31_private.outbox','UPDATE') OR
    has_schema_privilege('r31_browser','r31_private','USAGE') OR
    has_function_privilege('r31_browser','r31_private.claim_next(text)','EXECUTE')
 THEN RAISE EXCEPTION 'R31_EXPOSED_OUTBOX_TABLE_OR_FUNCTION'; END IF;
END;
$r31assert$;
\echo R31_TRUSTED_COLLECTED_EVENT_PRIVATE_OUTBOX_PASS
