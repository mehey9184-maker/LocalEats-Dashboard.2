-- LocalEats L4-R3: READ-ONLY database capability probe (2026-11-23).
-- Run independently against LocalEats STAGING and Production for schema parity.
-- No INSERT/UPDATE/DELETE, DDL, data export, identities, secrets or order writes.
-- A PRESENT result proves only that a name exists, not function semantics or full restore.
-- Observed 2026-11-23: staging lacks all six RPCs and shops.pickup_payment_methods.
-- Production has all 17 expected object names. Recheck immediately before cutover.
-- Never "repair" Production based solely on this probe; stage migrations separately.
WITH expected(kind, object_name, table_name, column_name) AS (
 VALUES
 ('rpc','pickup_create_order',NULL::text,NULL::text),
 ('rpc','pickup_order_command',NULL,NULL),
 ('rpc','pickup_claim_push',NULL,NULL),
 ('rpc','pickup_finish_push',NULL,NULL),
 ('rpc','pickup_push_sendable',NULL,NULL),
 ('rpc','merchant_set_pickup_payment_methods',NULL,NULL),
 ('column','shops.pickup_payment_methods','shops','pickup_payment_methods'),
 ('column','shops.owner_id','shops','owner_id'),
 ('column','shops.latitude','shops','latitude'),
 ('column','shops.longitude','shops','longitude'),
 ('column','orders.idempotency_key','orders','idempotency_key'),
 ('column','orders.delivery_type','orders','delivery_type'),
 ('column','orders.payment_status','orders','payment_status'),
 ('column','orders.create_intent_hash','orders','create_intent_hash'),
 ('column','orders.revision','orders','revision'),
 ('column','pickup_order_events.command_id','pickup_order_events','command_id'),
 ('column','pickup_push_outbox.state','pickup_push_outbox','state')
)
SELECT e.kind,e.object_name,
 CASE WHEN e.kind='rpc'
 THEN EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=e.object_name)
 ELSE EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=e.table_name AND c.column_name=e.column_name)
 END AS present
FROM expected e ORDER BY e.kind,e.object_name;
