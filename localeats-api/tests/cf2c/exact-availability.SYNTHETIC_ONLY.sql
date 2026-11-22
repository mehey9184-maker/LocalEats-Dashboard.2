-- CF2-C EXACT SOURCE PARITY LAB, SYNTHETIC ONLY; never apply to hosted DB.
-- PG17 disposable single-use database, no Supabase credentials or ports.
-- The two function definitions below are copied verbatim from
-- supabase/drafts/merchant_availability.sql and are parity-checked by CI.
CREATE ROLE cf2c_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE TABLE public.shops(
 id text PRIMARY KEY,name text NOT NULL,owner_id text NOT NULL,private_notes text,
 approval_status text NOT NULL,archived_at timestamptz,is_active boolean NOT NULL,
 opening_time text,closing_time text,availability_override_until timestamptz,
 availability_revision bigint NOT NULL,lat numeric,lng numeric
);
CREATE TABLE public.menu_items(
 id text PRIMARY KEY,shop_id text REFERENCES public.shops(id),
 name text,price numeric,is_available boolean,cost_price numeric
);

CREATE FUNCTION public.shop_schedule_open(p_open text, p_close text, p_at timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog, public AS $$
 SELECT CASE WHEN p_open !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR p_close !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN false
 WHEN p_open = p_close THEN false
 WHEN p_open < p_close THEN to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') >= p_open AND to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') < p_close
 ELSE to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') >= p_open OR to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') < p_close END;
