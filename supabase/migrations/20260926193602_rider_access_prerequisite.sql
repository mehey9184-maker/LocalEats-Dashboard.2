begin;

-- Narrow prerequisite for authoritative Firebase Rider identity and
-- merchant-approved Rider connections. Firebase supplies identity, the
-- LocalEats API supplies authority, and Supabase stores authoritative state.
--
-- This migration intentionally does not apply the broader
-- 20260905000000_order_integrity_foundation.sql migration. It changes only
-- the two empty Rider authority tables and intentionally runs before
-- 20260919000000_rider_onboarding_pairing_authority.sql.

do $rider_access_preflight$
declare
  expected_column record;
  constraint_count integer;
  id_default text;
  view_oid oid;
  view_columns text[];
  expected_view_definition text;
begin
  if to_regclass('public.shops') is null then
    raise exception using
      errcode = '42P01',
      message = 'RIDER_ACCESS_PREREQUISITE_SHOPS_TABLE_REQUIRED';
  end if;

  if to_regclass('public.rider_profiles') is null then
    raise exception using
      errcode = '42P01',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_PROFILES_TABLE_REQUIRED';
  end if;

  if to_regclass('public.rider_connections') is null then
    raise exception using
      errcode = '42P01',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_CONNECTIONS_TABLE_REQUIRED';
  end if;

  select relation_def.oid
  into view_oid
  from pg_catalog.pg_class as relation_def
  join pg_catalog.pg_namespace as schema_def
    on schema_def.oid = relation_def.relnamespace
  where schema_def.nspname = 'public'
    and relation_def.relname = 'rider_status_view'
    and relation_def.relkind = 'v';

  if view_oid is null then
    raise exception using
      errcode = '42809',
      message = 'RIDER_ACCESS_PREREQUISITE_NORMAL_RIDER_STATUS_VIEW_REQUIRED';
  end if;

  select array_agg(attribute_def.attname::text order by attribute_def.attnum)
  into view_columns
  from pg_catalog.pg_attribute as attribute_def
  where attribute_def.attrelid = view_oid
    and attribute_def.attnum > 0
    and not attribute_def.attisdropped;

  if view_columns is distinct from array[
    'connection_id', 'shop_id', 'rider_id', 'rider_name', 'is_online',
    'status', 'expires_at', 'connection_code', 'status_derived'
  ]::text[] then
    raise exception using
      errcode = '42804',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_STATUS_VIEW_COLUMNS_CHANGED';
  end if;

  expected_view_definition := $expected_rider_status_view$
    select rc.id as connection_id, rc.shop_id, rc.rider_id,
      coalesce(rp.full_name, rc.rider_name) as rider_name,
      coalesce(rp.is_online, false) as is_online,
      coalesce(rp.status, 'offline'::text) as status,
      rc.expires_at, rc.connection_code,
      case
        when rc.expires_at < now() then 'expired'::text
        when rp.is_online = true then 'online'::text
        else 'offline'::text
      end as status_derived
    from public.rider_connections rc
    left join public.rider_profiles rp on rc.rider_id = rp.id
  $expected_rider_status_view$;

  if replace(replace(
       regexp_replace(lower(pg_catalog.pg_get_viewdef(view_oid, false)),
         '[[:space:]();"]', '', 'g'), 'public.', ''), '::text', '')
     is distinct from
     replace(replace(
       regexp_replace(lower(expected_view_definition),
         '[[:space:]();"]', '', 'g'), 'public.', ''), '::text', '') then
    raise exception using
      errcode = '42804',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_STATUS_VIEW_DEFINITION_CHANGED';
  end if;

  if exists (
    select 1 from pg_catalog.pg_attribute as attribute_def
    where attribute_def.attrelid = view_oid
      and attribute_def.attnum > 0
      and not attribute_def.attisdropped
      and (attribute_def.attacl is not null
        or pg_catalog.col_description(view_oid, attribute_def.attnum) is not null)
  ) or exists (
    select 1 from pg_catalog.pg_rewrite as rule_def
    where rule_def.ev_class = view_oid and rule_def.rulename <> '_RETURN'
  ) or exists (
    select 1 from pg_catalog.pg_trigger as trigger_def
    where trigger_def.tgrelid = view_oid and not trigger_def.tgisinternal
  ) or exists (
    select 1 from pg_catalog.pg_attrdef as default_def
    where default_def.adrelid = view_oid
  ) or exists (
    select 1 from pg_catalog.pg_seclabel as security_label
    where security_label.objoid = view_oid
  ) then
    raise exception using
      errcode = '0A000',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_STATUS_VIEW_HAS_UNPRESERVED_DEPENDENCIES';
  end if;

  if to_regclass('auth.users') is null then
    raise exception using
      errcode = '42P01',
      message = 'RIDER_ACCESS_PREREQUISITE_AUTH_USERS_TABLE_REQUIRED';
  end if;

  if to_regprocedure('gen_random_uuid()') is null then
    raise exception using
      errcode = '42883',
      message = 'RIDER_ACCESS_PREREQUISITE_GEN_RANDOM_UUID_REQUIRED';
  end if;

  for expected_column in
    select *
    from (values
      ('public.shops', 'id', 'text'),
      ('public.rider_profiles', 'id', 'uuid'),
      ('public.rider_profiles', 'full_name', 'text'),
      ('public.rider_profiles', 'name', 'text'),
      ('public.rider_profiles', 'phone', 'text'),
      ('public.rider_profiles', 'vehicle_type', 'text'),
      ('public.rider_profiles', 'verification_status', 'text'),
      ('public.rider_profiles', 'is_online', 'boolean'),
      ('public.rider_profiles', 'status', 'text'),
      ('public.rider_profiles', 'rating', 'numeric'),
      ('public.rider_profiles', 'total_deliveries', 'integer'),
      ('public.rider_connections', 'id', 'uuid'),
      ('public.rider_connections', 'shop_id', 'bigint'),
      ('public.rider_connections', 'rider_id', 'uuid'),
      ('public.rider_connections', 'status', 'text'),
      ('public.rider_connections', 'connection_code', 'text'),
      ('public.rider_connections', 'expires_at', 'timestamptz'),
      ('public.rider_connections', 'created_at', 'timestamptz')
    ) as expected(table_name, column_name, type_name)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_attribute as attribute_def
      where attribute_def.attrelid = to_regclass(expected_column.table_name)
        and attribute_def.attname = expected_column.column_name
        and attribute_def.atttypid = to_regtype(expected_column.type_name)
        and not attribute_def.attisdropped
    ) then
      raise exception using
        errcode = '42804',
        message = format(
          'RIDER_ACCESS_PREREQUISITE_COLUMN_TYPE_MISMATCH:%s.%s_EXPECTED_%s',
          expected_column.table_name,
          expected_column.column_name,
          expected_column.type_name
        );
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_attribute as attribute_def
    where attribute_def.attrelid = 'public.rider_profiles'::regclass
      and attribute_def.attname = 'firebase_uid'
      and not attribute_def.attisdropped
  ) then
    raise exception using
      errcode = '42701',
      message = 'RIDER_ACCESS_PREREQUISITE_FIREBASE_UID_ALREADY_EXISTS';
  end if;

  select count(*)
  into constraint_count
  from pg_catalog.pg_constraint as constraint_def
  join pg_catalog.pg_attribute as id_column
    on id_column.attrelid = constraint_def.conrelid
   and id_column.attnum = any (constraint_def.conkey)
  where constraint_def.conrelid = 'public.shops'::regclass
    and constraint_def.contype in ('p', 'u')
    and cardinality(constraint_def.conkey) = 1
    and id_column.attname = 'id';

  if constraint_count = 0 then
    raise exception using
      errcode = '42830',
      message = 'RIDER_ACCESS_PREREQUISITE_SHOP_ID_NOT_UNIQUELY_REFERENCEABLE';
  end if;

  select count(*)
  into constraint_count
  from pg_catalog.pg_constraint as constraint_def
  join pg_catalog.pg_attribute as id_column
    on id_column.attrelid = constraint_def.conrelid
   and id_column.attnum = any (constraint_def.conkey)
  where constraint_def.conrelid = 'public.rider_profiles'::regclass
    and constraint_def.contype = 'p'
    and cardinality(constraint_def.conkey) = 1
    and id_column.attname = 'id';

  if constraint_count <> 1 then
    raise exception using
      errcode = '42830',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_PROFILE_UUID_PRIMARY_KEY_REQUIRED';
  end if;

  select count(*)
  into constraint_count
  from pg_catalog.pg_constraint as constraint_def
  join pg_catalog.pg_attribute as id_column
    on id_column.attrelid = constraint_def.conrelid
   and id_column.attnum = any (constraint_def.conkey)
  where constraint_def.conrelid = 'public.rider_profiles'::regclass
    and constraint_def.contype = 'f'
    and constraint_def.confrelid = 'auth.users'::regclass
    and cardinality(constraint_def.conkey) = 1
    and id_column.attname = 'id';

  if constraint_count <> 1 then
    raise exception using
      errcode = '42830',
      message = 'RIDER_ACCESS_PREREQUISITE_EXPECTED_AUTH_USER_FOREIGN_KEY';
  end if;

  select pg_get_expr(default_def.adbin, default_def.adrelid)
  into id_default
  from pg_catalog.pg_attribute as attribute_def
  left join pg_catalog.pg_attrdef as default_def
    on default_def.adrelid = attribute_def.attrelid
   and default_def.adnum = attribute_def.attnum
  where attribute_def.attrelid = 'public.rider_connections'::regclass
    and attribute_def.attname = 'id'
    and not attribute_def.attisdropped;

  if id_default is null or id_default not like '%gen_random_uuid()%' then
    raise exception using
      errcode = '42804',
      message = 'RIDER_ACCESS_PREREQUISITE_CONNECTION_UUID_DEFAULT_REQUIRED';
  end if;

  if exists (select 1 from public.rider_profiles limit 1) then
    raise exception using
      errcode = '23514',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_PROFILES_MUST_BE_EMPTY';
  end if;

  if exists (select 1 from public.rider_connections limit 1) then
    raise exception using
      errcode = '23514',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_CONNECTIONS_MUST_BE_EMPTY';
  end if;
