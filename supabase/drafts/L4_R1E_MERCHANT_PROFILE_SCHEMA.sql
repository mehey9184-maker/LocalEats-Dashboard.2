-- L4-R1E REVIEW-ONLY SCHEMA DRAFT; DO NOT APPLY TO PRODUCTION.
-- Generate a proper migration with Supabase CLI once the restore gate is clear.
-- Rehearse in a disposable database, audit RLS and confirm rollback before approval.
BEGIN;

CREATE TABLE IF NOT EXISTS public.merchant_profiles (
 merchant_uid text PRIMARY KEY,
 shop_id text NOT NULL,
 full_name text NOT NULL DEFAULT '' CHECK (char_length(full_name) <= 120),
 phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 24),
 avatar_url text NOT NULL DEFAULT '' CHECK (char_length(avatar_url) <= 600),
 marketing_opt_in boolean NOT NULL DEFAULT true,
 dark_mode boolean NOT NULL DEFAULT false,
 revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS merchant_profiles_shop_id_idx ON public.merchant_profiles(shop_id);
ALTER TABLE public.merchant_profiles ENABLE ROW LEVEL SECURITY;
-- With no anon/authenticated policies, only the server service role can read and write.
REVOKE ALL ON public.merchant_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.merchant_profiles TO service_role;

-- Storefront CAS version is independent of availability and approval.
-- Staging currently lacks shops.phone; Production already has it. Additive and nullable only.
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS merchant_profile_revision bigint NOT NULL DEFAULT 0;
-- No SECURITY DEFINER functions, public profile grants, account/user role changes or direct browser writes.
COMMIT;

-- ROLLBACK PLAN (requires verified backups and explicit review; never automatic):
-- ALTER TABLE public.shops DROP COLUMN merchant_profile_revision;
-- ALTER TABLE public.shops DROP COLUMN phone; -- ONLY if this migration created it; Production already uses it.
-- DROP TABLE public.merchant_profiles;
-- Rollback can destroy data; scope to the actual environment and sign off after restore proof.
