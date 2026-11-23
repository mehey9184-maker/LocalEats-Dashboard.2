#!/usr/bin/env bash
# L4-R1E local-only PostgreSQL 17 rehearsal. Creates disposable CI databases, never hosted resources.
set -euo pipefail
psql -v ON_ERROR_STOP=1 -d postgres <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
SQL
createdb l4_r1e_staging
createdb l4_r1e_production
for fixture in l4_r1e_staging l4_r1e_production; do
  psql -v ON_ERROR_STOP=1 -d "$fixture" <<'SQL'
CREATE TABLE public.shops (
 id text PRIMARY KEY, owner_id text, name text NOT NULL,
 category text, description text, story text, location text, logo_url text,
 latitude double precision, longitude double precision,
 opening_time text, closing_time text, approval_status text,
 archived_at timestamptz, is_active boolean
);
SQL
  if [[ "$fixture" == l4_r1e_production ]]; then
    psql -v ON_ERROR_STOP=1 -d "$fixture" -c 'ALTER TABLE public.shops ADD COLUMN phone text; ALTER TABLE public.shops ADD COLUMN lat double precision; ALTER TABLE public.shops ADD COLUMN lng double precision; ALTER TABLE public.shops ADD COLUMN approval_reason text;'
  fi
  psql -v ON_ERROR_STOP=1 -d "$fixture" -f supabase/drafts/L4_R1E_MERCHANT_PROFILE_SCHEMA.sql
  psql -v ON_ERROR_STOP=1 -d "$fixture" -f supabase/drafts/L4_R1F_MERCHANT_ONBOARDING_SCHEMA.sql
  psql -v ON_ERROR_STOP=1 -d "$fixture" <<'SQL'
DO $$
BEGIN
 IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='phone') THEN
  RAISE EXCEPTION 'phone missing';
 END IF;
 IF EXISTS (
 SELECT 1 FROM (VALUES ('phone'),('lat'),('lng'),('approval_reason')) AS required(column_name)
 WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='shops'
    AND c.column_name=required.column_name
 )
 ) THEN RAISE EXCEPTION 'onboarding compatibility columns missing'; END IF;
 IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='merchant_profile_revision') THEN
  RAISE EXCEPTION 'revision missing';
 END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.merchant_profiles'::regclass) THEN
  RAISE EXCEPTION 'merchant profiles RLS disabled';
 END IF;
 IF has_table_privilege('anon','public.merchant_profiles','SELECT') OR
    has_table_privilege('authenticated','public.merchant_profiles','UPDATE') THEN
  RAISE EXCEPTION 'untrusted browser role can access private merchant data';
 END IF;
 IF NOT has_table_privilege('service_role','public.merchant_profiles','SELECT') THEN
  RAISE EXCEPTION 'service adapter cannot read merchant profile';
 END IF;
END $$;
INSERT INTO public.shops (id,owner_id,name) VALUES ('owned-shop','merchant-A','Kota shop');
INSERT INTO public.shops (
 id,owner_id,name,category,description,phone,location,
 latitude,longitude,lat,lng,opening_time,closing_time,logo_url,story,
 approval_status,approval_reason,archived_at,is_active
) VALUES (
 'new-vendor','vendor-B','New Kota','Kota / Street Food','Street food','0821234567','Ivory Park',
 -26.005,28.225,-26.005,28.225,'08:00','22:00','https://res.cloudinary.com/example/image/upload/v1/logo.png','Fresh kota',
 'pending',NULL,NULL,false
);
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id='new-vendor'
   AND owner_id='vendor-B' AND approval_status='pending' AND is_active=false
   AND latitude=lat AND longitude=lng)
 THEN RAISE EXCEPTION 'new merchant registration was not pending, inactive or coordinate-consistent'; END IF;
END $$;
INSERT INTO public.merchant_profiles (merchant_uid,shop_id,full_name) VALUES ('merchant-A','owned-shop','A');
DO $$
DECLARE n bigint;
BEGIN
 WITH written AS (UPDATE public.merchant_profiles
  SET full_name='Updated',revision=revision+1
  WHERE merchant_uid='merchant-A' AND shop_id='owned-shop' AND revision=0
  RETURNING revision) SELECT count(*) INTO n FROM written;
 IF n<>1 THEN RAISE EXCEPTION 'account CAS success failed'; END IF;
 WITH stale AS (UPDATE public.merchant_profiles
  SET full_name='Stale',revision=revision+1
  WHERE merchant_uid='merchant-A' AND shop_id='owned-shop' AND revision=0
  RETURNING revision) SELECT count(*) INTO n FROM stale;
 IF n<>0 THEN RAISE EXCEPTION 'stale account update allowed'; END IF;
 WITH written AS (UPDATE public.shops
  SET name='Verified Kota',merchant_profile_revision=1
  WHERE id='owned-shop' AND owner_id='merchant-A' AND merchant_profile_revision=0
  RETURNING merchant_profile_revision) SELECT count(*) INTO n FROM written;
 IF n<>1 THEN RAISE EXCEPTION 'shop CAS success failed'; END IF;
 WITH stale AS (UPDATE public.shops
  SET name='Stale Kota',merchant_profile_revision=2
  WHERE id='owned-shop' AND owner_id='merchant-A' AND merchant_profile_revision=0
  RETURNING merchant_profile_revision) SELECT count(*) INTO n FROM stale;
 IF n<>0 THEN RAISE EXCEPTION 'stale shop update allowed'; END IF;
END $$;
SQL
  echo "$fixture: RLS, profile CAS, staging/production onboarding schema and pending-inactive shop insert PASS"
done