end;
$rider_access_preflight$;

do $drop_rider_profile_auth_foreign_key$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_def.conname
    from pg_catalog.pg_constraint as constraint_def
    join pg_catalog.pg_attribute as id_column
      on id_column.attrelid = constraint_def.conrelid
     and id_column.attnum = any (constraint_def.conkey)
    where constraint_def.conrelid = 'public.rider_profiles'::regclass
      and constraint_def.contype = 'f'
      and constraint_def.confrelid = 'auth.users'::regclass
      and cardinality(constraint_def.conkey) = 1
      and id_column.attname = 'id'
  loop
    execute format('alter table public.rider_profiles drop constraint %I', constraint_row.conname);
  end loop;
end;
$drop_rider_profile_auth_foreign_key$;

do $drop_rider_connection_foreign_keys$
declare
  constraint_row record;
begin
  for constraint_row in
    select distinct constraint_def.conname
    from pg_catalog.pg_constraint as constraint_def
    join pg_catalog.pg_attribute as column_def
      on column_def.attrelid = constraint_def.conrelid
     and column_def.attnum = any (constraint_def.conkey)
    where constraint_def.conrelid = 'public.rider_connections'::regclass
      and constraint_def.contype = 'f'
      and column_def.attname in ('shop_id', 'rider_id')
  loop
    execute format('alter table public.rider_connections drop constraint %I', constraint_row.conname);
  end loop;
