-- L3-N2, 2026-11-18. STAGING ONLY. REVIEW DRAFT: DO NOT APPLY AUTOMATICALLY.
-- Target (after separate staging-DB owner clearance):
-- Supabase "LocalEats-Profile-Staging" rgpbdajhlrwfmhopzgzk.
-- NEVER apply to Production phdjumtqkooyppxozqsi.
--
-- Non-destructive minimal schema required by the existing authenticated
-- /api/v1/push-subscriptions/:installationId PUT/DELETE and the L3-N1
-- /api/v1/customer-push-subscriptions/:installationId/test endpoint.
-- Production already has an authoritative pickup_push_subscriptions schema.
-- Replicate only the safe minimum here; no business orders, payments, shops,
-- ready events, rewards, customers or outbox records are created.

create table if not exists public.pickup_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (length(btrim(user_id)) > 0 and length(user_id) <= 256),
  installation_id uuid not null,
  fcm_token text null unique,
  revoked_at timestamptz null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint pickup_push_subscriptions_user_installation_unique unique (user_id,installation_id),
  constraint pickup_push_subscriptions_fcm_length check
    (fcm_token is null or (length(fcm_token) between 20 and 4096))
);

-- No direct public/browser read/write policy, ever. Firebase ID tokens are
-- validated at the API, which writes only through a restricted server key.
alter table public.pickup_push_subscriptions enable row level security;
revoke all on table public.pickup_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.pickup_push_subscriptions to service_role;

-- Never silently add or weaken RLS policies or reuse the Production FCM
-- project service account to make a staging test pass.
--
-- Separate draft supabase/drafts/l3_customer_push_test_rate_limit.sql adds
-- service-role-only distributed quota; both are needed before test sends.
--
-- Read-only validation (run only on the separately approved staging project):
-- select relrowsecurity from pg_class where oid='public.pickup_push_subscriptions'::regclass;
-- select has_table_privilege('anon','public.pickup_push_subscriptions','SELECT');
-- select has_table_privilege('authenticated','public.pickup_push_subscriptions','UPDATE');
-- select has_table_privilege('service_role','public.pickup_push_subscriptions','INSERT');
-- select count(*) from public.pickup_push_subscriptions;
