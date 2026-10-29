-- UNAPPROVED REVIEW DRAFT for production. Local disposable validation only until rollout approval.
-- Intentionally outside supabase/migrations: no migration version/history is created.
-- Additive objects only. No historical data inference or Rider schema changes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Fail on drift/collisions rather than silently accepting an incompatible schema.
do $preflight$
begin
  if not exists (select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.orders'::regclass and attname = 'id'
      and atttypid = 'uuid'::regtype and not attisdropped)
    or not exists (select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.orders'::regclass and attname = 'shop_id'
      and atttypid = 'text'::regtype and not attisdropped) then
    raise exception 'PICKUP_ORDER_SCHEMA_MISMATCH';
  end if;
  if exists (
    select 1 from (values
      ('orders','user_id','text'), ('orders','rider_id','uuid'),
      ('orders','status','text'), ('orders','delivery_status','text'),
      ('orders','payment_method','text'), ('orders','idempotency_key','text'),
      ('orders','items','jsonb'), ('orders','price','numeric'),
      ('orders','total_price','numeric'), ('orders','service_fee','numeric'),
      ('orders','delivery_fee','numeric'), ('orders','discount_amount','numeric'),
      ('orders','tip_amount','numeric'), ('orders','lat','numeric'), ('orders','lng','numeric'),
      ('orders','customer_name','text'), ('orders','phone','text'),
      ('orders','email','text'), ('orders','address','text'), ('orders','city','text'),
      ('orders','notes','text'), ('orders','product_name','text'), ('orders','product_variant','text'),
      ('orders','created_at','timestamp with time zone'), ('orders','updated_at','timestamp with time zone'),
      ('shops','location','text'), ('shops','id','text'), ('shops','owner_id','text'),
      ('shops','is_active','boolean'), ('shops','approval_status','text'),
      ('shops','archived_at','timestamp with time zone'),
      ('menu_items','shop_id','text'),
      ('menu_items','name','text'), ('menu_items','price','numeric'), ('menu_items','is_available','boolean')
    ) required(tbl,col,typ)
    where not exists (select 1 from pg_catalog.pg_attribute a
      where a.attrelid = ('public.' || required.tbl)::regclass and a.attname = required.col
        and a.atttypid = required.typ::regtype and not a.attisdropped)
  ) then raise exception 'PICKUP_ORDER_SCHEMA_MISMATCH'; end if;
  if not exists (select 1 from pg_catalog.pg_attribute where attrelid='public.menu_items'::regclass
    and attname='id' and atttypid in ('text'::regtype,'uuid'::regtype) and not attisdropped) then
    raise exception 'PICKUP_MENU_ID_SCHEMA_MISMATCH';
  end if;
  if exists (select 1 from (values ('lat'),('lng'),('latitude'),('longitude')) required(col)
    where not exists (select 1 from pg_catalog.pg_attribute where attrelid='public.shops'::regclass
      and attname=required.col and atttypid in ('numeric'::regtype,'double precision'::regtype,'real'::regtype) and not attisdropped)) then
    raise exception 'PICKUP_SHOP_COORDINATE_SCHEMA_MISMATCH';
  end if;
  if not has_table_privilege('service_role','public.orders','SELECT')
    or not has_table_privilege('service_role','public.orders','INSERT')
    or not has_table_privilege('service_role','public.orders','UPDATE')
    or not has_table_privilege('service_role','public.shops','SELECT')
    or not has_any_column_privilege('service_role','public.shops','UPDATE')
    or not has_table_privilege('service_role','public.menu_items','SELECT')
    or not has_any_column_privilege('service_role','public.menu_items','UPDATE') then
    raise exception 'PICKUP_SERVICE_PRIVILEGES_REQUIRED';
  end if;
  -- Accept either a UNIQUE constraint or its equivalent valid, unconditional unique index.
  if not exists (select 1 from pg_catalog.pg_index i
    join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
    where i.indrelid = 'public.orders'::regclass and i.indisunique and i.indisvalid and i.indisready
      and i.indnkeyatts = 1 and i.indpred is null and i.indexprs is null
      and a.attname = 'idempotency_key') then
    raise exception 'PICKUP_IDEMPOTENCY_UNIQUENESS_REQUIRED';
  end if;
end;
$preflight$;

