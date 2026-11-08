-- R4.2: Synthetic legacy payments within the real archived pickup migration rehearsal.
-- Only run in disposable PostgreSQL 17; not a hosted Supabase migration.
-- The legacy payments.shop_id is bigint while the pickup shops.id is text.
-- The numeric text IDs here are a *fixture*, not evidence all live shops map this way.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public.shops(id,owner_id,name,is_active,approval_status)
VALUES
 ('101','R42_FAKE_MERCHANT_A','Synthetic numeric-id shop A',false,'approved'),
 ('202','R42_FAKE_MERCHANT_B','Synthetic numeric-id shop B',false,'approved');

CREATE TABLE public.payments (
 id uuid PRIMARY KEY,
 shop_id bigint NOT NULL,
 amount numeric NOT NULL,
 payment_method text NOT NULL,
 transaction_id text,
 status text NOT NULL,
 payment_date timestamptz
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO anon, authenticated;
GRANT SELECT ON public.payments TO service_role;
CREATE POLICY "Payments access" ON public.payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.payments(id,shop_id,amount,payment_method,transaction_id,status)
VALUES
 ('00000000-0000-4000-8000-000000009101',101,2500,'cash','R42_FAKE_A','paid'),
 ('00000000-0000-4000-8000-000000009102',202,1750,'cash','R42_FAKE_B','paid');
COMMIT;
\echo R42_FAKE_LEGACY_PAYMENTS_LOADED