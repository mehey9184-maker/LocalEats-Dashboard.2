do $$ begin
 begin
  perform public.pickup_order_command('merchant',(select id from public.acceptance_race_id),'accept',gen_random_uuid(),0);
  raise exception 'WAITING_ACCEPT_BYPASSED_DEADLINE';
 exception when others then if sqlerrm<>'ORDER_ACCEPTANCE_EXPIRED' then raise;end if;end;
end $$;
select public.pickup_sweep_acceptance();
do $$ begin
 if (select acceptance_expired_at is null from public.orders where id=(select id from public.acceptance_race_id)) then raise exception 'RACE_NOT_PERSISTED';end if;
end $$;
select 'POST_LOCK_REAL_CLOCK_DEADLINE_PASSED';
