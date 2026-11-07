-- R3.3 SYNTHETIC_ONLY. No connected Supabase credentials, tables or orders.
\set ON_ERROR_STOP on
DO $r33preflight$
BEGIN
 IF r33_private.assert_source_contract() IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'R33_INITIAL_CONTRACT_FAILED'; END IF;
 IF r33_private.assert_safe_to_remove() IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'R33_INITIAL_ZERO_LIABILITY_GATE_FAILED'; END IF;
 IF (SELECT active FROM r33_private.programme WHERE version='future-v1') IS DISTINCT FROM false
 OR (SELECT budget_minor FROM r33_private.programme WHERE version='future-v1')<>0
 THEN RAISE EXCEPTION 'R33_REWARDS_NOT_DEFAULT_OFF'; END IF;
END;
$r33preflight$;

-- Detect mismatching source column types/columns without bypassing the gate.
DO $r33drift$
BEGIN
 BEGIN
   INSERT INTO r33_private.expected_source_columns(table_name,column_name,expected_pg_type)
     VALUES('orders','missing_column','uuid');
   PERFORM r33_private.assert_source_contract();
   RAISE EXCEPTION 'R33_DRIFT_NOT_DETECTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%R33_PICKUP_SCHEMA_DRIFT%' THEN RAISE; END IF;
 END;
 BEGIN
   UPDATE r33_private.expected_source_columns SET expected_pg_type='text'
     WHERE table_name='orders' AND column_name='id';
   PERFORM r33_private.assert_source_contract();
   RAISE EXCEPTION 'R33_TYPE_DRIFT_NOT_DETECTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%R33_PICKUP_SCHEMA_DRIFT%' THEN RAISE; END IF;
 END;
END;
$r33drift$;
SELECT r33_private.assert_source_contract();

BEGIN;
INSERT INTO r33_source.shops(id,owner_id) VALUES('shop-r33','merchant-r33');
INSERT INTO r33_source.orders(id,shop_id,user_id,items,create_intent_hash,
 revision,status,payment_status,payment_method,delivery_type)
 VALUES
 ('00000000-0000-4000-8000-000000000733'::uuid,
  'shop-r33','customer-r33',
  '[{"item_id":"kota","quantity":4}]'::jsonb,
  repeat('a',64),2,'collected','paid','cash','collection'),
 ('00000000-0000-4000-8000-000000000734'::uuid,
  'shop-r33','other-customer',
  '[{"item_id":"kota","quantity":4}]'::jsonb,
  repeat('b',64),0,'pending','unpaid',NULL,'collection');
INSERT INTO r33_source.pickup_order_events
(id,order_id,command_id,revision,command_hash,kind,actor_uid)
VALUES
('00000000-0000-4000-8000-000000000735'::uuid,
 '00000000-0000-4000-8000-000000000733'::uuid,
 '00000000-0000-4000-8000-000000000737'::uuid,
 1,repeat('c',64),'payment_confirmed','merchant-r33'),
('00000000-0000-4000-8000-000000000736'::uuid,
 '00000000-0000-4000-8000-000000000733'::uuid,
 '00000000-0000-4000-8000-000000000738'::uuid,
 2,repeat('d',64),'collected','merchant-r33');
INSERT INTO r33_private.checkout_snapshots
(order_id,shop_id,customer_uid,programme_version,
 original_shop_approved,original_shop_enrolled,original_registered_customer)
SELECT id,shop_id,user_id,'future-v1',true,true,true
FROM r33_source.orders WHERE id='00000000-0000-4000-8000-000000000733'::uuid;
INSERT INTO r33_private.original_lines
(order_id,line_no,item_id,menu_revision,unit_minor,quantity,qualifies_kota)
VALUES
('00000000-0000-4000-8000-000000000733'::uuid,1,'kota',4,2500,4,true);
INSERT INTO r33_private.outbox(order_id,collected_event_id)
VALUES
('00000000-0000-4000-8000-000000000733'::uuid,
 '00000000-0000-4000-8000-000000000736'::uuid);
INSERT INTO r33_private.financial_obligations(id,order_id,amount_minor,status)
VALUES
('00000000-0000-4000-8000-000000000739'::uuid,
 '00000000-0000-4000-8000-000000000733'::uuid,2500,'owed');
INSERT INTO r33_private.audit_events(event_id,order_id,kind)
VALUES
('00000000-0000-4000-8000-000000000740'::uuid,
 '00000000-0000-4000-8000-000000000733'::uuid,'synthetic-entitlement');
COMMIT;

