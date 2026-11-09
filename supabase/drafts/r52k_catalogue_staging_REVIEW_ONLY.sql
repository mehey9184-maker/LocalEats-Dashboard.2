-- R5.2K PROPOSAL / REVIEW ONLY. DO NOT APPLY TO ANY REMOTE DATABASE.
-- Requires separate owner approval of this exact SQL and the exact staging project.
-- Target ONLY Supabase project rgpbdajhlrwfmhopzgzk (LocalEats-Profile-Staging).
-- Never run on LocalEats Production or use this to activate orders.
--
-- Postgres session MUST be deliberately armed before executing this file:
--   SET localeats.r52k_owner_approval = 'APPROVED_R52K_ISOLATED_STAGING_ONLY';
-- The setting is an accidental-execution guard, NOT proof of project identity.
-- A human must independently verify the project ref and baseline before running.

BEGIN;

DO $r52k_preflight$
DECLARE
  profile_note text;
  row_count bigint;
BEGIN
  IF current_setting('localeats.r52k_owner_approval', true)
     IS DISTINCT FROM 'APPROVED_R52K_ISOLATED_STAGING_ONLY' THEN
    RAISE EXCEPTION 'R52K_OWNER_APPROVAL_REQUIRED';
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'R52K_STAGING_PROFILE_SENTINEL_MISSING';
  END IF;
  profile_note := obj_description('public.profiles'::regclass, 'pg_class');
  IF profile_note IS DISTINCT FROM
    'LocalEats Profile P5 isolated staging only; no direct anon/authenticated Data API access; Firebase UID scoped via server profile API.' THEN
    RAISE EXCEPTION 'R52K_STAGING_PROFILE_SENTINEL_MISMATCH';
  END IF;
  SELECT count(*) INTO row_count FROM public.profiles;
  IF row_count <> 0 THEN
    RAISE EXCEPTION 'R52K_STAGING_PROFILE_BASELINE_CHANGED';
  END IF;
  IF to_regclass('public.shops') IS NOT NULL OR
     to_regclass('public.menu_items') IS NOT NULL OR
     to_regclass('public.shops_with_availability') IS NOT NULL THEN
    RAISE EXCEPTION 'R52K_CATALOGUE_OBJECTS_ALREADY_EXIST';
  END IF;
  IF to_regprocedure('public.shop_schedule_open(text,text,timestamp with time zone)') IS NOT NULL OR
     to_regprocedure('public.shop_effective_open(public.shops,timestamp with time zone)') IS NOT NULL OR
     to_regprocedure('public.shop_availability_revision_guard()') IS NOT NULL THEN
    RAISE EXCEPTION 'R52K_AVAILABILITY_FUNCTION_COLLISION';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls) OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    RAISE EXCEPTION 'R52K_SUPABASE_ROLE_BASELINE_MISMATCH';
  END IF;
END;
$r52k_preflight$;

