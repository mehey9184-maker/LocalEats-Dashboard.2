-- L3-N1 DESIGN DRAFT ONLY. DO NOT APPLY TO PRODUCTION OR SHARED PREVIEW.
-- Apply only in independently verified disposable/isolated Supabase staging.
-- The server-side diagnostic function is service_role-only; browser direct writes denied.
create table if not exists public.customer_push_test_attempts (
  firebase_uid text primary key,
  last_attempt_at timestamptz not null,
  quota_date date not null,
  quota_count integer not null check (quota_count between 1 and 10)
);
alter table public.customer_push_test_attempts enable row level security;
revoke all on public.customer_push_test_attempts from public, anon, authenticated;
grant select,insert,update on public.customer_push_test_attempts to service_role;

create or replace function public.claim_customer_push_test_attempt(p_uid text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare claimed boolean := false;
begin
  if p_uid is null or length(p_uid)<1 or length(p_uid)>256 then return false; end if;
  insert into public.customer_push_test_attempts as t
      (firebase_uid,last_attempt_at,quota_date,quota_count)
  values(p_uid,clock_timestamp(),(clock_timestamp() at time zone 'UTC')::date,1)
  on conflict(firebase_uid) do update set
    last_attempt_at=clock_timestamp(),
    quota_date=(clock_timestamp() at time zone 'UTC')::date,
    quota_count=case when t.quota_date=(clock_timestamp() at time zone 'UTC')::date
      then t.quota_count+1 else 1 end
  where t.last_attempt_at <= clock_timestamp()-interval '60 seconds'
    and (t.quota_date<>(clock_timestamp() at time zone 'UTC')::date or t.quota_count<10)
  returning true into claimed;
  return coalesce(claimed,false);
end;
$$;
revoke all on function public.claim_customer_push_test_attempt(text) from public, anon, authenticated;
grant execute on function public.claim_customer_push_test_attempt(text) to service_role;

-- Isolated staging verification requirements before use:
-- 1. Authenticated and anonymous/browser roles cannot execute the RPC or read this table.
-- 2. 20 concurrent calls for one UID grant exactly one permit within 60 seconds.
-- 3. Eleven successive time-separated calls in one UTC day grant at most ten permits.
-- 4. No order, user, payment, reward, notification-outbox or merchant table is modified.
-- 5. Disposable-DB restore and rollback: drop function then drop table ONLY in staging.