DO $r33checks$
DECLARE t record; p record;
BEGIN
 IF (SELECT count(*) FROM r33_private.checkout_snapshots)<>1 OR
    (SELECT count(*) FROM r33_private.original_lines)<>1 OR
    (SELECT count(*) FROM r33_private.outbox)<>1 OR
    (SELECT count(*) FROM r33_private.financial_obligations)<>1
 THEN RAISE EXCEPTION 'R33_FIXTURE_NOT_COMPLETE'; END IF;
 -- Actual source UUID/shop/customer composite FK cannot be forged.
 BEGIN
   INSERT INTO r33_private.checkout_snapshots
   (order_id,shop_id,customer_uid,programme_version,
    original_shop_approved,original_shop_enrolled,original_registered_customer)
   VALUES('00000000-0000-4000-8000-000000000734'::uuid,
    'shop-r33','customer-r33','future-v1',true,true,true);
   RAISE EXCEPTION 'R33_IDENTITY_FK_BYPASSED';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
   INSERT INTO r33_private.checkout_snapshots
   (order_id,shop_id,customer_uid,programme_version,
    original_shop_approved,original_shop_enrolled,original_registered_customer)
   VALUES('00000000-0000-4000-8000-000000000799'::uuid,
    'shop-r33','other-customer','future-v1',true,true,true);
   RAISE EXCEPTION 'R33_ORPHAN_ORDER_ACCEPTED';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 -- A private append-only proof cannot change following a menu update.
 BEGIN
   UPDATE r33_private.original_lines SET qualifies_kota=false;
   RAISE EXCEPTION 'R33_FACT_MUTATED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%R33_APPEND_ONLY_FACT%' THEN RAISE; END IF;
 END;
 BEGIN
   DELETE FROM r33_private.audit_events;
   RAISE EXCEPTION 'R33_AUDIT_DELETED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%R33_APPEND_ONLY_FACT%' THEN RAISE; END IF;
 END;
 -- A real migration may NOT simply DROP all ledgers after food obligations.
 BEGIN
   PERFORM r33_private.assert_safe_to_remove();
   RAISE EXCEPTION 'R33_FINANCIAL_LEDGER_DELETABLE';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%R33_PRESERVE_LEDGER_AND_OBLIGATIONS%' THEN RAISE; END IF;
 END;
 -- Private relation permissions and forced RLS cover every financial table.
 FOR t IN SELECT schemaname,tablename FROM pg_catalog.pg_tables
   WHERE schemaname='r33_private'
 LOOP
   IF NOT EXISTS(
     SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
        ON n.oid=c.relnamespace
     WHERE n.nspname=t.schemaname AND c.relname=t.tablename
       AND c.relrowsecurity AND c.relforcerowsecurity
   ) THEN RAISE EXCEPTION 'R33_PRIVATE_RLS_MISSING:%',t.tablename; END IF;
   IF has_table_privilege('r33_browser',
      format('r33_private.%I',t.tablename),'SELECT') OR
      has_table_privilege('r33_worker',
      format('r33_private.%I',t.tablename),'INSERT')
   THEN RAISE EXCEPTION 'R33_PRIVATE_GRANT_EXPOSED:%',t.tablename; END IF;
 END LOOP;
 FOR p IN SELECT proc.oid,proc.prosecdef,proc.proconfig
  FROM pg_catalog.pg_proc proc JOIN pg_catalog.pg_namespace n
   ON n.oid=proc.pronamespace WHERE n.nspname='r33_private'
 LOOP
   IF p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
    OR has_function_privilege('r33_browser',p.oid,'EXECUTE')
    OR has_function_privilege('r33_worker',p.oid,'EXECUTE')
   THEN RAISE EXCEPTION 'R33_PUBLIC_FUNCTION_EXPOSED'; END IF;
 END LOOP;
 IF has_schema_privilege('r33_browser','r33_private','USAGE') OR
    has_schema_privilege('r33_worker','r33_private','USAGE')
 THEN RAISE EXCEPTION 'R33_PRIVATE_SCHEMA_EXPOSED'; END IF;
 IF (SELECT count(*) FROM r33_private.checkout_snapshots s
     JOIN r33_source.orders o ON o.id=s.order_id
      AND o.shop_id=s.shop_id AND o.user_id=s.customer_uid)<>1
 THEN RAISE EXCEPTION 'R33_ORPHAN_SNAPSHOT'; END IF;
END;
$r33checks$;
\echo R33_STAGING_MINIMUM_CONTRACT_AND_LIABILITY_ROLLBACK_GATE_PASS
