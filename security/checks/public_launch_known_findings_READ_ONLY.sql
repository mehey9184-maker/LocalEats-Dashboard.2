-- LocalEats pickup-only known-risk security preflight.
-- READ-ONLY SELECT only: safe to run before/after a separately approved security cutover.
-- This only verifies a subset of DB security; it cannot certify backups, Firestore,
-- hosted identity, hosting, payments, API environment, or real ordering.
-- Do not interpret these gate results as permission to open orders.
WITH baseline AS (
 SELECT
   EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relname='rider_notifications' AND c.relkind IN ('r','p') AND c.relrowsecurity) AS rider_table_rls,
   EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename='rider_notifications'
          AND (p.roles @> ARRAY['public']::name[] OR p.roles @> ARRAY['anon']::name[] OR p.roles @> ARRAY['authenticated']::name[])
          AND (lower(trim(coalesce(p.qual,'')))='true' OR lower(trim(coalesce(p.with_check,'')))='true')) AS unsafe_rider_policy,
   EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=to_regclass('public.rider_notifications')
          AND (has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('anon',c.oid,'INSERT')
               OR has_table_privilege('anon',c.oid,'UPDATE') OR has_table_privilege('anon',c.oid,'DELETE')
               OR has_table_privilege('authenticated',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'INSERT')
               OR has_table_privilege('authenticated',c.oid,'UPDATE') OR has_table_privilege('authenticated',c.oid,'DELETE'))) AS unsafe_rider_grants,
   EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.proname IN ('nudge_rider','nudge_rider_by_id')
            AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))) AS unsafe_rider_rpc,
   to_regprocedure('public.handle_new_user()') IS NOT NULL AS signup_exists,
   EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.handle_new_user()')
       AND pg_get_functiondef(p.oid) ~ 'raw_user_meta_data[[:space:]]*->>[[:space:]]*''role''') AS signup_unsafe_metadata,
   EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.handle_new_user()')
       AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))) AS signup_public_rpc,
   EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgname='on_auth_user_created'
       AND t.tgrelid=to_regclass('auth.users') AND t.tgfoid=to_regprocedure('public.handle_new_user()')
       AND NOT t.tgisinternal AND t.tgenabled='O') AS signup_trigger
)
SELECT 'rider_notification_policy' gate, CASE WHEN rider_table_rls AND NOT unsafe_rider_policy THEN 'PASS' ELSE 'BLOCKED' END status FROM baseline
UNION ALL SELECT 'rider_notification_public_grants',CASE WHEN NOT unsafe_rider_grants AND rider_table_rls THEN 'PASS' ELSE 'BLOCKED' END FROM baseline
UNION ALL SELECT 'rider_notification_public_rpc',CASE WHEN NOT unsafe_rider_rpc THEN 'PASS' ELSE 'BLOCKED' END FROM baseline
UNION ALL SELECT 'signup_user_metadata_role',CASE WHEN signup_exists AND NOT signup_unsafe_metadata THEN 'PASS' ELSE 'BLOCKED' END FROM baseline
UNION ALL SELECT 'signup_public_rpc',CASE WHEN signup_exists AND NOT signup_public_rpc THEN 'PASS' ELSE 'BLOCKED' END FROM baseline
UNION ALL SELECT 'signup_trigger_enabled',CASE WHEN signup_trigger THEN 'PASS' ELSE 'BLOCKED' END FROM baseline
ORDER BY gate;
