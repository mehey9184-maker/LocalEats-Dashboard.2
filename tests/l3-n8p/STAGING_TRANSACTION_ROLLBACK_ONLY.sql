-- L3-N8P approved STAGING-ONLY rehearsal; run through Supabase execute_sql
-- against EXACT project rgpbdajhlrwfmhopzgzk, NEVER Production.
-- DML only, ONE transaction, always ROLLBACK. No rule changes, trigger
-- modifications, RPC installs, actual Firebase users or FCM sends.
-- This cannot certify API Firebase Auth or real merchant pickup completion.
begin;
set local lock_timeout='3s';
set local statement_timeout='25s';
do $l3_n8p_rollback$
declare
  shop_a text:='stg-test-shop-n8p-rollback-a';
  shop_b text:='stg-test-shop-n8p-rollback-b';
  owner_a text:='stg-test-owner-n8p-rollback-a';
  owner_b text:='stg-test-owner-n8p-rollback-b';
  customer_a text:='stg-test-customer-n8p-rollback-a';
  item_a text:='stg-test-item-n8p-rollback-a';
  catalog_price numeric;
  changed integer;
  blocked boolean:=false;
  caught text;
begin
  -- Refuse to target an unexpected/dirty schema or previously committed fixture.
  if to_regclass('public.orders') is null
     or to_regclass('public.pickup_order_events') is null
     or to_regclass('public.pickup_push_outbox') is null
     or not exists (
       select 1 from pg_trigger
        where tgrelid='public.orders'::regclass
          and tgname='l3_n8o_orders_hard_off'
          and tgenabled='O'
     )
     or exists(select 1 from public.shops where id in (shop_a,shop_b))
     or exists(select 1 from public.menu_items where id=item_a)
  then raise exception 'L3_N8P_BAD_STAGE_BASELINE'; end if;

  if has_table_privilege('anon','public.orders','INSERT')
     or has_table_privilege('authenticated','public.orders','SELECT')
  then raise exception 'L3_N8P_BROWSER_PRIVILEGE_LEAK'; end if;

  -- Synthetic owner identities are strings ONLY: NO Firebase account exists.
  insert into public.shops(id,owner_id,name,location,approval_status,is_active,latitude,longitude)
    values (shop_a,owner_a,'STAGING TEST N8P OWNER A','STAGING TEST Area A','approved',true,0,0),
           (shop_b,owner_b,'STAGING TEST N8P OWNER B','STAGING TEST Area B','approved',true,0,0);
  insert into public.menu_items(id,shop_id,name,price,is_available)
    values(item_a,shop_a,'STAGING TEST Kota',25.00,true);

  select price into catalog_price
    from public.menu_items where id=item_a and shop_id=shop_a;
  if catalog_price is distinct from 25.00 then
    raise exception 'L3_N8P_CATALOG_PRICE_MISMATCH'; end if;
  if exists(select 1 from public.menu_items where id=item_a and price=0.01) then
    raise exception 'L3_N8P_CLIENT_PRICE_TRUST_BROKEN'; end if;

  -- The SQL predicate used by a future server-authorized merchant command
  -- excludes a different merchant; this does NOT prove API UID verification.
  update public.menu_items m set price=30.00
    from public.shops s
    where m.id=item_a and m.shop_id=s.id and s.owner_id=owner_b;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'L3_N8P_FOREIGN_OWNER_UPDATE'; end if;

  update public.menu_items m set price=25.00
    from public.shops s
    where m.id=item_a and m.shop_id=s.id and s.owner_id=owner_a;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'L3_N8P_OWNER_SCOPE_UNAVAILABLE'; end if;

  -- Even with legitimate-looking pickup payload and a valid test shop,
  -- unverified Firebase and a disabled RPC must NEVER produce an order.
  begin
    insert into public.orders(
      shop_id,user_id,price,total_price,status,delivery_status,
      payment_method,customer_name,phone,delivery_fee,service_fee,
      discount_amount,tip_amount,idempotency_key,items,delivery_type,
      payment_status,create_intent_hash,revision
    ) values (
      shop_a,customer_a,25,25,'pending','none',
      'cash','STAGING TEST CUSTOMER','synthetic-no-phone',0,0,
      0,0,gen_random_uuid()::text,
      jsonb_build_array(jsonb_build_object(
        'menu_item_id',item_a,'quantity',1,'unit_price',25,
        'line_total',25
      )),'collection','unpaid',repeat('a',64),0
    );
  exception when others then
    get stacked diagnostics caught=message_text;
    if caught='L3_N8O_STAGING_PICKUP_WRITES_DISABLED' then blocked:=true;
    else raise exception 'L3_N8P_UNEXPECTED_ORDER_FAILURE:%',caught; end if;
  end;
  if not blocked then raise exception 'L3_N8P_ORDER_HARD_OFF_BYPASSED'; end if;
  if exists(select 1 from public.orders o where o.shop_id in (shop_a,shop_b))
  then raise exception 'L3_N8P_UNEXPECTED_STAGED_ORDER'; end if;
end;
$l3_n8p_rollback$;

-- The following SELECT is only a transient in-transaction assertion.
-- The next statement ALWAYS rolls back synthetic shops/menus.
select
  (select count(*) from public.shops where id in
   ('stg-test-shop-n8p-rollback-a','stg-test-shop-n8p-rollback-b'))::int as transient_shops,
  (select count(*) from public.menu_items where id='stg-test-item-n8p-rollback-a')::int as transient_items,
  (select count(*) from public.orders where user_id='stg-test-customer-n8p-rollback-a')::int as transient_orders;
rollback;
