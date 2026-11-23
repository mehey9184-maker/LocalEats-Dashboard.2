# L4-R1E — Merchant Account and Storefront Profile Persistence

Status: **SOURCE ACCEPTANCE ONLY — DRAFT PR — NO DEPLOY / NO DATABASE MUTATIONS**.
Parent: L4-R1D draft PR #236. Current work: PR #237.

## Objective and strict ownership contract

- Account fields: `full_name`, `phone`, `avatar_url`, `marketing_opt_in`, `dark_mode`.
- Storefront fields: `name`, `description`, `category`, `phone`, `logo_url`, `opening_time`, `closing_time`.
- Firebase ID token is verified on the server. The server queries the base `shops` table using the authenticated UID and rejects absent or multiple current shops. The browser never selects an owner.
- Account and shop writes are **independently default-off** unless `MERCHANT_ACCOUNT_PROFILE_WRITES_ENABLED=true` and `MERCHANT_SHOP_PROFILE_WRITES_ENABLED=true`, respectively, in an explicitly approved non-Preview environment.
- All writes reject unknown fields. Role, owner ID, account email, approval, active state, GPS, delivery/rider settings, subscription, wallet and payments are forbidden.
- Each write uses an expected version, performs a conditional update and independently reads persisted fields before confirming. A stale revision, changed login, another owner's shop or failed readback never produces a saved state.
- Vercel Preview's pre-existing `previewReadOnlyGate` remains in front of both write routes regardless of write flags.
- A private `merchant_profiles` table is accessible only to the server service role; browser roles receive no direct table grants. RLS is enabled.
- Both Merchant screens call the API, not the legacy Firestore/Supabase compatibility writer. Account login email is read-only. Unsupported storefront location/social edits are rejected rather than silently discarded.
- When reopening My Account, the screen loads server data; after signed-in shop verification the app also projects previously saved nonzero-revision account details into the display state, without granting identity or roles.

## Read-only schema inspection on 23 November 2026

**Staging:** `public.shops.id` and `owner_id` are text; the `shops` table has no `phone`, `updated_at`, or `merchant_profile_revision` fields. The availability view does not expose `owner_id`.
**Production:** `shops.phone` exists, but `updated_at` and `merchant_profile_revision` do not. Its availability view already exposes `owner_id`. Both views have `security_invoker=true`. Both environments lack the new private merchant profile table.

The candidate uses a separate, review-only SQL draft at `supabase/drafts/L4_R1E_MERCHANT_PROFILE_SCHEMA.sql`. It adds `shops.phone` only when absent and adds an independent profile revision column, without requiring `updated_at`. **It has not been applied to Staging or Production.**

The existing merchant GET /shop was adjusted to verify `owner_id` via the base `shops` table, then look up effective availability by that verified ID. This avoids exposing `owner_id` in Staging's public availability view.

## Source evidence and disposable-only schema rehearsal

- Merchant root: **0 ESLint errors, 0 TypeScript errors** (the 22 pre-existing non-failing ESLint warnings remain).
- Complete source integration: existing API and pickup security suite, new merchant profile cases, Merchant UI regressions, real pinned Customer→API loopback, and Vercel Preview no-write tests.
- Disposable PostgreSQL 17 job creates two local-only schema shapes (with/without `shops.phone`) and applies the candidate SQL to each.
- The disposable job confirms RLS enabled, anon/authenticated no direct access to private profiles, service-role access, account CAS, shop CAS and stale-write rejection. It uses **no connected Supabase project or hosted credentials**.

CI evidence: [source and ephemeral schema](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/45224271317) and [lint/TypeScript](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/45224270966). Check the current PR head for the newest independent runs.

## Non-negotiable hosted rollout gate

1. Establish a recoverable, **tested backup** of the target environment, with a completed restore exercise and the right database selected. The prior encrypted V: backup has not been independently proven here.
2. Generate and review a canonical migration with the current Supabase CLI (not available in this execution environment), incorporating this reviewed SQL draft and a versioned rollback plan.
3. Rehearse on an isolated database with the real existing tables and all migrations; check permissions, indexes, revision semantics, and actual update/read-back behavior under server credentials.
4. Obtain separate approval **before** applying hosted DDL, enabling either write flag, deploying, merging to main or allowing public orders.
5. Test with two approved merchants and an unrelated customer, plus account switching, stale concurrent saves, network failure, holiday hours, avatar upload and actual phone UI.
6. Recheck pickup ordering and shop effective availability after changed hours. Do not use profile flags to activate orders, payouts, riders or payment transitions.
7. For rollback, disable both new write flags first. Restore only from verified backups if necessary. **Do not drop columns or the profile table on Production merely to roll back an app version.**

## Explicit deferrals

The legacy `supabase.auth.updateUser` adapter remains fail-closed for the separate holiday schedule / weekly operating-hours settings controls. Those operational policies require a dedicated DB-authoritative scheduler/availability design, not unsecured user metadata. Storefront location, GPS, city, email, social links and delivery settings are not part of this profile-write contract. Image uploads remain a separate Firebase Storage action; uploading alone does not save a profile. Physical browser/phone, live notifications and first real customer pickup acceptance are still outstanding.

**Release decision: HOLD.** Source readiness is not hosted migration approval, real-device evidence or public ordering readiness.
