begin;

-- Narrow compatibility repair for the Merchant orders read path.
-- This migration aligns only public.orders.shop_id with the canonical text
-- identifier used by public.shops.id. The broader order-integrity foundation
-- intentionally remains unapplied and is not activated by this repair.

do $migration_preflight$
declare
  v_shops regclass := to_regclass('public.shops');
  v_orders regclass := to_regclass('public.orders');
begin
  if v_shops is null then
    raise exception using
      errcode = '42P01',
      message = 'SHOPS_TABLE_REQUIRED';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute
    where attrelid = v_shops
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
    from pg_catalog.pg_constraint as constraint_def
    join pg_catalog.pg_attribute as id_column
      on id_column.attrelid = constraint_def.conrelid
     and id_column.attnum = any (constraint_def.conkey)
    where constraint_def.conrelid = v_shops
      and constraint_def.contype in ('p', 'u')
      and cardinality(constraint_def.conkey) = 1
      and id_column.attname = 'id'
  ) then
    raise exception using
      errcode = '42830',
      message = 'SHOP_ID_UNIQUE_CONTRACT_REQUIRED';
  end if;

  if v_orders is null then
    raise exception using
      errcode = '42P01',
      message = 'ORDERS_TABLE_REQUIRED';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute
    where attrelid = v_orders
      and attname = 'shop_id'
      and not attisdropped
  ) then
    raise exception using
      errcode = '42703',
      message = 'ORDERS_SHOP_ID_COLUMN_REQUIRED';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute
    where attrelid = v_orders
      and attname = 'shop_id'
      and atttypid in ('bigint'::regtype, 'text'::regtype)
      and not attisdropped
  ) then
    raise exception using
      errcode = '42804',
      message = 'ORDERS_SHOP_ID_MUST_BE_BIGINT_OR_TEXT';
  end if;

  if exists (
    select 1
    from public.orders as order_row
    where order_row.shop_id is null
  ) then
    raise exception using
      errcode = '23502',
      message = 'ORDER_SHOP_ID_REQUIRED';
  end if;

  if exists (
    select 1
    from public.orders as order_row
    left join public.shops as shop_row
      on shop_row.id = order_row.shop_id::text
    where order_row.shop_id is not null
      and shop_row.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'ORDER_SHOP_ID_MAPPING_REQUIRED';
  end if;
end;
$migration_preflight$;

-- Discover constraint names rather than assuming the live database uses a
-- particular legacy name. Drop only foreign keys whose local columns include
-- public.orders.shop_id; every unrelated constraint is preserved.
do $drop_orders_shop_id_foreign_keys$
declare
  constraint_row record;
  v_shop_id_attnum smallint;
begin
  select attnum
    into v_shop_id_attnum
    from pg_catalog.pg_attribute
   where attrelid = 'public.orders'::regclass
     and attname = 'shop_id'
     and not attisdropped;

  for constraint_row in
    select constraint_def.conname
      from pg_catalog.pg_constraint as constraint_def
     where constraint_def.conrelid = 'public.orders'::regclass
       and constraint_def.contype = 'f'
       and v_shop_id_attnum = any (constraint_def.conkey)
  loop
    execute format(
      'alter table public.orders drop constraint %I',
      constraint_row.conname
    );
  end loop;
end;
$drop_orders_shop_id_foreign_keys$;

-- Fail closed if the canonical name is occupied by an unrelated constraint.
do $orders_shop_id_constraint_name_guard$
begin
  if exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_shop_id_fkey'
  ) then
    raise exception using
      errcode = '42710',
      message = 'ORDERS_SHOP_ID_CONSTRAINT_NAME_CONFLICT';
  end if;
end;
$orders_shop_id_constraint_name_guard$;

alter table public.orders
  alter column shop_id type text using shop_id::text,
  alter column shop_id set not null;

alter table public.orders
  add constraint orders_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on delete restrict;

-- CREATE INDEX IF NOT EXISTS does not prove that an existing relation with the
-- same name has the required definition, so reject an obvious name collision.
do $orders_shop_id_index_name_guard$
declare
  v_index regclass := to_regclass('public.orders_shop_id_idx');
  v_shop_id_attnum smallint;
begin
  if v_index is null then
    return;
  end if;

  select attnum
    into v_shop_id_attnum
    from pg_catalog.pg_attribute
   where attrelid = 'public.orders'::regclass
     and attname = 'shop_id'
     and not attisdropped;

  if not exists (
    select 1
    from pg_catalog.pg_index as index_def
    where index_def.indexrelid = v_index
      and index_def.indrelid = 'public.orders'::regclass
      and index_def.indisvalid
      and index_def.indisready
      and index_def.indpred is null
      and index_def.indexprs is null
      and index_def.indnkeyatts = 1
      and index_def.indkey[0] = v_shop_id_attnum
  ) then
    raise exception using
      errcode = '42P07',
      message = 'ORDERS_SHOP_ID_INDEX_NAME_CONFLICT';
  end if;
end;
$orders_shop_id_index_name_guard$;

create index if not exists orders_shop_id_idx
  on public.orders (shop_id);

commit;
