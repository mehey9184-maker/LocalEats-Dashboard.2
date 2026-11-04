-- Disposable fixtures only. Production invocation is forbidden.
create function pg_temp.av_assert(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'AVAILABILITY ASSERT: %',label; end if;end $$;
select pg_temp.av_assert(not public.shop_schedule_open('08:00','20:00','2026-10-31 00:05+02'),'midnight scheduled closed');
select pg_temp.av_assert(public.shop_schedule_open('18:00','02:00','2026-10-31 00:05+02'),'overnight open');
select pg_temp.av_assert(not public.shop_schedule_open('18:00','02:00','2026-10-31 02:00+02'),'closing boundary exclusive');
select pg_temp.av_assert(public.shop_schedule_open('08:00','20:00','2026-10-31 06:00+00'),'SAST independent of session timezone');
select pg_temp.av_assert(not public.shop_schedule_open('08:00','08:00',now()),'equal hours fail closed');
select pg_temp.av_assert(not public.shop_schedule_open('bad','20:00',now()),'malformed hours fail closed');
begin;
update public.shops set opening_time='08:00',closing_time='20:00',is_active=true,availability_override_until='2026-10-31 01:05+02' where id='shop';
select pg_temp.av_assert((select public.shop_effective_open(s,'2026-10-31 00:05+02') from public.shops s where id='shop'),'manual opening overrides schedule');
select pg_temp.av_assert(not (select public.shop_effective_open(s,'2026-10-31 01:05+02') from public.shops s where id='shop'),'expiry enforced without dashboard');
update public.shops set is_active=false where id='shop';
select pg_temp.av_assert(not (select public.shop_effective_open(s,'2026-10-31 00:06+02') from public.shops s where id='shop'),'manual close dominates opening');
rollback;
DO $$declare revision bigint; response jsonb; failed boolean;
begin
 select availability_revision into revision from public.shops where id='shop';
 failed:=false;begin perform public.merchant_set_availability('other','shop',false,false,revision);exception when others then if sqlerrm='FORBIDDEN' then failed:=true;else raise;end if;end;
 if not failed then raise exception 'ownership bypass';end if;
 failed:=false;begin perform public.merchant_set_availability('merchant','shop',false,false,revision+1);exception when others then if sqlerrm='AVAILABILITY_CHANGED' then failed:=true;else raise;end if;end;
 if not failed then raise exception 'revision bypass';end if;
 response:=public.merchant_set_availability('merchant','shop',false,false,revision);
 if response->>'is_active'<>'false' then raise exception 'close not saved';end if;
 select availability_revision into revision from public.shops where id='shop';
 perform public.merchant_set_availability('merchant','shop',true,true,revision);
end $$;
begin;
update public.shops set opening_time='08:00',closing_time='08:00' where id='shop';
DO $$declare revision bigint; response jsonb; failed boolean:=false;
begin
 select availability_revision into revision from public.shops where id='shop';
 begin perform public.merchant_set_availability('merchant','shop',true,false,revision);exception when others then if sqlerrm='OUTSIDE_HOURS_CONFIRMATION_REQUIRED' then failed:=true;else raise;end if;end;
 if not failed then raise exception 'outside hours opened without consent';end if;
 response:=public.merchant_set_availability('merchant','shop',true,true,revision);
 if abs(extract(epoch from ((response->>'availability_override_until')::timestamptz-clock_timestamp()))-3600)>2 then raise exception 'not one hour';end if;
end $$;
rollback;
-- Do not retain any state from availability tests.
update public.shops set is_active=true,opening_time='00:00',closing_time='23:59',availability_override_until=null where id='shop';
select 'AVAILABILITY_SQL_PASSED';
