-- R5.2K ROLLBACK PROPOSAL ONLY. DO NOT APPLY TO REMOTE DATABASE.
-- This deliberately refuses CASCADE and refuses unexpected rows/dependencies.
-- Only after separate owner approval and verification of the exact staging ref.
-- Arming command (run in session before this file):
-- SET localeats.r52k_owner_approval = 'APPROVED_R52K_ISOLATED_STAGING_ONLY';
BEGIN;

DO $rollback_preflight$
BEGIN
 IF current_setting('localeats.r52k_owner_approval', true)
      IS DISTINCT FROM 'APPROVED_R52K_ISOLATED_STAGING_ONLY' THEN
   RAISE EXCEPTION 'R52K_ROLLBACK_OWNER_APPROVAL_REQUIRED';
 END IF;
 IF to_regclass('public.profiles') IS NULL OR
    obj_description('public.profiles'::regclass, 'pg_class') IS DISTINCT FROM
    'LocalEats Profile P5 isolated staging only; no direct anon/authenticated Data API access; Firebase UID scoped via server profile API.' THEN
   RAISE EXCEPTION 'R52K_ROLLBACK_STAGING_SENTINEL_MISMATCH';
 END IF;
 IF to_regclass('public.shops') IS NULL OR
    to_regclass('public.menu_items') IS NULL OR
    to_regclass('public.shops_with_availability') IS NULL OR
    obj_description('public.shops'::regclass, 'pg_class') IS DISTINCT FROM
    'R5.2K isolated LocalEats staging synthetic catalogue ONLY. Never Production.' THEN
   RAISE EXCEPTION 'R52K_ROLLBACK_OBJECT_SET_UNEXPECTED';
 END IF;
 IF to_regclass('public.orders') IS NOT NULL THEN
   RAISE EXCEPTION 'R52K_ROLLBACK_ORDER_DEPENDENCY_POSSIBLE';
 END IF;
 IF EXISTS (SELECT 1 FROM public.shops
            WHERE id !~ '^stg-test-shop-[a-z0-9-]{2,80}$')
    OR EXISTS (SELECT 1 FROM public.menu_items
               WHERE id !~ '^stg-test-item-[a-z0-9-]{2,80}$') THEN
   RAISE EXCEPTION 'R52K_ROLLBACK_NON_SYNTHETIC_DATA_PRESENT';
 END IF;
END;
$rollback_preflight$;

-- Strict RESTRICT drops intentionally stop on unknown references.
DROP VIEW public.shops_with_availability RESTRICT;
DROP TRIGGER shops_availability_revision ON public.shops;
DROP FUNCTION public.shop_availability_revision_guard() RESTRICT;
DROP FUNCTION public.shop_effective_open(public.shops,timestamptz) RESTRICT;
DROP FUNCTION public.shop_schedule_open(text,text,timestamptz) RESTRICT;
DROP TABLE public.menu_items RESTRICT;
DROP TABLE public.shops RESTRICT;

-- Existing public.profiles, its policies and any authentication state are untouched.
COMMIT;
