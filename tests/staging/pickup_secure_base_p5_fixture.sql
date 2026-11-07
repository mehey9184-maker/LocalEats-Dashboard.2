-- Disposable stage P5 only, no shop/order fixtures and no real data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO service_role;

-- Synthetic PG17 only: reproduce the read-only inspected P5 staging profile
-- shape/constraints/locked-down grants, including forced RLS. This fixture
-- is NOT a migration and must never run in the connected Supabase project.
-- Existing pickup fixture created anon, authenticated and service_role.
CREATE TABLE public.profiles (
  user_id text PRIMARY KEY CONSTRAINT profiles_user_id_check
    CHECK (length(btrim(user_id)) BETWEEN 1 AND 128),
  "fullName" text CONSTRAINT profiles_fullName_check
    CHECK ("fullName" IS NULL OR length("fullName") <= 120),
  email text CONSTRAINT profiles_email_check
    CHECK (email IS NULL OR length(email) <= 320),
  phone text CONSTRAINT profiles_phone_check
    CHECK (phone IS NULL OR length(phone) <= 32),
  city text DEFAULT 'Johannesburg' CONSTRAINT profiles_city_check
    CHECK (city IS NULL OR length(city) <= 120),
  address text CONSTRAINT profiles_address_check
    CHECK (address IS NULL OR length(address) <= 500),
  country text DEFAULT 'South Africa' CONSTRAINT profiles_country_check
    CHECK (country IS NULL OR length(country) <= 120),
  role text NOT NULL DEFAULT 'customer' CONSTRAINT profiles_role_check
    CHECK (role IN ('customer','merchant','rider','admin','super_admin')),
  photo_url text,
  language text DEFAULT 'en' CONSTRAINT profiles_language_check
    CHECK (language IS NULL OR length(language) <= 12),
  latitude double precision CONSTRAINT profiles_latitude_check
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude double precision CONSTRAINT profiles_longitude_check
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  favorites jsonb NOT NULL DEFAULT '[]'::jsonb CONSTRAINT profiles_favorites_check
    CHECK (jsonb_typeof(favorites)='array'),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc',now())
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profiles TO service_role;
INSERT INTO public.profiles(user_id,"fullName",role,favorites)
VALUES ('synthetic-stage-customer-a','Synthetic P5 Account','customer','[]');

-- Fingerprint schema, constraints, RLS and ACL BEFORE the additional pickup SQL.
-- No real staging records are copied. The test_support schema is disposable.
CREATE SCHEMA test_support;
CREATE TABLE test_support.profile_contract_baseline (
  signature text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL
);
CREATE FUNCTION test_support.p5_signature()
RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
SELECT md5(
  coalesce((SELECT string_agg(
    a.attnum::text||':'||a.attname||':'||pg_catalog.format_type(a.atttypid,a.atttypmod)
      ||':'||a.attnotnull::text||':'||coalesce(pg_catalog.pg_get_expr(d.adbin,d.adrelid),''),
    E'\n' ORDER BY a.attnum)
  FROM pg_catalog.pg_attribute a
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attrelid='public.profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped),'')
  || '::' ||
  coalesce((SELECT string_agg(conname||':'||pg_catalog.pg_get_constraintdef(oid),E'\n' ORDER BY conname)
    FROM pg_catalog.pg_constraint WHERE conrelid='public.profiles'::regclass),'')
  || '::' ||
  (SELECT relrowsecurity::text||':'||relforcerowsecurity::text||':'||coalesce(relacl::text,'')
    FROM pg_catalog.pg_class WHERE oid='public.profiles'::regclass)
);
$$;
INSERT INTO test_support.profile_contract_baseline(signature,user_id,role)
SELECT test_support.p5_signature(),user_id,role FROM public.profiles;

