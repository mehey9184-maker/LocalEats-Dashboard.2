-- R5.2K SYNTHETIC FIXTURE PROPOSAL ONLY. DO NOT APPLY TO REMOTE DATABASE.
-- Requires separate explicit owner approval for INSERTS after schema approval.
-- Use ONLY in Supabase rgpbdajhlrwfmhopzgzk; never copy Production data.
-- Arm a new SQL session deliberately with:
-- SET localeats.r52k_owner_approval = 'APPROVED_R52K_ISOLATED_STAGING_ONLY';
BEGIN;
DO $fixture_preflight$
BEGIN
  IF current_setting('localeats.r52k_owner_approval', true)
       IS DISTINCT FROM 'APPROVED_R52K_ISOLATED_STAGING_ONLY' OR
     to_regclass('public.shops') IS NULL OR
     obj_description('public.shops'::regclass,'pg_class')
       IS DISTINCT FROM 'R5.2K isolated LocalEats staging synthetic catalogue ONLY. Never Production.' THEN
    RAISE EXCEPTION 'R52K_FIXTURE_STAGING_APPROVAL_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shops)
     OR EXISTS (SELECT 1 FROM public.menu_items) THEN
    RAISE EXCEPTION 'R52K_FIXTURE_EXPECTS_EMPTY_SYNTHETIC_TABLES';
  END IF;
END;
$fixture_preflight$;

-- Fixed invented coordinate origin is (-26.0000, 28.0000); NOT device GPS.
INSERT INTO public.shops
  (id,owner_id,name,description,location,category,approval_status,archived_at,
   is_active,latitude,longitude,opening_time,closing_time,availability_override_until)
VALUES
  ('stg-test-shop-open','stg-test-owner-synthetic',
   'STAGING TEST — Open Kota','Fabricated open-shop fixture',
   'Synthetic fixture A (not a real business)','Kota','approved',NULL,
   true,-26.0000,28.0000,'00:00','23:59',now() + interval '7 days'),
  ('stg-test-shop-closed','stg-test-owner-synthetic',
   'STAGING TEST — Closed Kota','Fabricated closed-shop fixture; menu browse only',
   'Synthetic fixture B (not a real business)','Kota','approved',NULL,
   false,-26.0040,28.0010,'00:00','23:59',NULL),
  ('stg-test-shop-pending','stg-test-owner-synthetic',
   'STAGING TEST — Pending Shop','Must be excluded from public catalogues',
   'Synthetic fixture C (not a real business)','Kota','pending',NULL,
   true,-26.0050,28.0000,'00:00','23:59',NULL),
  ('stg-test-shop-archived','stg-test-owner-synthetic',
   'STAGING TEST — Archived Shop','Must be excluded from public catalogues',
   'Synthetic fixture D (not a real business)','Kota','approved',now(),
   true,-26.0060,28.0000,'00:00','23:59',NULL),
  ('stg-test-shop-far','stg-test-owner-synthetic',
   'STAGING TEST — Far Kota','Approved but more than 4 km from fixture origin',
   'Synthetic fixture E (not a real business)','Kota','approved',NULL,
   true,-26.0800,28.0000,'00:00','23:59',NULL);

INSERT INTO public.menu_items
  (id,shop_id,name,price,description,category,is_available,customizations)
VALUES
 ('stg-test-item-kota-open','stg-test-shop-open',
  'STAGING TEST Kota R25',25.00,'Synthetic menu price only','Kota',true,'[]'),
 ('stg-test-item-drink-open','stg-test-shop-open',
  'STAGING TEST Drink R10',10.00,'Synthetic menu price only','Drink',true,'[]'),
 ('stg-test-item-kota-closed','stg-test-shop-closed',
  'STAGING TEST Closed Shop Kota',25.00,'Browseable menu, not orderable','Kota',true,'[]');

COMMIT;
