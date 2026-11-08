-- R3.8 SYNTHETIC_ONLY. Never run on connected Supabase or in active migrations.
-- Reduced schema reproduces observed legacy public.payments columns and
-- current broad authenticated ALL/USING true/WITH CHECK true RLS policy.
-- Separate backend interface will be required before any real policy change.
BEGIN;
CREATE ROLE r38_authenticated NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r38_anon NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r38_backend NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE SCHEMA r38_lab;
REVOKE ALL ON SCHEMA r38_lab FROM PUBLIC;
GRANT USAGE ON SCHEMA r38_lab TO r38_authenticated,r38_anon,r38_backend;
CREATE TABLE r38_lab.payments(
 id uuid PRIMARY KEY,
 shop_id bigint,
 amount numeric NOT NULL,
 payment_method text NOT NULL,
 transaction_id text,
 status text NOT NULL,
 payment_date timestamptz
);
INSERT INTO r38_lab.payments(id,shop_id,amount,payment_method,transaction_id,status)
VALUES
 ('00000000-0000-4000-8000-000000000381',101,2500,'cash','TESTONLY-1','paid'),
 ('00000000-0000-4000-8000-000000000382',202,1750,'cash','TESTONLY-2','paid');
ALTER TABLE r38_lab.payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON r38_lab.payments TO r38_authenticated;
CREATE POLICY "Payments access" ON r38_lab.payments FOR ALL TO r38_authenticated
 USING (true) WITH CHECK (true);
GRANT SELECT ON r38_lab.payments TO r38_backend;
CREATE POLICY r38_backend_read ON r38_lab.payments FOR SELECT TO r38_backend USING (true);
COMMIT;
\echo R38_FAKE_BROAD_PAYMENT_POLICY_INSTALLED
