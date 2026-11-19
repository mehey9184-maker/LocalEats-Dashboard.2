-- Disposable local database only; fixture clock never appears in the deployment draft.
create or replace function public.pickup_acceptance_now() returns timestamptz language sql security invoker
set search_path='' as $$ select current_setting('test.acceptance_now')::timestamptz $$;
set test.acceptance_now='2026-11-19T10:00:00Z';
update public.pickup_acceptance_settings set enabled=true;
update public.shops set availability_override_until=clock_timestamp()+interval '1 day' where id='shop';
insert into public.pickup_push_subscriptions(user_id,installation_id,fcm_token) values
 ('merchant','550e8400-e29b-41d4-a716-000000009901','synthetic-merchant-token'),
 ('deadline-customer','550e8400-e29b-41d4-a716-000000009902','synthetic-customer-token');
-- All existing SQL lifecycle/race tests run before this fixture, preserving their independent coverage.
create function public.test_acceptance_order(n integer,p_shop text default 'shop') returns uuid language plpgsql as $$
declare result jsonb; oid uuid;
begin
 result:=public.pickup_create_order('deadline-customer',repeat('a',64),jsonb_build_object(
 'shop_id',p_shop,'idempotency_key','550e8400-e29b-41d4-a716-'||lpad(n::text,12,'0'),'items',jsonb_build_array(jsonb_build_object('menu_item_id',case when p_shop='shop' then 'item' else p_shop||'-item' end,'name','Fixture meal','quantity',1,'unit_price',25,'line_total',25)),
 'price',25,'service_fee',0,'total_price',25,'payment_method','cash','customer_name','Synthetic','phone','0000000000',
 'launch_location',jsonb_build_object('lat',-26,'lng',28)));
 oid:=(result->'order'->>'id')::uuid; return oid;
end $$;
create temporary table deadline_ids(n integer primary key,id uuid);
insert into deadline_ids values(1,public.test_acceptance_order(1)),(2,public.test_acceptance_order(2)),(3,public.test_acceptance_order(3));
do $$ begin
 if exists(select 1 from public.orders o join deadline_ids i on i.id=o.id where o.acceptance_deadline_at<>'2026-11-19T10:05:00Z') then raise exception 'DEADLINE_NOT_SERVER_DERIVED';end if;
end $$;
set test.acceptance_now='2026-11-19T10:02:00Z';
select public.pickup_sweep_acceptance();
select public.pickup_sweep_acceptance();
do $$ begin
 if (select count(*) from public.pickup_acceptance_notices where kind='merchant_reminder')<>3 then raise exception 'REMINDER_DUPLICATE_OR_MISSING';end if;
 if jsonb_array_length(public.pickup_acceptance_inbox('other'))<>0 then raise exception 'CROSS_ACCOUNT_INBOX';end if;
 if jsonb_array_length(public.pickup_acceptance_inbox('merchant'))<>3 then raise exception 'MERCHANT_REMINDER_INBOX';end if;
 if (select count(*) from public.pickup_acceptance_push_jobs)<>3 then raise exception 'REMINDER_OUTBOX_DUPLICATE';end if;
end $$;
update public.shops set owner_id='transferred-owner' where id='shop';
do $$ begin
 if jsonb_array_length(public.pickup_acceptance_inbox('merchant'))<>0 then raise exception 'FORMER_OWNER_NOTICES_VISIBLE';end if;
end $$;
update public.shops set owner_id='merchant' where id='shop';
-- Synthetic sender lease; stale completions cannot mark another attempt sent.
create temporary table claimed_job as select public.pickup_claim_acceptance_push() as job;
do $$ declare j jsonb;begin
 select job into j from claimed_job;
 if not public.pickup_acceptance_push_sendable((j->>'id')::uuid,(j->>'attempts')::integer,(j->>'lease_until')::timestamptz,j->>'token') then raise exception 'CLAIM_NOT_SENDABLE';end if;
 if public.pickup_finish_acceptance_push((j->>'id')::uuid,99,(j->>'lease_until')::timestamptz,true) then raise exception 'STALE_WORKER_FINISHED';end if;
 if not public.pickup_finish_acceptance_push((j->>'id')::uuid,(j->>'attempts')::integer,(j->>'lease_until')::timestamptz,false,false) then raise exception 'FAILURE_NOT_RETRIED';end if;
