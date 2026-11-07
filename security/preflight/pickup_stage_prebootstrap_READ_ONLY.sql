-- LocalEats STAGING only. Read-only, does not create or change anything.
-- Confirm project ref rgpbdajhlrwfmhopzgzk in dashboard BEFORE executing.
-- A returned PRECHECK_PASS is NOT a backup or migration approval.
WITH baseline AS (
SELECT current_database() AS database_name,
 current_setting('server_version_num') AS pg_version,
 to_regclass('public.profiles') IS NOT NULL AS has_profiles,
 to_regclass('public.shops') IS NULL AS no_existing_shops,
 to_regclass('public.orders') IS NULL AS no_existing_orders,
 to_regclass('public.admin_users') IS NULL AS no_existing_admin_users,
 (SELECT count(*) FROM public.profiles) AS profile_rows,
 (SELECT count(*) FROM auth.users) AS auth_users,
 (SELECT count(*) FROM storage.objects) AS storage_objects,
 (SELECT count(*) FROM supabase_migrations.schema_migrations
    WHERE version='20261103140914') AS expected_profile_migration,
 (SELECT count(*) FROM supabase_migrations.schema_migrations) AS total_migrations,
 (SELECT c.relrowsecurity FROM pg_class c
     WHERE c.oid=to_regclass('public.profiles')) AS profile_rls_enabled,
 has_table_privilege('anon', 'public.profiles', 'SELECT') AS anon_profile_select,
 has_table_privilege('authenticated', 'public.profiles', 'UPDATE') AS authenticated_profile_update
)
SELECT *,
CASE
 WHEN database_name='postgres'
  AND pg_version::integer >= 170000 AND pg_version::integer < 180000
  AND has_profiles AND no_existing_shops AND no_existing_orders AND no_existing_admin_users
  AND profile_rows=0 AND auth_users=0 AND storage_objects=0
  AND expected_profile_migration=1 AND total_migrations=1
  AND profile_rls_enabled
  AND NOT anon_profile_select AND NOT authenticated_profile_update
 THEN 'BASELINE_PRECHECK_PASS_BACKUP_AND_RESTORE_STILL_REQUIRED'
 ELSE 'STOP_STAGING_BASELINE_CHANGED'
END AS verdict
FROM baseline;