-- No defaults: legacy fulfillment, payment and revision remain unknown.
alter table public.orders
  add column delivery_type text,
  add column payment_status text,
  add column create_intent_hash text,
  add column revision bigint,
  add constraint pickup_fulfillment_value check (delivery_type is null or delivery_type in ('collection', 'delivery')) not valid,
  add constraint pickup_payment_value check (payment_status is null or payment_status in ('unpaid', 'paid')) not valid,
  add constraint pickup_intent_hash_value check (create_intent_hash is null or create_intent_hash ~ '^[0-9a-f]{64}$') not valid,
  add constraint pickup_revision_value check (revision is null or revision >= 0) not valid,
  add constraint pickup_managed_order_shape check (
    create_intent_hash is null or (
      delivery_type is not distinct from 'collection' and payment_status is not null and revision is not null
      and user_id is not null and length(btrim(user_id)) > 0
      and idempotency_key is not null and length(btrim(idempotency_key)) > 0
      and customer_name is not null and length(btrim(customer_name)) > 0
      and phone is not null and length(btrim(phone)) > 0
      and status is not null and status in ('pending', 'preparing', 'ready_for_pickup', 'collected', 'cancelled')
      and delivery_status is not distinct from 'none' and rider_id is null and lat is null and lng is null
      and payment_method is not null and payment_method in ('cash', 'card_machine')
      and delivery_fee is not distinct from 0 and discount_amount is not distinct from 0 and tip_amount is not distinct from 0
      and price is not null and price >= 0 and service_fee is not null and service_fee >= 0
      and total_price is not null and total_price = price + service_fee
      and price::text not in ('NaN', 'Infinity', '-Infinity')
      and service_fee::text not in ('NaN', 'Infinity', '-Infinity')
      and total_price::text not in ('NaN', 'Infinity', '-Infinity')
      and price = round(price, 2) and service_fee = round(service_fee, 2)
      and total_price = round(total_price, 2)
      and items is not null and jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0
      and ((status in ('pending', 'preparing', 'cancelled') and payment_status = 'unpaid')
        or status = 'ready_for_pickup' or (status = 'collected' and payment_status = 'paid'))
    )
  ) not valid;
-- NOT VALID avoids a historical heap scan under the ALTER TABLE lock. New writes are still checked.
-- A later approved maintenance window may VALIDATE these checks without rewriting history.

-- These facts also supply the customer Ready inbox. No second notification payload/table.
create table public.pickup_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  revision bigint not null check (revision >= 0),
  command_id uuid not null,
  command_hash text not null check (command_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('created', 'accepted', 'ready', 'merchant_rejected', 'customer_cancelled', 'payment_confirmed', 'collected')),
  actor_uid text not null check (length(btrim(actor_uid)) > 0),
  recipient_uid text,
  occurred_at timestamptz not null default statement_timestamp(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  unique (order_id, revision),
  unique (order_id, command_id),
  unique (order_id, kind),
  check ((kind = 'ready' and recipient_uid is not null and length(btrim(recipient_uid)) > 0)
    or (kind <> 'ready' and recipient_uid is null))
);
create unique index pickup_single_cancellation on public.pickup_order_events(order_id)
  where kind in ('merchant_rejected', 'customer_cancelled');
create index pickup_ready_inbox on public.pickup_order_events(recipient_uid, occurred_at desc, id desc)
  where kind = 'ready';

-- FCM tokens only. No provider subscription or paid queue required.
create table public.pickup_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (length(btrim(user_id)) > 0),
  installation_id uuid not null,
  fcm_token text unique,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (user_id, installation_id),
  check ((revoked_at is null and fcm_token is not null and length(btrim(fcm_token)) > 0)
    or (revoked_at is not null and fcm_token is null))
);
create table public.pickup_push_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.pickup_order_events(id) on delete restrict,
  subscription_id uuid not null references public.pickup_push_subscriptions(id) on delete restrict,
  state text not null default 'pending' check (state in ('pending', 'sending', 'sent', 'abandoned')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  next_attempt_at timestamptz not null default statement_timestamp(),
  lease_until timestamptz,
  sent_at timestamptz,
  unique(event_id, subscription_id),
  check ((state = 'sending' and lease_until is not null) or (state <> 'sending' and lease_until is null)),
  check ((state = 'sent' and sent_at is not null) or (state <> 'sent' and sent_at is null))
);
create index pickup_push_due on public.pickup_push_outbox(next_attempt_at, id)
  where state in ('pending', 'sending');

