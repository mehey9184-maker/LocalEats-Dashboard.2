-- LOCAL EATS SECURITY P1 / REVIEW-ONLY SQL DRAFT
-- NOT a Supabase migration. DO NOT APPLY TO PRODUCTION without separate owner approval.
-- Prepared against the read-only 2026-11-04 catalog snapshot. No automatic deploy.
-- Intended effect: deny Data API readers/writers and public privileged RPC calls
-- to the legacy rider notifications table. Preserve server-side service_role access.
-- Requires careful review of app consumers, backup and separately approved cutover.
BEGIN;

DO $gate$
DECLARE
  broad_policy_count integer;
  total_policy_count integer;
BEGIN
  IF to_regclass('public.rider_notifications') IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM pg_class c WHERE c.oid='public.rider_notifications'::regclass
          AND c.relrowsecurity
      ) THEN
    RAISE EXCEPTION 'SECURITY_REVIEW_SCHEMA_DRIFT: rider_notifications missing or RLS off';
  END IF;
  SELECT count(*) INTO total_policy_count
    FROM pg_policies WHERE schemaname='public' AND tablename='rider_notifications';
  SELECT count(*) INTO broad_policy_count
    FROM pg_policies WHERE schemaname='public' AND tablename='rider_notifications'
      AND policyname='Rider notifications access'
      AND cmd='ALL' AND qual='true' AND with_check='true';
  IF total_policy_count<>1 OR broad_policy_count<>1 THEN
    RAISE EXCEPTION 'SECURITY_REVIEW_POLICY_DRIFT: inspect current policies before proceeding';
  END IF;
  IF to_regprocedure('public.nudge_rider(uuid,text)') IS NULL
     OR to_regprocedure('public.nudge_rider_by_id(uuid,bigint,text)') IS NULL THEN
    RAISE EXCEPTION 'SECURITY_REVIEW_FUNCTION_DRIFT: inspect actual function signatures first';
  END IF;
END;
$gate$;

-- Direct public table privileges + permissive RLS together permitted all rows.
-- Remove both, even if the service-role API is the only intended consumer.
REVOKE ALL PRIVILEGES ON TABLE public.rider_notifications FROM PUBLIC, anon, authenticated;
DROP POLICY "Rider notifications access" ON public.rider_notifications;

-- These are SECURITY DEFINER functions. Merely relying on RLS would not stop them.
REVOKE EXECUTE ON FUNCTION public.nudge_rider(uuid,text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.nudge_rider_by_id(uuid,bigint,text)
  FROM PUBLIC, anon, authenticated;

-- Retain explicitly limited server-side authority. The Supabase service_role
-- bypasses RLS; never distribute its credential to a browser or rider app.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rider_notifications
  TO service_role;
GRANT EXECUTE ON FUNCTION public.nudge_rider(uuid,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.nudge_rider_by_id(uuid,bigint,text)
  TO service_role;

DO $assert$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(role_name,'public.rider_notifications','SELECT')
       OR has_table_privilege(role_name,'public.rider_notifications','INSERT')
       OR has_table_privilege(role_name,'public.rider_notifications','UPDATE')
       OR has_table_privilege(role_name,'public.rider_notifications','DELETE')
       OR has_function_privilege(role_name,'public.nudge_rider(uuid,text)','EXECUTE')
       OR has_function_privilege(role_name,'public.nudge_rider_by_id(uuid,bigint,text)','EXECUTE') THEN
      RAISE EXCEPTION 'SECURITY_REVIEW_POSTCONDITION_FAILED: role % retains unauthorized access',role_name;
    END IF;
  END LOOP;
  IF NOT has_table_privilege('service_role','public.rider_notifications','SELECT')
     OR NOT has_table_privilege('service_role','public.rider_notifications','INSERT')
     OR NOT has_function_privilege('service_role','public.nudge_rider(uuid,text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.nudge_rider_by_id(uuid,bigint,text)','EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rider_notifications') THEN
    RAISE EXCEPTION 'SECURITY_REVIEW_POSTCONDITION_FAILED: service access or RLS policy unexpected';
  END IF;
END;
$assert$;

COMMIT;
