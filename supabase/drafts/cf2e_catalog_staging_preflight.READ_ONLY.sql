-- CF2-E READ-ONLY PRECHECK. SQL SELECT ONLY. Never mutates any database.
-- Intended for the separately connected LocalEats-Profile-Staging project.
-- Caller MUST select/verify that project before executing this source.
-- Positive result is metadata approval readiness, NOT permission to migrate.
WITH checks(name, ok) AS (
 VALUES
 ('postgres_17_plus', current_setting('server_version_num')::int >= 170000),
 ('shops_exists', to_regclass('public.shops') IS NOT NULL),
 ('menu_exists', to_regclass('public.menu_items') IS NOT NULL),
 ('availability_view_exists', to_regclass('public.shops_with_availability') IS NOT NULL),
 ('no_existing_catalogue_role', NOT EXISTS
   (SELECT 1 FROM pg_roles WHERE rolname='cf2_catalog_reader')),
 ('no_existing_catalogue_schema', NOT EXISTS
   (SELECT 1 FROM pg_namespace WHERE nspname='catalog_cf2')),
 ('shops_rls_on', COALESCE((SELECT relrowsecurity
   FROM pg_class WHERE oid='public.shops'::regclass),false)),
 ('menu_rls_on', COALESCE((SELECT relrowsecurity
   FROM pg_class WHERE oid='public.menu_items'::regclass),false)),
 ('zero_original_shop_menu_policies', NOT EXISTS
   (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('shops','menu_items'))),
 ('approval_check_deployed', COALESCE(position('p_shop.approval_status = ''approved''' IN
   pg_get_functiondef(to_regprocedure('public.shop_effective_open(public.shops,timestamptz)')))>0,false)),
 ('archive_check_deployed', COALESCE(position('p_shop.archived_at IS NULL' IN
   pg_get_functiondef(to_regprocedure('public.shop_effective_open(public.shops,timestamptz)')))>0,false)),
 ('johannesburg_clock_deployed', COALESCE(position('Africa/Johannesburg' IN
   pg_get_functiondef(to_regprocedure('public.shop_schedule_open(text,text,timestamptz)')))>0,false)),
 ('restricted_anon_shops', NOT has_table_privilege('anon','public.shops','SELECT')),
 ('restricted_authenticated_shops', NOT has_table_privilege('authenticated','public.shops','SELECT')),
 ('restricted_anon_menu', NOT has_table_privilege('anon','public.menu_items','SELECT')),
 ('restricted_authenticated_menu', NOT has_table_privilege('authenticated','public.menu_items','SELECT')),
 ('all_required_shop_columns', (SELECT count(*)=16
   FROM information_schema.columns WHERE table_schema='public' AND table_name='shops'
   AND column_name IN ('id','name','description','story','location','category','logo_url','rating',
     'approval_status','archived_at','opening_time','closing_time','is_active',
     'latitude','longitude','availability_override_until'))),
 ('availability_revision_column', EXISTS
   (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND table_name='shops' AND column_name='availability_revision')),
 ('all_required_menu_columns', (SELECT count(*)=11
   FROM information_schema.columns WHERE table_schema='public' AND table_name='menu_items'
   AND column_name IN ('id','shop_id','name','price','description','image_url','category',
   'is_available','popularity_score','customizations','created_at')))
)
SELECT CASE WHEN bool_and(ok) THEN 'CF2E_STAGING_READ_ONLY_PREFLIGHT_PASS'
 ELSE 'CF2E_STAGING_READ_ONLY_PREFLIGHT_BLOCKED' END AS result,
       array_agg(name ORDER BY name) FILTER (WHERE NOT ok OR ok IS NULL) AS failed_checks
FROM checks;
