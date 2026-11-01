begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.shops') is null or to_regclass('public.orders') is null
    or not exists (select 1 from pg_catalog.pg_attribute where attrelid='public.shops'::regclass and attname='id' and not attisdropped)
    or not exists (select 1 from pg_catalog.pg_attribute where attrelid='public.shops'::regclass and attname='owner_id' and not attisdropped)
    or not exists (select 1 from pg_catalog.pg_attribute where attrelid='public.orders'::regclass and attname='delivery_type' and not attisdropped)
    or not exists (select 1 from pg_catalog.pg_attribute where attrelid='public.orders'::regclass and attname='payment_method' and not attisdropped) then
    raise exception 'PICKUP_PAYMENT_SCHEMA_MISMATCH';
  end if;
  if exists (select 1 from pg_catalog.pg_attribute where attrelid='public.shops'::regclass and attname='pickup_payment_methods' and not attisdropped)
    or to_regprocedure('public.merchant_set_pickup_payment_methods(text,text,text[],text[])') is not null
    or to_regprocedure('public.pickup_payment_method_guard()') is not null then
    raise exception 'PICKUP_PAYMENT_MIGRATION_ALREADY_PRESENT';
  end if;
end;
$preflight$;

alter table public.shops add column pickup_payment_methods text[];
alter table public.shops add constraint shops_pickup_payment_methods_valid check (
  pickup_payment_methods is null or (
    cardinality(pickup_payment_methods) between 1 and 2
    and pickup_payment_methods <@ array['cash','card_machine']::text[]
    and (cardinality(pickup_payment_methods)=1 or pickup_payment_methods[1]<>pickup_payment_methods[2])
  )
) not valid;

create function public.pickup_payment_method_guard()
returns trigger language plpgsql security invoker set search_path = '' as $guard$
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
$guard$;

create function public.merchant_set_pickup_payment_methods(
  p_uid text,p_shop_id text,p_payment_methods text[],p_expected_methods text[]
) returns jsonb language plpgsql security invoker set search_path = '' as $set_methods$
declare s public.shops%rowtype;
begin
  if current_user not in ('service_role','postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED'; end if;
  if p_uid is null or btrim(p_uid)='' or p_shop_id is null or btrim(p_shop_id)=''
    or p_payment_methods is null or cardinality(p_payment_methods) not between 1 and 2
    or not (p_payment_methods <@ array['cash','card_machine']::text[])
    or (cardinality(p_payment_methods)=2 and p_payment_methods[1]=p_payment_methods[2])
    or (p_expected_methods is not null and (cardinality(p_expected_methods) not between 1 and 2
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
$set_methods$;

create trigger pickup_payment_method_before_insert
before insert on public.orders for each row execute function public.pickup_payment_method_guard();

revoke all on function public.pickup_payment_method_guard(),
  public.merchant_set_pickup_payment_methods(text,text,text[],text[]) from public,anon,authenticated;
grant execute on function public.pickup_payment_method_guard(),
  public.merchant_set_pickup_payment_methods(text,text,text[],text[]) to service_role;
grant select(pickup_payment_methods),update(pickup_payment_methods) on public.shops to service_role;

commit;