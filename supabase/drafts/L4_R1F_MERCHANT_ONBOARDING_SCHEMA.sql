-- L4-R1F — REVIEW ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- Existing new-merchant POST uses phone, lat, lng and approval_reason.
-- Live staging was observed lacking these fields on 2026-11-23.
-- This additive compatibility draft must be folded into a canonical, reviewed
-- migration after a verified restorable backup and isolated staging rehearsal.
BEGIN;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS approval_reason text;
COMMIT;
-- Do not drop existing Production columns during rollback.
-- Disable the onboarding write path before any schema rollback.
