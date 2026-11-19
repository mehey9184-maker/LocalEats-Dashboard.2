-- REVIEW ONLY. Local disposable validation until separate hosted activation approval.
-- Never auto-apply or schedule. Existing/historical orders are not backfilled.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Refuse to replace a changed lifecycle guard; rebase/review rather than overwrite newer contracts.
do $$ begin
 if (select encode(sha256(convert_to(replace(prosrc,chr(13),''),'UTF8')),'hex') from pg_proc where oid='public.guard_pickup_event()'::regprocedure)
  is distinct from '2319584bc80251af3e07f4f43fc37ea1fc76b1f7cea0e1b5a27e3f594436536d'
 or (select encode(sha256(convert_to(replace(prosrc,chr(13),''),'UTF8')),'hex') from pg_proc where oid='public.require_pickup_fact_event()'::regprocedure)
  is distinct from '0d2604c982f8fbe01f37b53229e330837e4b404783f43272a9c186ba242bfd3d' then raise exception 'ACCEPTANCE_LIFECYCLE_GUARD_DRIFT';end if;
end $$;
create table public.pickup_acceptance_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into public.pickup_acceptance_settings values(true,false);
alter table public.orders add column acceptance_deadline_at timestamptz,
 add column acceptance_expired_at timestamptz;
alter table public.shops add column pickup_reception_paused boolean not null default false,
 add column pickup_reception_revision bigint not null default 0 check(pickup_reception_revision>=0),
 add column pickup_reception_resumed_at timestamptz;
-- Preserve the established availability view and append reception through a separate invoker view.
create view public.shops_with_pickup_reception with(security_invoker=true) as
 select v.*,s.pickup_reception_paused from public.shops_with_availability v join public.shops s on s.id=v.id;
revoke all on public.shops_with_pickup_reception from public,anon,authenticated;
grant select on public.shops_with_pickup_reception to service_role;
create index pickup_acceptance_due on public.orders(acceptance_deadline_at,shop_id,id)
 where status='pending' and acceptance_deadline_at is not null;
create index pickup_acceptance_misses on public.orders(shop_id,acceptance_deadline_at)
 where acceptance_expired_at is not null;
create table public.pickup_acceptance_notices(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),
 kind text not null check(kind in('merchant_reminder','customer_expired','merchant_paused')),
 recipient_uid text not null check(length(btrim(recipient_uid))>0),
 created_at timestamptz not null,unique(order_id,kind));
create index pickup_acceptance_notice_recipient on public.pickup_acceptance_notices(recipient_uid,created_at desc,id);
alter table public.pickup_acceptance_notices enable row level security;
alter table public.pickup_acceptance_settings enable row level security;
revoke all on public.pickup_acceptance_notices,public.pickup_acceptance_settings from public,anon,authenticated,service_role;
grant select,insert on public.pickup_acceptance_notices to service_role;
grant select on public.pickup_acceptance_settings to service_role;
-- No token or private payload is stored in a browser-readable table.
create function public.pickup_acceptance_now() returns timestamptz language sql volatile security invoker set search_path='' as $$select clock_timestamp()$$;

