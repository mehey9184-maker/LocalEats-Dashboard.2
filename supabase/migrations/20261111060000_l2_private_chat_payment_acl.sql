-- LocalEats L2: harden private chat and legacy payment Data API access.
-- Production-safe, fail-closed: no user rows are inserted, updated or deleted.
-- Preserves explicit service_role backend table permissions and RLS.
-- Based on tested R3.9 payment + L2 chat synthetic authorization rehearsals.
-- Requires exact previously audited policies; drift aborts the transaction.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regclass('public.chat_messages') IS NULL
    OR to_regclass('public.payments') IS NULL THEN
    RAISE EXCEPTION 'L2_MISSING_PRIVATE_TABLE';
  END IF;
  IF (SELECT relrowsecurity FROM pg_catalog.pg_class
      WHERE oid='public.chat_messages'::regclass) IS DISTINCT FROM true
    OR (SELECT relrowsecurity FROM pg_catalog.pg_class
      WHERE oid='public.payments'::regclass) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'L2_PRIVATE_TABLE_RLS_MUST_BE_ENABLED';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='chat_messages') <> 2
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='chat_messages'
        AND policyname='Allow all on chat_messages' AND cmd='ALL'
        AND roles=ARRAY['public']::name[] AND qual='true' AND with_check='true')
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='chat_messages'
        AND policyname='Chat message access' AND cmd='ALL'
        AND roles=ARRAY['public']::name[] AND qual='true' AND with_check='true') THEN
    RAISE EXCEPTION 'L2_CHAT_POLICIES_DRIFTED';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='payments') <> 1
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='payments'
        AND policyname='Payments access' AND cmd='ALL'
        AND roles=ARRAY['authenticated']::name[] AND qual='true' AND with_check='true') THEN
    RAISE EXCEPTION 'L2_PAYMENTS_POLICY_DRIFTED';
  END IF;
  IF NOT (
    has_table_privilege('service_role','public.chat_messages','SELECT') AND
    has_table_privilege('service_role','public.chat_messages','INSERT') AND
    has_table_privilege('service_role','public.chat_messages','UPDATE') AND
    has_table_privilege('service_role','public.chat_messages','DELETE') AND
    has_table_privilege('service_role','public.payments','SELECT') AND
    has_table_privilege('service_role','public.payments','INSERT') AND
    has_table_privilege('service_role','public.payments','UPDATE') AND
    has_table_privilege('service_role','public.payments','DELETE')
  ) THEN RAISE EXCEPTION 'L2_SERVER_ROLE_NEEDS_EXPLICIT_PRIVILEGES'; END IF;
END
$preflight$;

REVOKE ALL PRIVILEGES ON TABLE public.chat_messages FROM PUBLIC, anon, authenticated;
DROP POLICY "Allow all on chat_messages" ON public.chat_messages;
DROP POLICY "Chat message access" ON public.chat_messages;

REVOKE ALL PRIVILEGES ON TABLE public.payments FROM PUBLIC, anon, authenticated;
DROP POLICY "Payments access" ON public.payments;

DO $postflight$
DECLARE table_name text;
DECLARE role_name text;
DECLARE privilege_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['chat_messages','payments'] LOOP
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
        IF has_table_privilege(role_name,'public.'||table_name,privilege_name) THEN
          RAISE EXCEPTION 'L2_BROWSER_PRIVILEGE_REMAINS_%.%_%',role_name,table_name,privilege_name;
        END IF;
      END LOOP;
    END LOOP;
    FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF NOT has_table_privilege('service_role','public.'||table_name,privilege_name) THEN
        RAISE EXCEPTION 'L2_SERVER_PRIVILEGE_LOST_%.%',table_name,privilege_name;
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies
               WHERE schemaname='public' AND tablename=table_name) THEN
      RAISE EXCEPTION 'L2_BROAD_POLICY_REMAINS_%',table_name;
    END IF;
  END LOOP;
END
$postflight$;

COMMIT;
