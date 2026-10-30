
\set ON_ERROR_STOP on
create function pg_temp.assert_ok(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %',label; end if; end $$;
create function pg_temp.expect_error(statement text,expected text) returns void language plpgsql as $$
declare caught text;
begin
  begin execute statement; exception when others then get stacked diagnostics caught=message_text; end;
  if caught is null or position(expected in caught)=0 then raise exception 'Expected %, got %',expected,coalesce(caught,'SUCCESS'); end if;
end $$;
select pg_temp.assert_ok((select count(*)=4 from public.orders where create_intent_hash is null and payment_status is null and delivery_type is null and revision is null),'history remains unknown');
set role authenticated;
select pg_temp.expect_error($q$insert into public.orders(shop_id) values('shop')$q$,'PICKUP_SERVER_AUTHORITY_REQUIRED');
select pg_temp.expect_error($q$update public.orders set status='pending' where id='550e8400-e29b-41d4-a716-000000000091'$q$,'PICKUP_SERVER_AUTHORITY_REQUIRED');
select pg_temp.expect_error($q$select public.pickup_create_order('x',repeat('a',64),'{}')$q$,'permission denied');
select pg_temp.expect_error($q$select * from public.pickup_order_events$q$,'permission denied');
reset role;
select pg_temp.expect_error($q$insert into public.orders(shop_id) values('shop')$q$,'PICKUP_CONTRACT_REQUIRED');
-- Existing authorized delivery continuation remains possible without classifying history.
set role service_role;
update public.orders set delivery_status='picked_up' where id='550e8400-e29b-41d4-a716-000000000093';
reset role;
select pg_temp.assert_ok((select delivery_status='picked_up' and create_intent_hash is null from public.orders where id='550e8400-e29b-41d4-a716-000000000093'),'delivery drain retained');
create function pg_temp.record(key text default '550e8400-e29b-41d4-a716-000000000001') returns jsonb language sql as $$
 select jsonb_build_object('shop_id','shop','idempotency_key',key,'items',jsonb_build_array(jsonb_build_object('menu_item_id','item','name','Fixture meal','unit_price',25,'quantity',1,'line_total',25)),
   'product_name','Fixture meal','price',25,'service_fee',0,'total_price',25,'payment_method','cash','customer_name','Fixture customer','phone','+27712345678','email','','address','','city','','launch_location',jsonb_build_object('lat',-26.0,'lng',28.0));
$$;
set role service_role;
select public.pickup_create_order('customer',repeat('a',64),pg_temp.record()) as result \gset created_
reset role;
select (:'created_result'::jsonb->'order'->>'id') as oid \gset
select pg_temp.assert_ok((select count(*)=1 from public.pickup_order_events where order_id=:'oid'),'creation fact committed');
select pg_temp.assert_ok((select price=25 and total_price=25 and service_fee=0 and delivery_fee=0 and discount_amount=0 and payment_status='unpaid' from public.orders where id=:'oid'),'zero-fee persisted pickup amount');
select pg_temp.expect_error($q$select public.pickup_create_order('customer',repeat('f',64),jsonb_set(pg_temp.record('550e8400-e29b-41d4-a716-000000000099'),'{service_fee}','2.5'))$q$,'PRICE_CHANGED');
-- Immutable create replay survives catalog closure and never transfers customer ownership.
update public.shops set is_active=false;
set role service_role;
select pg_temp.assert_ok((public.pickup_create_order('customer',repeat('a',64),pg_temp.record())->>'replayed')::boolean,'replay before availability');
select pg_temp.expect_error($q$select public.pickup_create_order('other',repeat('a',64),pg_temp.record())$q$,'IDEMPOTENCY_CONFLICT');
select pg_temp.expect_error($q$select public.pickup_create_order('customer',repeat('b',64),pg_temp.record())$q$,'IDEMPOTENCY_CONFLICT');
select pg_temp.expect_error($q$select public.pickup_create_order('customer',repeat('a',64),pg_temp.record('550e8400-e29b-41d4-a716-000000000002'))$q$,'SHOP_UNAVAILABLE');
reset role;
update public.shops set is_active=true;
select pg_temp.expect_error($q$select public.pickup_create_order('customer',repeat('a',64),jsonb_set(pg_temp.record('550e8400-e29b-41d4-a716-000000000002'),'{items,0,unit_price}','1'))$q$,'PRICE_CHANGED');
select pg_temp.expect_error($q$select public.pickup_create_order('customer',repeat('a',64),jsonb_set(pg_temp.record('550e8400-e29b-41d4-a716-000000000002'),'{launch_location,lat}','-20'))$q$,'OUTSIDE_PICKUP_RADIUS');
-- A bare order update cannot commit without its matching event. Exception block rolls it back.
do $$ begin
  begin
    update public.orders set status='preparing',revision=1 where idempotency_key='550e8400-e29b-41d4-a716-000000000001';
    set constraints all immediate;
    raise exception 'EXPECTED ATOMIC CHECK';
  exception when others then
    if sqlerrm not like '%PICKUP_ATOMIC_EVENT_REQUIRED%' then raise; end if;
  end;
end $$;
select pg_temp.assert_ok((select status='pending' and revision=0 from public.orders where id=:'oid'),'failed transaction rolled back');
-- Two devices, one revoked. Only active recipient receives a job.
insert into public.pickup_push_subscriptions(user_id,installation_id,fcm_token) values
 ('customer','550e8400-e29b-41d4-a716-000000000011','synthetic-permitted-token'),
 ('customer','550e8400-e29b-41d4-a716-000000000012','synthetic-revoked-token');
update public.pickup_push_subscriptions set revoked_at=now() where installation_id='550e8400-e29b-41d4-a716-000000000012';
select pg_temp.assert_ok((select fcm_token is null from public.pickup_push_subscriptions where installation_id='550e8400-e29b-41d4-a716-000000000012'),'revocation clears token');
set role service_role;
select public.pickup_order_command('merchant',:'oid','accept','550e8400-e29b-41d4-a716-000000000021',0);
select public.pickup_order_command('merchant',:'oid','ready','550e8400-e29b-41d4-a716-000000000022',1);
select pg_temp.assert_ok((public.pickup_order_command('merchant',:'oid','ready','550e8400-e29b-41d4-a716-000000000022',1)->>'replayed')::boolean,'duplicate Ready replays');
reset role;
select pg_temp.assert_ok((select count(*)=1 from public.pickup_order_events where order_id=:'oid' and kind='ready'),'one inbox fact');
select pg_temp.assert_ok((select count(*)=1 from public.pickup_push_outbox),'one active-device job');
-- Claims are scoped, non-overlapping, rechecked before send, and fenced on completion.
set role service_role;
select pg_temp.assert_ok(public.pickup_claim_push('other') is null,'outbox ownership');
select public.pickup_claim_push('customer') as result \gset first_
select pg_temp.assert_ok(public.pickup_claim_push('merchant') is null,'no overlapping claim');
reset role;
select (:'first_result'::jsonb->>'id') as job, (:'first_result'::jsonb->>'lease_until') as lease \gset
select pg_temp.assert_ok(public.pickup_push_sendable('customer',:'job',1,:'lease','synthetic-permitted-token'),'send recheck');
select pg_temp.assert_ok(not public.pickup_push_sendable('customer',:'job',1,:'lease','old-token'),'rotation fenced');
update public.pickup_push_outbox set lease_until=now()-interval '1 second';
select public.pickup_claim_push('customer') as result \gset second_
select pg_temp.assert_ok((:'second_result'::jsonb->>'attempts')::integer=2,'expired lease reclaimed with generation');
select pg_temp.assert_ok(not public.pickup_finish_push('customer',:'job',1,:'lease',true),'stale worker cannot acknowledge');
-- Exhausted expired workers must be abandoned, never leased a sixth time.
update public.pickup_push_outbox set attempts=5,lease_until=now()-interval '1 second';
select pg_temp.assert_ok(public.pickup_claim_push('customer') is null,'exhausted lease not returned');
select pg_temp.assert_ok((select state='abandoned' from public.pickup_push_outbox where id=:'job'),'exhausted lease abandoned');
-- Payment remains independent and method is captured from the merchant confirmation.
select pg_temp.expect_error(format('select public.pickup_order_command(%L,%L,%L,%L,2)','merchant',:'oid','collect','550e8400-e29b-41d4-a716-000000000023'),'INVALID_ORDER_TRANSITION');
select pg_temp.expect_error(format('select public.pickup_order_command(%L,%L,%L,%L,2)','merchant',:'oid','confirm_payment','550e8400-e29b-41d4-a716-000000000023'),'INVALID_PAYMENT_METHOD');
select pg_temp.expect_error(format('select public.pickup_order_command(%L,%L,%L,%L,2,null,%L)','other',:'oid','confirm_payment','550e8400-e29b-41d4-a716-000000000023','cash'),'FORBIDDEN');
set role service_role;
select public.pickup_order_command('merchant',:'oid','confirm_payment','550e8400-e29b-41d4-a716-000000000023',2,null,'card_machine');
reset role;
select pg_temp.assert_ok((select status='ready_for_pickup' and payment_status='paid' and payment_method='card_machine' from public.orders where id=:'oid'),'payment did not collect');
select pg_temp.assert_ok((select details->>'method'='card_machine' and (details->>'amount')::numeric=25 from public.pickup_order_events where order_id=:'oid' and kind='payment_confirmed'),'payment fact server amount and method');
select pg_temp.assert_ok((public.pickup_create_order('customer',repeat('a',64),pg_temp.record())->>'replayed')::boolean,'creation replay after method switch');
select pg_temp.expect_error(format('select public.pickup_order_command(%L,%L,%L,%L,3)','merchant',:'oid','collect','550e8400-e29b-41d4-a716-000000000024'),'HANDOVER_CONFIRMATION_REQUIRED');
set role service_role;
select public.pickup_order_command('merchant',:'oid','collect','550e8400-e29b-41d4-a716-000000000024',3,null,null,true);
select pg_temp.assert_ok((public.pickup_order_command('merchant',:'oid','ready','550e8400-e29b-41d4-a716-000000000022',1)->>'replayed')::boolean,'Ready replay after collection');
reset role;
select pg_temp.expect_error(format('select public.pickup_order_command(%L,%L,%L,%L,4)','merchant',:'oid','accept','550e8400-e29b-41d4-a716-000000000025'),'INVALID_ORDER_TRANSITION');
select pg_temp.expect_error(format('update public.orders set create_intent_hash=repeat(%L,64),revision=5 where id=%L','b',:'oid'),'PICKUP_CREATION_FACTS_IMMUTABLE');
select pg_temp.expect_error(format('delete from public.pickup_order_events where order_id=%L',:'oid'),'PICKUP_EVENT_APPEND_ONLY');
select pg_temp.assert_ok((select count(*)=5 from public.pickup_order_events where order_id=:'oid'),'all five independent facts retained');

-- Pending-only rejection/customer cancellation; changed command and actor cannot replay.
select public.pickup_create_order('customer',repeat('b',64),pg_temp.record('550e8400-e29b-41d4-a716-000000000002')) as result \gset cancel_
select (:'cancel_result'::jsonb->'order'->>'id') as cancelled_id \gset
select public.pickup_order_command('merchant',:'cancelled_id','reject','550e8400-e29b-41d4-a716-000000000031',0,'Sold out');
select pg_temp.expect_error(format('select public.pickup_order_command(%L,%L,%L,%L,1)','merchant',:'cancelled_id','accept','550e8400-e29b-41d4-a716-000000000032'),'INVALID_ORDER_TRANSITION');
select pg_temp.expect_error(format('select public.pickup_order_command(%L,%L,%L,%L,0,%L)','merchant',:'cancelled_id','reject','550e8400-e29b-41d4-a716-000000000031','Changed reason'),'IDEMPOTENCY_CONFLICT');
select public.pickup_create_order('customer',repeat('c',64),pg_temp.record('550e8400-e29b-41d4-a716-000000000003')) as result \gset customer_cancel_
select (:'customer_cancel_result'::jsonb->'order'->>'id') as customer_cancelled_id \gset
select pg_temp.expect_error(format('select public.pickup_order_command(%L,%L,%L,%L,0,%L)','other',:'customer_cancelled_id','cancel','550e8400-e29b-41d4-a716-000000000033','Changed mind'),'FORBIDDEN');
select public.pickup_order_command('customer',:'customer_cancelled_id','cancel','550e8400-e29b-41d4-a716-000000000033',0,'Changed mind');
-- Ready without event and payment without event each roll back their independent projection.
select public.pickup_create_order('customer',repeat('d',64),pg_temp.record('550e8400-e29b-41d4-a716-000000000004')) as result \gset atomic_
select (:'atomic_result'::jsonb->'order'->>'id') as atomic_id \gset
select public.pickup_order_command('merchant',:'atomic_id','accept','550e8400-e29b-41d4-a716-000000000041',0);
do $$ begin
  begin
    update public.orders set status='ready_for_pickup',revision=2 where idempotency_key='550e8400-e29b-41d4-a716-000000000004';
    set constraints all immediate;
    raise exception 'EXPECTED READY CHECK';
  exception when others then if sqlerrm not like '%PICKUP_ATOMIC_EVENT_REQUIRED%' then raise; end if; end;
end $$;
select public.pickup_order_command('merchant',:'atomic_id','ready','550e8400-e29b-41d4-a716-000000000042',1);
do $$ begin
  begin
    update public.orders set payment_status='paid',revision=3 where idempotency_key='550e8400-e29b-41d4-a716-000000000004';
    set constraints all immediate;
    raise exception 'EXPECTED PAYMENT CHECK';
  exception when others then if sqlerrm not like '%PICKUP_ATOMIC_EVENT_REQUIRED%' then raise; end if; end;
end $$;
select pg_temp.assert_ok((select payment_status='unpaid' and revision=2 from public.orders where id=:'atomic_id'),'payment projection rolled back');
select public.pickup_claim_push('customer') as result \gset revoke_
select (:'revoke_result'::jsonb->>'id') as revoke_job, (:'revoke_result'::jsonb->>'lease_until') as revoke_lease \gset
update public.pickup_push_subscriptions set revoked_at=now() where installation_id='550e8400-e29b-41d4-a716-000000000011';
select pg_temp.assert_ok(not public.pickup_push_sendable('customer',:'revoke_job',1,:'revoke_lease','synthetic-permitted-token'),'revoked leased subscription cannot send');
select 'PICKUP_POSTGRES_ASSERTIONS_PASSED' as result;
