begin;

-- Canonical shops use text IDs. These dependent commerce tables must use the
-- same type or real shop orders cannot be persisted.
alter table public.orders
  alter column shop_id type text using shop_id::text;

alter table public.rider_connections
  alter column shop_id type text using shop_id::text;

alter table public.orders
  add column if not exists delivery_type text,
  add column if not exists delivery_pin_hash text,
  add column if not exists delivery_qr_hash text;

update public.orders
set delivery_type = case
  when lat is not null and lng is not null then 'delivery'
  else 'collection'
end
where delivery_type is null;

alter table public.orders
  alter column delivery_type set default 'collection',
  alter column delivery_type set not null;

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
  );

alter table public.orders
  alter column idempotency_key set not null;

alter table public.rider_profiles
  add column if not exists firebase_uid text;

create unique index if not exists rider_profiles_firebase_uid_key
  on public.rider_profiles (firebase_uid)
  where firebase_uid is not null;

create or replace function public.claim_delivery_order(
  p_order_id uuid,
  p_firebase_uid text
)
returns setof public.orders
language plpgsql
security definer
set search_path = public, pg_temp
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

  if not exists (
    select 1
    from public.rider_connections
    where shop_id = v_order.shop_id
      and rider_id = v_rider.id
      and status in ('active', 'approved')
      and (expires_at is null or expires_at > now())
  ) then
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

create or replace function public.complete_delivery_order(
  p_order_id uuid,
  p_firebase_uid text,
  p_delivery_proof_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rider public.rider_profiles%rowtype;
  v_order public.orders%rowtype;
  v_earnings numeric;
begin
  select * into v_rider
  from public.rider_profiles
  where firebase_uid = p_firebase_uid
    and verification_status = 'approved'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Rider is not approved';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found';
  end if;

  if v_order.rider_id is distinct from v_rider.id then
    raise exception using errcode = '42501', message = 'Rider is not assigned to this order';
  end if;

  if p_delivery_proof_hash is null or not (
    p_delivery_proof_hash = v_order.delivery_pin_hash
    or p_delivery_proof_hash = v_order.delivery_qr_hash
  ) then
    raise exception using errcode = '22023', message = 'Delivery confirmation is invalid';
  end if;

  if v_order.delivery_status = 'delivered' then
    return jsonb_build_object('order', to_jsonb(v_order), 'earnings_awarded', 0, 'replayed', true);
  end if;

  if v_order.delivery_status <> 'delivering' then
    raise exception using errcode = '55000', message = 'Order is not ready for delivery completion';
  end if;

  v_earnings := greatest(coalesce(v_order.delivery_fee, 0), 0);

  update public.orders
  set status = 'delivered',
      delivery_status = 'delivered',
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  update public.rider_profiles
  set total_earnings = coalesce(total_earnings, 0) + v_earnings,
      total_deliveries = coalesce(total_deliveries, 0) + 1,
      active_points = coalesce(active_points, 0) + 10,
      updated_at = now()
  where id = v_rider.id;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'earnings_awarded', v_earnings,
    'replayed', false
  );
end;
$$;

revoke all on function public.claim_delivery_order(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_delivery_order(uuid, text) to service_role;

revoke all on function public.complete_delivery_order(uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_delivery_order(uuid, text, text) to service_role;

commit;
