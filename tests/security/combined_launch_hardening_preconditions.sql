-- Disposable PostgreSQL 17 test only. Never run this file on real customer data.
DO $check$
DECLARE f text;
BEGIN
 IF to_regprocedure('public.handle_new_user()') IS NULL
    OR to_regprocedure('public.nudge_rider(uuid,text)') IS NULL
    OR to_regprocedure('public.nudge_rider_by_id(uuid,bigint,text)') IS NULL
    OR to_regclass('public.rider_notifications') IS NULL
 THEN
   RAISE EXCEPTION 'COMBINED_SECURITY_FIXTURE_MISSING_OBJECTS';
 END IF;

 SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure) INTO f;
 IF position('raw_user_meta_data->>''role''' IN f)=0
    OR NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgname='on_auth_user_created'
        AND tgrelid='auth.users'::regclass
        AND tgfoid='public.handle_new_user()'::regprocedure
        AND tgenabled='O')
 THEN
   RAISE EXCEPTION 'COMBINED_SECURITY_SIGNUP_BASELINE_NOT_REPRODUCED';
 END IF;

 IF NOT EXISTS(SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='rider_notifications'
        AND policyname='Rider notifications access'
        AND cmd='ALL' AND qual='true' AND with_check='true')
    OR NOT has_table_privilege('anon','public.rider_notifications','SELECT')
    OR NOT has_function_privilege('authenticated','public.nudge_rider_by_id(uuid,bigint,text)','EXECUTE')
 THEN
   RAISE EXCEPTION 'COMBINED_SECURITY_RIDER_BASELINE_NOT_REPRODUCED';
 END IF;
END $check$;
