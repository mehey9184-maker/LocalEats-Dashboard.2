-- R5.2C DISPOSABLE PG17 SCHEMA-ONLY REHEARSAL. DO NOT APPLY TO SUPABASE.
-- This is NOT a production-equivalent migration or a real staging cutover.
-- Intentionally hard-stops on every Supabase-hosted 'postgres' database.
-- No customer data, live UID, production credentials, Rewards or real order.
BEGIN;
DO $r52c_guard$
BEGIN
  IF current_database() <> 'r52c_synthetic_only'
     OR current_setting('r52c.synthetic_only', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'R52C_REFUSE_NONDISPOSABLE_DATABASE';
  END IF;
END
$r52c_guard$;

-- These roles never log in and exist only inside the disposable container.
CREATE ROLE r52c_browser NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r52c_api_reader NOLOGIN NOINHERIT NOBYPASSRLS;

-- The four missing pickup tables; actual PK, identity, amount and event types
-- follow read-only production pg_catalog metadata, NOT copied customer rows.
CREATE TABLE public.shops (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  location text,
  category text,
  owner_id text,
  logo_url text,
  rating numeric,
  phone text,
  opening_time text,
  closing_time text,
  is_active boolean NOT NULL DEFAULT false,
  localeats_cash_trust boolean,
  cash_trust_enabled boolean,
  allow_external_riders boolean,
  auto_look_for_rider boolean,
  latitude double precision,
  longitude double precision,
  lat double precision,
  lng double precision,
  created_at timestamptz DEFAULT statement_timestamp(),
  approval_status text NOT NULL DEFAULT 'pending',
  approval_reason text,
  archived_at timestamptz,
  story text,
  availability_override_until timestamptz,
  availability_revision bigint NOT NULL DEFAULT 0,
  pickup_payment_methods text[]
);
CREATE TABLE public.menu_items (
  id text PRIMARY KEY,
  shop_id text NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  name text NOT NULL,
  price numeric NOT NULL,
  description text,
  image_url text,
  category text,
  is_available boolean NOT NULL DEFAULT false,
  popularity_score integer,
  customizations jsonb,
  created_at timestamptz DEFAULT statement_timestamp()
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  user_id text,
  rider_id uuid,
  product_name text,
  product_variant text,
  total_price numeric,
  price numeric,
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
  merchant_rating numeric,
  acceptance_message text,
  notes text,
  created_at timestamptz DEFAULT statement_timestamp(),
  updated_at timestamptz DEFAULT statement_timestamp(),
  delivery_fee numeric,
  service_fee numeric,
  discount_amount numeric,
  tip_amount numeric,
  idempotency_key text UNIQUE,
  items jsonb,
  delivery_type text,
  payment_status text,
  create_intent_hash text,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
CREATE TABLE public.pickup_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  revision bigint NOT NULL CHECK (revision > 0),
  command_id uuid NOT NULL,
  command_hash text NOT NULL,
  kind text NOT NULL,
  actor_uid text NOT NULL,
  recipient_uid text,
  occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (order_id, command_id),
  UNIQUE (order_id, revision),
  UNIQUE (order_id, kind)
);
CREATE INDEX r52c_orders_user_recent ON public.orders(user_id, created_at DESC, id DESC);
CREATE INDEX r52c_orders_shop_recent ON public.orders(shop_id, created_at DESC, id DESC);
CREATE INDEX r52c_events_recipient_recent ON public.pickup_order_events(recipient_uid, occurred_at DESC, id DESC);

-- A synthetic STRUCTURE-ONLY view. Production uses public.shop_effective_open
-- and public.shop_schedule_open, not this forced-closed test definition.
-- Every shop is unorderable in this disposable fixture even if is_active=true.
CREATE VIEW public.shops_with_availability
  WITH (security_invoker = true)
AS SELECT s.*, false::boolean AS effective_is_active FROM public.shops AS s;

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops FORCE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_order_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.shops, public.menu_items, public.orders,
  public.pickup_order_events, public.shops_with_availability
  FROM PUBLIC, r52c_browser;
GRANT USAGE ON SCHEMA public TO r52c_api_reader;
GRANT SELECT ON public.shops, public.menu_items, public.orders,
  public.pickup_order_events, public.shops_with_availability TO r52c_api_reader;
CREATE POLICY r52c_api_ro_shops ON public.shops FOR SELECT TO r52c_api_reader USING (true);
CREATE POLICY r52c_api_ro_menu ON public.menu_items FOR SELECT TO r52c_api_reader USING (true);
CREATE POLICY r52c_api_ro_orders ON public.orders FOR SELECT TO r52c_api_reader USING (true);
CREATE POLICY r52c_api_ro_events ON public.pickup_order_events FOR SELECT TO r52c_api_reader USING (true);

-- NO create/command/payout functions, triggers, promo credit, write policies,
-- live order seeding or API credentials are created by this lab.
COMMIT;
