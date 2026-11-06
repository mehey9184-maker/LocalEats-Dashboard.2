\set ON_ERROR_STOP on
INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES
('550e8400-e29b-41d4-a716-100000000002','customer@example.test','{"role":"admin","fullName":"New customer","phone":"0712345678"}'::jsonb),
('550e8400-e29b-41d4-a716-100000000003','merchant@example.test','{"role":"rider","fullName":"Ignored existing"}'::jsonb),
('550e8400-e29b-41d4-a716-100000000004','rider@example.test','{"role":"merchant"}'::jsonb);
DO $assert$
BEGIN
 IF (SELECT role FROM public.profiles WHERE user_id='550e8400-e29b-41d4-a716-100000000002')<>'customer'
 OR (SELECT role FROM public.profiles WHERE user_id='550e8400-e29b-41d4-a716-100000000004')<>'customer' THEN
  RAISE EXCEPTION 'Untrusted signup metadata granted an elevated role';
 END IF;
 IF (SELECT role FROM public.profiles WHERE user_id='550e8400-e29b-41d4-a716-100000000003')<>'merchant' THEN
  RAISE EXCEPTION 'Verified existing merchant role was not preserved';
 END IF;
 IF (SELECT "fullName" FROM public.profiles WHERE user_id='550e8400-e29b-41d4-a716-100000000002')<>'New customer' THEN
  RAISE EXCEPTION 'Regular signup profile fields were lost';
 END IF;
 IF has_function_privilege('anon','public.handle_new_user()','EXECUTE')
 OR has_function_privilege('authenticated','public.handle_new_user()','EXECUTE')
 OR NOT has_function_privilege('service_role','public.handle_new_user()','EXECUTE') THEN
  RAISE EXCEPTION 'SECURITY_REVIEW_PRIVILEGE_TEST_FAILED';
 END IF;
END $assert$;
SELECT 'SIGNUP_ROLE_METADATA_LOCKDOWN_ISOLATED_PASS' AS result;
