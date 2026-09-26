-- Phase 1A only: replace legacy Rider verification values and prevent a
-- non-approved Rider from remaining online. No existing Rider is migrated.
begin;

do $rider_pool_verification_preflight$
declare
  v_profiles regclass := to_regclass('public.rider_profiles');
  v_verification_attribute smallint;
  v_definition text;
  v_normalized_definition text;
  v_row_count bigint;
begin
  if v_profiles is null then
    raise exception using errcode = '42P01', message = 'RIDER_POOL_PROFILES_MISSING';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_class as relation
    where relation.oid = v_profiles and relation.relkind = 'r'
  ) then
    raise exception using errcode = '23514', message = 'RIDER_POOL_PROFILES_NOT_A_TABLE';
  end if;

  -- Hold the table stable until the two replacement checks are installed.
  lock table public.rider_profiles in access exclusive mode;

  select attribute.attnum into v_verification_attribute
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = v_profiles
    and attribute.attname = 'verification_status'
    and attribute.atttypid = 'pg_catalog.text'::regtype
    and attribute.attnotnull
    and not attribute.attisdropped;
  if v_verification_attribute is null then
    raise exception using errcode = '23514', message = 'RIDER_POOL_VERIFICATION_COLUMN_CONTRACT_MISMATCH';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = v_profiles
      and attribute.attname = 'status'
      and attribute.atttypid = 'pg_catalog.text'::regtype
      and attribute.attnotnull
      and not attribute.attisdropped
  ) then
    raise exception using errcode = '23514', message = 'RIDER_POOL_STATUS_COLUMN_CONTRACT_MISMATCH';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = v_profiles
      and attribute.attname = 'is_online'
      and attribute.atttypid = 'pg_catalog.bool'::regtype
      and attribute.attnotnull
      and not attribute.attisdropped
  ) then
    raise exception using errcode = '23514', message = 'RIDER_POOL_ONLINE_COLUMN_CONTRACT_MISMATCH';
  end if;

  select pg_catalog.pg_get_constraintdef(constraint_def.oid)
    into v_definition
  from pg_catalog.pg_constraint as constraint_def
  where constraint_def.conrelid = v_profiles
    and constraint_def.conname = 'rider_profiles_verification_status_check'
    and constraint_def.contype = 'c'
    and constraint_def.convalidated
    and constraint_def.conkey = array[v_verification_attribute]::smallint[];

  -- pg_get_constraintdef is reconstructed text, not the original SQL. Ignore
  -- only whitespace and optional text casts; keep the exact column, operator,
  -- four literals, and their order fixed. Any other expression aborts.
  v_normalized_definition := regexp_replace(
    regexp_replace(v_definition, '[[:space:]]+', '', 'g'),
    '::(pg_catalog[.])?text', '', 'g'
  );
  if v_normalized_definition is distinct from
       'CHECK((verification_status=ANY(ARRAY[''pending'',''approved'',''rejected'',''verified''])))' then
    raise exception using errcode = '23514', message = 'RIDER_POOL_LEGACY_VERIFICATION_CHECK_MISMATCH';
  end if;

  select count(*) into v_row_count from public.rider_profiles;
  if v_row_count <> 0 then
    raise exception using errcode = '23514', message = 'RIDER_POOL_PROFILES_NOT_EMPTY';
  end if;

  if exists (
    select 1 from pg_catalog.pg_constraint as constraint_def
    where constraint_def.conname = 'rider_profiles_approved_online_only_check'
      and constraint_def.conrelid = v_profiles
  ) then
    raise exception using errcode = '42710', message = 'RIDER_POOL_ELIGIBILITY_CHECK_NAME_CONFLICT';
  end if;
end;
$rider_pool_verification_preflight$;

alter table public.rider_profiles
  drop constraint rider_profiles_verification_status_check;

alter table public.rider_profiles
  add constraint rider_profiles_verification_status_check
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended')),
  add constraint rider_profiles_approved_online_only_check
    check (
      verification_status = 'approved'
      or (is_online = false and status = 'offline')
    );

-- Existing pending/offline/false defaults and API-only privileges are unchanged.
commit;
