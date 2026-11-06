-- Assertions run after the reviewed transaction in isolated CI only.
INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES (
 '22222222-2222-4222-8222-222222222222','after@example.invalid',
 '{"full_name":"After","role":"admin"}'
);
INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES (
 '33333333-3333-4333-8333-333333333333','another@example.invalid',
 '{"role":"merchant"}'
);
DO $assert$
BEGIN
 IF (SELECT role FROM public.profiles WHERE user_id='22222222-2222-4222-8222-222222222222') <> 'customer'
 OR (SELECT role FROM public.profiles WHERE user_id='33333333-3333-4333-8333-333333333333') <> 'customer'
 THEN RAISE EXCEPTION 'SYNTHETIC_SIGNUP_ROLE_PRIVILEGE_ESCALATION'; END IF;
 IF (SELECT role FROM public.profiles WHERE user_id='11111111-1111-4111-8111-111111111111') <> 'admin'
 THEN RAISE EXCEPTION 'SYNTHETIC_EXISTING_ROLE_MUST_NOT_BE_OVERWRITTEN_BY_REVIEW_PATCH'; END IF;
 IF has_function_privilege('anon','public.handle_new_user()','EXECUTE')
 OR has_function_privilege('authenticated','public.handle_new_user()','EXECUTE')
 THEN RAISE EXCEPTION 'SYNTHETIC_SIGNUP_RPC_EXECUTE_NOT_REVOKED'; END IF;
END $assert$;
SELECT 'SYNTHETIC_SIGNUP_ROLE_SECURITY_PASS' AS result;
