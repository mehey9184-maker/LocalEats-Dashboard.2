-- SYNTHETIC DISPOSABLE PG17 ONLY. Executed after the reviewed function
-- body is installed and the review-only hash-pinned replacement succeeds.
create function public.synthetic_pickup_record(p_shop text,p_key uuid,p_total numeric default 25)
returns jsonb language sql stable set search_path='' as $body$
select jsonb_build_object(
 'idempotency_key',p_key::text,
 'shop_id',p_shop,
 'launch_location',jsonb_build_object('lat',-26.0,'lng',28.0),
 'items',jsonb_build_array(jsonb_build_object(
   'menu_item_id',(select m.id::text from public.menu_items m where m.shop_id=p_shop limit 1),
   'quantity',1,'name','Kota','unit_price',25,'line_total',25)),
 'price',p_total,'service_fee',0,'total_price',p_total,
 'payment_method','cash','product_name','Kota',
 'customer_name','Synthetic Pickup QA','phone','0000000000');
$body$;
grant execute on function public.synthetic_pickup_record(text,uuid,numeric) to service_role;

do $preflight$
begin
 if (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc
     where oid=to_regprocedure('public.pickup_create_order(text,text,jsonb)')) <>
    'd4f2f67aa2ff03120d4de27a4860f56defd770cf3c53016a1759709737da4eb1'
 then raise exception 'PICKUP_ANY_TOWN_TARGET_HASH_MISMATCH'; end if;
 if has_function_privilege('anon','public.pickup_create_order(text,text,jsonb)','EXECUTE')
   or has_function_privilege('authenticated','public.pickup_create_order(text,text,jsonb)','EXECUTE')
   or not has_function_privilege('service_role','public.pickup_create_order(text,text,jsonb)','EXECUTE')
 then raise exception 'PICKUP_ANY_TOWN_ROLE_PRIVILEGES_CHANGED'; end if;
end $preflight$;

set role service_role;
do $exercise$
declare
  shop text;
  record jsonb;
  saved jsonb;
  replay jsonb;
  k uuid;
  error_text text;
  count_orders int;
  count_events int;
begin
  -- Three genuinely nearby shops with completely different town metadata,
  -- including NULL, can now be ordered at their verified menu price.
  foreach shop in array array['cosmo','pretoria','no-town'] loop
    k := gen_random_uuid();
    record := public.synthetic_pickup_record(shop,k,25);
    saved := public.pickup_create_order('synthetic-customer',repeat('a',64),record);
    if saved->>'replayed' <> 'false'
      or saved->'order'->>'shop_id' is distinct from shop
      or saved->'order'->>'delivery_type' is distinct from 'collection'
      or saved->'order'->>'payment_status' is distinct from 'unpaid'
      or (saved->'order'->>'total_price')::numeric is distinct from 25
      or (saved->'order'->>'service_fee')::numeric is distinct from 0
    then raise exception 'PICKUP_ANY_TOWN_ORDER_CONTENT_MISMATCH for %',shop; end if;

    replay := public.pickup_create_order('synthetic-customer',repeat('a',64),record);
    if replay->>'replayed'<>'true'
       or replay->'order'->>'id' is distinct from saved->'order'->>'id'
    then raise exception 'PICKUP_ANY_TOWN_IDEMPOTENCY_REPLAY_MISMATCH for %',shop; end if;

    -- A second identity cannot take possession of the first user's idempotency key.
    begin
      perform public.pickup_create_order('another-customer',repeat('a',64),record);
      raise exception 'PICKUP_ANY_TOWN_CROSS_ACCOUNT_IDEMPOTENCY_ALLOWED';
    exception when raise_exception then
      get stacked diagnostics error_text = message_text;
      if error_text<>'IDEMPOTENCY_CONFLICT' then raise; end if;
    end;
  end loop;

  -- Distance, approval, archival, open state, verified coordinate, and
  -- authoritative totals stay enforced. No error may create order/events.
  foreach shop in array array['far','closed','pending','archived','missing-pin'] loop
    record := public.synthetic_pickup_record(shop,gen_random_uuid(),25);
    begin
      perform public.pickup_create_order('synthetic-customer',repeat('a',64),record);
      raise exception 'PICKUP_ANY_TOWN_UNSAFE_SHOP_ACCEPTED';
    exception when raise_exception then
      get stacked diagnostics error_text = message_text;
      if (shop='far' and error_text <> 'OUTSIDE_PICKUP_RADIUS')
         or (shop in ('closed','pending','archived') and error_text <> 'SHOP_UNAVAILABLE')
         or (shop='missing-pin' and error_text <> 'SHOP_LOCATION_UNAVAILABLE')
      then raise exception 'PICKUP_ANY_TOWN_WRONG_FAILURE for %: %',shop,error_text; end if;
    end;
  end loop;

  -- Even a nearby approved shop cannot underpay.
  record := public.synthetic_pickup_record('cosmo',gen_random_uuid(),1);
  begin
    perform public.pickup_create_order('synthetic-customer',repeat('a',64),record);
    raise exception 'PICKUP_ANY_TOWN_ACCEPTED_CLIENT_PRICE';
  exception when raise_exception then
    get stacked diagnostics error_text = message_text;
    if error_text <> 'PRICE_CHANGED' then raise; end if;
  end;

  select count(*) into count_orders from public.orders;
  select count(*) into count_events from public.pickup_order_events;
  if count_orders<>3 or count_events<>3
  then raise exception 'PICKUP_ANY_TOWN_FALSE_SUCCESS_OR_DUPLICATE (%/%)',count_orders,count_events; end if;
end $exercise$;
reset role;

select 'PICKUP_ANY_TOWN_PG17_CREATE_AND_AUTHORITY_PASS' as result;
