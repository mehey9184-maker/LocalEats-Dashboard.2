-- L3-N8O: EXPLICITLY STAGING ONLY — LocalEats-Profile-Staging
-- Target Supabase project ref: rgpbdajhlrwfmhopzgzk (NOT Production).
-- Approved scope: additive pickup-order schema only, ZERO live orders.
-- All business mutation paths are deliberately HARD-DISABLED by triggers.
-- NEVER merge into automatic production migration paths.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $l3_n8o_preflight$
begin
  if to_regclass('public.orders') is not null
    or to_regclass('public.pickup_order_events') is not null
    or to_regclass('public.pickup_push_outbox') is not null
    or to_regprocedure('public.l3_n8o_staging_pickup_writes_disabled()') is not null
  then raise exception 'L3_N8O_STAGE_SCHEMA_ALREADY_PRESENT'; end if;
  if to_regclass('public.shops') is null
     or to_regclass('public.menu_items') is null
     or to_regclass('public.pickup_push_subscriptions') is null
  then raise exception 'L3_N8O_REQUIRED_STAGE_BASE_TABLES_MISSING'; end if;
  if (select count(*) from public.shops) > 20
  then raise exception 'L3_N8O_NOT_ISOLATED_STAGE_CATALOG'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.shops'::regclass and contype='p'
  ) then raise exception 'L3_N8O_SHOP_PRIMARY_KEY_REQUIRED'; end if;
end;
$l3_n8o_preflight$;

-- Match the existing Production order column names/types for later reviewed
-- RPC compatibility, without copying any real Production rows or policies.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete restrict,
  user_id text,
  rider_id uuid,
  product_name text,
  product_variant text,
  total_price numeric not null check (total_price >= 0 and total_price = round(total_price, 2)),
  price numeric check (price is null or (price >= 0 and price = round(price, 2))),
  status text check (status is null or status in ('pending','preparing','ready_for_pickup','collected','cancelled')),
  delivery_status text check (delivery_status is null or delivery_status = 'none'),
  payment_method text check (payment_method is null or payment_method in ('cash','card_machine')),
  customer_name text,
  phone text,
  email text,
  address text,
  city text,
  lat numeric,
  lng numeric,
  merchant_rating numeric,
  acceptance_message text,
  notes text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  delivery_fee numeric,
  service_fee numeric,
  discount_amount numeric,
  tip_amount numeric,
  idempotency_key text unique,
  items jsonb check (items is null or jsonb_typeof(items)='array'),
  delivery_type text check (delivery_type is null or delivery_type='collection'),
  payment_status text check (payment_status is null or payment_status in ('unpaid','paid')),
  create_intent_hash text check (create_intent_hash is null or create_intent_hash ~ '^[a-f0-9]{64}$'),
  revision bigint check (revision is null or revision>=0),
  constraint l3_n8o_pickup_managed_shape check (
    create_intent_hash is null or (
      delivery_type = 'collection'
      and user_id is not null and length(btrim(user_id))>0
      and idempotency_key is not null and length(btrim(idempotency_key))>0
      and status is not null and payment_status is not null
      and revision is not null and rider_id is null and lat is null and lng is null
      and delivery_status='none'
      and payment_method in ('cash','card_machine')
      and price is not null and service_fee is not null
      and total_price=price+service_fee
      and coalesce(delivery_fee,0)=0 and coalesce(discount_amount,0)=0
      and coalesce(tip_amount,0)=0
      and items is not null and jsonb_array_length(items)>0
    )
  )
);
create index l3_n8o_orders_shop_recent on public.orders(shop_id,created_at desc,id desc);
create index l3_n8o_orders_user_recent on public.orders(user_id,created_at desc,id desc);

create table public.pickup_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  revision bigint not null check (revision>=0),
  command_id uuid not null,
  command_hash text not null check (command_hash ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('created','accepted','ready','merchant_rejected','customer_cancelled','payment_confirmed','collected')),
  actor_uid text not null check (length(btrim(actor_uid))>0),
  recipient_uid text,
  occurred_at timestamptz not null default statement_timestamp(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  unique(order_id,revision), unique(order_id,command_id), unique(order_id,kind)
);
create unique index l3_n8o_single_cancel on public.pickup_order_events(order_id)
  where kind in ('merchant_rejected','customer_cancelled');
create index l3_n8o_ready_inbox on public.pickup_order_events(recipient_uid,occurred_at desc,id desc)
  where kind='ready';

create table public.pickup_push_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.pickup_order_events(id) on delete restrict,
  subscription_id uuid not null references public.pickup_push_subscriptions(id) on delete restrict,
  state text not null default 'pending' check (state in ('pending','sending','sent','abandoned')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  next_attempt_at timestamptz not null default statement_timestamp(),
  lease_until timestamptz,
  sent_at timestamptz,
  unique(event_id,subscription_id)
);
create index l3_n8o_push_due on public.pickup_push_outbox(next_attempt_at,id)
 where state in ('pending','sending');

-- Browser roles have no access. Service-role reads alone are allowed.
-- No lifecycle, order-creation, payment, or notification RPC is installed.
alter table public.orders enable row level security;
alter table public.pickup_order_events enable row level security;
alter table public.pickup_push_outbox enable row level security;
revoke all on table public.orders,public.pickup_order_events,public.pickup_push_outbox
  from public,anon,authenticated;
grant select on table public.orders,public.pickup_order_events,public.pickup_push_outbox to service_role;

-- Independent hard stop if a write gate is accidentally flipped. These triggers
-- require a separate, owner-approved staged contract migration to remove.
create function public.l3_n8o_staging_pickup_writes_disabled()
returns trigger language plpgsql security invoker set search_path='' as $hard_off$
begin
  raise exception 'L3_N8O_STAGING_PICKUP_WRITES_DISABLED';
end;
$hard_off$;
create trigger l3_n8o_orders_hard_off before insert or update or delete
 on public.orders for each row execute function public.l3_n8o_staging_pickup_writes_disabled();
create trigger l3_n8o_events_hard_off before insert or update or delete
 on public.pickup_order_events for each row execute function public.l3_n8o_staging_pickup_writes_disabled();
create trigger l3_n8o_outbox_hard_off before insert or update or delete
 on public.pickup_push_outbox for each row execute function public.l3_n8o_staging_pickup_writes_disabled();
revoke all on function public.l3_n8o_staging_pickup_writes_disabled()
 from public,anon,authenticated;
grant execute on function public.l3_n8o_staging_pickup_writes_disabled() to service_role;
commit;
