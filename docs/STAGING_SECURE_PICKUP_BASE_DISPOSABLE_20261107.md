# LocalEats — Secure pickup-only staging base, disposable rehearsal
Date: 2026-11-07 | **REVIEW-ONLY / DISPOSABLE SQL. NOT AN APPROVED STAGING MIGRATION.**

## Why this scope is different

The owner approved using the existing **LocalEats-Profile-Staging** Supabase project for a full synthetic pickup pilot **only after a verified encrypted, restorable backup and independently reviewed SQL**. The connected staging project is profile-only; its P5 `public.profiles` is already managed, has **14 columns, 13 constraints, forced RLS** and no direct browser profile grants. It uses Firebase UID text rather than the legacy Production signup trigger.

The earlier staging parity checklist incorrectly treated `rider_notifications`, two `nudge_rider` functions and `public.handle_new_user()` as required for pickup. Corrected **draft PR #87** removes those four from its required gate and adds the actually needed `pickup_push_subscriptions`, resulting in **23 pickup-specific requirements**, 3 currently present and 20 missing in the last read-only staging inspection. This staging candidate deliberately does **not** create dormant Rider functions, Rider approval paths or a Supabase signup trigger.

## Disposable-only base SQL

`security/drafts/staging_pickup_secure_base_DISPOSABLE_ONLY.sql` explicitly refuses database names other than `localeats_stage_base_disposable`, so it cannot be executed against the standard connected Supabase staging or Production databases (both called `postgres`). It is **not** listed under `supabase/migrations`, cannot be automatically deployed and does not authorize a connected cloud change.

The script starts a single transaction and:
1. Confirms a P5-like `profiles` table has exactly 14 columns, 13 constraints, text UID, forced RLS and no direct browser profile grants. Rejects any existing shops, menu, orders, admin, event or Rider table collision.
2. Creates only `shops` (pending and closed by default), `menu_items` with server price and actual shop reference, and `orders` with UUID ID and unique idempotency key. Includes the real Merchant signup, Customer catalog and pickup order data columns, but makes **no real synthetic row insert in the base schema**.
3. Within that same transaction, enables and forces RLS on all three tables, revokes browser table grants and grants the required access only to `service_role`. Until COMMIT, Postgres does not expose the new objects to other sessions. There are no permissive RLS policies.
4. Verifies RLS/grants and refuses a signup trigger or dormant Rider notification table.

**Caveat:** This is a minimal pickup-only foundation, not a complete source-of-truth Production schema reconstruction and not final DDL for the connected staging environment. It intentionally avoids merging legacy rider/profile objects and legacy browser policies. It must be reconciled with the actual API data contract, current Supabase default privileges, exact order event/FCM outbox schema, Supabase extensions, RLS, API views and PostgREST before any stage rollout. Shop owner uniqueness across multiple active stores is a separate business rule and is **not changed** here.

## How the new isolated CI tests it

`.github/workflows/staging-secure-pickup-base-pg17.yml` launches a new `postgres:17-alpine` service on localhost with a fixed disposable DB name and no real credentials. It:
1. Reconstructs the P5 profile contract from read-only inspected metadata, with a fictional profile and its fingerprint.
2. Executes **only the new secure base schema**, then confirms repeat application aborts on baseline drift.
3. Runs the existing reviewed pickup foundation, R0 service fee, merchant availability, archived Super Admin approval SQL and the already-tested hash-pinned any-town 4 km function from stacked PR #86 **only against disposable PostgreSQL**.
4. Inserts a fictional merchant, menu item and active synthetic Super Admin **after** the base tables have been protected.
5. Verifies approved still CLOSED, explicit merchant opening with revision, same-person R25 pickup, idempotent replay, different-person replay denied, closing blocks new orders, P5 schema and profile untouched, server-only table/function privileges, no Rider data/FCM/online payments.

Passing synthetic tests proves only these fragments work together in a disposable PostgreSQL 17 DB. It does **not** replace a hosted Customer, Merchant and Super Admin user-journey acceptance or complete backup/restore.

## What is still required for actual staging

1. From [backup-first draft PR #88](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/88), export a **private real staging backup**, encrypt an offsite copy and **prove restore** to a separately isolated database. The existing connected Supabase tools cannot make a restorable dump; this task is **not completed**.
2. Re-run the read-only staging baseline and confirm the existing P5 `profiles` schema, authentication settings, roles and single migration remain compatible; reject on any drift.
3. Review a **separate, stage-targeted migration** with the exact verified P5 schema, reviewed dependency order, actual 23-object pickup-only contract, source hash/permissions, and a rollback or forward-fix strategy. Do **not** deploy these disposable fixtures directly. Confirm restrictive permissions in the same transaction that creates each table and function.
4. Use dedicated staging Firebase identities and an isolated staged API only after the database and token audience have been verified. Never reuse Production Firebase/Auth credentials or customer records.
5. Test full authenticated Super Admin → Merchant → Customer pickup on hosted isolated stage with two synthetic customers, failure/duplicate cases, Ready inbox and push recovery, no delivery or payment capture.
6. Only after independent approval discuss Production security, Firebase named-database published rules and any-town order SQL cutover.

No money spent, no Production or connected staging changes, no GitHub merge, no live ordering, subscriptions or Rider activation.
