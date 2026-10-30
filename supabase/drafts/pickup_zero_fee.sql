-- REVIEW DRAFT ONLY: separate owner approval required before Production application.
-- Changes only the new pickup creation fee. Preserves function identity/grants, replay and historical rows.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $preflight$
begin
  if (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc
      where oid = 'public.pickup_create_order(text,text,jsonb)'::regprocedure) is distinct from '6ff9319db511da669b0489cef8d18fe6f252269096b243f3d40e3fc20696836a' then
    raise exception 'PICKUP_CREATE_FUNCTION_DRIFT';
  end if;
end;
$preflight$;
create or replace function public.pickup_create_order(p_uid text, p_intent_hash text, p_record jsonb)
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
  fee := 0;
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
commit;
