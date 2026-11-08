-- R3.8 SYNTHETIC_ONLY restricted future-policy rehearsal.
-- NOT a deployable migration, not an authorized Production policy change.
-- Real Firebase UID authorization must happen at the server API boundary.
BEGIN;
DO $preflight$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_policies
   WHERE schemaname='r38_lab' AND tablename='payments'
     AND policyname='Payments access' AND cmd='ALL'
     AND qual='true' AND with_check='true')
 OR NOT has_table_privilege('r38_authenticated','r38_lab.payments','UPDATE')
 OR NOT has_table_privilege('r38_authenticated','r38_lab.payments','DELETE')
 THEN RAISE EXCEPTION 'R38_EXPECTED_LEGACY_POLICY_DRIFT'; END IF;
END;
$preflight$;
-- The API must provide an authenticated, owner-scoped read method BEFORE
-- making an equivalent real change; never call this from a browser.
REVOKE ALL PRIVILEGES ON TABLE r38_lab.payments
  FROM r38_authenticated,r38_anon;
DROP POLICY "Payments access" ON r38_lab.payments;
-- Restrict owner/privileged bypass as defense in depth in synthetic model.
ALTER TABLE r38_lab.payments FORCE ROW LEVEL SECURITY;
COMMIT;
\echo R38_SYNTHETIC_CLIENT_PAYMENTS_ACCESS_REMOVED
