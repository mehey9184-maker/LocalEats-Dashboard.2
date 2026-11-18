-- Run only against an isolated PostgreSQL fixture.
DO $$
BEGIN
 IF has_table_privilege('anon','public.customer_push_test_attempts','SELECT')
 OR has_table_privilege('authenticated','public.customer_push_test_attempts','INSERT')
 OR has_function_privilege('anon','public.claim_customer_push_test_attempt(text)','EXECUTE')
 OR has_function_privilege('authenticated','public.claim_customer_push_test_attempt(text)','EXECUTE')
 THEN RAISE EXCEPTION 'browser role can access quota'; END IF;
END $$;
SET ROLE service_role;
DO $$
DECLARE i integer;
BEGIN
 IF NOT public.claim_customer_push_test_attempt('fixture-customer') THEN
   RAISE EXCEPTION 'initial claim should succeed'; END IF;
 IF public.claim_customer_push_test_attempt('fixture-customer') THEN
   RAISE EXCEPTION 'immediate duplicate should fail'; END IF;
 FOR i IN 1..9 LOOP
   UPDATE public.customer_push_test_attempts
      SET last_attempt_at=clock_timestamp()-interval '70 seconds'
      WHERE firebase_uid='fixture-customer';
   IF NOT public.claim_customer_push_test_attempt('fixture-customer') THEN
     RAISE EXCEPTION 'premature UTC daily quota %',i; END IF;
 END LOOP;
 UPDATE public.customer_push_test_attempts
    SET last_attempt_at=clock_timestamp()-interval '70 seconds'
    WHERE firebase_uid='fixture-customer';
 IF public.claim_customer_push_test_attempt('fixture-customer') THEN
   RAISE EXCEPTION 'UTC day cap exceeded'; END IF;
END $$;
RESET ROLE;
