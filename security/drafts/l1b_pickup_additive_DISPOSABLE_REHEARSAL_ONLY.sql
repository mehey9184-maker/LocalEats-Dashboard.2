-- LocalEats L1B: additive pickup DDL DESIGN REHEARSAL ONLY.
-- DO NOT APPLY TO HOSTED SUPABASE STAGING OR PRODUCTION.
-- IMPORTANT: this is NOT the production-equivalent migration and contains NO
-- working pickup RPCs. It is a *deliberately unwriteable schema rehearsal*.
-- Exact target is an independent disposable PostgreSQL 17 clone named
-- "localeats_l1b_disposable" with pre-existing P5 + R5.2O catalogue structures.
-- A hosted database normally has current_database()='postgres'; this refuses it.
-- Owner approval for L1A cannot authorize any DDL.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $l1b_guard$
DECLARE n_profile_cols int; n_shop_cols int; n_menu_cols int;
BEGIN
  IF current_database() <> 'localeats_l1b_disposable'
     OR current_user <> 'postgres'
  THEN RAISE EXCEPTION 'L1B_DISPOSABLE_DATABASE_ONLY'; END IF;

  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.shops') IS NULL
     OR to_regclass('public.menu_items') IS NULL
     OR to_regclass('public.shops_with_availability') IS NULL
     OR to_regclass('public.orders') IS NOT NULL
     OR to_regclass('public.pickup_order_events') IS NOT NULL
  THEN RAISE EXCEPTION 'L1B_STAGING_CATALOGUE_BASELINE_DRIFT'; END IF;

  SELECT count(*) INTO n_profile_cols FROM pg_attribute
    WHERE attrelid='public.profiles'::regclass AND attnum>0 AND NOT attisdropped;
  SELECT count(*) INTO n_shop_cols FROM pg_attribute
    WHERE attrelid='public.shops'::regclass AND attnum>0 AND NOT attisdropped;
  SELECT count(*) INTO n_menu_cols FROM pg_attribute
    WHERE attrelid='public.menu_items'::regclass AND attnum>0 AND NOT attisdropped;

  IF n_profile_cols <> 14 OR n_shop_cols <> 18 OR n_menu_cols <> 11
    OR (SELECT count(*) FROM public.profiles) <> 0
    OR (SELECT count(*) FROM public.shops) <> 5
    OR (SELECT count(*) FROM public.menu_items) <> 3
    OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.profiles'::regclass
      AND relrowsecurity AND relforcerowsecurity)
    OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.shops'::regclass AND relrowsecurity)
    OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.menu_items'::regclass AND relrowsecurity)
    OR has_table_privilege('anon','public.profiles','SELECT')
    OR has_table_privilege('authenticated','public.shops','SELECT')
    OR has_table_privilege('service_role','public.shops','INSERT')
  THEN RAISE EXCEPTION 'L1B_CATALOGUE_OR_PERMISSIONS_CHANGED'; END IF;

  IF to_regprocedure('public.pickup_create_order(text,text,jsonb)') IS NOT NULL
    OR EXISTS(SELECT 1 FROM pg_proc WHERE proname IN
      ('pickup_create_order','pickup_order_command'))
  THEN RAISE EXCEPTION 'L1B_EXISTING_PICKUP_RPC'; END IF;
END
$l1b_guard$;

