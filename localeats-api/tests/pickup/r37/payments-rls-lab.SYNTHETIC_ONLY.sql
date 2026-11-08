-- R3.7 synthetic PostgreSQL 17 reproduction of a LIVE RLS policy weakness.
-- Never run on a Supabase database, never copy real payments/customer records.
-- Observed read-only 2026-11-08: public.payments has SELECT/INSERT/UPDATE/
-- DELETE grants for authenticated AND an ALL/USING true/WITH CHECK true policy.
BEGIN;
CREATE ROLE r37_authenticated NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r37_anon NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r37_service NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE SCHEMA r37_lab;
REVOKE ALL ON SCHEMA r37_lab FROM PUBLIC;
GRANT USAGE ON SCHEMA r37_lab TO r37_authenticated,r37_anon,r37_service;
CREATE TABLE r37_lab.payments(
 id bigint PRIMARY KEY,
 shop_id bigint,
 amount numeric NOT NULL,
 payment_method text NOT NULL,
 status text NOT NULL
);
INSERT INTO r37_lab.payments VALUES
 (1,101,2500,'cash','paid'),
 (2,202,1750,'cash','paid');
ALTER TABLE r37_lab.payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON r37_lab.payments
 TO r37_anon,r37_authenticated;
CREATE POLICY payments_access ON r37_lab.payments FOR ALL
 TO r37_authenticated USING (true) WITH CHECK (true);
-- A completely separate hypothetical service role should be able to inspect.
GRANT SELECT ON r37_lab.payments TO r37_service;
CREATE POLICY service_select ON r37_lab.payments FOR SELECT
 TO r37_service USING (true);
COMMIT;

DO $preflight$
BEGIN
 IF (SELECT count(*) FROM r37_lab.payments)<>2
 THEN RAISE EXCEPTION 'R37_FAKE_PAYMENTS_NOT_SEEDED';END IF;
 IF NOT has_table_privilege('r37_authenticated','r37_lab.payments','UPDATE')
 OR NOT has_table_privilege('r37_authenticated','r37_lab.payments','INSERT')
 OR NOT has_table_privilege('r37_authenticated','r37_lab.payments','DELETE')
 OR NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='r37_lab'
   AND tablename='payments' AND policyname='payments_access'
   AND cmd='ALL' AND qual='true' AND with_check='true'
 ) THEN RAISE EXCEPTION 'R37_LAB_DOES_NOT_REPRODUCE_CURRENT_BROAD_POLICY'; END IF;
END;
$preflight$;
\echo R37_SYNTHETIC_BROAD_POLICY_INSTALLED
