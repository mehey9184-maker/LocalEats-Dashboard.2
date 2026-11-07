-- R3.4 BASELINE.SYNTHETIC_ONLY.sql
-- No real Supabase, production schema dump, customer data or live ordering.
-- Disposable pg17 DB only. Small fixture recreates *legacy prerequisites*
-- so that the actual repository pickup SQL can execute unchanged.
-- This is NOT a full deployed Production schema reconstruction.
BEGIN;
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
-- All fixtures use fake Firebase UIDs, fake coordinates, fake devices.
CREATE TABLE public.shops(
 id text PRIMARY KEY,
 owner_id text,
 name text NOT NULL DEFAULT 'Synthetic Shop',
 location text,
 is_active boolean,
 approval_status text,
 archived_at timestamptz,
 lat numeric,
 lng numeric,
 latitude numeric,
 longitude numeric,
 opening_time text,
 closing_time text
);
CREATE TABLE public.menu_items(
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
 name text NOT NULL,
 price numeric NOT NULL,
 is_available boolean
);
CREATE TABLE public.orders(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 shop_id text NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
 user_id text,
 rider_id uuid,
 status text,
 delivery_status text,
 payment_method text,
 idempotency_key text UNIQUE,
 items jsonb,
 price numeric,
 total_price numeric,
 service_fee numeric,
 delivery_fee numeric,
 discount_amount numeric,
 tip_amount numeric,
 lat numeric,
 lng numeric,
 customer_name text,
 phone text,
 email text,
 address text,
 city text,
 notes text,
 product_name text,
 product_variant text,
 created_at timestamptz DEFAULT statement_timestamp(),
 updated_at timestamptz DEFAULT statement_timestamp()
);
-- The Supabase service role bypasses RLS in actual deployment. This synthetic
-- role is not a credential and has no external network login.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders,public.shops,public.menu_items FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orders TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.shops TO service_role;
GRANT SELECT,UPDATE ON public.menu_items TO service_role;
COMMIT;