create function public.guard_pickup_acceptance() returns trigger language plpgsql security invoker set search_path='' as $$
declare t timestamptz; paused boolean;
begin
 if current_user not in('service_role','postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED';end if;
 t:=public.pickup_acceptance_now();
 if tg_op='INSERT' then
  new.acceptance_expired_at:=null;new.acceptance_deadline_at:=null;
  if new.create_intent_hash is not null and new.delivery_type='collection' and (select enabled from public.pickup_acceptance_settings where singleton) then
   select pickup_reception_paused into paused from public.shops where id=new.shop_id for share;
   if paused then raise exception 'SHOP_RECEPTION_PAUSED';end if;
   new.acceptance_deadline_at:=t+interval '5 minutes';
  end if;
 else
  if new.acceptance_deadline_at is distinct from old.acceptance_deadline_at then raise exception 'ACCEPTANCE_DEADLINE_IMMUTABLE';end if;
  if old.status='pending' and new.status='preparing' and old.acceptance_deadline_at<=t then raise exception 'ORDER_ACCEPTANCE_EXPIRED';end if;
  if new.acceptance_expired_at is distinct from old.acceptance_expired_at then
   if not coalesce(old.acceptance_expired_at is null and new.acceptance_expired_at is not null and old.status='pending'
    and new.status='cancelled' and old.payment_status='unpaid' and old.acceptance_deadline_at<=t,false) then raise exception 'INVALID_ACCEPTANCE_EXPIRY';end if;
   new.acceptance_expired_at:=t;
  end if;
 end if;
 return new;
end $$;
create trigger guard_pickup_acceptance before insert or update on public.orders for each row execute function public.guard_pickup_acceptance();

-- Extend the existing atomic audit contract with an explicit server actor, never impersonate an owner/customer.
alter table public.pickup_order_events drop constraint pickup_order_events_kind_check,
 drop constraint pickup_order_events_check;
alter table public.pickup_order_events add constraint pickup_order_events_kind_check check(kind in
 ('created','accepted','ready','merchant_rejected','customer_cancelled','payment_confirmed','collected','acceptance_expired')),
 add constraint pickup_order_events_check check((kind='ready' and recipient_uid is not null and length(btrim(recipient_uid))>0) or (kind<>'ready' and recipient_uid is null));
drop index public.pickup_single_cancellation;
create unique index pickup_single_cancellation on public.pickup_order_events(order_id) where kind in('merchant_rejected','customer_cancelled','acceptance_expired');

create or replace function public.guard_pickup_event() returns trigger language plpgsql security invoker set search_path='' as $$
declare o public.orders%rowtype; owner_uid text;
begin
 if tg_op<>'INSERT' then raise exception 'PICKUP_EVENT_APPEND_ONLY';end if;
 select * into strict o from public.orders where id=new.order_id;
 if o.create_intent_hash is null or new.revision is distinct from o.revision then raise exception 'PICKUP_EVENT_REVISION_INVALID';end if;
 select owner_id into strict owner_uid from public.shops where id=o.shop_id;
 if new.kind='acceptance_expired' then
  if current_user not in('service_role','postgres') or new.actor_uid<>'__localeats_acceptance_worker__'
    or o.status<>'cancelled' or o.payment_status<>'unpaid' or o.acceptance_expired_at is null then raise exception 'PICKUP_EVENT_ACTOR_INVALID';end if;
  new.details:=jsonb_build_object('reason','SHOP_ACCEPTANCE_TIMEOUT');
 else
  if (new.kind in('created','customer_cancelled') and new.actor_uid is distinct from o.user_id)
   or (new.kind not in('created','customer_cancelled') and new.actor_uid is distinct from owner_uid) then raise exception 'PICKUP_EVENT_ACTOR_INVALID';end if;
  if not ((new.kind='created' and o.revision=0 and o.status='pending' and o.payment_status='unpaid')
   or(new.kind='accepted' and o.status='preparing' and o.payment_status='unpaid')
   or(new.kind='ready' and o.status='ready_for_pickup' and o.payment_status='unpaid')
   or(new.kind in('merchant_rejected','customer_cancelled') and o.status='cancelled' and o.payment_status='unpaid')
   or(new.kind='payment_confirmed' and o.status='ready_for_pickup' and o.payment_status='paid')
   or(new.kind='collected' and o.status='collected' and o.payment_status='paid')) then raise exception 'PICKUP_EVENT_STATE_INVALID';end if;
  if new.kind in('merchant_rejected','customer_cancelled') then
   if length(btrim(coalesce(new.details->>'reason',''))) not between 1 and 500 then raise exception 'PICKUP_REASON_REQUIRED';end if;
   new.details:=jsonb_build_object('reason',btrim(new.details->>'reason'));
  elsif new.kind='payment_confirmed' then new.details:=jsonb_build_object('amount',o.total_price,'currency','ZAR','method',o.payment_method);
  else new.details:='{}'::jsonb;end if;
 end if;
 new.recipient_uid:=case when new.kind='ready' then o.user_id else null end;
 new.occurred_at:=case when new.kind='acceptance_expired' then o.acceptance_expired_at else statement_timestamp() end;return new;
end $$;
create or replace function public.require_pickup_fact_event() returns trigger language plpgsql security invoker set search_path='' as $$
declare expected_kind text;
begin
 if new.create_intent_hash is null then return null;end if;
 if tg_op='INSERT' then expected_kind:='created';
 elsif new.payment_status is distinct from old.payment_status then expected_kind:='payment_confirmed';
 elsif new.status='preparing' then expected_kind:='accepted';
 elsif new.status='ready_for_pickup' then expected_kind:='ready';
 elsif new.status='collected' then expected_kind:='collected';
 elsif new.acceptance_expired_at is not null then expected_kind:='acceptance_expired';
 else expected_kind:=null;end if;
 if not exists(select 1 from public.pickup_order_events e where e.order_id=new.id and e.revision=new.revision and
  ((expected_kind is not null and e.kind=expected_kind) or(expected_kind is null and e.kind in('merchant_rejected','customer_cancelled')))) then raise exception 'PICKUP_ATOMIC_EVENT_REQUIRED';end if;
 return null;
end $$;

-- Lock shops before their orders. SKIP LOCKED avoids waiting behind owner commands.
-- At most 10 shops and 100 due orders per shop per invocation. A missed run never permits late acceptance.
create function public.pickup_sweep_acceptance() returns integer language plpgsql security invoker set search_path='' as $$
declare sh public.shops%rowtype;o public.orders%rowtype;t timestamptz;cutoff timestamptz;misses integer;processed integer:=0;
begin
 if current_user not in('service_role','postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED';end if;
 if not(select enabled from public.pickup_acceptance_settings where singleton) then return 0;end if;
 cutoff:=public.pickup_acceptance_now();
 for sh in select s.* from public.shops s where exists(select 1 from public.orders ord where ord.shop_id=s.id
   and ord.status='pending' and ord.acceptance_deadline_at<=cutoff+interval '3 minutes'
   and (ord.acceptance_deadline_at<=cutoff or not exists(select 1 from public.pickup_acceptance_notices n where n.order_id=ord.id and n.kind='merchant_reminder')))
   order by (select min(ord.acceptance_deadline_at) from public.orders ord where ord.shop_id=s.id and ord.status='pending'
    and (ord.acceptance_deadline_at<=cutoff or not exists(select 1 from public.pickup_acceptance_notices n where n.order_id=ord.id and n.kind='merchant_reminder'))),s.id
   limit 10 for update of s skip locked loop
  for o in select ord.* from public.orders ord where ord.shop_id=sh.id and ord.status='pending'
   and ord.acceptance_deadline_at<=cutoff+interval '3 minutes'
   and (ord.acceptance_deadline_at<=cutoff or not exists(select 1 from public.pickup_acceptance_notices n where n.order_id=ord.id and n.kind='merchant_reminder'))
   order by ord.acceptance_deadline_at,ord.id limit 100 for update of ord skip locked loop
   t:=public.pickup_acceptance_now();
   if o.acceptance_deadline_at<=t then
    update public.orders set status='cancelled',revision=revision+1,acceptance_expired_at=t where id=o.id returning * into o;
    insert into public.pickup_order_events(order_id,revision,command_id,command_hash,kind,actor_uid)
     values(o.id,o.revision,gen_random_uuid(),repeat('0',64),'acceptance_expired','__localeats_acceptance_worker__');
    insert into public.pickup_acceptance_notices(order_id,kind,recipient_uid,created_at) values(o.id,'customer_expired',o.user_id,t) on conflict do nothing;
    select count(*) into misses from public.orders where shop_id=sh.id and acceptance_expired_at is not null
     and acceptance_deadline_at>coalesce(sh.pickup_reception_resumed_at,'-infinity'::timestamptz)
     and acceptance_deadline_at>=t-interval '30 minutes';
    if misses>=2 and not sh.pickup_reception_paused then
     update public.shops set pickup_reception_paused=true,pickup_reception_revision=pickup_reception_revision+1 where id=sh.id returning * into sh;
     insert into public.pickup_acceptance_notices(order_id,kind,recipient_uid,created_at) values(o.id,'merchant_paused',sh.owner_id,t) on conflict do nothing;
    end if;
   else
    insert into public.pickup_acceptance_notices(order_id,kind,recipient_uid,created_at) values(o.id,'merchant_reminder',sh.owner_id,t) on conflict do nothing;
   end if;
   processed:=processed+1;
  end loop;
 end loop;
 return processed;
end $$;

create function public.pickup_resume_reception(p_uid text,p_shop text,p_revision bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare sh public.shops%rowtype;
begin
 if current_user not in('service_role','postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED';end if;
 select * into sh from public.shops where id=p_shop for update;
 if not found or sh.owner_id is distinct from p_uid or p_uid is null or btrim(p_uid)='' or sh.approval_status is distinct from 'approved' or sh.archived_at is not null then raise exception 'FORBIDDEN';end if;
 if p_revision is null or p_revision<>sh.pickup_reception_revision then raise exception 'RECEPTION_STATE_CHANGED';end if;
 if sh.pickup_reception_paused then
  update public.shops set pickup_reception_paused=false,pickup_reception_revision=pickup_reception_revision+1,
   pickup_reception_resumed_at=public.pickup_acceptance_now() where id=sh.id returning * into sh;
 end if;
 return jsonb_build_object('shop_id',sh.id,'paused',sh.pickup_reception_paused,'revision',sh.pickup_reception_revision);
end $$;
revoke all on function public.pickup_acceptance_now(),public.guard_pickup_acceptance(),public.pickup_sweep_acceptance(),public.pickup_resume_reception(text,text,bigint) from public,anon,authenticated;
grant execute on function public.pickup_acceptance_now(),public.guard_pickup_acceptance(),public.pickup_sweep_acceptance(),public.pickup_resume_reception(text,text,bigint) to service_role;
-- Grant only the new pause bookkeeping columns; no opening hours or approval privileges.
grant update(pickup_reception_paused,pickup_reception_revision,pickup_reception_resumed_at) on public.shops to service_role;
create function public.pickup_reception_status(p_uid text,p_shop text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare sh public.shops%rowtype;
begin
 if current_user not in('service_role','postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED';end if;
 select * into sh from public.shops where id=p_shop;
 if not found or sh.owner_id is distinct from p_uid or p_uid is null or btrim(p_uid)='' or sh.approval_status is distinct from 'approved' or sh.archived_at is not null then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('shop_id',sh.id,'paused',sh.pickup_reception_paused,'revision',sh.pickup_reception_revision);
end $$;
create function public.pickup_acceptance_inbox(p_uid text) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if current_user not in('service_role','postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED';end if;
 if p_uid is null or btrim(p_uid)='' then raise exception 'FORBIDDEN';end if;
 return coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id) from(
  select nt.id,nt.order_id,o.shop_id,nt.kind,nt.created_at from public.pickup_acceptance_notices nt
  join public.orders o on o.id=nt.order_id join public.shops s on s.id=o.shop_id
  where nt.recipient_uid=p_uid and ((nt.kind='customer_expired' and o.user_id=p_uid and o.acceptance_expired_at is not null)
   or(nt.kind='merchant_reminder' and s.owner_id=p_uid and s.approval_status='approved' and s.archived_at is null and o.status='pending' and o.acceptance_deadline_at>public.pickup_acceptance_now())
   or(nt.kind='merchant_paused' and s.owner_id=p_uid and s.approval_status='approved' and s.archived_at is null and s.pickup_reception_paused))
  order by nt.created_at desc,nt.id limit 100
 ) n),'[]'::jsonb);
end $$;
revoke all on function public.pickup_reception_status(text,text),public.pickup_acceptance_inbox(text) from public,anon,authenticated;
grant execute on function public.pickup_reception_status(text,text),public.pickup_acceptance_inbox(text) to service_role;
create table public.pickup_acceptance_push_jobs(
 id uuid primary key default gen_random_uuid(),notice_id uuid not null references public.pickup_acceptance_notices(id),
 subscription_id uuid not null references public.pickup_push_subscriptions(id),
 state text not null default 'pending' check(state in('pending','sending','sent','abandoned')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 next_attempt_at timestamptz not null default clock_timestamp(),lease_until timestamptz,
 unique(notice_id,subscription_id),
 check((state='sending' and lease_until is not null) or(state<>'sending' and lease_until is null)));
create index pickup_acceptance_push_due on public.pickup_acceptance_push_jobs(next_attempt_at,id) where state in('pending','sending');
alter table public.pickup_acceptance_push_jobs enable row level security;
revoke all on public.pickup_acceptance_push_jobs from public,anon,authenticated,service_role;
grant select,insert,update on public.pickup_acceptance_push_jobs to service_role;
create function public.queue_pickup_acceptance_notice() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.pickup_acceptance_push_jobs(notice_id,subscription_id,next_attempt_at)
  select new.id,s.id,new.created_at from public.pickup_push_subscriptions s where s.user_id=new.recipient_uid and s.revoked_at is null;
 return new;
end $$;
create trigger queue_pickup_acceptance_notice after insert on public.pickup_acceptance_notices for each row execute function public.queue_pickup_acceptance_notice();
create function public.pickup_acceptance_notice_sendable(p_notice uuid,p_subscription uuid) returns boolean language sql volatile security invoker set search_path='' as $$
 select current_user in('service_role','postgres') and exists(
  select 1 from public.pickup_acceptance_notices n join public.orders o on o.id=n.order_id
  join public.shops sh on sh.id=o.shop_id join public.pickup_push_subscriptions s on s.id=p_subscription
  where n.id=p_notice and s.user_id=n.recipient_uid and s.revoked_at is null and s.fcm_token is not null
   and n.created_at>public.pickup_acceptance_now()-interval '15 minutes'
   and ((n.kind='customer_expired' and o.user_id=n.recipient_uid and o.acceptance_expired_at is not null)
    or(n.kind='merchant_reminder' and sh.owner_id=n.recipient_uid and sh.approval_status='approved' and sh.archived_at is null and o.status='pending' and o.acceptance_deadline_at>public.pickup_acceptance_now())
    or(n.kind='merchant_paused' and sh.owner_id=n.recipient_uid and sh.approval_status='approved' and sh.archived_at is null and sh.pickup_reception_paused)));
$$;
create function public.pickup_claim_acceptance_push() returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.pickup_acceptance_push_jobs%rowtype;t timestamptz;token text;oid uuid;notice_kind text;
begin
 if current_user not in('service_role','postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED';end if;
 if not(select enabled from public.pickup_acceptance_settings where singleton) then return null;end if;
 t:=public.pickup_acceptance_now();
 for j in select * from public.pickup_acceptance_push_jobs where state in('pending','sending') and next_attempt_at<=t
  and(lease_until is null or lease_until<=t) order by next_attempt_at,id limit 10 for update skip locked loop
  if j.attempts>=3 or not public.pickup_acceptance_notice_sendable(j.notice_id,j.subscription_id) then
   update public.pickup_acceptance_push_jobs set state='abandoned',lease_until=null where id=j.id;continue;
  end if;
  update public.pickup_acceptance_push_jobs set state='sending',attempts=attempts+1,lease_until=t+interval '30 seconds' where id=j.id returning * into j;
  select fcm_token into token from public.pickup_push_subscriptions where id=j.subscription_id;
  select order_id,kind into oid,notice_kind from public.pickup_acceptance_notices where id=j.notice_id;
  return jsonb_build_object('id',j.id,'attempts',j.attempts,'lease_until',j.lease_until,'token',token,'order_id',oid,'kind',notice_kind);
 end loop;
 return null;
end $$;
create function public.pickup_acceptance_push_sendable(p_job uuid,p_attempt integer,p_lease timestamptz,p_token text) returns boolean language sql security invoker set search_path='' as $$
 select current_user in('service_role','postgres') and exists(select 1 from public.pickup_acceptance_push_jobs j where id=p_job
  and state='sending' and attempts=p_attempt and lease_until=p_lease and lease_until>public.pickup_acceptance_now()
  and exists(select 1 from public.pickup_push_subscriptions s where s.id=j.subscription_id and s.fcm_token=p_token)
  and public.pickup_acceptance_notice_sendable(notice_id,subscription_id));
$$;
create function public.pickup_finish_acceptance_push(p_job uuid,p_attempt integer,p_lease timestamptz,p_sent boolean,p_permanent boolean default false) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if current_user not in('service_role','postgres') then raise exception 'PICKUP_SERVER_AUTHORITY_REQUIRED';end if;
 update public.pickup_acceptance_push_jobs set state=case when p_sent then 'sent' when p_permanent or attempts>=3 then 'abandoned' else 'pending' end,
  lease_until=null,next_attempt_at=public.pickup_acceptance_now()+interval '1 minute' where id=p_job and state='sending'
  and attempts=p_attempt and lease_until=p_lease and lease_until>public.pickup_acceptance_now();
 return found;
end $$;
revoke all on function public.queue_pickup_acceptance_notice(),public.pickup_acceptance_notice_sendable(uuid,uuid),public.pickup_claim_acceptance_push(),public.pickup_acceptance_push_sendable(uuid,integer,timestamptz,text),public.pickup_finish_acceptance_push(uuid,integer,timestamptz,boolean,boolean) from public,anon,authenticated;
grant execute on function public.queue_pickup_acceptance_notice(),public.pickup_acceptance_notice_sendable(uuid,uuid),public.pickup_claim_acceptance_push(),public.pickup_acceptance_push_sendable(uuid,integer,timestamptz,text),public.pickup_finish_acceptance_push(uuid,integer,timestamptz,boolean,boolean) to service_role;
commit;
