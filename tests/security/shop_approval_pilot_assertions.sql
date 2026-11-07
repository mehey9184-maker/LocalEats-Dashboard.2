-- Executed in disposable PG17 CI only, after archived Phase4G migration.
-- The migration itself is not changed or deployed.
insert into public.admin_users(firebase_uid,role,is_active)
values ('admin-active','super_admin',true),('admin-disabled','super_admin',false);

do $baseline$
begin
 if (select count(*) from public.shop_approval_events)<>0 then
  raise exception 'APPROVAL_PILOT_EVENTS_NOT_EMPTY';
 end if;
 if has_function_privilege('anon','public.transition_shop_approval(text,text,text,text,text)','EXECUTE')
   or has_function_privilege('authenticated','public.transition_shop_approval(text,text,text,text,text)','EXECUTE')
   or not has_function_privilege('service_role','public.transition_shop_approval(text,text,text,text,text)','EXECUTE')
 then raise exception 'APPROVAL_RPC_PRIVILEGE_VIOLATION'; end if;
 if (select count(*) from public.shops where approval_status='approved' and archived_at is null)<>1
 then raise exception 'APPROVAL_PENDING_SHOP_PUBLIC_BEFORE_DECISION'; end if;
end $baseline$;

set role service_role;

-- An active, server-verified super admin can approve an owner-submitted shop.
select public.transition_shop_approval('test-pending','approve','pending','admin-active');

-- Approval leaves the shop closed; merchant owner must open separately.
do $check$
begin
 if not exists(select 1 from public.shops where id='test-pending'
  and approval_status='approved' and is_active=false and approval_reason is null)
 then raise exception 'APPROVAL_MUST_NOT_OPEN_SHOP'; end if;
end $check$;

-- Stale expected-status replay fails atomically and creates no new event.
do $retry$
begin
 perform public.transition_shop_approval('test-pending','approve','pending','admin-active');
 raise exception 'STALE_APPROVAL_WAS_UNEXPECTEDLY_ACCEPTED';
exception when sqlstate 'LE409' then null;
end $retry$;

-- A disabled admin or arbitrary Firebase UID may not approve a different shop.
do $denied$
begin
 perform public.transition_shop_approval('test-still-pending','approve','pending','admin-disabled');
 raise exception 'DISABLED_ADMIN_WAS_UNEXPECTEDLY_AUTHORIZED';
exception when sqlstate 'LE403' then null;
end $denied$;
do $denied$
begin
 perform public.transition_shop_approval('test-still-pending','approve','pending','user-admin-metadata');
 raise exception 'UNPROVISIONED_ADMIN_WAS_UNEXPECTEDLY_AUTHORIZED';
exception when sqlstate 'LE403' then null;
end $denied$;

-- Cannot approve archived shops (even with valid admin and expected status).
do $archived$
begin
 perform public.transition_shop_approval('test-archived','approve','pending','admin-active');
 raise exception 'ARCHIVED_SHOP_WAS_UNEXPECTEDLY_APPROVED';
exception when sqlstate 'LE404' then null;
end $archived$;

-- Suspension/rejection require a recorded reason and fail without mutation.
do $reason$
begin
 perform public.transition_shop_approval('test-active','suspend','approved','admin-active',null);
 raise exception 'SUSPEND_WITHOUT_REASON_ACCEPTED';
exception when sqlstate 'LE422' then null;
end $reason$;

select public.transition_shop_approval('test-active','suspend','approved','admin-active','Owner test suspension');
-- Reinstate never silently reopens a suspended shop.
select public.transition_shop_approval('test-active','reinstate','suspended','admin-active');
select public.transition_shop_approval('test-rejected','approve','rejected','admin-active');
select public.transition_shop_approval('test-still-pending','reject','pending','admin-active','Missing verification documents');

reset role;

do $final$
declare v_count integer;
begin
 if not exists(select 1 from public.shops where id='test-pending'
    and approval_status='approved' and is_active=false and archived_at is null)
 then raise exception 'APPROVAL_CLOSED_SHOP_NOT_READY_FOR_BROWSING'; end if;
 if not exists(select 1 from public.shops where id='test-active'
    and approval_status='approved' and is_active=false and approval_reason is null)
 then raise exception 'REINSTATEMENT_MUST_NOT_OPEN_SHOP'; end if;
 if not exists(select 1 from public.shops where id='test-rejected'
    and approval_status='approved' and is_active=false)
 then raise exception 'REAPPLY_APPROVAL_MUST_NOT_OPEN_SHOP'; end if;
 if not exists(select 1 from public.shops where id='test-still-pending'
    and approval_status='rejected' and is_active=false
    and approval_reason='Missing verification documents')
 then raise exception 'REJECTION_NOT_AUDITABLE'; end if;
 if not exists(select 1 from public.shops where id='test-archived'
    and approval_status='pending' and archived_at is not null)
 then raise exception 'ARCHIVED_SHOP_MODIFIED'; end if;
 select count(*) into v_count from public.shop_approval_events;
 if v_count<>5 then raise exception 'APPROVAL_HISTORY_COUNT_INCORRECT: %',v_count; end if;
 if (select count(*) from public.shop_approval_events where acted_by='admin-active')<>v_count
 then raise exception 'APPROVAL_HISTORY_ADMIN_IDENTITY_MISMATCH'; end if;
 if (select count(*) from public.shop_approval_events
    where shop_id='test-active' and to_status='suspended' and reason='Owner test suspension')<>1
 then raise exception 'SUSPENSION_REASON_NOT_RECORDED'; end if;
 if (select count(*) from public.shops where approval_status='approved' and archived_at is null)<>3
 then raise exception 'CUSTOMER_APPROVED_CATALOG_ELIGIBILITY_MISMATCH'; end if;
 if (select count(*) from public.shops where approval_status='approved' and is_active=true and archived_at is null)<>0
 then raise exception 'NEW_APPROVAL_MUST_NOT_CREATE_ORDERABLE_SHOP'; end if;
end $final$;
select 'SYNTHETIC_SUPERADMIN_SHOP_APPROVAL_PG17_PASS' as result;