end $$;
-- Accept one before cutoff; reminder is no longer eligible afterwards.
select public.pickup_order_command('merchant',(select id from deadline_ids where n=3),'accept',gen_random_uuid(),0);
do $$ begin
 if jsonb_array_length(public.pickup_acceptance_inbox('merchant'))<>2 then raise exception 'STALE_REMINDER_AFTER_ACCEPT';end if;
end $$;
set test.acceptance_now='2026-11-19T10:05:00Z';
do $$ begin
 begin
 perform public.pickup_order_command('merchant',(select id from deadline_ids where n=1),'accept',gen_random_uuid(),0);
 raise exception 'LATE_ACCEPT_SUCCEEDED';
 exception when others then if sqlerrm<>'ORDER_ACCEPTANCE_EXPIRED' then raise;end if;end;
end $$;
select public.pickup_sweep_acceptance();
select public.pickup_sweep_acceptance();
do $$ begin
 if (select count(*) from public.orders o join deadline_ids i on i.id=o.id where i.n<3 and o.status='cancelled' and o.acceptance_expired_at is not null and o.revision=1)<>2 then raise exception 'EXPIRY_NOT_ATOMIC';end if;
 if (select count(*) from public.pickup_order_events e join deadline_ids i on i.id=e.order_id where kind='acceptance_expired')<>2 then raise exception 'EXPIRY_EVENT_MISSING_OR_DUPLICATE';end if;
 if not (select pickup_reception_paused from public.shops where id='shop') then raise exception 'MISSED_SHOP_NOT_PAUSED';end if;
 if (select status from public.orders where id=(select id from deadline_ids where n=3))<>'preparing' then raise exception 'ACCEPTED_ORDER_EXPIRED';end if;
 begin perform public.test_acceptance_order(4);raise exception 'PAUSED_SHOP_CREATED';exception when others then if sqlerrm<>'SHOP_RECEPTION_PAUSED' then raise;end if;end;
 begin perform public.pickup_resume_reception('other','shop',1);raise exception 'WRONG_OWNER_RESUMED';exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
select public.pickup_resume_reception('merchant','shop',1);
insert into deadline_ids values(4,public.test_acceptance_order(4));
set test.acceptance_now='2026-11-19T10:10:00Z';
select public.pickup_sweep_acceptance();
do $$ begin
 if (select pickup_reception_paused from public.shops where id='shop') then raise exception 'OLD_MISSES_REPAUSED';end if;
end $$;
-- A real server clock, unlike the deterministic fixture, changes between worker and guard.
create or replace function public.pickup_acceptance_now() returns timestamptz language sql volatile security invoker set search_path='' as $$select clock_timestamp()+interval '10 minutes'$$;
select public.pickup_sweep_acceptance();
do $$ begin
 if jsonb_array_length(public.pickup_acceptance_inbox('deadline-customer'))<>3 then raise exception 'CUSTOMER_EXPIRY_INBOX';end if;
end $$;
-- Browser database roles cannot invoke workers, read notices, resume or change settings.
set role authenticated;
do $$ begin
 begin perform public.pickup_sweep_acceptance();raise exception 'PUBLIC_WORKER';exception when insufficient_privilege then null;end;
 begin perform * from public.pickup_acceptance_notices;raise exception 'PUBLIC_NOTICES';exception when insufficient_privilege then null;end;
 begin update public.pickup_acceptance_settings set enabled=true;raise exception 'PUBLIC_SETTINGS';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'ACCEPTANCE_DEADLINE_SQL_PASSED';
