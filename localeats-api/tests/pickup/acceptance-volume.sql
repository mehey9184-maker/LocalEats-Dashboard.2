-- SYNTHETIC ONLY: 180 virtual days, exactly 2500 new requests; no hosted/cloud traffic.
create or replace function public.pickup_acceptance_now() returns timestamptz language sql volatile security invoker set search_path='' as $$select current_setting('test.acceptance_now')::timestamptz$$;
do $$ declare day integer;i integer;count_before integer;n integer:=100000;oid uuid;sh public.shops%rowtype;origin timestamptz:='2026-12-01T10:00:00Z';
begin
 select count(*) into count_before from public.orders;
 for day in 0..179 loop
  perform set_config('test.acceptance_now',(origin+day*interval '1 day')::text,false);
  select * into sh from public.shops where id='shop';
  if sh.pickup_reception_paused then perform public.pickup_resume_reception('merchant','shop',sh.pickup_reception_revision);end if;
  for i in 1..(case when day<160 then 14 else 13 end) loop
   n:=n+1;oid:=public.test_acceptance_order(n);
   if i%5=0 then
    perform public.pickup_order_command('deadline-customer',oid,'cancel',gen_random_uuid(),0,'Changed plans');
   elsif i<=12 then
    perform public.pickup_order_command('merchant',oid,'accept',gen_random_uuid(),0);
    perform public.pickup_order_command('merchant',oid,'ready',gen_random_uuid(),1);
    perform public.pickup_order_command('merchant',oid,'confirm_payment',gen_random_uuid(),2,null,'cash');
    perform public.pickup_order_command('merchant',oid,'collect',gen_random_uuid(),3,null,null,true);
   end if;
  end loop;
  perform set_config('test.acceptance_now',(origin+day*interval '1 day'+interval '2 minutes')::text,false);
  perform public.pickup_sweep_acceptance();perform public.pickup_sweep_acceptance();
  perform set_config('test.acceptance_now',(origin+day*interval '1 day'+interval '5 minutes')::text,false);
  perform public.pickup_sweep_acceptance();perform public.pickup_sweep_acceptance();
 end loop;
 if (select count(*) from public.orders)-count_before<>2500 then raise exception 'VOLUME_NOT_2500';end if;
 if (select count(*) from public.orders where acceptance_deadline_at>=origin and status='collected')<>1800 then raise exception 'COLLECTION_COUNT_MISMATCH';end if;
 if (select count(*) from public.orders where acceptance_deadline_at>=origin and status='cancelled' and acceptance_expired_at is null)<>360 then raise exception 'CUSTOMER_CANCELLATION_COUNT_MISMATCH';end if;
 if (select count(*) from public.orders where acceptance_deadline_at>=origin and acceptance_expired_at is not null)<>340 then raise exception 'EXPIRY_COUNT_MISMATCH';end if;
 if exists(select 1 from public.orders where acceptance_deadline_at>=origin and status='pending') then raise exception 'UNRESOLVED_VOLUME_ORDER';end if;
 if exists(select order_id from public.pickup_order_events group by order_id,kind having count(*)>1) then raise exception 'DUPLICATE_EVENT';end if;
 raise notice 'SIX_MONTH_SIMULATION_PASSED: 180 days,2500 orders,1800 collected,360 customer-cancelled,340 expired. No real users/payments/push.';
end $$;
-- Backlog fairness: >10 shops and >100 orders in one shop must all advance.
set test.acceptance_now='2027-06-01T10:00:00Z';
insert into public.shops(id,owner_id,name,location,is_active,approval_status,lat,lng,latitude,longitude)
 select 'fair-'||n,'merchant','Synthetic fairness shop','Tembisa synthetic fixture',true,'approved',-26,28,-26,28 from generate_series(0,11) n;
insert into public.menu_items(id,shop_id,name,price,is_available) select id||'-item',id,'Fixture meal',25,true from public.shops where id like 'fair-%';
update public.shops set availability_override_until=clock_timestamp()+interval '1 day' where id like 'fair-%';
do $$ begin
 for i in 1..201 loop perform public.test_acceptance_order(200000+i,'fair-0');end loop;
 for i in 1..11 loop perform public.test_acceptance_order(201000+i,'fair-'||i);end loop;
end $$;
set test.acceptance_now='2027-06-01T10:02:00Z';
select public.pickup_sweep_acceptance();select public.pickup_sweep_acceptance();select public.pickup_sweep_acceptance();
do $$ begin
 if (select count(*) from public.pickup_acceptance_notices n join public.orders o on o.id=n.order_id where o.shop_id like 'fair-%' and n.kind='merchant_reminder')<>212 then raise exception 'REMINDER_BACKLOG_STARVED';end if;
end $$;
set test.acceptance_now='2027-06-01T10:05:00Z';
select public.pickup_sweep_acceptance();select public.pickup_sweep_acceptance();select public.pickup_sweep_acceptance();
do $$ begin
 if (select count(*) from public.orders where shop_id like 'fair-%' and acceptance_expired_at is not null)<>212 then raise exception 'EXPIRY_BACKLOG_STARVED';end if;
end $$;
select 'ACCEPTANCE_BACKLOG_FAIRNESS_PASSED';
