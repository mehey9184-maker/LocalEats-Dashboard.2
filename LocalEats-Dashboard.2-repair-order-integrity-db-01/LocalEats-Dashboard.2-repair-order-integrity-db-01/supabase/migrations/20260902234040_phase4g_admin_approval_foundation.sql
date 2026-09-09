-- Phase 4G-B1: server-authorized administrators and atomic shop approval history.
--
-- This migration is additive. It does not seed administrators or modify existing
-- shop rows. The LocalEats API must authenticate the Firebase user, authorize the
-- Firebase UID through public.admin_users, and pass that UID as p_acted_by.
--
-- Stable transition errors for the API layer:
--   LE403 / ADMIN_NOT_AUTHORIZED
--   LE404 / SHOP_NOT_FOUND_OR_ARCHIVED
--   LE409 / SHOP_APPROVAL_STATE_CONFLICT
--   LE409 / SHOP_APPROVAL_SAME_STATE_CONFLICT
--   LE409 / SHOP_APPROVAL_ILLEGAL_TRANSITION
--   LE422 / SHOP_APPROVAL_REASON_REQUIRED
--   LE422 / SHOP_APPROVAL_ACTOR_REQUIRED

create table public.admin_users (
  firebase_uid text primary key,
  role text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint admin_users_firebase_uid_nonempty
    check (btrim(firebase_uid) <> ''),
  constraint admin_users_role_check
    check (role in ('super_admin'))
);

alter table public.admin_users enable row level security;

-- Start from no Data API privileges, then grant the server only what Phase 4G uses.
revoke all privileges on table public.admin_users
  from public, anon, authenticated, service_role;
grant select on table public.admin_users to service_role;

create table public.shop_approval_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  from_status text not null,
  to_status text not null,
  reason text null,
  acted_by text not null,
  created_at timestamptz not null default now(),
  constraint shop_approval_events_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on delete restrict,
  constraint shop_approval_events_acted_by_fkey
    foreign key (acted_by)
    references public.admin_users (firebase_uid)
    on delete restrict,
  constraint shop_approval_events_actor_nonempty
    check (btrim(acted_by) <> ''),
  constraint shop_approval_events_from_status_check
    check (from_status in ('pending', 'approved', 'rejected', 'suspended')),
  constraint shop_approval_events_to_status_check
    check (to_status in ('pending', 'approved', 'rejected', 'suspended')),
  constraint shop_approval_events_transition_check
    check (
      (from_status = 'pending' and to_status in ('approved', 'rejected'))
      or (from_status = 'rejected' and to_status = 'approved')
      or (from_status = 'approved' and to_status = 'suspended')
      or (from_status = 'suspended' and to_status = 'approved')
    ),
  constraint shop_approval_events_reason_check
    check (
      (
        to_status in ('rejected', 'suspended')
        and reason is not null
        and btrim(reason) <> ''
      )
      or (
        to_status in ('pending', 'approved')
        and reason is null
      )
    )
);

create index shop_approval_events_shop_created_at_idx
  on public.shop_approval_events (shop_id, created_at desc);

alter table public.shop_approval_events enable row level security;

-- Approval history is append-only for the API server and invisible to browsers.
revoke all privileges on table public.shop_approval_events
  from public, anon, authenticated, service_role;
grant select, insert on table public.shop_approval_events to service_role;

create function public.transition_shop_approval(
  p_shop_id text,
  p_action text,
  p_expected_status text,
  p_acted_by text,
  p_reason text default null
)
returns public.shops
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shop public.shops%rowtype;
  v_updated_shop public.shops%rowtype;
  v_action text := lower(btrim(p_action));
  v_expected_status text := lower(btrim(p_expected_status));
  v_from_status text;
  v_to_status text;
  v_acted_by text := nullif(btrim(p_acted_by), '');
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_acted_by is null then
    raise exception using
      errcode = 'LE422',
      message = 'SHOP_APPROVAL_ACTOR_REQUIRED';
  end if;

  if not exists (
    select 1
      from public.admin_users as admin_user
     where admin_user.firebase_uid = v_acted_by
       and admin_user.is_active = true
       and admin_user.role = 'super_admin'
  ) then
    raise exception using
      errcode = 'LE403',
      message = 'ADMIN_NOT_AUTHORIZED';
  end if;

  select shop.*
    into v_shop
    from public.shops as shop
   where shop.id = p_shop_id
     and shop.archived_at is null
   for update;

  if not found then
    raise exception using
      errcode = 'LE404',
      message = 'SHOP_NOT_FOUND_OR_ARCHIVED';
  end if;

  v_from_status := v_shop.approval_status;

  if v_expected_status is null
     or v_expected_status not in ('pending', 'approved', 'rejected', 'suspended')
     or v_expected_status <> v_from_status then
    raise exception using
      errcode = 'LE409',
      message = 'SHOP_APPROVAL_STATE_CONFLICT',
      detail = format(
        'Expected approval status %L but current status is %L.',
        p_expected_status,
        v_from_status
      );
  end if;

  case v_action
    when 'approve' then
      v_to_status := 'approved';
    when 'reject' then
      v_to_status := 'rejected';
    when 'suspend' then
      v_to_status := 'suspended';
    when 'reinstate' then
      v_to_status := 'approved';
    else
      raise exception using
        errcode = 'LE409',
        message = 'SHOP_APPROVAL_ILLEGAL_TRANSITION',
        detail = format('Unsupported approval action %L.', p_action);
  end case;

  if v_from_status = v_to_status then
    raise exception using
      errcode = 'LE409',
      message = 'SHOP_APPROVAL_SAME_STATE_CONFLICT',
      detail = format('Shop is already in approval status %L.', v_from_status);
  end if;

  if not (
    (v_action = 'approve' and v_from_status in ('pending', 'rejected'))
    or (v_action = 'reject' and v_from_status = 'pending')
    or (v_action = 'suspend' and v_from_status = 'approved')
    or (v_action = 'reinstate' and v_from_status = 'suspended')
  ) then
    raise exception using
      errcode = 'LE409',
      message = 'SHOP_APPROVAL_ILLEGAL_TRANSITION',
      detail = format(
        'Action %L cannot transition approval status %L.',
        v_action,
        v_from_status
      );
  end if;

  if v_action in ('reject', 'suspend') and v_reason is null then
    raise exception using
      errcode = 'LE422',
      message = 'SHOP_APPROVAL_REASON_REQUIRED';
  end if;

  if v_action in ('approve', 'reinstate') then
    v_reason := null;

    update public.shops as shop
       set approval_status = v_to_status,
           approval_reason = null
     where shop.id = v_shop.id
     returning shop.* into v_updated_shop;
  else
    update public.shops as shop
       set approval_status = v_to_status,
           approval_reason = v_reason,
           is_active = false
     where shop.id = v_shop.id
     returning shop.* into v_updated_shop;
  end if;

  insert into public.shop_approval_events (
    shop_id,
    from_status,
    to_status,
    reason,
    acted_by
  ) values (
    v_shop.id,
    v_from_status,
    v_to_status,
    v_reason,
    v_acted_by
  );

  return v_updated_shop;
end;
$$;

comment on function public.transition_shop_approval(text, text, text, text, text)
  is 'Server-only atomic LocalEats shop approval transition. Errors: LE403 unauthorized admin; LE404 missing/archived; LE409 stale, same-state, or illegal transition; LE422 missing reason or actor.';

revoke execute on function public.transition_shop_approval(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.transition_shop_approval(text, text, text, text, text)
  to service_role;