$$;
CREATE FUNCTION public.shop_effective_open(p_shop public.shops, p_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
 SELECT coalesce(p_shop.is_active,false) AND
 (coalesce(public.shop_schedule_open(p_shop.opening_time,p_shop.closing_time,p_at),false) OR coalesce(p_shop.availability_override_until > p_at,false));
$$;

CREATE VIEW public.shops_with_availability WITH (security_invoker = true) AS
 SELECT s.*, public.shop_effective_open(s,statement_timestamp()) AS effective_is_active FROM public.shops s;
REVOKE ALL ON public.shops_with_availability FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_schedule_open(text,text,timestamptz),
 public.shop_effective_open(public.shops,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_schedule_open(text,text,timestamptz),
 public.shop_effective_open(public.shops,timestamptz) TO cf2c_reader;

CREATE SCHEMA catalog_cf2;
CREATE VIEW catalog_cf2.public_shops WITH (security_invoker = true,security_barrier = true) AS
 SELECT s.id,s.name,s.approval_status,s.archived_at,s.is_active,
 s.opening_time,s.closing_time,s.availability_override_until,s.availability_revision,
 s.lat,s.lng,
 public.shop_effective_open(s,statement_timestamp()) AS effective_is_active
 FROM public.shops s WHERE s.approval_status = 'approved' AND s.archived_at IS NULL;
CREATE VIEW catalog_cf2.public_menu WITH (security_invoker = true,security_barrier = true) AS
 SELECT m.id,m.shop_id,m.name,m.price,m.is_available FROM public.menu_items m;

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cf2c_shop_read ON public.shops FOR SELECT TO cf2c_reader
 USING(approval_status='approved' AND archived_at IS NULL);
CREATE POLICY cf2c_menu_read ON public.menu_items FOR SELECT TO cf2c_reader
 USING (EXISTS(SELECT 1 FROM public.shops s
 WHERE s.id=shop_id AND s.approval_status='approved' AND s.archived_at IS NULL));

GRANT USAGE ON SCHEMA public,catalog_cf2 TO cf2c_reader;
GRANT SELECT (id,name,approval_status,archived_at,is_active,
 opening_time,closing_time,availability_override_until,availability_revision,lat,lng)
 ON public.shops TO cf2c_reader;
GRANT SELECT (id,shop_id,name,price,is_available) ON public.menu_items TO cf2c_reader;
GRANT SELECT ON catalog_cf2.public_shops,catalog_cf2.public_menu TO cf2c_reader;

INSERT INTO public.shops(
 id,name,owner_id,private_notes,approval_status,archived_at,is_active,
 opening_time,closing_time,availability_override_until,availability_revision,lat,lng)
 VALUES
 ('stg-test-shop-open','STAGING TEST Open','fake-owner','private','approved',null,true,'08:00','22:00',null,3,-25.98,28.2),
 ('stg-test-shop-far','STAGING TEST Far','fake-owner','private','approved',null,true,'08:00','22:00',null,3,-26.06,28.2),
 ('stg-test-shop-closed','STAGING TEST Closed','fake-owner','private','approved',null,false,'08:00','22:00',null,3,-25.98,28.2),
 ('stg-test-shop-pending','STAGING TEST Pending','fake-owner','private','pending',null,true,'08:00','22:00',null,3,-25.98,28.2),
 ('stg-test-shop-archived','STAGING TEST Archived','fake-owner','private','approved','2026-11-01',true,'08:00','22:00',null,3,-25.98,28.2),
 ('stg-test-shop-overnight','STAGING TEST Overnight','fake-owner','private','approved',null,true,'22:00','04:00',null,3,-25.98,28.2),
 ('stg-test-shop-override','STAGING TEST Override','fake-owner','private','approved',null,true,'08:00','22:00','2026-11-23 00:00+00',3,-25.98,28.2);
INSERT INTO public.menu_items (id,shop_id,name,price,is_available,cost_price) VALUES
 ('stg-test-item-kota-open','stg-test-shop-open','STAGING TEST Kota',25,true,4),
 ('stg-test-item-kota-closed','stg-test-shop-closed','STAGING TEST Kota Closed',25,true,4),
 ('stg-test-item-kota-pending','stg-test-shop-pending','STAGING TEST Kota Pending',25,true,4);

DO $$
BEGIN
 IF (SELECT rolcanlogin OR rolbypassrls OR rolsuper FROM pg_roles WHERE rolname='cf2c_reader')
 OR has_column_privilege('cf2c_reader','public.shops','owner_id','SELECT')
 OR has_column_privilege('cf2c_reader','public.shops','private_notes','SELECT')
 OR has_column_privilege('cf2c_reader','public.menu_items','cost_price','SELECT')
 OR has_table_privilege('cf2c_reader','public.shops','UPDATE')
 OR has_table_privilege('cf2c_reader','public.menu_items','INSERT') THEN
  RAISE EXCEPTION 'CF2C_EXCESS_PRIVILEGE';
 END IF;
END $$;

-- Exact-source reference function tests using fixed UTC->SAST conversion:
DO $$
BEGIN
 IF NOT public.shop_schedule_open('08:00','22:00','2026-11-22 08:00+00') THEN
  RAISE EXCEPTION 'CF2C_DAY_OPEN'; END IF;
 IF public.shop_schedule_open('08:00','22:00','2026-11-22 21:30+00') THEN
  RAISE EXCEPTION 'CF2C_DAY_CLOSED'; END IF;
 IF NOT public.shop_schedule_open('22:00','04:00','2026-11-22 21:30+00') THEN
  RAISE EXCEPTION 'CF2C_OVERNIGHT_OPEN'; END IF;
 IF public.shop_schedule_open('22:00','04:00','2026-11-22 09:00+00') THEN
  RAISE EXCEPTION 'CF2C_OVERNIGHT_CLOSED'; END IF;
 IF NOT (SELECT public.shop_effective_open(s,'2026-11-22 21:30+00')
   FROM public.shops s WHERE s.id='stg-test-shop-override') THEN
  RAISE EXCEPTION 'CF2C_OVERRIDE_FALSE'; END IF;
 IF (SELECT public.shop_effective_open(s,'2026-11-22 09:00+00')
   FROM public.shops s WHERE s.id='stg-test-shop-closed') THEN
  RAISE EXCEPTION 'CF2C_CLOSED_OPEN'; END IF;
END $$;

-- This is the key CF2-C question: does PostgreSQL allow an invoker view that
-- invokes the original composite shop function without granting owner_id?
SET ROLE cf2c_reader;
DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM catalog_cf2.public_shops;
 IF n <> 5 THEN RAISE EXCEPTION 'CF2C_SHOP_SCOPE_%',n; END IF;
 SELECT count(*) INTO n FROM catalog_cf2.public_shops WHERE id='stg-test-shop-pending';
 IF n <> 0 THEN RAISE EXCEPTION 'CF2C_PENDING_LEAK'; END IF;
 SELECT count(*) INTO n FROM catalog_cf2.public_shops WHERE id='stg-test-shop-archived';
 IF n <> 0 THEN RAISE EXCEPTION 'CF2C_ARCHIVED_LEAK'; END IF;
 SELECT count(*) INTO n FROM catalog_cf2.public_menu;
 IF n <> 2 THEN RAISE EXCEPTION 'CF2C_MENU_SCOPE_%',n; END IF;
END $$;
RESET ROLE;
SELECT 'CF2C_EXACT_AVAILABILITY_SQL_AND_RESTRICTED_ROLE_PARITY_PASS';
