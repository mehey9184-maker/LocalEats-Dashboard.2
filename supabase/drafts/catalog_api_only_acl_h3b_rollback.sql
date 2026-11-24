-- REVIEW ONLY: rollback to observed 2026-11-25 grants; restores known broad exposure.
-- Never apply automatically. Only use after explicit owner-approved incident decision and fresh metadata comparison.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $rollback$
DECLARE target text; c oid; role_name text;
BEGIN
 FOREACH target IN ARRAY ARRAY['shops','menu_items','reviews','announcements'] LOOP
  c:=to_regclass(format('public.%I',target));
  IF c IS NULL OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=c AND relrowsecurity)
    OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=c)
    OR NOT has_table_privilege('service_role',c,'SELECT')
    OR NOT has_table_privilege('service_role',c,'UPDATE') THEN RAISE EXCEPTION 'H3B1_ROLLBACK_DRIFT: %',target; END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF has_table_privilege(role_name,c,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege(role_name,c,'SELECT,INSERT,UPDATE,REFERENCES')
    THEN RAISE EXCEPTION 'H3B1_ROLLBACK_BROWSER_GRANT_DRIFT: %',target; END IF;
  END LOOP;
 END LOOP;
END $rollback$;
-- Explicit PostgreSQL 17 permissions from the observed ACLs (arwdDxtm).
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.shops,public.menu_items,public.reviews TO anon,authenticated;
GRANT SELECT ON public.announcements TO anon,authenticated;
CREATE POLICY shops_select_public ON public.shops FOR SELECT TO PUBLIC USING(true);
CREATE POLICY menu_items_select_public ON public.menu_items FOR SELECT TO PUBLIC USING(true);
CREATE POLICY "Public read reviews" ON public.reviews FOR SELECT TO PUBLIC USING(true);
CREATE POLICY "Public read announcements" ON public.announcements FOR SELECT TO PUBLIC USING(true);
-- Hosted explicit column grants belong only to service_role and are not modified by forward candidate.
COMMIT;
