-- LocalEats L1A: current staging evidence and recovery-comparator preflight.
-- READ ONLY: one SELECT over pg_catalog and aggregate row counts. NO DDL/DML.
-- Target for evidence capture: rgpbdajhlrwfmhopzgzk (verify project ID
-- out of band first). Production may also use database name "postgres",
-- so this SQL alone cannot authenticate the remote project identity.
-- Baseline captured on 2026-11-10. Exact counts can change after a later
-- separately approved change; drift means RE-REVIEW, never force a match.
-- Auth users here means Supabase Auth, NOT the separate Firebase project.
WITH observed AS (
  SELECT
    current_setting('server_version_num')::int BETWEEN 170000 AND 179999 AS postgres_17,
    to_regclass('public.profiles') IS NOT NULL AS profiles_exist,
    to_regclass('public.shops') IS NOT NULL AS shops_exist,
    to_regclass('public.menu_items') IS NOT NULL AS menu_exist,
    to_regclass('public.shops_with_availability') IS NOT NULL AS availability_view_exists,
    to_regclass('public.orders') IS NULL AS orders_absent,
    to_regclass('public.pickup_order_events') IS NULL AS pickup_events_absent,
    NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('pickup_create_order','pickup_order_command'))
      AS pickup_write_rpcs_absent,
    (SELECT count(*) FROM public.profiles) AS profiles_rows,
    (SELECT count(*) FROM public.shops) AS shops_rows,
    (SELECT count(*) FROM public.menu_items) AS menu_rows,
    (SELECT count(*) FROM auth.users) AS supabase_auth_user_rows,
    (SELECT count(*) FROM storage.objects) AS storage_object_rows,
    (SELECT count(*) FROM storage.buckets) AS storage_bucket_rows,
    (SELECT count(*) FROM auth.schema_migrations) AS auth_managed_migrations,
    (SELECT count(*) FROM storage.migrations) AS storage_managed_migrations,
    (SELECT count(*) FROM supabase_migrations.schema_migrations) AS app_migrations,
    (SELECT count(*) FROM supabase_migrations.schema_migrations
       WHERE (version='20261103140914' AND name='create_isolated_profile_staging_p5')
          OR (version='20261109165612' AND name='r52o_isolated_staging_catalogue_schema_approval_a'))
      AS known_app_migrations,
    (SELECT count(*) FROM pg_attribute a WHERE a.attrelid='public.profiles'::regclass
       AND a.attnum>0 AND NOT a.attisdropped) AS profiles_columns,
    (SELECT count(*) FROM pg_constraint WHERE conrelid='public.profiles'::regclass)
      AS profiles_constraints,
    (SELECT count(*) FROM pg_attribute a WHERE a.attrelid='public.shops'::regclass
       AND a.attnum>0 AND NOT a.attisdropped) AS shops_columns,
    (SELECT count(*) FROM pg_attribute a WHERE a.attrelid='public.menu_items'::regclass
       AND a.attnum>0 AND NOT a.attisdropped) AS menu_columns,
    obj_description('public.profiles'::regclass,'pg_class') =
      'LocalEats Profile P5 isolated staging only; no direct anon/authenticated Data API access; Firebase UID scoped via server profile API.'
      AS staging_sentinel_matches,
    (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
       WHERE oid='public.profiles'::regclass) AS profiles_force_rls,
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.shops'::regclass) AS shops_rls,
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.menu_items'::regclass) AS menu_rls,
    (SELECT 'security_invoker=true'=ANY(coalesce(reloptions,'{}'::text[])) FROM pg_class
       WHERE oid='public.shops_with_availability'::regclass) AS view_security_invoker,
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
       AND tablename IN ('profiles','shops','menu_items')) AS no_browser_rls_policies,
    NOT has_table_privilege('anon','public.profiles','SELECT') AS deny_anon_profile_read,
    NOT has_table_privilege('authenticated','public.profiles','SELECT') AS deny_auth_profile_read,
    NOT has_table_privilege('anon','public.shops','SELECT') AS deny_anon_shop_read,
    NOT has_table_privilege('authenticated','public.menu_items','SELECT')
       AS deny_auth_menu_read,
    NOT has_table_privilege('anon','public.shops_with_availability','SELECT')
       AS deny_anon_catalogue_view_read,
    has_table_privilege('service_role','public.profiles','SELECT') AS service_profile_read,
    has_table_privilege('service_role','public.shops','SELECT') AS service_shop_read,
    has_table_privilege('service_role','public.menu_items','SELECT') AS service_menu_read,
    NOT has_table_privilege('service_role','public.shops','INSERT') AS no_service_shop_insert,
    NOT has_table_privilege('service_role','public.menu_items','INSERT') AS no_service_menu_insert
)
SELECT
  CASE WHEN
    postgres_17 AND profiles_exist AND shops_exist AND menu_exist AND
    availability_view_exists AND orders_absent AND pickup_events_absent AND
    pickup_write_rpcs_absent AND
    profiles_rows=0 AND shops_rows=5 AND menu_rows=3 AND
    supabase_auth_user_rows=0 AND storage_object_rows=0 AND storage_bucket_rows=0 AND
    auth_managed_migrations=82 AND storage_managed_migrations=80 AND
    app_migrations=2 AND known_app_migrations=2 AND
    profiles_columns=14 AND profiles_constraints=13 AND
    shops_columns=18 AND menu_columns=11 AND
    staging_sentinel_matches AND profiles_force_rls AND shops_rls AND menu_rls AND
    view_security_invoker AND no_browser_rls_policies AND
    deny_anon_profile_read AND deny_auth_profile_read AND
    deny_anon_shop_read AND deny_auth_menu_read AND deny_anon_catalogue_view_read AND
    service_profile_read AND service_shop_read AND service_menu_read AND
    no_service_shop_insert AND no_service_menu_insert
  THEN 'L1A_CURRENT_STAGING_BASELINE_PASS'
  ELSE 'L1A_STOP_BASELINE_DRIFT' END AS verification,
  observed.*
FROM observed;