end;
$drop_rider_connection_foreign_keys$;

do $drop_rider_status_checks$
declare
  constraint_row record;
begin
  for constraint_row in
    select distinct constraint_def.conrelid::regclass as table_name,
      constraint_def.conname
    from pg_catalog.pg_constraint as constraint_def
    join pg_catalog.pg_attribute as column_def
      on column_def.attrelid = constraint_def.conrelid
     and column_def.attnum = any (constraint_def.conkey)
    where constraint_def.contype = 'c'
      and ((constraint_def.conrelid = 'public.rider_profiles'::regclass
          and column_def.attname in ('verification_status', 'status'))
        or (constraint_def.conrelid = 'public.rider_connections'::regclass
          and column_def.attname = 'status'))
  loop
    execute format('alter table %s drop constraint %I', constraint_row.table_name, constraint_row.conname);
  end loop;
end;
$drop_rider_status_checks$;

do $rider_access_name_conflicts$
declare
  canonical_object record;
begin
  for canonical_object in
    select * from (values
      ('public.rider_profiles', 'rider_profiles_firebase_uid_nonempty'),
      ('public.rider_profiles', 'rider_profiles_firebase_uid_key'),
      ('public.rider_profiles', 'rider_profiles_verification_status_check'),
      ('public.rider_profiles', 'rider_profiles_status_check'),
      ('public.rider_connections', 'rider_connections_status_check'),
      ('public.rider_connections', 'rider_connections_shop_id_fkey'),
      ('public.rider_connections', 'rider_connections_rider_id_fkey'),
      ('public.rider_connections', 'rider_connections_unique_shop_rider')
    ) as expected(table_name, object_name)
  loop
    if exists (
      select 1 from pg_catalog.pg_constraint as constraint_def
      where constraint_def.conrelid = to_regclass(canonical_object.table_name)
        and constraint_def.conname = canonical_object.object_name
    ) then
      raise exception using errcode = '42710',
        message = format('RIDER_ACCESS_PREREQUISITE_CONSTRAINT_NAME_CONFLICT:%s', canonical_object.object_name);
    end if;
  end loop;

  for canonical_object in
    select object_name from (values
      ('rider_profiles_firebase_uid_key'),
      ('rider_connections_unique_shop_rider'),
      ('rider_connections_rider_id_idx')
    ) as expected(object_name)
  loop
    if to_regclass(format('public.%I', canonical_object.object_name)) is not null then
      raise exception using errcode = '42P07',
        message = format('RIDER_ACCESS_PREREQUISITE_RELATION_NAME_CONFLICT:%s', canonical_object.object_name);
    end if;
  end loop;
