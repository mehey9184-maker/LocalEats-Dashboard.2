begin;

create table public.rider_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  code text not null unique,
  created_by_firebase_uid text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rider_pairing_codes_six_digits_check
    check (code ~ '^[0-9]{6}$')
);

create index rider_pairing_codes_shop_created_idx
  on public.rider_pairing_codes (shop_id, created_at desc);

create index rider_pairing_codes_unrevoked_expiry_idx
  on public.rider_pairing_codes (expires_at)
  where revoked_at is null;

alter table public.rider_pairing_codes enable row level security;

revoke all privileges on table public.rider_pairing_codes
from public, anon, authenticated, service_role;

grant select, insert, update on table public.rider_pairing_codes to service_role;

-- LR2-A profile synchronization and connection transitions are server-only.
-- The preceding order-integrity migration already revoked browser authority.
grant select, insert, update on table public.rider_profiles to service_role;
grant select, insert, update on table public.rider_connections to service_role;

-- Lock the shop row so concurrent requests cannot leave two active codes.
-- The function remains SECURITY INVOKER and is executable only by service_role.
create or replace function public.issue_rider_pairing_code(
  p_shop_id text,
  p_code text,
  p_created_by_firebase_uid text,
  p_expires_at timestamptz
)
returns setof public.rider_pairing_codes
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.shops
  where id = p_shop_id
  for update;

  if not found then
    raise exception using errcode = 'LE404', message = 'SHOP_NOT_FOUND';
  end if;

  update public.rider_pairing_codes
  set revoked_at = now()
  where shop_id = p_shop_id
    and revoked_at is null;

  return query
  insert into public.rider_pairing_codes (
    shop_id,
    code,
    created_by_firebase_uid,
    expires_at
  ) values (
    p_shop_id,
    p_code,
    p_created_by_firebase_uid,
    p_expires_at
  )
  returning *;
end;
$$;

revoke all on function public.issue_rider_pairing_code(text, text, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.issue_rider_pairing_code(text, text, text, timestamptz)
to service_role;

comment on table public.rider_pairing_codes is
  'Server-only LR2-A rider invitations. A code creates a pending connection and never grants shop authority.';

comment on function public.issue_rider_pairing_code(text, text, text, timestamptz) is
  'Atomically revokes a shop previous pairing code and inserts a replacement. service_role only.';

commit;
