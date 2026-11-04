begin;
set local role service_role;
select public.merchant_set_availability('merchant','shop',false,false,(select availability_revision from public.shops where id='shop'));
select pg_sleep(1);
commit;