-- Existing public.shops.id, public.menu_items.id are TEXT constrained to
-- synthetic fixture IDs, not UUID. Do NOT drop, alter, or recreate them.
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  user_id text NOT NULL CHECK (length(btrim(user_id)) BETWEEN 1 AND 128),
  idempotency_key text NOT NULL UNIQUE
    CHECK (idempotency_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  create_intent_hash text NOT NULL CHECK (create_intent_hash ~ '^[0-9a-f]{64}$'),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  delivery_type text NOT NULL DEFAULT 'collection' CHECK (delivery_type='collection'),
  rider_id uuid CHECK (rider_id IS NULL),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','preparing','ready_for_pickup','collected','cancelled','rejected')),
  delivery_status text NOT NULL DEFAULT 'none' CHECK (delivery_status='none'),
  payment_method text NOT NULL CHECK (payment_method IN ('cash','card_machine')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','confirmed_at_shop')),
  price numeric(12,2) NOT NULL CHECK (price>=0 AND price<=99999.99),
  service_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (service_fee>=0 AND service_fee<=99999.99),
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee=0),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount=0),
  tip_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (tip_amount=0),
  total_price numeric(12,2) NOT NULL
    CHECK (total_price>=0 AND total_price=price+service_fee+delivery_fee-discount_amount+tip_amount),
  items jsonb NOT NULL
    CHECK (jsonb_typeof(items)='array' AND jsonb_array_length(items) BETWEEN 1 AND 50
       AND octet_length(items::text)<=65536),
  product_name text CHECK (product_name IS NULL OR length(product_name)<=2000),
  product_variant text,
  customer_name text NOT NULL CHECK (length(btrim(customer_name)) BETWEEN 1 AND 120),
  phone text NOT NULL CHECK (length(btrim(phone)) BETWEEN 7 AND 32),
  email text CHECK (email IS NULL OR length(email)<=320),
  address text CHECK (address IS NULL OR length(address)<=500),
  city text CHECK (city IS NULL OR length(city)<=120),
  lat numeric CHECK (lat IS NULL),
  lng numeric CHECK (lng IS NULL),
  notes text CHECK (notes IS NULL OR length(notes)<=3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX l1b_orders_shop_recent ON public.orders(shop_id,created_at DESC,id DESC);
CREATE INDEX l1b_orders_customer_recent ON public.orders(user_id,created_at DESC,id DESC);

CREATE TABLE public.pickup_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  command_id uuid NOT NULL,
  command_hash text NOT NULL CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  revision bigint NOT NULL CHECK (revision>0),
  kind text NOT NULL CHECK (kind IN
    ('accepted','ready','merchant_rejected','cancelled','payment_confirmed','collected')),
  actor_uid text NOT NULL CHECK (length(btrim(actor_uid)) BETWEEN 1 AND 128),
  recipient_uid text CHECK (recipient_uid IS NULL OR length(btrim(recipient_uid)) BETWEEN 1 AND 128),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(details)='object' AND octet_length(details::text)<=16384),
  UNIQUE (order_id, command_id),
  UNIQUE (order_id, revision)
);
CREATE INDEX l1b_events_recipient_recent
 ON public.pickup_order_events(recipient_uid,occurred_at DESC,id DESC);

-- Defense-in-depth: deny all browser DB privileges, enable FORCE RLS,
-- and grant backend SELECT only in this rehearsal. Crucially, NO backend
-- INSERT, UPDATE, DELETE, or callable RPC exists. This schema cannot
-- create an order even if an API write flag were mistakenly switched on.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_order_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.orders,public.pickup_order_events
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.orders,public.pickup_order_events TO service_role;

COMMENT ON TABLE public.orders IS
  'L1B DISPOSABLE DESIGN ONLY: no hosted migration approval and no write RPCs';
COMMENT ON TABLE public.pickup_order_events IS
  'L1B DISPOSABLE DESIGN ONLY: no hosted migration approval and no write RPCs';

DO $l1b_post$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_tables t JOIN pg_class c
      ON c.oid=(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))::regclass
      WHERE t.schemaname='public' AND t.tablename IN ('orders','pickup_order_events')
        AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity))
    OR has_table_privilege('anon','public.orders','SELECT')
    OR has_table_privilege('authenticated','public.orders','INSERT')
    OR has_table_privilege('service_role','public.orders','INSERT')
    OR has_table_privilege('service_role','public.orders','UPDATE')
    OR has_table_privilege('service_role','public.pickup_order_events','INSERT')
    OR (SELECT count(*) FROM public.shops)<>5
    OR (SELECT count(*) FROM public.menu_items)<>3
 THEN RAISE EXCEPTION 'L1B_POSTCONDITION_FAILED'; END IF;
END
$l1b_post$;
COMMIT;
