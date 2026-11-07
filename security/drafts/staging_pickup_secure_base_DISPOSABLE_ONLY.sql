-- REVIEW-ONLY, DISPOSABLE POSTGRES 17 REHEARSAL.
-- DO NOT apply to Supabase staging or Production. Both real projects use
-- database "postgres"; this file refuses any database other than the fixed,
-- local CI-only name and therefore cannot perform connected project DDL.
-- Planned eventual stage migration MUST be independently prepared and reviewed
-- AFTER the owner provides an encrypted offsite, successfully RESTORED backup.
--
-- Creates pickup-only foundation tables from empty stage P5 profile state,
-- preserving P5 profiles EXACTLY. Creates NO Rider or Supabase signup trigger.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $guard$
DECLARE v_profile_cols integer; v_profile_constraints integer;
BEGIN
 IF current_database() <> 'localeats_stage_base_disposable'
    OR current_user <> 'postgres'
 THEN RAISE EXCEPTION 'STAGE_BASE_DISPOSABLE_DATABASE_ONLY'; END IF;

 IF to_regclass('public.profiles') IS NULL
    OR to_regclass('public.shops') IS NOT NULL
    OR to_regclass('public.menu_items') IS NOT NULL
    OR to_regclass('public.orders') IS NOT NULL
    OR to_regclass('public.admin_users') IS NOT NULL
    OR to_regclass('public.pickup_order_events') IS NOT NULL
    OR to_regclass('public.rider_notifications') IS NOT NULL
 THEN RAISE EXCEPTION 'STAGE_P5_BASELINE_OR_OBJECT_COLLISION'; END IF;

 SELECT count(*) INTO v_profile_cols FROM pg_catalog.pg_attribute
 WHERE attrelid='public.profiles'::regclass AND attnum>0 AND NOT attisdropped;
 SELECT count(*) INTO v_profile_constraints FROM pg_catalog.pg_constraint
 WHERE conrelid='public.profiles'::regclass;
 IF v_profile_cols<>14 OR v_profile_constraints<>13
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid='public.profiles'::regclass
        AND attname='user_id' AND atttypid='text'::regtype
        AND attnotnull AND NOT attisdropped)
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid='public.profiles'::regclass
        AND attname='role' AND atttypid='text'::regtype
        AND attnotnull AND NOT attisdropped)
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class
      WHERE oid='public.profiles'::regclass AND relrowsecurity AND relforcerowsecurity)
    OR has_table_privilege('anon','public.profiles','SELECT')
    OR has_table_privilege('authenticated','public.profiles','UPDATE')
    OR NOT has_table_privilege('service_role','public.profiles','SELECT')
 THEN RAISE EXCEPTION 'STAGE_P5_PROFILE_CONTRACT_DRIFT'; END IF;
END $guard$;

-- Merchant onboarding: new shops must start PENDING and CLOSED. Never trust
-- a browser role or a shop's display address for authorization/proximity.
CREATE TABLE public.shops (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id text NOT NULL CHECK (length(btrim(owner_id)) BETWEEN 1 AND 128),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  category text,
  description text,
  phone text,
  location text,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  lat double precision CHECK (lat BETWEEN -90 AND 90),
  lng double precision CHECK (lng BETWEEN -180 AND 180),
  opening_time text NOT NULL DEFAULT '00:00',
  closing_time text NOT NULL DEFAULT '23:59',
  logo_url text,
  story text,
  rating numeric,
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','rejected','suspended')),
  approval_reason text,
  is_active boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  description text,
  price numeric NOT NULL CHECK (price >= 0 AND price=round(price,2)
                                AND price::text NOT IN ('NaN','Infinity','-Infinity')),
  image_url text,
  category text,
  is_available boolean NOT NULL DEFAULT true,
  popularity_score integer NOT NULL DEFAULT 0,
  customizations jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(customizations)='array'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menu_items_shop_lookup ON public.menu_items(shop_id);

-- The reviewed pickup foundation adds order state/contract columns and
-- immutable event/outbox tables later, after this table is fully protected.
-- Rider ID remains a nullable legacy-compatible field, with NO Rider table,
-- Rider approval RPC or delivery activation.
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  user_id text,
  rider_id uuid,
  product_name text,
  product_variant text,
  price numeric,
  total_price numeric,
  status text,
  delivery_status text,
  payment_method text,
  customer_name text,
  phone text,
  email text,
  address text,
  city text,
  lat numeric,
  lng numeric,
  notes text,
  delivery_fee numeric,
  service_fee numeric,
  discount_amount numeric,
  tip_amount numeric,
  idempotency_key text UNIQUE,
  items jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_shop_recent ON public.orders(shop_id,created_at DESC);
CREATE INDEX orders_customer_recent ON public.orders(user_id,created_at DESC);

-- In the same transaction, revoke default PUBLIC/anon/authenticated access
-- and enforce RLS before any object becomes visible to a second session.
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops FORCE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.shops,public.menu_items,public.orders
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.shops,public.menu_items,public.orders TO service_role;

DO $end_check$
DECLARE v_table text;
BEGIN
 FOR v_table IN SELECT unnest(ARRAY['shops','menu_items','orders']) LOOP
   IF NOT EXISTS (
     SELECT 1 FROM pg_catalog.pg_class
       WHERE oid=('public.'||v_table)::regclass
         AND relrowsecurity AND relforcerowsecurity)
       OR has_table_privilege('anon','public.'||v_table,'SELECT')
       OR has_table_privilege('authenticated','public.'||v_table,'INSERT')
       OR has_table_privilege('authenticated','public.'||v_table,'UPDATE')
       OR has_table_privilege('authenticated','public.'||v_table,'DELETE')
       OR NOT has_table_privilege('service_role','public.'||v_table,'SELECT')
       OR NOT has_table_privilege('service_role','public.'||v_table,'UPDATE')
   THEN RAISE EXCEPTION 'STAGE_BASE_TABLE_PERMISSIONS_UNSAFE: %',v_table; END IF;
 END LOOP;
 IF to_regclass('public.rider_notifications') IS NOT NULL
    OR to_regprocedure('public.handle_new_user()') IS NOT NULL
 THEN RAISE EXCEPTION 'STAGE_BASE_FORBIDDEN_DORMANT_OBJECT'; END IF;
END $end_check$;
COMMIT;