-- Reject browser roles even if legacy orders policies are permissive.
-- No SECURITY DEFINER RPCs or public write policies are introduced.
create function public.guard_pickup_order() returns trigger language plpgsql
security invoker set search_path = '' as $guard$
begin
  if current_user not in ('service_role', 'postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED'; end if;
  if tg_op = 'DELETE' then
    if old.create_intent_hash is not null then raise exception 'PICKUP_HISTORY_IMMUTABLE'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.create_intent_hash is null then
    if row(new.delivery_type, new.payment_status, new.create_intent_hash, new.revision)
       is distinct from row(old.delivery_type, old.payment_status, old.create_intent_hash, old.revision) then
      raise exception 'LEGACY_PICKUP_CLASSIFICATION_REQUIRES_REVIEW';
    end if;
    return new;
  end if;
  if current_user not in ('service_role', 'postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED'; end if;
  if new.create_intent_hash is null then raise exception 'PICKUP_CONTRACT_REQUIRED'; end if;
  if tg_op = 'INSERT' then
    if new.revision is distinct from 0 or new.status is distinct from 'pending'
       or new.payment_status is distinct from 'unpaid' then raise exception 'PICKUP_INITIAL_STATE_INVALID'; end if;
    new.created_at := statement_timestamp();
    new.updated_at := statement_timestamp();
    return new;
  end if;
  if row(new.id, new.product_name, new.product_variant, new.create_intent_hash, new.user_id, new.shop_id, new.idempotency_key, new.items,
         new.price, new.total_price, new.service_fee, new.delivery_fee, new.discount_amount, new.tip_amount,
         new.customer_name, new.phone, new.email, new.address, new.city, new.notes, new.delivery_type,
         new.lat, new.lng, new.rider_id, new.delivery_status, new.created_at)
     is distinct from row(old.id, old.product_name, old.product_variant, old.create_intent_hash, old.user_id, old.shop_id, old.idempotency_key, old.items,
         old.price, old.total_price, old.service_fee, old.delivery_fee, old.discount_amount, old.tip_amount,
         old.customer_name, old.phone, old.email, old.address, old.city, old.notes, old.delivery_type,
         old.lat, old.lng, old.rider_id, old.delivery_status, old.created_at) then
    raise exception 'PICKUP_CREATION_FACTS_IMMUTABLE';
  end if;
  if new.revision is distinct from old.revision + 1 then raise exception 'PICKUP_REVISION_INVALID'; end if;
  if new.payment_status is distinct from old.payment_status then
    if old.status is distinct from 'ready_for_pickup' or new.status is distinct from old.status
       or old.payment_status is distinct from 'unpaid' or new.payment_status is distinct from 'paid' then
      raise exception 'PICKUP_PAYMENT_TRANSITION_INVALID';
    end if;
  else
    if new.payment_method is distinct from old.payment_method then raise exception 'PICKUP_PAYMENT_METHOD_IMMUTABLE'; end if;
    if not ((old.status = 'pending' and new.status in ('preparing', 'cancelled'))
      or (old.status = 'preparing' and new.status = 'ready_for_pickup')
      or (old.status = 'ready_for_pickup' and new.status = 'collected' and old.payment_status = 'paid')) then
      raise exception 'PICKUP_TRANSITION_INVALID';
    end if;
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$guard$;
create trigger guard_pickup_order before insert or update or delete on public.orders
  for each row execute function public.guard_pickup_order();

create function public.guard_pickup_event() returns trigger language plpgsql
security invoker set search_path = '' as $event$
declare o public.orders%rowtype; owner_uid text;
begin
  if tg_op <> 'INSERT' then raise exception 'PICKUP_EVENT_APPEND_ONLY'; end if;
  select * into strict o from public.orders where id = new.order_id;
  if o.create_intent_hash is null or new.revision is distinct from o.revision then raise exception 'PICKUP_EVENT_REVISION_INVALID'; end if;
  select owner_id into strict owner_uid from public.shops where id = o.shop_id;
  if (new.kind in ('created', 'customer_cancelled') and new.actor_uid is distinct from o.user_id)
    or (new.kind not in ('created', 'customer_cancelled') and new.actor_uid is distinct from owner_uid) then
    raise exception 'PICKUP_EVENT_ACTOR_INVALID';
  end if;
  if not ((new.kind = 'created' and o.revision = 0 and o.status = 'pending' and o.payment_status = 'unpaid')
    or (new.kind = 'accepted' and o.status = 'preparing' and o.payment_status = 'unpaid')
    or (new.kind = 'ready' and o.status = 'ready_for_pickup' and o.payment_status = 'unpaid')
    or (new.kind in ('merchant_rejected', 'customer_cancelled') and o.status = 'cancelled' and o.payment_status = 'unpaid')
    or (new.kind = 'payment_confirmed' and o.status = 'ready_for_pickup' and o.payment_status = 'paid')
    or (new.kind = 'collected' and o.status = 'collected' and o.payment_status = 'paid')) then
    raise exception 'PICKUP_EVENT_STATE_INVALID';
  end if;
  if new.kind = 'ready' then new.recipient_uid := o.user_id;
  else new.recipient_uid := null; end if;
  new.occurred_at := statement_timestamp();
  if new.kind in ('merchant_rejected', 'customer_cancelled') then
    if length(btrim(coalesce(new.details->>'reason', ''))) not between 1 and 500 then raise exception 'PICKUP_REASON_REQUIRED'; end if;
    new.details := jsonb_build_object('reason', btrim(new.details->>'reason'));
  elsif new.kind = 'payment_confirmed' then
    new.details := jsonb_build_object('amount', o.total_price, 'currency', 'ZAR', 'method', o.payment_method);
  else new.details := '{}'::jsonb;
  end if;
  return new;
end;
$event$;
create trigger guard_pickup_event before insert or update or delete on public.pickup_order_events
  for each row execute function public.guard_pickup_event();

-- The API must perform order mutation + matching event in ONE transaction.
-- Deferred checks make partial Ready/payment/collection transactions fail at commit.
create function public.require_pickup_fact_event() returns trigger language plpgsql
security invoker set search_path = '' as $fact$
declare expected_kind text;
begin
  if new.create_intent_hash is null then return null; end if;
  if tg_op = 'INSERT' then expected_kind := 'created';
  elsif new.payment_status is distinct from old.payment_status then expected_kind := 'payment_confirmed';
  elsif new.status = 'preparing' then expected_kind := 'accepted';
  elsif new.status = 'ready_for_pickup' then expected_kind := 'ready';
  elsif new.status = 'collected' then expected_kind := 'collected';
  else expected_kind := null;
  end if;
  if not exists (select 1 from public.pickup_order_events e where e.order_id = new.id and e.revision = new.revision
      and ((expected_kind is not null and e.kind = expected_kind)
        or (expected_kind is null and e.kind in ('merchant_rejected', 'customer_cancelled')))) then
    raise exception 'PICKUP_ATOMIC_EVENT_REQUIRED';
  end if;
  return null;
end;
$fact$;
create constraint trigger require_pickup_fact_event after insert or update on public.orders
  deferrable initially deferred for each row execute function public.require_pickup_fact_event();

create function public.guard_pickup_push_recipient() returns trigger language plpgsql
security invoker set search_path = '' as $recipient$
begin
  if tg_op = 'UPDATE' and row(new.event_id, new.subscription_id) is distinct from row(old.event_id, old.subscription_id) then
    raise exception 'PICKUP_PUSH_TARGET_IMMUTABLE';
  end if;
  if not exists (select 1 from public.pickup_order_events e
    join public.pickup_push_subscriptions s on s.user_id = e.recipient_uid
    where e.id = new.event_id and s.id = new.subscription_id and e.kind = 'ready') then
    raise exception 'PICKUP_PUSH_RECIPIENT_INVALID';
  end if;
  return new;
end;
$recipient$;
create trigger guard_pickup_push_recipient before insert or update on public.pickup_push_outbox
  for each row execute function public.guard_pickup_push_recipient();

create function public.guard_pickup_subscription() returns trigger language plpgsql
security invoker set search_path = '' as $subscription$
begin
  if tg_op = 'UPDATE' and row(new.id, new.user_id, new.installation_id)
      is distinct from row(old.id, old.user_id, old.installation_id) then
    raise exception 'PICKUP_SUBSCRIPTION_OWNER_IMMUTABLE';
  end if;
  if new.revoked_at is not null then new.fcm_token := null; end if;
  new.updated_at := statement_timestamp();
  if tg_op = 'INSERT' then new.created_at := statement_timestamp(); end if;
  return new;
end;
$subscription$;
create trigger guard_pickup_subscription before insert or update on public.pickup_push_subscriptions
  for each row execute function public.guard_pickup_subscription();

alter table public.pickup_order_events enable row level security;
alter table public.pickup_push_subscriptions enable row level security;
alter table public.pickup_push_outbox enable row level security;
revoke all on table public.pickup_order_events, public.pickup_push_subscriptions, public.pickup_push_outbox from public, anon, authenticated, service_role;
grant select, insert on table public.pickup_order_events to service_role;
grant select, insert, update on table public.pickup_push_subscriptions, public.pickup_push_outbox to service_role;
revoke all on function public.guard_pickup_order(), public.guard_pickup_event(), public.require_pickup_fact_event(), public.guard_pickup_push_recipient(), public.guard_pickup_subscription() from public, anon, authenticated;
grant execute on function public.guard_pickup_order(), public.guard_pickup_event(), public.require_pickup_fact_event(), public.guard_pickup_push_recipient(), public.guard_pickup_subscription() to service_role;
-- Existing orders grants/policies are NOT rewritten; verify them before rollout.
-- Application rollback: retain these columns/events and serve read-only managed orders.
-- Physical reversal is safe only before any managed order/event/subscription exists;
-- after use, never erase audit/payment/collection facts to run an older application.

-- API-owned transaction functions. Firebase UID is supplied ONLY by the authenticated API.
-- No browser role can execute these functions. All functions are SECURITY INVOKER.
create function public.pickup_create_order(p_uid text, p_intent_hash text, p_record jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $create$
declare o public.orders%rowtype; sh public.shops%rowtype; m public.menu_items%rowtype;
  line jsonb; subtotal numeric := 0; qty integer; fee numeric;
  slat double precision; slng double precision; clat double precision; clng double precision; a double precision;
begin
  if current_user not in ('service_role', 'postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED'; end if;
  if p_uid is null or length(btrim(p_uid)) = 0 or p_intent_hash is null or p_intent_hash !~ '^[0-9a-f]{64}$'
    or p_record->>'idempotency_key' is null then raise exception 'INVALID_REQUEST'; end if;
  -- Transaction advisory lock serializes equal keys, including concurrent first inserts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_record->>'idempotency_key', 0));
  select * into o from public.orders where idempotency_key = p_record->>'idempotency_key';
  if found then
    if o.user_id is distinct from p_uid or o.create_intent_hash is distinct from p_intent_hash then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('order', to_jsonb(o), 'replayed', true);
  end if;
  select * into sh from public.shops where id = p_record->>'shop_id' for share;
  if not found or sh.archived_at is not null or sh.approval_status is distinct from 'approved'
    or sh.is_active is distinct from true then raise exception 'SHOP_UNAVAILABLE'; end if;
  -- Recheck radius using the locked shop row; discovery coordinates are not a delivery location.
  slat := coalesce(to_jsonb(sh)->>'lat',to_jsonb(sh)->>'latitude')::double precision;
  slng := coalesce(to_jsonb(sh)->>'lng',to_jsonb(sh)->>'longitude')::double precision;
  clat := (p_record->'launch_location'->>'lat')::double precision;
  clng := (p_record->'launch_location'->>'lng')::double precision;
  if slat is null or slng is null or clat is null or clng is null
    or not (slat between -90 and 90 and clat between -90 and 90 and slng between -180 and 180 and clng between -180 and 180)
    then raise exception 'SHOP_LOCATION_UNAVAILABLE'; end if;
  a := power(sin(radians(slat-clat)/2),2) + cos(radians(slat))*cos(radians(clat))*power(sin(radians(slng-clng)/2),2);
  if 6371*2*asin(sqrt(least(1.0,greatest(0.0,a)))) > 4 then raise exception 'OUTSIDE_PICKUP_RADIUS'; end if;
  if sh.location is null or sh.location !~* '\m(tembisa|thembisa|ivory[[:space:]]+park)\M' then raise exception 'OUTSIDE_PICKUP_PILOT'; end if;
  if jsonb_typeof(p_record->'items') is distinct from 'array' then raise exception 'INVALID_ITEMS'; end if;
  if jsonb_array_length(p_record->'items') not between 1 and 50 then raise exception 'INVALID_ITEMS'; end if;
  if (select count(*) <> count(distinct x->>'menu_item_id') from jsonb_array_elements(p_record->'items') x) then
    raise exception 'INVALID_ITEMS';
  end if;
  -- Lock in stable item-id order to avoid deadlocks. Prices/availability cannot change before commit.
  for line in select x from jsonb_array_elements(p_record->'items') x order by x->>'menu_item_id' loop
    if jsonb_typeof(line->'quantity') is distinct from 'number' or (line->>'quantity')::numeric <> trunc((line->>'quantity')::numeric)
      then raise exception 'INVALID_QUANTITY'; end if;
    qty := (line->>'quantity')::integer;
    if qty not between 1 and 20 then raise exception 'INVALID_QUANTITY'; end if;
    select * into m from public.menu_items where id::text = line->>'menu_item_id' and shop_id::text = sh.id for share;
    if not found or m.is_available is distinct from true then raise exception 'MENU_ITEM_UNAVAILABLE'; end if;
    if m.price is null or m.price < 0 or m.price::text in ('NaN','Infinity','-Infinity') or m.price <> round(m.price,2)
      then raise exception 'INVALID_SERVER_PRICE'; end if;
    if (line->>'unit_price')::numeric is distinct from m.price or line->>'name' is distinct from m.name
      or (line->>'line_total')::numeric is distinct from m.price * qty then raise exception 'PRICE_CHANGED'; end if;
    subtotal := subtotal + m.price * qty;
  end loop;
  fee := case when subtotal > 0 then 2.50 else 0 end;
  if (p_record->>'price')::numeric is distinct from subtotal
    or (p_record->>'service_fee')::numeric is distinct from fee
    or (p_record->>'total_price')::numeric is distinct from subtotal + fee then raise exception 'PRICE_CHANGED'; end if;
  insert into public.orders(shop_id,user_id,product_name,product_variant,price,total_price,status,delivery_status,
    payment_method,customer_name,phone,email,address,city,lat,lng,notes,delivery_fee,service_fee,discount_amount,
    tip_amount,idempotency_key,items,delivery_type,payment_status,create_intent_hash,revision)
  values(sh.id,p_uid,p_record->>'product_name',null,subtotal,subtotal+fee,'pending','none',
    p_record->>'payment_method',p_record->>'customer_name',p_record->>'phone',p_record->>'email',
    p_record->>'address',p_record->>'city',null,null,p_record->>'notes',0,fee,0,0,
    p_record->>'idempotency_key',p_record->'items','collection','unpaid',p_intent_hash,0) returning * into o;
  insert into public.pickup_order_events(order_id,revision,command_id,command_hash,kind,actor_uid)
    values(o.id,0,(o.idempotency_key)::uuid,p_intent_hash,'created',p_uid);
  return jsonb_build_object('order',to_jsonb(o),'replayed',false);
end;
$create$;

create function public.pickup_order_command(p_uid text, p_order_id uuid, p_action text,
  p_command_id uuid, p_expected_revision bigint, p_reason text default null, p_payment_method text default null,
  p_handover_confirmed boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $command$
declare o public.orders%rowtype; e public.pickup_order_events%rowtype; owner_uid text;
  h text; k text; target text;
begin
  if current_user not in ('service_role', 'postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED'; end if;
  if p_uid is null or btrim(p_uid) = '' or p_command_id is null or p_expected_revision is null
    or p_expected_revision < 0 or p_expected_revision > 9007199254740990 then raise exception 'INVALID_COMMAND'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select owner_id into owner_uid from public.shops where id = o.shop_id for share;
  if (p_action = 'cancel' and o.user_id is distinct from p_uid)
    or (p_action <> 'cancel' and owner_uid is distinct from p_uid) then raise exception 'FORBIDDEN'; end if;
  if o.delivery_type is distinct from 'collection' or o.create_intent_hash is null then raise exception 'PICKUP_CONTRACT_REQUIRED'; end if;
  k := case p_action when 'accept' then 'accepted' when 'ready' then 'ready' when 'reject' then 'merchant_rejected'
    when 'cancel' then 'customer_cancelled' when 'confirm_payment' then 'payment_confirmed' when 'collect' then 'collected' end;
  if k is null then raise exception 'INVALID_COMMAND'; end if;
  -- Hash only normalized semantic input, including actual actor, order and explicit confirmations.
  h := encode(sha256(convert_to(jsonb_build_object('uid',p_uid,'order',p_order_id,'action',p_action,
    'revision',p_expected_revision,'reason',btrim(p_reason),'method',p_payment_method,'handover',p_handover_confirmed)::text,'UTF8')),'hex');
  select * into e from public.pickup_order_events where order_id = o.id and command_id = p_command_id;
  if found then
    if e.actor_uid is distinct from p_uid or e.kind is distinct from k or e.command_hash is distinct from h
      then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('order',to_jsonb(o),'event',to_jsonb(e),'replayed',true);
  end if;
  if o.revision is distinct from p_expected_revision then raise exception 'ORDER_STATE_CHANGED'; end if;
  if o.delivery_status is distinct from 'none' or o.rider_id is not null or o.lat is not null or o.lng is not null
    or o.payment_status is null or o.status is null or o.status in ('collected','cancelled')
    or not ((o.status in ('pending','preparing') and o.payment_status = 'unpaid')
      or (o.status = 'ready_for_pickup' and o.payment_status in ('unpaid','paid'))) then
    raise exception 'INVALID_ORDER_TRANSITION';
  end if;
  target := o.status;
  if p_action = 'accept' and o.status = 'pending' then target := 'preparing';
  elsif p_action = 'ready' and o.status = 'preparing' then target := 'ready_for_pickup';
  elsif p_action in ('reject','cancel') and o.status = 'pending' then
    if length(btrim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'INVALID_CANCELLATION'; end if;
    target := 'cancelled';
  elsif p_action = 'confirm_payment' and o.status = 'ready_for_pickup' and o.payment_status = 'unpaid' then
    if p_payment_method is null or p_payment_method not in ('cash','card_machine') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  elsif p_action = 'collect' and o.status = 'ready_for_pickup' and o.payment_status = 'paid' then
    if p_handover_confirmed is distinct from true then raise exception 'HANDOVER_CONFIRMATION_REQUIRED'; end if;
    target := 'collected';
  else raise exception 'INVALID_ORDER_TRANSITION'; end if;
  if (p_action <> 'confirm_payment' and p_payment_method is not null)
    or (p_action not in ('reject','cancel') and p_reason is not null)
    or (p_action <> 'collect' and p_handover_confirmed is distinct from false) then raise exception 'INVALID_COMMAND'; end if;
  update public.orders set status = target, revision = revision + 1, updated_at = statement_timestamp(),
    payment_status = case when p_action = 'confirm_payment' then 'paid' else payment_status end,
    payment_method = case when p_action = 'confirm_payment' then p_payment_method else payment_method end
    where id = o.id returning * into o;
  insert into public.pickup_order_events(order_id,revision,command_id,command_hash,kind,actor_uid,details)
    values(o.id,o.revision,p_command_id,h,k,p_uid,case when p_action in ('reject','cancel')
      then jsonb_build_object('reason',btrim(p_reason)) else '{}'::jsonb end) returning * into e;
  if p_action = 'ready' then
    insert into public.pickup_push_outbox(event_id,subscription_id)
      select e.id,s.id from public.pickup_push_subscriptions s where s.user_id = o.user_id and s.revoked_at is null;
  end if;
  return jsonb_build_object('order',to_jsonb(o),'event',to_jsonb(e),'replayed',false);
end;
$command$;

-- Claims and completions are scoped to the authenticated customer or current merchant owner.
-- Attempts is the fencing generation: a reclaimed lease increments it, invalidating stale workers.
create function public.pickup_claim_push(p_uid text)
returns jsonb language plpgsql security invoker set search_path = '' as $claim$
declare j public.pickup_push_outbox%rowtype; e public.pickup_order_events%rowtype;
  o public.orders%rowtype; s public.pickup_push_subscriptions%rowtype;
begin
  if current_user not in ('service_role','postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED'; end if;
  if p_uid is null or btrim(p_uid) = '' then raise exception 'FORBIDDEN'; end if;
  -- Bounded scan, including exhausted expired leases: they become abandoned rather than immortal.
  for j in select q.* from public.pickup_push_outbox q
    join public.pickup_order_events ev on ev.id = q.event_id join public.orders ord on ord.id = ev.order_id
    join public.shops sh on sh.id = ord.shop_id
    where (ev.recipient_uid = p_uid or sh.owner_id = p_uid) and q.state in ('pending','sending')
      and q.next_attempt_at <= statement_timestamp() and (q.lease_until is null or q.lease_until <= statement_timestamp())
    order by q.next_attempt_at,q.id limit 10 for update of q skip locked loop
    select * into e from public.pickup_order_events where id = j.event_id;
    select * into o from public.orders where id = e.order_id;
    select * into s from public.pickup_push_subscriptions where id = j.subscription_id;
    if j.attempts >= 5 or s.revoked_at is not null or s.fcm_token is null or s.user_id is distinct from e.recipient_uid
      or o.status is distinct from 'ready_for_pickup' then
      update public.pickup_push_outbox set state = 'abandoned',lease_until = null where id = j.id;
      continue;
    end if;
    update public.pickup_push_outbox set state = 'sending', attempts = attempts+1,
      lease_until = statement_timestamp() + interval '30 seconds' where id = j.id returning * into j;
    return jsonb_build_object('id',j.id,'attempts',j.attempts,'lease_until',j.lease_until,
      'event_id',e.id,'order_id',o.id,'token',s.fcm_token);
  end loop;
  return null;
end;
$claim$;

create function public.pickup_push_sendable(p_uid text,p_job uuid,p_attempt integer,p_lease timestamptz,p_token text)
returns boolean language sql security invoker set search_path = '' as $sendable$
  select current_user in ('service_role','postgres') and exists (
    select 1 from public.pickup_push_outbox q join public.pickup_order_events e on e.id=q.event_id
    join public.orders o on o.id=e.order_id join public.shops sh on sh.id=o.shop_id
    join public.pickup_push_subscriptions s on s.id=q.subscription_id
    where q.id=p_job and q.attempts=p_attempt and q.lease_until=p_lease and q.lease_until>statement_timestamp()
      and q.state='sending' and s.revoked_at is null and s.fcm_token=p_token and s.user_id=e.recipient_uid
      and o.status='ready_for_pickup' and (e.recipient_uid=p_uid or sh.owner_id=p_uid));
$sendable$;

create function public.pickup_finish_push(p_uid text,p_job uuid,p_attempt integer,p_lease timestamptz,p_sent boolean,p_permanent boolean default false)
returns boolean language plpgsql security invoker set search_path = '' as $finish$
begin
  if current_user not in ('service_role','postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED'; end if;
  update public.pickup_push_outbox q set
    state = case when p_sent then 'sent' when q.attempts >= 5 or p_permanent then 'abandoned' else 'pending' end,
    sent_at = case when p_sent then statement_timestamp() else null end,
    next_attempt_at = statement_timestamp() + (interval '30 seconds' * power(2,q.attempts)), lease_until = null
    from public.pickup_order_events e, public.orders o, public.shops sh
    where q.id=p_job and q.event_id=e.id and e.order_id=o.id and o.shop_id=sh.id
      and (e.recipient_uid=p_uid or sh.owner_id=p_uid) and q.state='sending'
      and q.attempts=p_attempt and q.lease_until=p_lease and q.lease_until>statement_timestamp();
  return found;
end;
$finish$;

revoke all on function public.pickup_create_order(text,text,jsonb),
  public.pickup_order_command(text,uuid,text,uuid,bigint,text,text,boolean),public.pickup_claim_push(text),
  public.pickup_push_sendable(text,uuid,integer,timestamptz,text),public.pickup_finish_push(text,uuid,integer,timestamptz,boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.pickup_create_order(text,text,jsonb),
  public.pickup_order_command(text,uuid,text,uuid,bigint,text,text,boolean),public.pickup_claim_push(text),
  public.pickup_push_sendable(text,uuid,integer,timestamptz,text),public.pickup_finish_push(text,uuid,integer,timestamptz,boolean,boolean)
  to service_role;
commit;
