-- SYNTHETIC OFFLINE DOCKER-RESTORE TEST ONLY; not Production schema dump.
-- Matches the P5 14-column, 13-constraint shape inspected read-only.
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
