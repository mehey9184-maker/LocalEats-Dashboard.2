-- STRICTLY READ-ONLY staging inventory. No schema, data or privilege changes.
-- Run ONLY against the separately confirmed isolated Supabase staging project
-- rgpbdajhlrwfmhopzgzk. Never treat a copied JSON snapshot as live proof.
--
-- Return a single JSON value. Copy ONLY schema metadata into a private file.
-- The project reference MUST be supplied separately by the verified operator
-- before calling the offline gate. Never paste a key, personal data or JWT.
WITH required(kind,identifier) AS (
 VALUES
 ('table','public.profiles'),
 ('table','public.shops'),
 ('table','public.menu_items'),
 ('table','public.orders'),
 ('table','public.pickup_order_events'),
 ('table','public.pickup_push_outbox'),
 ('table','public.admin_users'),
 ('table','public.shop_approval_events'),
 ('table','public.pickup_push_subscriptions'),
 ('view','public.shops_with_availability'),
 ('column','public.profiles.user_id'),
 ('column','public.profiles.role'),
 ('column','public.shops.approval_status'),
 ('column','public.shops.is_active'),
 ('column','public.orders.idempotency_key'),
 ('column','public.orders.revision'),
 ('function','public.transition_shop_approval(text,text,text,text,text)'),
 ('function','public.merchant_set_availability(text,text,boolean,boolean,bigint)'),
 ('function','public.pickup_create_order(text,text,jsonb)'),
 ('function','public.pickup_order_command(text,uuid,text,uuid,bigint,text,text,boolean)'),
 ('function','public.pickup_claim_push(text)'),
 ('function','public.pickup_push_sendable(text,uuid,integer,timestamp with time zone,text)'),
 ('function','public.pickup_finish_push(text,uuid,integer,timestamp with time zone,boolean,boolean)')

), inspected AS (
 SELECT req.kind,req.identifier,
 CASE
  WHEN req.kind='column' THEN EXISTS(
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema=split_part(req.identifier,'.',1)
      AND c.table_name=split_part(req.identifier,'.',2)
      AND c.column_name=split_part(req.identifier,'.',3))
  WHEN req.kind='function' THEN to_regprocedure(req.identifier) IS NOT NULL
  WHEN req.kind='view' THEN EXISTS (
    SELECT 1 FROM pg_class c WHERE c.oid=to_regclass(req.identifier) AND c.relkind IN ('v','m'))
  ELSE EXISTS (SELECT 1 FROM pg_class c WHERE c.oid=to_regclass(req.identifier) AND c.relkind IN ('r','p'))
 END AS exists,
 CASE WHEN req.kind='function' THEN has_function_privilege('anon',to_regprocedure(req.identifier),'EXECUTE') END AS anon_execute,
 CASE WHEN req.kind='function' THEN has_function_privilege('authenticated',to_regprocedure(req.identifier),'EXECUTE') END AS authenticated_execute,
 CASE WHEN req.kind='function' THEN has_function_privilege('service_role',to_regprocedure(req.identifier),'EXECUTE') END AS service_execute,
 CASE WHEN req.kind='function' THEN (SELECT p.prosecdef FROM pg_proc p WHERE p.oid=to_regprocedure(req.identifier)) END AS security_definer
 FROM required req
)
SELECT jsonb_build_object(
  'database',current_database(),
  'captured_at',current_timestamp,
  'objects',(SELECT jsonb_agg(to_jsonb(x) ORDER BY kind,identifier) FROM inspected x)
) AS read_only_staging_schema_inventory;