CREATE TABLE public.shops (
  id text PRIMARY KEY
    CHECK (id ~ '^stg-test-shop-[a-z0-9-]{2,80}$'),
  owner_id text NOT NULL
    CHECK (owner_id ~ '^stg-test-owner-[a-z0-9-]{2,80}$'),
  name text NOT NULL
    CHECK (name LIKE 'STAGING TEST %' AND length(name) BETWEEN 15 AND 120),
  description text CHECK (description IS NULL OR length(description) <= 1000),
  story text CHECK (story IS NULL OR length(story) <= 1000),
  location text NOT NULL CHECK (length(location) BETWEEN 3 AND 240),
  category text NOT NULL DEFAULT 'Kota' CHECK (length(category) BETWEEN 2 AND 80),
  logo_url text CHECK (logo_url IS NULL OR length(logo_url) <= 2048),
  rating numeric(3,2) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','rejected','suspended')),
  archived_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  latitude double precision NOT NULL CHECK (isfinite(latitude) AND latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (isfinite(longitude) AND longitude BETWEEN -180 AND 180),
  opening_time text DEFAULT '00:00'
    CHECK (opening_time IS NULL OR opening_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  closing_time text DEFAULT '23:59'
    CHECK (closing_time IS NULL OR closing_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  availability_override_until timestamptz
    CHECK (availability_override_until IS NULL OR isfinite(availability_override_until)),
  availability_revision bigint NOT NULL DEFAULT 0 CHECK (availability_revision >= 0),
  CONSTRAINT r52k_schedule_pair
    CHECK ((opening_time IS NULL) = (closing_time IS NULL))
);

CREATE TABLE public.menu_items (
  id text PRIMARY KEY
    CHECK (id ~ '^stg-test-item-[a-z0-9-]{2,80}$'),
  shop_id text NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  price numeric(10,2) NOT NULL CHECK (price >= 0 AND price <= 9999.99),
  description text CHECK (description IS NULL OR length(description) <= 1000),
  image_url text CHECK (image_url IS NULL OR length(image_url) <= 2048),
  category text CHECK (category IS NULL OR length(category) <= 80),
  is_available boolean NOT NULL DEFAULT true,
  popularity_score integer NOT NULL DEFAULT 0
    CHECK (popularity_score BETWEEN 0 AND 1000000),
  customizations jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(customizations) = 'array'
      AND octet_length(customizations::text) <= 16384),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX r52k_shops_public_idx ON public.shops (approval_status, archived_at);
CREATE INDEX r52k_menu_shop_idx ON public.menu_items (shop_id);

-- This schedule function is STABLE (not IMMUTABLE) because it uses
-- timezone rules and timestamp inputs. Closed intervals and 24-hour clocks
-- are deliberately represented in local South African wall time.
CREATE FUNCTION public.shop_schedule_open(p_open text, p_close text, p_at timestamptz)
RETURNS boolean
LANGUAGE sql STABLE STRICT
SET search_path = pg_catalog
AS $shop_schedule$
  SELECT CASE
    WHEN p_open !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR p_close !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN false
    WHEN p_open = p_close THEN false
    WHEN p_open < p_close THEN
      to_char(p_at AT TIME ZONE 'Africa/Johannesburg', 'HH24:MI') >= p_open
      AND to_char(p_at AT TIME ZONE 'Africa/Johannesburg', 'HH24:MI') < p_close
    ELSE
      to_char(p_at AT TIME ZONE 'Africa/Johannesburg', 'HH24:MI') >= p_open
      OR to_char(p_at AT TIME ZONE 'Africa/Johannesburg', 'HH24:MI') < p_close
  END;
$shop_schedule$;

CREATE FUNCTION public.shop_effective_open(p_shop public.shops, p_at timestamptz)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = pg_catalog
AS $effective_open$
  SELECT coalesce(p_shop.is_active,false)
    AND p_shop.approval_status = 'approved'
    AND p_shop.archived_at IS NULL
    AND (
      coalesce(public.shop_schedule_open(p_shop.opening_time,p_shop.closing_time,p_at),false)
      OR coalesce(p_shop.availability_override_until > p_at,false)
    );
$effective_open$;

CREATE FUNCTION public.shop_availability_revision_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog
AS $revision_guard$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.opening_time IS DISTINCT FROM OLD.opening_time
     OR NEW.closing_time IS DISTINCT FROM OLD.closing_time
     OR NEW.availability_override_until IS DISTINCT FROM OLD.availability_override_until THEN
    NEW.availability_revision := OLD.availability_revision + 1;
  ELSE
    NEW.availability_revision := OLD.availability_revision;
  END IF;
  RETURN NEW;
END;
$revision_guard$;

CREATE TRIGGER shops_availability_revision
BEFORE UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.shop_availability_revision_guard();

-- Do not project owner_id, internal owner email, or approval reasoning.
-- Include approval_status and archived_at because PostgREST filters on them.
-- Avoid duplicating coordinates in the table: aliases derive from one source.
CREATE VIEW public.shops_with_availability
WITH (security_invoker = true)
AS SELECT
  s.id, s.name, s.description, s.story, s.location, s.category,
  s.logo_url, s.rating, s.approval_status, s.archived_at,
  s.opening_time, s.closing_time, s.is_active, s.latitude, s.longitude,
  s.latitude AS lat, s.longitude AS lng,
  s.availability_override_until, s.availability_revision,
  public.shop_effective_open(s, statement_timestamp()) AS effective_is_active
FROM public.shops AS s;

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies. Backend service_role performs read-only catalogues.

REVOKE ALL ON public.shops, public.menu_items,
  public.shops_with_availability FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.shops, public.menu_items,
  public.shops_with_availability TO service_role;

REVOKE ALL ON FUNCTION public.shop_schedule_open(text,text,timestamptz),
  public.shop_effective_open(public.shops,timestamptz),
  public.shop_availability_revision_guard()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shop_schedule_open(text,text,timestamptz),
  public.shop_effective_open(public.shops,timestamptz)
  TO service_role;
-- Trigger functions need no public EXECUTE grants.

COMMENT ON TABLE public.shops IS
  'R5.2K isolated LocalEats staging synthetic catalogue ONLY. Never Production.';
COMMENT ON TABLE public.menu_items IS
  'R5.2K isolated LocalEats staging synthetic menu ONLY. Never Production.';
COMMENT ON VIEW public.shops_with_availability IS
  'R5.2K read-only staging public projection (service_role only).';

COMMIT;
