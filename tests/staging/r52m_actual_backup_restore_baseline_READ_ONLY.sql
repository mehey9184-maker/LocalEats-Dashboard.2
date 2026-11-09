-- R5.2M — READ ONLY. Actual staging baseline vs isolated restore.
-- Source: verified live staging metadata on 2026-11-09.
-- Execute only on the connected staging Supabase project or an independently
-- restored disposable copy. Never writes, alters, exports rows or reads secrets.
-- A PASS only verifies the tested metadata; it does NOT establish that a
-- complete platform backup has been created, stored, or restored.

WITH observed AS (
 SELECT
   current_setting('server_version_num')::integer BETWEEN 170000 AND 179999 AS pg17,
   to_regclass('public.profiles') IS NOT NULL AS profiles_present,
   (SELECT count(*) FROM public.profiles) AS profiles_count,
   (SELECT count(*) FROM auth.users) AS supabase_auth_users_count,
   (SELECT count(*) FROM storage.objects) AS storage_objects_count,
   (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles') AS profiles_column_count,
   (SELECT count(*) FROM pg_constraint
      WHERE conrelid='public.profiles'::regclass) AS profiles_constraint_count,
   (SELECT count(*) FROM pg_indexes
      WHERE schemaname='public' AND tablename='profiles') AS profiles_index_count,
   (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='profiles') AS profiles_policy_count,
   (SELECT relrowsecurity FROM pg_class
      WHERE oid='public.profiles'::regclass) AS profiles_rls,
   obj_description('public.profiles'::regclass,'pg_class') =
     'LocalEats Profile P5 isolated staging only; no direct anon/authenticated Data API access; Firebase UID scoped via server profile API.'
     AS profiles_sentinel,
   NOT has_table_privilege('anon','public.profiles','SELECT') AS deny_anon,
   NOT has_table_privilege('authenticated','public.profiles','SELECT') AS deny_auth_role,
   has_table_privilege('service_role','public.profiles','SELECT') AS allow_service_role,
   (SELECT count(*) FROM supabase_migrations.schema_migrations) AS migration_count,
   (SELECT count(*) FROM supabase_migrations.schema_migrations
      WHERE version='20261103140914' AND name='create_isolated_profile_staging_p5') AS expected_migration_count,
   to_regclass('public.shops') IS NULL AS no_shops,
   to_regclass('public.menu_items') IS NULL AS no_menu,
   to_regclass('public.shops_with_availability') IS NULL AS no_catalogue_view
)
SELECT
  CASE WHEN
    pg17 AND profiles_present AND profiles_count=0 AND
    supabase_auth_users_count=0 AND storage_objects_count=0 AND
    profiles_column_count=14 AND profiles_constraint_count=13 AND
    profiles_index_count=1 AND profiles_policy_count=0 AND
    profiles_rls AND profiles_sentinel AND deny_anon AND deny_auth_role
    AND allow_service_role AND migration_count=1
    AND expected_migration_count=1 AND no_shops AND no_menu
    AND no_catalogue_view
  THEN 'R52M_BASELINE_METADATA_PASS'
  ELSE 'R52M_BASELINE_METADATA_FAIL'
  END AS verification,
  pg17, profiles_present, profiles_count, supabase_auth_users_count,
  storage_objects_count, profiles_column_count, profiles_constraint_count,
  profiles_index_count, profiles_policy_count, profiles_rls, profiles_sentinel,
  deny_anon, deny_auth_role, allow_service_role, migration_count,
  expected_migration_count, no_shops, no_menu, no_catalogue_view
FROM observed;
