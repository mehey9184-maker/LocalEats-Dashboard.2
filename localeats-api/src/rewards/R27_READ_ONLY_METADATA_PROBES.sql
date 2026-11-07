-- R2.7 REPEATABLE READ-ONLY pg_catalog probes.
-- SAFE: SELECT-only metadata; no application table records or private keys.
-- Run manually on the correct project with authorized access.
-- Never run a DDL command or change permissions as part of the audit.

-- 1. Public and any proposed private Rewards relations, RLS and API-role grants.
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       c.relrowsecurity AS rls_enabled,
       has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
       has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,
       has_table_privilege('anon',c.oid,'UPDATE') AS anon_update,
       has_table_privilege('authenticated',c.oid,'SELECT') AS auth_select,
       has_table_privilege('authenticated',c.oid,'INSERT') AS auth_insert,
       has_table_privilege('authenticated',c.oid,'UPDATE') AS auth_update
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','rewards_private')
  AND c.relkind IN ('r','p')
  AND (c.relname IN ('orders','pickup_order_events','shops','menu_items',
                    'admin_users','profiles','payments')
       OR n.nspname='rewards_private')
ORDER BY n.nspname,c.relname;

-- 2. Column names and types only; never select customer/order rows.
SELECT n.nspname AS schema_name,c.relname AS relation_name,
       a.attname AS column_name,
       pg_catalog.format_type(a.atttypid,a.atttypmod) AS column_type,
       a.attnotnull AS is_not_null
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE a.attnum>0 AND NOT a.attisdropped
  AND n.nspname IN ('public','rewards_private')
  AND (c.relname IN ('orders','pickup_order_events','shops','menu_items',
                    'admin_users','profiles','payments')
       OR n.nspname='rewards_private')
ORDER BY n.nspname,c.relname,a.attnum;

-- 3. Relevant functions, identity argument types and public EXECUTE.
-- Deliberately does not fetch function source/definition.
SELECT n.nspname AS schema_name,p.proname AS routine,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       p.proconfig AS search_path_settings,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_exec,
       EXISTS(SELECT 1 FROM pg_catalog.pg_depend dep
         WHERE dep.classid='pg_proc'::regclass AND dep.objid=p.oid AND dep.deptype='e')
         AS extension_owned
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','rewards_private')
  AND (p.proname ILIKE '%pickup%' OR p.proname ILIKE '%reward%'
       OR p.proname ILIKE '%admin%' OR p.proname ILIKE '%refund%'
       OR p.proname IN ('handle_new_user','nudge_rider','nudge_rider_by_id','rls_auto_enable')
       OR p.prosecdef)
ORDER BY n.nspname,p.proname;

-- 4. Row-level policy names and predicates for high-risk/future financial tables.
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_catalog.pg_policies
WHERE schemaname IN ('public','rewards_private')
  AND (tablename IN ('orders','pickup_order_events','shops','menu_items',
                     'payments','admin_users','profiles')
       OR schemaname='rewards_private')
ORDER BY schemaname,tablename,policyname;

-- 5. Guard triggers and order/pickup uniqueness constraints.
SELECT n.nspname AS schema_name,c.relname AS relation_name,t.tgname,
       pg_catalog.pg_get_triggerdef(t.oid,true) AS trigger_definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal
  AND c.relname IN ('orders','pickup_order_events')
ORDER BY c.relname,t.tgname;
SELECT c.relname AS relation_name,con.conname,con.contype,con.convalidated,
       pg_catalog.pg_get_constraintdef(con.oid,true) AS constraint_definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid=con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('orders','pickup_order_events')
  AND con.contype IN ('u','c','p')
ORDER BY c.relname,con.conname;

-- This query deliberately DOES NOT report that Rewards are enabled or
-- Production-safe. It is only a repeatable structural audit.