end;
$rider_access_name_conflicts$;

alter table public.rider_profiles
  alter column id set default gen_random_uuid(),
  add column firebase_uid text not null,
  alter column verification_status set default 'pending',
  alter column verification_status set not null,
  alter column is_online set default false,
  alter column is_online set not null,
  alter column status set default 'offline',
  alter column status set not null;

alter table public.rider_profiles
  add constraint rider_profiles_firebase_uid_nonempty check (firebase_uid = btrim(firebase_uid) and length(firebase_uid) > 0),
  add constraint rider_profiles_firebase_uid_key unique (firebase_uid),
  add constraint rider_profiles_verification_status_check check (verification_status in ('pending', 'approved', 'rejected', 'verified')),
  add constraint rider_profiles_status_check check (status in ('offline', 'online', 'busy', 'paused'));

drop view public.rider_status_view;

alter table public.rider_connections
  alter column id set default gen_random_uuid(),
  alter column shop_id type text using shop_id::text,
  alter column shop_id set not null,
  alter column rider_id set not null,
  alter column status set default 'pending',
  alter column status set not null;

alter table public.rider_connections
  add constraint rider_connections_status_check check (status in ('pending', 'approved', 'rejected')),
  add constraint rider_connections_shop_id_fkey foreign key (shop_id) references public.shops(id) on delete cascade,
  add constraint rider_connections_rider_id_fkey foreign key (rider_id) references public.rider_profiles(id) on delete cascade,
  add constraint rider_connections_unique_shop_rider unique (shop_id, rider_id);

create index rider_connections_rider_id_idx on public.rider_connections (rider_id);

create view public.rider_status_view with (security_invoker = true) as
select
  rc.id as connection_id,
  rc.shop_id,
  rc.rider_id,
  coalesce(rp.full_name, rc.rider_name) as rider_name,
  coalesce(rp.is_online, false) as is_online,
  coalesce(rp.status, 'offline'::text) as status,
  rc.expires_at,
  rc.connection_code,
  case
    when rc.expires_at < now() then 'expired'::text
    when rp.is_online = true then 'online'::text
    else 'offline'::text
  end as status_derived
from public.rider_connections rc
left join public.rider_profiles rp on rc.rider_id = rp.id;

revoke all privileges on public.rider_status_view from public, anon, authenticated, service_role;
grant select on public.rider_status_view to service_role;

do $verify_rider_status_view_security$
declare
  view_oid oid := 'public.rider_status_view'::regclass;
  view_owner oid;
  view_columns text[];
  expected_view_definition text;
  privilege_name text;
