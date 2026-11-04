do $$
declare o public.orders%rowtype;
begin
  select * into strict o from public.orders where idempotency_key='550e8400-e29b-41d4-a716-000000000050';
  if o.revision <> 1 or o.status not in ('preparing','cancelled') or
    (select count(*) from public.pickup_order_events where order_id=o.id) <> 2 then raise exception 'RACE_ASSERTION_FAILED'; end if;
end $$;
select 'PICKUP_CONCURRENT_CREATION_AND_ACCEPT_CANCEL_PASSED';
