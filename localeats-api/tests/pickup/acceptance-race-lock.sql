set application_name='acceptance-lock-holder';
begin;
select id from public.orders where id=(select id from public.acceptance_race_id) for update;
select pg_sleep(7);
commit;
