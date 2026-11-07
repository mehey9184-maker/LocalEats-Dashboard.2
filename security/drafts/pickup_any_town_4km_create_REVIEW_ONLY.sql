-- REVIEW ONLY. NEVER apply to Production or connected staging without separate
-- explicit owner approval, fresh schema/privilege preflight and verified backup.
-- Exact-source, fail-closed removal of a single obsolete township-name check.
-- Public pickup_create_order remains SECURITY INVOKER and server-role-only.
-- Baseline source verified read-only 2026-11-07 against Production PG prosrc
-- and the existing supabase/drafts/pickup_zero_fee.sql function body.
-- This file is intentionally NOT under supabase/migrations.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $patch$
declare
  v_oid oid := to_regprocedure('public.pickup_create_order(text,text,jsonb)');
  v_prosrc text;
  v_definition text;
  v_guard text := $town$  if sh.location is null or sh.location !~* '\m(tembisa|thembisa|ivory[[:space:]]+park)\M' then raise exception 'OUTSIDE_PICKUP_PILOT'; end if;
$town$;
  v_updated text;
  v_owner oid;
  v_definer boolean;
  v_volatile "char";
  v_options text[];
  v_oldsha text;
begin
  if v_oid is null then
    raise exception 'PICKUP_ANY_TOWN_FUNCTION_MISSING';
  end if;
  select p.prosrc, pg_get_functiondef(p.oid), p.proowner, p.prosecdef,
         p.provolatile, p.proconfig
    into v_prosrc, v_definition, v_owner, v_definer, v_volatile, v_options
    from pg_proc p where p.oid = v_oid;

  v_oldsha := encode(sha256(convert_to(v_prosrc,'UTF8')),'hex');
  if v_oldsha is distinct from
      'd876b99ff69718b9aed46ebe4b0f8074eb762454f237728e0f13a5a2b87d0b0d'
     or v_owner::regrole::text <> 'postgres'
     or v_definer is distinct from false
     or v_volatile is distinct from 'v'
     or ('search_path=""' = any(v_options)) is distinct from true
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or not has_function_privilege('service_role',v_oid,'EXECUTE')
  then
    raise exception 'PICKUP_ANY_TOWN_BASELINE_OR_GRANTS_DRIFT';
  end if;

  -- Exactly one old check must be present, including its original newline.
  -- A wrong version or a second matching guard cannot be silently rewritten.
  if length(v_prosrc)-length(replace(v_prosrc,v_guard,'')) <> length(v_guard)
     or length(v_definition)-length(replace(v_definition,v_guard,'')) <> length(v_guard)
  then
    raise exception 'PICKUP_ANY_TOWN_GUARD_DRIFT';
  end if;

  -- CREATE OR REPLACE from the installed definition preserves original grants,
  -- owner, security-invoker mode, immutable business/financial checks and types.
  execute replace(v_definition,v_guard,'');

  select p.prosrc, p.proowner, p.prosecdef, p.provolatile, p.proconfig
    into v_updated, v_owner, v_definer, v_volatile, v_options
    from pg_proc p where p.oid=v_oid;
  if v_updated is distinct from replace(v_prosrc,v_guard,'')
     or encode(sha256(convert_to(v_updated,'UTF8')),'hex') is distinct from
        'd4f2f67aa2ff03120d4de27a4860f56defd770cf3c53016a1759709737da4eb1'
     or v_owner::regrole::text <> 'postgres'
     or v_definer is distinct from false
     or v_volatile is distinct from 'v'
     or ('search_path=""' = any(v_options)) is distinct from true
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or not has_function_privilege('service_role',v_oid,'EXECUTE')
  then
    raise exception 'PICKUP_ANY_TOWN_POSTCONDITION_FAILED';
  end if;
end;
$patch$;
commit;