begin
  select relation_def.relowner into view_owner
  from pg_catalog.pg_class as relation_def
  where relation_def.oid = view_oid
    and relation_def.relkind = 'v'
    and relation_def.reloptions @> array['security_invoker=true']::text[];

  if view_owner is null then
    raise exception using errcode = '0A000',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_STATUS_VIEW_SECURITY_INVOKER_REQUIRED';
  end if;

  select array_agg(attribute_def.attname::text order by attribute_def.attnum)
  into view_columns
  from pg_catalog.pg_attribute as attribute_def
  where attribute_def.attrelid = view_oid
    and attribute_def.attnum > 0
    and not attribute_def.attisdropped;

  if view_columns is distinct from array[
    'connection_id', 'shop_id', 'rider_id', 'rider_name', 'is_online',
    'status', 'expires_at', 'connection_code', 'status_derived'
  ]::text[] then
    raise exception using errcode = '42804',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_STATUS_VIEW_COLUMNS_CHANGED';
  end if;

  expected_view_definition := $expected_rider_status_view$
    select rc.id as connection_id, rc.shop_id, rc.rider_id,
      coalesce(rp.full_name, rc.rider_name) as rider_name,
      coalesce(rp.is_online, false) as is_online,
      coalesce(rp.status, 'offline'::text) as status,
      rc.expires_at, rc.connection_code,
      case
        when rc.expires_at < now() then 'expired'::text
        when rp.is_online = true then 'online'::text
        else 'offline'::text
      end as status_derived
    from public.rider_connections rc
    left join public.rider_profiles rp on rc.rider_id = rp.id
  $expected_rider_status_view$;

  if replace(replace(
       regexp_replace(lower(pg_catalog.pg_get_viewdef(view_oid, false)),
         '[[:space:]();"]', '', 'g'), 'public.', ''), '::text', '')
     is distinct from
     replace(replace(
       regexp_replace(lower(expected_view_definition),
         '[[:space:]();"]', '', 'g'), 'public.', ''), '::text', '') then
    raise exception using errcode = '42804',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_STATUS_VIEW_DEFINITION_CHANGED';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation_def
    cross join lateral pg_catalog.aclexplode(coalesce(relation_def.relacl,
      pg_catalog.acldefault('r', relation_def.relowner))) as view_grant
    where relation_def.oid = view_oid
      and (view_grant.grantee = 0
        or (view_grant.grantee <> view_owner
          and (view_grant.grantee <> 'service_role'::regrole
            or view_grant.privilege_type <> 'SELECT')))
  ) then
    raise exception using errcode = '0A000',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_STATUS_VIEW_UNEXPECTED_GRANT';
  end if;

  for privilege_name in
    select distinct privilege_type
    from pg_catalog.aclexplode(pg_catalog.acldefault('r', view_owner))
  loop
    if pg_catalog.has_table_privilege('anon'::regrole, view_oid, privilege_name)
      or pg_catalog.has_table_privilege('authenticated'::regrole, view_oid, privilege_name)
      or (privilege_name <> 'SELECT'
        and pg_catalog.has_table_privilege('service_role'::regrole, view_oid, privilege_name)) then
      raise exception using errcode = '0A000',
        message = 'RIDER_ACCESS_PREREQUISITE_RIDER_STATUS_VIEW_ROLE_PRIVILEGES_UNSAFE';
    end if;
  end loop;

  if not pg_catalog.has_table_privilege('service_role'::regrole, view_oid, 'SELECT') then
    raise exception using errcode = '0A000',
      message = 'RIDER_ACCESS_PREREQUISITE_RIDER_STATUS_VIEW_SERVICE_SELECT_REQUIRED';
  end if;
end;
$verify_rider_status_view_security$;

do $drop_rider_browser_policies$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('rider_profiles', 'rider_connections')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$drop_rider_browser_policies$;

alter table public.rider_profiles enable row level security;
alter table public.rider_connections enable row level security;

revoke all privileges on table public.rider_profiles, public.rider_connections from public, anon, authenticated, service_role;
grant select, insert, update on table public.rider_profiles to service_role;
grant select, insert, update on table public.rider_connections to service_role;

commit;