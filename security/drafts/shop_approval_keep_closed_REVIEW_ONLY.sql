-- REVIEW ONLY. Do not apply to a connected database without separate approval.
-- Approval and reinstatement require a later Merchant opening action.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';

DO $review$
DECLARE
  fn regprocedure := to_regprocedure('public.transition_shop_approval(text,text,text,text,text)');
  definition text;
  body text;
  baseline_hash constant text := '4df239c23ee8fe9997a217a2906024753a3008bb2c865d2cf4b53b7df39f12b4';
  updated_hash constant text := '8431bfdefe1ea3cbab2d93c59245c649638f0c6bccf0c74e08ff95fb7ee4a5f6';
  old_assignment constant text := $old$       set approval_status = v_to_status,
           approval_reason = null
$old$;
  new_assignment constant text := $new$       set approval_status = v_to_status,
           approval_reason = null,
           is_active = false,
           availability_override_until = null
$new$;
BEGIN
  SELECT pg_get_functiondef(p.oid), p.prosrc INTO definition, body
  FROM pg_proc p
  WHERE p.oid = fn
    AND NOT p.prosecdef
    AND p.proowner = 'postgres'::regrole
    AND p.proconfig = ARRAY['search_path=""']
    AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
    AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND has_function_privilege('service_role', p.oid, 'EXECUTE');

  IF encode(sha256(convert_to(body,'UTF8')),'hex') IS DISTINCT FROM baseline_hash
     OR length(body) - length(replace(body,old_assignment,'')) <> length(old_assignment) THEN
    RAISE EXCEPTION 'SHOP_APPROVAL_REVIEW_BASELINE_DRIFT';
  END IF;

  EXECUTE replace(definition,old_assignment,new_assignment);

  IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid=fn)
     IS DISTINCT FROM updated_hash THEN
    RAISE EXCEPTION 'SHOP_APPROVAL_REVIEW_POSTCONDITION_FAILED';
  END IF;
END $review$;

COMMIT;
