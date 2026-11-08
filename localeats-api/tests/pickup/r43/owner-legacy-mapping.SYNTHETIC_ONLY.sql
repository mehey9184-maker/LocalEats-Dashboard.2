-- R4.3 only: add synthetic tricky legacy mappings inside R4.2 disposable PG17.
-- This file is NOT an active migration. It assumes R4.2 payment hardening
-- already revoked browser grants; no hosted database access is used.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.shops(id,owner_id,name,is_active,approval_status,archived_at)
VALUES
 ('303','R42_FAKE_MERCHANT_A','Fake archived shop',false,'approved',now()),
 ('0101','R42_FAKE_MERCHANT_A','Fake leading-zero identifier',false,'approved',NULL),
 ('shop-not-a-number','R42_FAKE_MERCHANT_A','Fake modern shop identifier',false,'approved',NULL);
INSERT INTO public.payments(id,shop_id,amount,payment_method,transaction_id,status)
VALUES
 ('00000000-0000-4000-8000-000000009303',303,900,'cash','R43_ARCHIVED_FAKE','paid'),
 ('00000000-0000-4000-8000-000000009304',NULL,500,'cash','R43_NULL_SHOP_FAKE','paid');

DO $r43_mapping$
DECLARE a_count integer;b_count integer;wrong_count integer;archived_count integer;
  nonnumeric_count integer;null_count integer;leading_count integer;
BEGIN
 IF (SELECT data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='payments' AND column_name='shop_id') <> 'bigint'
 OR (SELECT data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='shops' AND column_name='id') <> 'text'
 THEN RAISE EXCEPTION 'R43_LEGACY_SHOP_TYPE_DRIFT'; END IF;

 -- The synthetic JOIN only describes a *candidate*, not a proven real mapping.
 SELECT count(*) INTO a_count FROM public.payments p JOIN public.shops s
 ON s.id=p.shop_id::text
 WHERE s.owner_id='R42_FAKE_MERCHANT_A' AND s.archived_at IS NULL;
 SELECT count(*) INTO b_count FROM public.payments p JOIN public.shops s
 ON s.id=p.shop_id::text
 WHERE s.owner_id='R42_FAKE_MERCHANT_B' AND s.archived_at IS NULL;
 IF a_count<>1 OR b_count<>1
 THEN RAISE EXCEPTION 'R43_SYNTHETIC_OWNER_SCOPING_BROKEN A=% B=%',a_count,b_count; END IF;

 SELECT count(*) INTO wrong_count FROM public.payments p JOIN public.shops s
 ON s.id=p.shop_id::text
 WHERE s.owner_id='R42_FAKE_MERCHANT_A' AND p.shop_id=202;
 SELECT count(*) INTO archived_count FROM public.payments p JOIN public.shops s
 ON s.id=p.shop_id::text
 WHERE s.owner_id='R42_FAKE_MERCHANT_A' AND s.archived_at IS NULL AND p.shop_id=303;
 SELECT count(*) INTO nonnumeric_count FROM public.payments p JOIN public.shops s
 ON s.id=p.shop_id::text WHERE s.id='shop-not-a-number';
 SELECT count(*) INTO null_count FROM public.payments p JOIN public.shops s
 ON s.id=p.shop_id::text WHERE p.shop_id IS NULL;
 SELECT count(*) INTO leading_count FROM public.payments p JOIN public.shops s
 ON s.id=p.shop_id::text WHERE s.id='0101';
 IF wrong_count<>0 OR archived_count<>0 OR nonnumeric_count<>0 OR null_count<>0 OR leading_count<>0
 THEN RAISE EXCEPTION 'R43_LEGACY_OWNER_MAPPING_LEAK'; END IF;

 IF has_table_privilege('authenticated','public.payments','SELECT')
 OR has_table_privilege('anon','public.payments','SELECT')
 THEN RAISE EXCEPTION 'R43_BROWSER_PAYMENT_GRANT_REAPPEARED'; END IF;
END;
$r43_mapping$;
ROLLBACK;
\echo R43_SYNTHETIC_OWNER_MAPPING_NEGATIVES_PASS