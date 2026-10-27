begin;
set local role service_role;
select public.pickup_order_command('customer',(select id from public.orders where idempotency_key='550e8400-e29b-41d4-a716-000000000050'),'cancel','550e8400-e29b-41d4-a716-000000000052',0,'Cancelled by customer');
select pg_sleep(0.3);
commit;
