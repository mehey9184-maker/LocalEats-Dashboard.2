begin;

-- This migration is intentionally fail-closed. It never invents shop or
-- Firebase identities for legacy rows that cannot satisfy the target model.
alter table public.rider_profiles
  add column if not exists firebase_uid text;

alter table public.orders
  add column if not exists delivery_type text,
  add column if not exists delivery_pin_hash text,
  add column if not exists delivery_qr_hash text,
  add column if not exists delivery_pin_failed_attempts integer,
  add column if not exists delivery_pin_locked_until timestamptz;

do $migration_preflight$
begin
  if not exists (
    select 1
    from pg_catalog.pg_attribute
    where attrelid = 'public.shops'::regclass
      and attname = 'id'
      and atttypid = 'text'::regtype
      and not attisdropped
  ) then
    raise exception using
      errcode = '42804',
      message = 'SHOP_ID_MUST_BE_TEXT';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as primary_key
    join pg_catalog.pg_attribute as id_column
      on id_column.attrelid = primary_key.conrelid
     and id_column.attnum = any (primary_key.conkey)
    where primary_key.conrelid = 'public.rider_profiles'::regclass
      and primary_key.contype = 'p'
      and cardinality(primary_key.conkey) = 1
      and id_column.attname = 'id'
      and id_column.atttypid = 'uuid'::regtype
  ) then
    raise exception using
      errcode = '42804',
      message = 'RIDER_PROFILE_ID_MUST_BE_UUID_PRIMARY_KEY';
  end if;

  if exists (
    select 1
    from public.orders as orders_row
    left join public.shops as shops_row
      on shops_row.id = orders_row.shop_id::text
    where orders_row.shop_id is null or shops_row.id is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'ORDER_SHOP_ID_CONTRACT_VIOLATION';
  end if;

  if exists (
    select 1
    from public.rider_profiles
    where firebase_uid is null
       or btrim(firebase_uid) = ''
       or firebase_uid <> btrim(firebase_uid)
  ) then
    raise exception using
      errcode = '23514',
      message = 'RIDER_FIREBASE_UID_MAPPING_REQUIRED';
  end if;

  if exists (
    select firebase_uid
    from public.rider_profiles
    group by firebase_uid
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'RIDER_FIREBASE_UID_MUST_BE_UNIQUE';
  end if;

  if exists (
    select 1
    from public.rider_profiles
    where verification_status is null
       or verification_status not in ('pending', 'approved', 'rejected', 'verified')
  ) then
    raise exception using
      errcode = '23514',
      message = 'RIDER_VERIFICATION_STATUS_UNSUPPORTED';
  end if;

  if exists (
    select 1
    from public.rider_connections as connections_row
    left join public.shops as shops_row
      on shops_row.id = connections_row.shop_id::text
    left join public.rider_profiles as riders_row
      on riders_row.id = connections_row.rider_id
    where connections_row.shop_id is null
       or shops_row.id is null
       or connections_row.rider_id is null
       or riders_row.id is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'RIDER_CONNECTION_IDENTITY_CONTRACT_VIOLATION';
  end if;

  if exists (
    select 1
    from public.rider_connections
    where status is null
       or status not in ('pending', 'approved', 'rejected', 'active', 'expired', 'offline', 'paused', 'busy')
  ) then
    raise exception using
      errcode = '23514',
      message = 'RIDER_CONNECTION_STATUS_UNSUPPORTED';
  end if;

  if exists (
    select shop_id::text, rider_id
    from public.rider_connections
    group by shop_id::text, rider_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'RIDER_CONNECTION_MUST_BE_UNIQUE';
  end if;

  if exists (
    select 1
    from public.orders
    where idempotency_key is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'ORDER_IDEMPOTENCY_KEY_REQUIRED';
  end if;
end;
$migration_preflight$;

-- Remove only foreign keys involving the columns whose identity contracts are
-- replaced below. Constraint names are discovered rather than guessed.
do $drop_legacy_foreign_keys$
declare
  constraint_row record;
begin
  for constraint_row in
    select distinct constraint_def.conrelid::regclass as table_name, constraint_def.conname
    from pg_catalog.pg_constraint as constraint_def
    join pg_catalog.pg_attribute as column_def
      on column_def.attrelid = constraint_def.conrelid
     and column_def.attnum = any (constraint_def.conkey)
    where constraint_def.contype = 'f'
      and (
        (constraint_def.conrelid = 'public.orders'::regclass and column_def.attname = 'shop_id')
        or
        (constraint_def.conrelid = 'public.rider_connections'::regclass and column_def.attname in ('shop_id', 'rider_id'))
        or
        (
          constraint_def.conrelid = 'public.rider_profiles'::regclass
          and column_def.attname = 'id'
          and constraint_def.confrelid = 'auth.users'::regclass
        )
      )
  loop
    execute format(
      'alter table %s drop constraint %I',
      constraint_row.table_name,
      constraint_row.conname
    );
  end loop;
end;
$drop_legacy_foreign_keys$;

-- Canonical LocalEats shop IDs are text across all dependent commerce tables.
alter table public.orders
  alter column shop_id type text using shop_id::text,
  alter column shop_id set not null;

alter table public.rider_connections
  alter column shop_id type text using shop_id::text,
  alter column shop_id set not null,
  alter column rider_id set not null;

alter table public.orders
  add constraint orders_shop_id_fkey
    foreign key (shop_id) references public.shops(id) on delete restrict;

alter table public.rider_connections
  add constraint rider_connections_shop_id_fkey
    foreign key (shop_id) references public.shops(id) on delete cascade,
  add constraint rider_connections_rider_id_fkey
    foreign key (rider_id) references public.rider_profiles(id) on delete cascade;

create index if not exists orders_shop_id_idx
  on public.orders (shop_id);

create index if not exists rider_connections_rider_id_idx
  on public.rider_connections (rider_id);

alter table public.rider_connections
  drop constraint if exists rider_connections_unique_shop_rider,
  add constraint rider_connections_unique_shop_rider unique (shop_id, rider_id);

-- Rider IDs are internal UUIDs; Firebase UIDs are non-empty external mappings.
alter table public.rider_profiles
  alter column id set default gen_random_uuid(),
  alter column firebase_uid set not null,
  drop constraint if exists rider_profiles_firebase_uid_nonempty,
  add constraint rider_profiles_firebase_uid_nonempty
    check (length(btrim(firebase_uid)) > 0 and firebase_uid = btrim(firebase_uid));

alter table public.rider_profiles
  drop constraint if exists rider_profiles_firebase_uid_key;

drop index if exists public.rider_profiles_firebase_uid_key;

alter table public.rider_profiles
  add constraint rider_profiles_firebase_uid_key unique (firebase_uid),
  alter column verification_status set default 'pending',
  alter column verification_status set not null,
  drop constraint if exists rider_profiles_verification_status_check,
  add constraint rider_profiles_verification_status_check
    check (verification_status in ('pending', 'approved', 'rejected', 'verified'));

-- Legacy operational connection states remain representable, but only the
-- explicit approved state grants claim authority in the RPC below.
alter table public.rider_connections
  alter column status set default 'pending',
  alter column status set not null,
  drop constraint if exists rider_connections_status_check,
  add constraint rider_connections_status_check check (
    status in ('pending', 'approved', 'rejected', 'active', 'expired', 'offline', 'paused', 'busy')
  );

update public.orders
set delivery_type = case
  when lat is not null and lng is not null then 'delivery'
  else 'collection'
end
where delivery_type is null;

update public.orders
set delivery_pin_failed_attempts = 0
where delivery_pin_failed_attempts is null;

alter table public.orders
  alter column delivery_type set default 'collection',
  alter column delivery_type set not null,
  alter column delivery_pin_failed_attempts set default 0,
  alter column delivery_pin_failed_attempts set not null,
  drop constraint if exists orders_delivery_pin_failed_attempts_check,
  add constraint orders_delivery_pin_failed_attempts_check
    check (delivery_pin_failed_attempts >= 0 and delivery_pin_failed_attempts <= 5);

alter table public.orders
  drop constraint if exists orders_delivery_type_check,
  add constraint orders_delivery_type_check
    check (delivery_type in ('collection', 'delivery'));

alter table public.orders
  alter column delivery_status set default 'none';

update public.orders
set delivery_status = 'none'
where delivery_status is null or delivery_status = 'pending';

alter table public.orders
  drop constraint if exists orders_status_check,
  add constraint orders_status_check check (
    status in ('pending', 'preparing', 'ready_for_pickup', 'collected', 'delivered', 'cancelled')
  ),
  drop constraint if exists orders_delivery_status_check,
  add constraint orders_delivery_status_check check (
    delivery_status in ('none', 'finding_rider', 'rider_assigned', 'picked_up', 'delivering', 'delivered', 'cancelled')
  );

update public.orders
set payment_method = 'cash_on_arrival'
where payment_method = 'cash_on_delivery';

alter table public.orders
  alter column payment_method set default 'cash_on_arrival',
  drop constraint if exists orders_payment_method_check,
  add constraint orders_payment_method_check check (
    payment_method in ('cash', 'cash_on_arrival', 'card_machine')
  ),
  alter column idempotency_key set not null;

-- Browser-facing roles have no direct table authority. The Firebase-authenticated
-- LocalEats API uses service_role and performs application authorization first.
do $drop_browser_policies$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('orders', 'rider_profiles', 'rider_connections')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$drop_browser_policies$;

alter table public.orders enable row level security;
alter table public.rider_profiles enable row level security;
alter table public.rider_connections enable row level security;

revoke all privileges on table
  public.orders,
  public.rider_profiles,
  public.rider_connections
from public, anon, authenticated;

revoke all privileges on table
  public.orders,
  public.rider_profiles,
  public.rider_connections
from service_role;

grant select, insert, update on table public.orders to service_role;
grant select, update on table public.rider_profiles to service_role;
grant select on table public.rider_connections to service_role;

create or replace function public.claim_delivery_order(
  p_order_id uuid,
  p_firebase_uid text
)
returns setof public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rider public.rider_profiles%rowtype;
  v_order public.orders%rowtype;
begin
  select * into v_rider
  from public.rider_profiles
  where firebase_uid = p_firebase_uid
    and is_online is true
    and verification_status = 'approved'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Rider is not approved and online';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found';
  end if;

  if v_order.delivery_status <> 'finding_rider' or v_order.rider_id is not null then
    raise exception using errcode = '40001', message = 'Order is no longer available';
  end if;

  perform 1
  from public.rider_connections
  where shop_id = v_order.shop_id
    and rider_id = v_rider.id
    and status = 'approved'
    and (expires_at is null or expires_at > now())
  for key share;

  if not found then
    raise exception using errcode = '42501', message = 'Rider is not approved for this shop';
  end if;

  return query
  update public.orders
  set rider_id = v_rider.id,
      delivery_status = 'rider_assigned',
      updated_at = now()
  where id = p_order_id
    and rider_id is null
    and delivery_status = 'finding_rider'
  returning *;

  if not found then
    raise exception using errcode = '40001', message = 'Order was claimed by another rider';
  end if;
end;
$$;

drop function if exists public.complete_delivery_order(uuid, text, text);

create function public.complete_delivery_order(
  p_order_id uuid,
  p_firebase_uid text,
  p_delivery_proof_kind text,
  p_delivery_proof_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rider public.rider_profiles%rowtype;
  v_order public.orders%rowtype;
  v_now timestamptz := statement_timestamp();
  v_failed_attempts integer;
  v_locked_until timestamptz;
  v_retry_after integer;
begin
  select * into v_rider
  from public.rider_profiles
  where firebase_uid = p_firebase_uid
    and verification_status = 'approved'
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error_code', 'RIDER_NOT_APPROVED',
      'replayed', false
    );
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error_code', 'ORDER_NOT_FOUND',
      'replayed', false
    );
  end if;

  if v_order.rider_id is distinct from v_rider.id then
    return jsonb_build_object(
      'success', false,
      'error_code', 'RIDER_NOT_ASSIGNED',
      'replayed', false
    );
  end if;

  if v_order.delivery_status = 'delivered' then
    return jsonb_build_object(
      'success', true,
      'order', to_jsonb(v_order),
      'replayed', true
    );
  end if;

  if v_order.delivery_status <> 'delivering' then
    return jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_ORDER_STATE',
      'replayed', false
    );
  end if;

  if p_delivery_proof_kind = 'pin' then
    if v_order.delivery_pin_locked_until is not null
       and v_order.delivery_pin_locked_until > v_now then
      v_retry_after := greatest(
        1,
        ceil(extract(epoch from (v_order.delivery_pin_locked_until - v_now)))::integer
      );
      return jsonb_build_object(
        'success', false,
        'error_code', 'PIN_LOCKED',
        'retry_after', v_retry_after,
        'replayed', false
      );
    end if;

    if p_delivery_proof_hash is null
       or v_order.delivery_pin_hash is null
       or p_delivery_proof_hash <> v_order.delivery_pin_hash then
      v_failed_attempts := case
        when v_order.delivery_pin_locked_until is not null
          and v_order.delivery_pin_locked_until <= v_now
          then 1
        else least(coalesce(v_order.delivery_pin_failed_attempts, 0) + 1, 5)
      end;
      v_locked_until := case
        when v_failed_attempts >= 5 then v_now + interval '15 minutes'
        else null
      end;

      update public.orders
      set delivery_pin_failed_attempts = v_failed_attempts,
          delivery_pin_locked_until = v_locked_until,
          updated_at = v_now
      where id = p_order_id;

      if v_locked_until is not null then
        return jsonb_build_object(
          'success', false,
          'error_code', 'PIN_LOCKED',
          'retry_after', 900,
          'replayed', false
        );
      end if;

      return jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_DELIVERY_PROOF',
        'replayed', false
      );
    end if;
  elsif p_delivery_proof_kind = 'qr' then
    if p_delivery_proof_hash is null
       or v_order.delivery_qr_hash is null
       or p_delivery_proof_hash <> v_order.delivery_qr_hash then
      return jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_DELIVERY_PROOF',
        'replayed', false
      );
    end if;
  else
    return jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_DELIVERY_PROOF_KIND',
      'replayed', false
    );
  end if;

  update public.orders
  set status = 'delivered',
      delivery_status = 'delivered',
      delivery_pin_hash = null,
      delivery_qr_hash = null,
      delivery_pin_failed_attempts = 0,
      delivery_pin_locked_until = null,
      updated_at = v_now
  where id = p_order_id
  returning * into v_order;

  update public.rider_profiles
  set total_deliveries = coalesce(total_deliveries, 0) + 1,
      updated_at = v_now
  where id = v_rider.id;

  return jsonb_build_object(
    'success', true,
    'order', to_jsonb(v_order),
    'replayed', false
  );
end;
$$;

revoke all on function public.claim_delivery_order(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_delivery_order(uuid, text)
  to service_role;

revoke all on function public.complete_delivery_order(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_delivery_order(uuid, text, text, text)
  to service_role;

commit;
