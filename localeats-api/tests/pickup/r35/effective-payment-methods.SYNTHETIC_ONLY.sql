-- R3.5 EFFECTIVE_PICKUP_PAYMENT_METHODS.SYNTHETIC_ONLY.sql
-- NEVER RUN ON ANY CONNECTED SUPABASE DATABASE OR IN supabase/migrations.
-- OBSERVED BEHAVIOR RECONSTRUCTION, **NOT** the original applied migration.
--
-- Read-only pg_catalog snapshot 2026-11-08:
-- live public.shops.pickup_payment_methods text[] nullable, default NULL;
-- live CHECK shops_pickup_payment_methods_valid NOT VALID;
-- live BEFORE INSERT orders trigger pickup_payment_method_before_insert;
-- live functions: pickup_payment_method_guard() and
-- merchant_set_pickup_payment_methods(text,text,text[],text[]).
-- Source function fingerprints checked separately at runtime.
BEGIN;

ALTER TABLE public.shops
  ADD COLUMN pickup_payment_methods text[],
  ADD CONSTRAINT shops_pickup_payment_methods_valid CHECK (
    pickup_payment_methods IS NULL OR (
      cardinality(pickup_payment_methods) BETWEEN 1 AND 2 AND
      array_ndims(pickup_payment_methods)=1 AND
      array_lower(pickup_payment_methods,1)=1 AND
      array_position(pickup_payment_methods,NULL::text) IS NULL AND
      pickup_payment_methods <@ ARRAY['cash','card_machine']::text[] AND
      (cardinality(pickup_payment_methods)=1 OR
        pickup_payment_methods[1]<>pickup_payment_methods[2])
    )
  ) NOT VALID;

-- Effective Production function body was retrieved via pg_get_functiondef
-- using SELECT only; no user data or account tokens were read.
CREATE FUNCTION public.pickup_payment_method_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
declare methods text[];
begin
  if new.delivery_type is distinct from 'collection' then return new; end if;
  if new.payment_method is null or new.payment_method not in ('cash','card_machine') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;
  select pickup_payment_methods into methods from public.shops where id::text=new.shop_id::text for share;
  if not found or methods is null then raise exception 'PAYMENT_METHOD_CONFIGURATION_UNAVAILABLE'; end if;
  if not (new.payment_method=any(methods)) then raise exception 'UNSUPPORTED_PAYMENT_METHOD'; end if;
  return new;
end;
$function$;

CREATE TRIGGER pickup_payment_method_before_insert
  BEFORE INSERT ON public.orders FOR EACH ROW
  EXECUTE FUNCTION public.pickup_payment_method_guard();

CREATE FUNCTION public.merchant_set_pickup_payment_methods(
 p_uid text,p_shop_id text,p_payment_methods text[],p_expected_methods text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
declare s public.shops%rowtype;
begin
  if current_user not in ('service_role','postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED'; end if;
  if p_uid is null or btrim(p_uid)='' or p_shop_id is null or btrim(p_shop_id)=''
    or p_payment_methods is null or cardinality(p_payment_methods) not between 1 and 2
    or array_ndims(p_payment_methods)<>1 or array_lower(p_payment_methods,1)<>1
    or array_position(p_payment_methods,null::text) is not null
    or not (p_payment_methods <@ array['cash','card_machine']::text[])
    or (cardinality(p_payment_methods)=2 and p_payment_methods[1]=p_payment_methods[2])
    or (p_expected_methods is not null and (cardinality(p_expected_methods) not between 1 and 2
      or array_ndims(p_expected_methods)<>1 or array_lower(p_expected_methods,1)<>1
      or array_position(p_expected_methods,null::text) is not null
      or not (p_expected_methods <@ array['cash','card_machine']::text[])
      or (cardinality(p_expected_methods)=2 and p_expected_methods[1]=p_expected_methods[2]))) then
    raise exception 'INVALID_PAYMENT_METHODS';
  end if;
  select * into s from public.shops where id::text=p_shop_id for update;
  if not found or s.owner_id is distinct from p_uid or s.archived_at is not null then raise exception 'FORBIDDEN'; end if;
  if s.pickup_payment_methods is distinct from p_expected_methods then raise exception 'PAYMENT_METHODS_CHANGED'; end if;
  update public.shops set pickup_payment_methods=p_payment_methods where id::text=p_shop_id returning * into s;
  return to_jsonb(s);
end;
$function$;

REVOKE ALL ON FUNCTION public.pickup_payment_method_guard(),
  public.merchant_set_pickup_payment_methods(text,text,text[],text[])
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pickup_payment_method_guard(),
  public.merchant_set_pickup_payment_methods(text,text,text[],text[])
  TO service_role;
GRANT UPDATE(pickup_payment_methods) ON public.shops TO service_role;
COMMIT;
