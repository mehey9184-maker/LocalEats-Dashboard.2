-- CF2-D PROPOSAL ONLY — DO NOT APPLY to Supabase without separate founder approval.
-- TARGET: existing isolated LocalEats-Profile-Staging, NOT main/Production.
-- Verified staging schema: PostgreSQL 17.11. public.shops uses latitude/longitude
-- (not physical lat/lng); deployed shop_effective_open additionally checks
-- approval_status='approved' AND archived_at IS NULL.
-- This creates only a NOLOGIN role / NON-EXPOSED projection; it does NOT create
-- credentialed login, access keys, Hyperdrive, public REST endpoints, or writes.
-- Review current grants, function definitions, RLS and backup before apply.
BEGIN;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cf2_catalog_reader') THEN
    RAISE EXCEPTION 'CF2D_ROLE_EXISTS_STOP';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='catalog_cf2') THEN
    RAISE EXCEPTION 'CF2D_SCHEMA_EXISTS_STOP';
  END IF;
  IF to_regclass('public.shops') IS NULL
     OR to_regclass('public.menu_items') IS NULL
     OR to_regprocedure('public.shop_schedule_open(text,text,timestamp with time zone)') IS NULL
  THEN
    RAISE EXCEPTION 'CF2D_SOURCE_SCHEMA_UNVERIFIED';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.shops'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.menu_items'::regclass)
  THEN
    RAISE EXCEPTION 'CF2D_RLS_DISABLED_STOP';
  END IF;
END $$;

CREATE ROLE cf2_catalog_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
CREATE SCHEMA catalog_cf2;
REVOKE ALL ON SCHEMA catalog_cf2 FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public, catalog_cf2 TO cf2_catalog_reader;

-- RLS is additive to the existing tables, and strictly scoped TO this role.
CREATE POLICY cf2_catalog_shops_select ON public.shops
FOR SELECT TO cf2_catalog_reader
USING (approval_status = 'approved' AND archived_at IS NULL);

CREATE POLICY cf2_catalog_menu_select ON public.menu_items
FOR SELECT TO cf2_catalog_reader
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = shop_id
      AND s.approval_status = 'approved'
      AND s.archived_at IS NULL
  )
);

-- Source-column grants are column-specific, never SELECT *.
GRANT SELECT (
  id, name, description, story, location, category, logo_url, rating,
  approval_status, archived_at, opening_time, closing_time, is_active,
  latitude, longitude, availability_override_until, availability_revision
) ON public.shops TO cf2_catalog_reader;

GRANT SELECT (
  id, shop_id, name, price, description, image_url, category,
  is_available, popularity_score, customizations, created_at
) ON public.menu_items TO cf2_catalog_reader;

GRANT EXECUTE ON FUNCTION public.shop_schedule_open(text,text,timestamptz)
TO cf2_catalog_reader;

-- The approved shop view does not pass s.* into shop_effective_open:
-- PostgreSQL rejected that under a column-restricted reader in CF2-C.
-- The scalar expression below mirrors the VERIFIED DEPLOYED STAGING function,
-- including approval_status and archived_at, not merely the older draft.
CREATE VIEW catalog_cf2.public_shops
WITH (security_invoker = true, security_barrier = true)
AS SELECT
 s.id, s.name, s.description, s.story, s.location, s.category,
 s.logo_url, s.rating, s.approval_status, s.archived_at,
 s.opening_time, s.closing_time, s.is_active,
 s.latitude, s.longitude, s.latitude AS lat, s.longitude AS lng,
 s.availability_override_until, s.availability_revision,
 (
   coalesce(s.is_active,false)
   AND s.approval_status = 'approved'
   AND s.archived_at IS NULL
   AND (
     coalesce(public.shop_schedule_open(
       s.opening_time,s.closing_time,statement_timestamp()),false)
     OR coalesce(s.availability_override_until > statement_timestamp(),false)
   )
 ) AS effective_is_active
FROM public.shops s
WHERE s.approval_status = 'approved' AND s.archived_at IS NULL;

CREATE VIEW catalog_cf2.public_menu
WITH (security_invoker = true, security_barrier = true)
AS SELECT
 m.id, m.shop_id, m.name, m.price, m.description, m.image_url,
 m.category, m.is_available, m.popularity_score, m.customizations,
 m.created_at
FROM public.menu_items m
WHERE EXISTS (
 SELECT 1 FROM public.shops s
 WHERE s.id = m.shop_id
 AND s.approval_status='approved' AND s.archived_at IS NULL
);

REVOKE ALL ON catalog_cf2.public_shops, catalog_cf2.public_menu
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON catalog_cf2.public_shops, catalog_cf2.public_menu
TO cf2_catalog_reader;

-- Restrict permissions without assuming or changing any existing role grants.
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname='cf2_catalog_reader'
    AND (rolcanlogin OR rolbypassrls OR rolsuper OR rolcreaterole)) THEN
      RAISE EXCEPTION 'CF2D_ROLE_NOT_READ_ONLY';
  END IF;
  IF has_column_privilege('cf2_catalog_reader','public.shops','owner_id','SELECT')
     OR has_table_privilege('cf2_catalog_reader','public.shops','INSERT')
     OR has_table_privilege('cf2_catalog_reader','public.shops','UPDATE')
     OR has_table_privilege('cf2_catalog_reader','public.shops','DELETE')
     OR has_table_privilege('cf2_catalog_reader','public.menu_items','INSERT')
     OR has_table_privilege('cf2_catalog_reader','public.menu_items','UPDATE')
     OR has_table_privilege('cf2_catalog_reader','public.menu_items','DELETE') THEN
       RAISE EXCEPTION 'CF2D_UNEXPECTED_PRIVILEGES';
  END IF;
  IF has_table_privilege('anon','catalog_cf2.public_shops','SELECT')
     OR has_table_privilege('authenticated','catalog_cf2.public_shops','SELECT') THEN
       RAISE EXCEPTION 'CF2D_PUBLIC_GRANT';
  END IF;
END $$;
COMMIT;

-- STOP: There is intentionally NO login role / password / token / deployed
-- Worker / Hyperdrive binding / public Data API schema here.
