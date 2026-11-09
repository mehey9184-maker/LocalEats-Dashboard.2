-- R5.2L: READ-ONLY Schema Approval A preflight for isolated staging.
-- Target Supabase: rgpbdajhlrwfmhopzgzk (LocalEats-Profile-Staging).
-- Never execute any R5.2K migration from this script.
-- This is a baseline inspection, NOT a backup or authorization to mutate.
-- All fields returned are metadata, booleans and aggregate row counts.
SELECT
  current_setting('server_version') AS postgres_version,
  current_setting('server_version_num')::int BETWEEN 170000 AND 179999
    AS exact_major_pg17,
  to_regclass('public.profiles') IS NOT NULL AS profiles_exists,
  (SELECT count(*) FROM public.profiles) AS profile_row_count,
  (SELECT relrowsecurity FROM pg_class
    WHERE oid=to_regclass('public.profiles')) AS profiles_rls_enabled,
  obj_description(to_regclass('public.profiles'),'pg_class') =
    'LocalEats Profile P5 isolated staging only; no direct anon/authenticated Data API access; Firebase UID scoped via server profile API.'
    AS staging_profile_sentinel_matches,
  NOT has_table_privilege('anon','public.profiles','SELECT') AS profiles_anon_select_denied,
  NOT has_table_privilege('authenticated','public.profiles','SELECT') AS profiles_authenticated_select_denied,
  has_table_privilege('service_role','public.profiles','SELECT')
    AS profiles_service_role_select_granted,
  to_regclass('public.shops') IS NULL AS no_shops,
  to_regclass('public.menu_items') IS NULL AS no_menu_items,
  to_regclass('public.shops_with_availability') IS NULL AS no_catalogue_view,
  (SELECT count(*) FROM supabase_migrations.schema_migrations)
    AS existing_migration_count,
  (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role'))
    AS expected_supabase_role_count;

-- STOP on any unexpected value. A successful result does not confirm:
--  - which Supabase project an external operator connected to,
--  - whether a point-in-time/daily backup exists,
--  - whether masked API service credentials are valid.
