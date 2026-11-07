-- Disposable PostgreSQL 17 test only.
DO $check$
DECLARE body text; n integer;
BEGIN
 SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure) INTO body;
 IF position('raw_user_meta_data->>''role''' IN body)>0
    OR position('''customer''' IN body)=0
    OR has_function_privilege('anon','public.handle_new_user()','EXECUTE')
    OR has_function_privilege('authenticated','public.handle_new_user()','EXECUTE')
 THEN RAISE EXCEPTION 'COMBINED_SECURITY_SIGNUP_POSTCONDITION_FAILED'; END IF;

 IF (SELECT role FROM public.profiles
    WHERE user_id='11111111-1111-4111-8111-111111111111')<>'admin'
    OR (SELECT role FROM public.profiles
    WHERE user_id='22222222-2222-4222-8222-222222222222')<>'customer'
    OR (SELECT role FROM public.profiles
    WHERE user_id='33333333-3333-4333-8333-333333333333')<>'customer'
 THEN RAISE EXCEPTION 'COMBINED_SECURITY_CUSTOMER_ROLE_OR_LEGACY_ROLE_CHANGED'; END IF;

 IF has_table_privilege('anon','public.rider_notifications','SELECT')
    OR has_table_privilege('authenticated','public.rider_notifications','INSERT')
    OR has_function_privilege('anon','public.nudge_rider(uuid,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.nudge_rider_by_id(uuid,bigint,text)','EXECUTE')
    OR NOT has_table_privilege('service_role','public.rider_notifications','SELECT')
    OR NOT has_function_privilege('service_role','public.nudge_rider_by_id(uuid,bigint,text)','EXECUTE')
 THEN RAISE EXCEPTION 'COMBINED_SECURITY_RIDER_GRANTS_POSTCONDITION_FAILED'; END IF;

 SELECT count(*) INTO n FROM pg_policies
 WHERE schemaname='public' AND tablename='rider_notifications';
 IF n<>0 THEN RAISE EXCEPTION 'COMBINED_SECURITY_RIDER_POLICY_NOT_REMOVED'; END IF;
END $check$;
SELECT 'COMBINED_POSTGRES_17_SECURITY_REHEARSAL_PASS' AS result;
