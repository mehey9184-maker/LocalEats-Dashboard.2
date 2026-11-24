-- REVIEW DRAFT ONLY: API-only raw catalog boundary. Do not apply to hosted projects.
-- Requires complete consumer audit, independent backup, rollback and explicit release approval.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $acl$
DECLARE target record; c oid; col record; role_name text; privilege_name text;
        before_service text; after_service text; policy_count integer;
BEGIN
 FOR target IN SELECT * FROM (VALUES
 ('shops','shops_select_public'),('menu_items','menu_items_select_public'),
 ('reviews','Public read reviews'),('announcements','Public read announcements')
 ) AS x(table_name,policy_name) LOOP
   c := to_regclass(format('public.%I',target.table_name));
   IF c IS NULL OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=c AND relkind='r' AND relrowsecurity)
     THEN RAISE EXCEPTION 'H3B_TABLE_OR_RLS_DRIFT: %',target.table_name; END IF;
   SELECT count(*) INTO policy_count FROM pg_policy WHERE polrelid=c;
   IF policy_count<>1 OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=c
     AND polname=target.policy_name AND polcmd='r' AND polpermissive
     AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL)
     THEN RAISE EXCEPTION 'H3B_POLICY_DRIFT: %',target.table_name; END IF;
   SELECT string_agg(privilege_type||':'||is_grantable::text,',' ORDER BY privilege_type,is_grantable)
     INTO before_service FROM aclexplode((SELECT relacl FROM pg_class WHERE oid=c))
     WHERE grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role');
   IF before_service IS NULL OR NOT has_table_privilege('service_role',c,'SELECT')
     OR NOT has_table_privilege('service_role',c,'INSERT') OR NOT has_table_privilege('service_role',c,'UPDATE')
     OR NOT has_table_privilege('service_role',c,'DELETE') THEN RAISE EXCEPTION 'H3B_SERVICE_ACL_DRIFT: %',target.table_name; END IF;
   EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',target.table_name);
   -- A table-level revoke does not necessarily remove independent column grants.
   FOR col IN SELECT attname FROM pg_attribute WHERE attrelid=c AND attnum>0 AND NOT attisdropped AND attacl IS NOT NULL LOOP
     EXECUTE format('REVOKE ALL PRIVILEGES (%I) ON TABLE public.%I FROM PUBLIC, anon, authenticated',col.attname,target.table_name);
   END LOOP;
   EXECUTE format('DROP POLICY %I ON public.%I',target.policy_name,target.table_name);
   FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
     FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
       IF has_table_privilege(role_name,c,privilege_name) THEN RAISE EXCEPTION 'H3B_RESIDUAL_TABLE_GRANT: % % %',target.table_name,role_name,privilege_name; END IF;
     END LOOP;
     FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','REFERENCES'] LOOP
       IF has_any_column_privilege(role_name,c,privilege_name) THEN RAISE EXCEPTION 'H3B_RESIDUAL_COLUMN_GRANT: % % %',target.table_name,role_name,privilege_name; END IF;
     END LOOP;
   END LOOP;
   SELECT string_agg(privilege_type||':'||is_grantable::text,',' ORDER BY privilege_type,is_grantable)
     INTO after_service FROM aclexplode((SELECT relacl FROM pg_class WHERE oid=c))
     WHERE grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role');
   IF before_service IS DISTINCT FROM after_service OR NOT has_table_privilege('service_role',c,'SELECT')
     THEN RAISE EXCEPTION 'H3B_SERVICE_ACL_CHANGED: %',target.table_name; END IF;
 END LOOP;
END;
$acl$;
COMMIT;
