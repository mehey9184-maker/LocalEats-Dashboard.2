begin;

-- Pairing authority depends on the separately applied Rider access
-- prerequisite. Abort before creating anything if that contract has drifted.
do $rider_pairing_preflight$
declare
  expected_column record;
begin
  if to_regclass('public.shops') is null then
    raise exception using
      errcode = '42P01',
      message = 'RIDER_PAIRING_PREREQUISITE_SHOPS_TABLE_REQUIRED';
  end if;

  if to_regclass('public.rider_profiles') is null then
    raise exception using
      errcode = '42P01',
      message = 'RIDER_PAIRING_PREREQUISITE_RIDER_PROFILES_TABLE_REQUIRED';
  end if;

  if to_regclass('public.rider_connections') is null then
    raise exception using
      errcode = '42P01',
      message = 'RIDER_PAIRING_PREREQUISITE_RIDER_CONNECTIONS_TABLE_REQUIRED';
  end if;

  for expected_column in
    select * from (values
      ('public.shops', 'id', 'text', false),
      ('public.rider_profiles', 'firebase_uid', 'text', true),
      ('public.rider_connections', 'shop_id', 'text', true),
      ('public.rider_connections', 'rider_id', 'uuid', true)
    ) as expected(table_name, column_name, type_name, required_not_null)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_attribute as column_def
      where column_def.attrelid = to_regclass(expected_column.table_name)
        and column_def.attname = expected_column.column_name
        and column_def.atttypid = to_regtype(expected_column.type_name)
        and not column_def.attisdropped
        and (not expected_column.required_not_null or column_def.attnotnull)
    ) then
      raise exception using
        errcode = '42804',
        message = format(
          'RIDER_PAIRING_PREREQUISITE_COLUMN_MISMATCH:%s.%s_EXPECTED_%s%s',
          expected_column.table_name,
          expected_column.column_name,
          expected_column.type_name,
          case when expected_column.required_not_null then '_NOT_NULL' else '' end
        );
    end if;
  end loop;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_def
    join pg_catalog.pg_attribute as id_column
      on id_column.attrelid = constraint_def.conrelid
     and id_column.attnum = any (constraint_def.conkey)
    where constraint_def.conrelid = 'public.shops'::regclass
      and constraint_def.contype in ('p', 'u')
      and cardinality(constraint_def.conkey) = 1
      and id_column.attname = 'id'
  ) then
    raise exception using
      errcode = '42830',
      message = 'RIDER_PAIRING_PREREQUISITE_SHOP_ID_NOT_UNIQUELY_REFERENCEABLE';
  end if;

  if to_regclass('public.rider_pairing_codes') is not null then
    raise exception using
      errcode = '42P07',
      message = 'RIDER_PAIRING_PREREQUISITE_PAIRING_CODES_ALREADY_EXISTS';
  end if;

  if to_regprocedure('public.issue_rider_pairing_code(text,text,text,timestamptz)')
    is not null then
    raise exception using
      errcode = '42723',
      message = 'RIDER_PAIRING_PREREQUISITE_ISSUE_CODE_FUNCTION_ALREADY_EXISTS';
  end if;
end;
$rider_pairing_preflight$;

create table public.rider_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  code text not null unique,
  created_by_firebase_uid text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rider_pairing_codes_six_digits_check
    check (code ~ '^[0-9]{6}$')
);

create index rider_pairing_codes_shop_created_idx
  on public.rider_pairing_codes (shop_id, created_at desc);

create index rider_pairing_codes_unrevoked_expiry_idx
  on public.rider_pairing_codes (expires_at)
  where revoked_at is null;

alter table public.rider_pairing_codes enable row level security;

revoke all privileges on table public.rider_pairing_codes
from public, anon, authenticated, service_role;

grant select, insert, update on table public.rider_pairing_codes to service_role;

-- LR2-A profile synchronization and connection transitions are server-only.
-- The Rider access prerequisite established API-only Rider authority.
grant select, insert, update on table public.rider_profiles to service_role;
grant select, insert, update on table public.rider_connections to service_role;

-- Lock the shop row so concurrent requests cannot leave two active codes.
-- The function remains SECURITY INVOKER and is executable only by service_role.
create or replace function public.issue_rider_pairing_code(
  p_shop_id text,
  p_code text,
  p_created_by_firebase_uid text,
  p_expires_at timestamptz
)
returns setof public.rider_pairing_codes
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.shops
  where id = p_shop_id
  for update;

  if not found then
    raise exception using errcode = 'LE404', message = 'SHOP_NOT_FOUND';
  end if;

  update public.rider_pairing_codes
  set revoked_at = now()
  where shop_id = p_shop_id
    and revoked_at is null;

  return query
  insert into public.rider_pairing_codes (
    shop_id,
    code,
    created_by_firebase_uid,
    expires_at
  ) values (
    p_shop_id,
    p_code,
    p_created_by_firebase_uid,
    p_expires_at
  )
  returning *;
end;
$$;

revoke all on function public.issue_rider_pairing_code(text, text, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.issue_rider_pairing_code(text, text, text, timestamptz)
to service_role;

comment on table public.rider_pairing_codes is
  'Server-only LR2-A rider invitations. A code creates a pending connection and never grants shop authority.';

comment on function public.issue_rider_pairing_code(text, text, text, timestamptz) is
  'Atomically revokes a shop previous pairing code and inserts a replacement. service_role only.';

commit;
