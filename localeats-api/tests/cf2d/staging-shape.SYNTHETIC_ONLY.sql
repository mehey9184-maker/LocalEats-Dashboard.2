-- CF2-D synthetic PostgreSQL 17 preparation. DISPOSABLE DOCKER ONLY.
-- This fixture deliberately resembles verified staging column names and its
-- deployed availability function, but uses INVENTED shop/owner records.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE TABLE public.shops(
 id text PRIMARY KEY, owner_id text NOT NULL, private_notes text,
 name text NOT NULL, description text, story text, location text, category text,
 logo_url text, rating numeric, approval_status text NOT NULL,
 archived_at timestamptz, opening_time text, closing_time text,
 is_active boolean NOT NULL, latitude double precision,
 longitude double precision, availability_override_until timestamptz,
 availability_revision bigint NOT NULL
);
CREATE TABLE public.menu_items(
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES public.shops(id),
 name text NOT NULL, price numeric, description text,image_url text,
 category text,is_available boolean,popularity_score integer,
 customizations jsonb,created_at timestamptz,
 cost_price numeric,private_notes text
);
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Reproduces the VERIFIED DEPLOYED STAGING function semantics, including
-- approval and archive checks which an older GitHub draft omitted.
CREATE OR REPLACE FUNCTION public.shop_schedule_open(
 p_open text,p_close text,p_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE STRICT SET search_path TO 'pg_catalog'
AS $function$
 SELECT CASE
 WHEN p_open !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  OR p_close !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN false
 WHEN p_open = p_close THEN false
 WHEN p_open < p_close THEN
   to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') >= p_open
   AND to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') < p_close
 ELSE
   to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') >= p_open
   OR to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') < p_close
 END;
$function$;
CREATE OR REPLACE FUNCTION public.shop_effective_open(
 p_shop public.shops,p_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'pg_catalog'
AS $function$
 SELECT coalesce(p_shop.is_active,false)
 AND p_shop.approval_status = 'approved'
 AND p_shop.archived_at IS NULL
 AND (
   coalesce(public.shop_schedule_open(
     p_shop.opening_time,p_shop.closing_time,p_at),false)
   OR coalesce(p_shop.availability_override_until > p_at,false)
 );
$function$;

-- Current staging limits executor to service_role. Dummy fixture uses
-- deliberate narrower grants only after the proposal SQL is applied.
REVOKE EXECUTE ON FUNCTION public.shop_schedule_open(text,text,timestamptz)
FROM PUBLIC, anon, authenticated;

INSERT INTO public.shops (
 id,owner_id,private_notes,name,approval_status,archived_at,
 opening_time,closing_time,is_active,latitude,longitude,
 availability_override_until,availability_revision
) VALUES
 ('stg-test-open','synthetic-owner','secret','STAGING TEST Open','approved',null,
 '08:00','22:00',true,-25.98,28.2,null,3),
 ('stg-test-far','synthetic-owner','secret','STAGING TEST Far','approved',null,
 '08:00','22:00',true,-26.06,28.2,null,3),
 ('stg-test-closed','synthetic-owner','secret','STAGING TEST Closed','approved',null,
 '08:00','22:00',false,-25.98,28.2,null,3),
 ('stg-test-pending','synthetic-owner','secret','STAGING TEST Pending','pending',null,
 '08:00','22:00',true,-25.98,28.2,null,3),
 ('stg-test-archived','synthetic-owner','secret','STAGING TEST Archived','approved',
 '2026-11-21 10:00+00','08:00','22:00',true,-25.98,28.2,null,3);

INSERT INTO public.menu_items(
 id,shop_id,name,price,is_available,cost_price,private_notes)
VALUES
 ('test-kota-open','stg-test-open','STAGING TEST Kota',25,true,3,'private'),
 ('test-kota-closed','stg-test-closed','STAGING TEST Closed Kota',25,true,3,'private'),
 ('test-kota-pending','stg-test-pending','STAGING TEST Pending Kota',25,true,3,'private');
