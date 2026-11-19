-- Synthetic clock creates a five-second remaining deadline, then restores the real clock.
create or replace function public.pickup_acceptance_now() returns timestamptz language sql volatile security invoker set search_path='' as $$select clock_timestamp()-interval '4 minutes 55 seconds'$$;
create table public.acceptance_race_id as select public.test_acceptance_order(300001) id;
create or replace function public.pickup_acceptance_now() returns timestamptz language sql volatile security invoker set search_path='' as $$select clock_timestamp()$$;
