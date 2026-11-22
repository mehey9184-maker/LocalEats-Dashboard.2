-- CF2-D rollback REVIEW ONLY — must be authorized separately for hosted staging.
-- Reverts only cf2_catalog_reader / catalog_cf2 created by matching proposal.
-- STOP if objects have been reused or modified; no CASCADE anywhere.
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cf2_catalog_reader')
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='catalog_cf2')
 THEN RAISE EXCEPTION 'CF2D_ROLLBACK_UNEXPECTED_STATE_STOP'; END IF;
END $$;

REVOKE SELECT ON catalog_cf2.public_menu, catalog_cf2.public_shops
FROM cf2_catalog_reader;
DROP VIEW catalog_cf2.public_menu RESTRICT;
DROP VIEW catalog_cf2.public_shops RESTRICT;
REVOKE USAGE ON SCHEMA catalog_cf2 FROM cf2_catalog_reader;
DROP SCHEMA catalog_cf2 RESTRICT;

DROP POLICY cf2_catalog_menu_select ON public.menu_items;
DROP POLICY cf2_catalog_shops_select ON public.shops;
REVOKE EXECUTE ON FUNCTION public.shop_schedule_open(text,text,timestamptz)
FROM cf2_catalog_reader;
REVOKE SELECT (
 id,shop_id,name,price,description,image_url,category,is_available,
 popularity_score,customizations,created_at
) ON public.menu_items FROM cf2_catalog_reader;
REVOKE SELECT (
 id,name,description,story,location,category,logo_url,rating,
 approval_status,archived_at,opening_time,closing_time,is_active,
 latitude,longitude,availability_override_until,availability_revision
) ON public.shops FROM cf2_catalog_reader;
REVOKE USAGE ON SCHEMA public FROM cf2_catalog_reader;
DROP ROLE cf2_catalog_reader;
COMMIT;

-- No customer, merchant, order, payment, fixture or original SQL function changed.
