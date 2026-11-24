-- REVIEW DRAFT ONLY — no hosted application or migration authorization.
-- ADR-016: remove ONLY the obsolete town-text guard. Existing API controlled-shop/customer
-- allowlist and write gate remain mandatory; 4km, shop approval, locks, fees and event facts stay.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $patch$
DECLARE
 f oid := to_regprocedure('public.pickup_create_order(text,text,jsonb)');
 before_body text; after_body text; original_def text; revised_def text; original_acl aclitem[];
 original_owner oid; original_config text[];
 legacy text := $legacy$  if sh.location is null or sh.location !~* '\m(tembisa|thembisa|ivory[[:space:]]+park)\M' then raise exception 'OUTSIDE_PICKUP_PILOT'; end if;$legacy$;
BEGIN
 IF f IS NULL THEN RAISE EXCEPTION 'H2D1_PICKUP_FUNCTION_MISSING'; END IF;
 SELECT prosrc,proacl,proowner,proconfig INTO before_body,original_acl,original_owner,original_config FROM pg_proc WHERE oid=f;
 IF encode(sha256(convert_to(before_body,'UTF8')),'hex') IS DISTINCT FROM
  'd876b99ff69718b9aed46ebe4b0f8074eb762454f237728e0f13a5a2b87d0b0d'
 THEN RAISE EXCEPTION 'H2D1_PICKUP_FUNCTION_DRIFT'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid=f) OR
    has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE') OR
    NOT has_function_privilege('service_role',f,'EXECUTE') THEN RAISE EXCEPTION 'H2D1_PICKUP_AUTHORITY_DRIFT'; END IF;
 IF (length(before_body)-length(replace(before_body,legacy,'')))<>length(legacy) THEN
  RAISE EXCEPTION 'H2D1_EXPECT_EXACTLY_ONE_LEGACY_GUARD'; END IF;
 original_def := pg_get_functiondef(f);
 revised_def := replace(original_def,legacy,'');
 IF revised_def=original_def THEN RAISE EXCEPTION 'H2D1_DEFINITION_UNCHANGED'; END IF;
 EXECUTE revised_def;
 SELECT prosrc INTO after_body FROM pg_proc WHERE oid=f;
 IF after_body IS DISTINCT FROM replace(before_body,legacy,'') OR
    position('OUTSIDE_PICKUP_RADIUS' in after_body)=0 OR
    position('OUTSIDE_PICKUP_PILOT' in after_body)>0 OR
    NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=f AND proacl IS NOT DISTINCT FROM original_acl
      AND proowner=original_owner AND proconfig IS NOT DISTINCT FROM original_config AND NOT prosecdef)
 THEN RAISE EXCEPTION 'H2D1_UNEXPECTED_FUNCTION_CHANGE'; END IF;
END;
$patch$;
COMMIT;
