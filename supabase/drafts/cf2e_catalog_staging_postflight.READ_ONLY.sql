-- CF2-E READ-ONLY POSTCHECK. SQL SELECT ONLY, execute only AFTER a
-- separately founder-approved CF2-D forward migration on the confirmed
-- LocalEats-Profile-Staging project. Never grants privileges or changes rows.
-- The public catalogue role must remain NOLOGIN and cannot access orders.
WITH checks(name, ok) AS (
 VALUES
 ('catalogue_role_exists', EXISTS
   (SELECT 1 FROM pg_roles WHERE rolname='cf2_catalog_reader')),
 ('reader_nonlogin_no_bypass', EXISTS
   (SELECT 1 FROM pg_roles WHERE rolname='cf2_catalog_reader'
    AND NOT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper
    AND NOT rolcreaterole AND NOT rolcreatedb)),
 ('reader_no_memberships', NOT EXISTS
   (SELECT 1 FROM pg_auth_members m JOIN pg_roles r
      ON r.oid=m.member OR r.oid=m.roleid
    WHERE r.rolname='cf2_catalog_reader')),
 ('catalogue_schema_exists', EXISTS
   (SELECT 1 FROM pg_namespace WHERE nspname='catalog_cf2')),
 ('reader_catalogue_schema_usage', has_schema_privilege(
   'cf2_catalog_reader','catalog_cf2','USAGE')),
 ('anon_no_catalogue_schema_usage', NOT has_schema_privilege(
   'anon','catalog_cf2','USAGE')),
 ('authenticated_no_catalogue_schema_usage', NOT has_schema_privilege(
   'authenticated','catalog_cf2','USAGE')),
 ('shops_projection_security_invoker_and_barrier', EXISTS
   (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='catalog_cf2' AND c.relname='public_shops' AND
     'security_invoker=true'=ANY(c.reloptions) AND
     'security_barrier=true'=ANY(c.reloptions))),
 ('menu_projection_security_invoker_and_barrier', EXISTS
   (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='catalog_cf2' AND c.relname='public_menu' AND
     'security_invoker=true'=ANY(c.reloptions) AND
     'security_barrier=true'=ANY(c.reloptions))),
 ('reader_shops_projection_select', has_table_privilege(
   'cf2_catalog_reader','catalog_cf2.public_shops','SELECT')),
 ('reader_menu_projection_select', has_table_privilege(
   'cf2_catalog_reader','catalog_cf2.public_menu','SELECT')),
 ('anon_shops_projection_denied', NOT has_table_privilege(
   'anon','catalog_cf2.public_shops','SELECT')),
 ('authenticated_shops_projection_denied', NOT has_table_privilege(
   'authenticated','catalog_cf2.public_shops','SELECT')),
 ('anon_menu_projection_denied', NOT has_table_privilege(
   'anon','catalog_cf2.public_menu','SELECT')),
 ('authenticated_menu_projection_denied', NOT has_table_privilege(
   'authenticated','catalog_cf2.public_menu','SELECT')),
 ('reader_owner_id_denied', NOT has_column_privilege(
   'cf2_catalog_reader','public.shops','owner_id','SELECT')),
 ('reader_shop_full_table_denied', NOT EXISTS
   (SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee='cf2_catalog_reader' AND table_schema='public'
      AND table_name='shops' AND privilege_type='SELECT')),
 ('reader_shops_dml_denied', NOT
   (has_table_privilege('cf2_catalog_reader','public.shops','INSERT')
    OR has_table_privilege('cf2_catalog_reader','public.shops','UPDATE')
    OR has_table_privilege('cf2_catalog_reader','public.shops','DELETE'))),
 ('reader_menu_dml_denied', NOT
   (has_table_privilege('cf2_catalog_reader','public.menu_items','INSERT')
    OR has_table_privilege('cf2_catalog_reader','public.menu_items','UPDATE')
    OR has_table_privilege('cf2_catalog_reader','public.menu_items','DELETE'))),
 ('reader_shops_policy_scoped', EXISTS
   (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='shops'
    AND policyname='cf2_catalog_shops_select' AND cmd='SELECT'
    AND 'cf2_catalog_reader'=ANY(roles))),
 ('reader_menu_policy_scoped', EXISTS
   (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='menu_items'
    AND policyname='cf2_catalog_menu_select' AND cmd='SELECT'
    AND 'cf2_catalog_reader'=ANY(roles))),
 ('original_shops_rls_intact', COALESCE(
   (SELECT relrowsecurity FROM pg_class WHERE oid='public.shops'::regclass),false)),
 ('original_menu_rls_intact', COALESCE(
   (SELECT relrowsecurity FROM pg_class WHERE oid='public.menu_items'::regclass),false)),
 ('reader_no_other_public_relation_reads', NOT EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
   AND c.relname NOT IN ('shops','menu_items')
   AND has_table_privilege('cf2_catalog_reader',c.oid,'SELECT')))
)
SELECT CASE WHEN bool_and(ok) THEN 'CF2E_STAGING_READ_ONLY_POSTFLIGHT_PASS'
 ELSE 'CF2E_STAGING_READ_ONLY_POSTFLIGHT_BLOCKED' END AS result,
 array_agg(name ORDER BY name) FILTER (WHERE NOT ok OR ok IS NULL) AS failed_checks
FROM checks;
