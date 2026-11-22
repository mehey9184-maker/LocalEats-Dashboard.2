# CF2-E — Staging-only catalogue permission release gate

**Date:** 2026-11-22 (Africa/Johannesburg)  
**Status:** **READ-ONLY LIVE PREFLIGHT PASSED; HOSTED DDL NOT AUTHORIZED OR EXECUTED**  
**Scope:** Existing separate **LocalEats-Profile-Staging** Supabase project only. Never the primary LocalEats database.  
**Founder authority:** SAFE autonomous source work; a phase-selection message is **not a standalone explicit approval** to change hosted database security policies. See [Founder charter](LOCALEATS_FOUNDER_CHARTER.md).

## Business reason

Build a secure public catalogue data path while retaining server-authoritative shop approval, prices, Johannesburg opening times and merchant overrides, without revealing shop owner/contact fields or granting any customer or AI read/write access to accounts, orders, payments or push infrastructure.

CF2-E is about database permissions only. A successful role creation will **not** activate the public API, and it does not automatically improve live LocalEats site availability. Cloudflare API connectivity, secrets and Worker deployment require later separate authorization and testing.

## Actual connected staging read-only inspection

The connected **LocalEats-Profile-Staging** project was healthy and reported PostgreSQL **17.11** at inspection. We executed **only SELECT metadata and the exact new CF2-E SELECT-only preflight file**, not data dumps or customer/order row queries.

- [Actual CF2-E preflight](../supabase/drafts/cf2e_catalog_staging_preflight.READ_ONLY.sql) returned **`CF2E_STAGING_READ_ONLY_PREFLIGHT_PASS`** with **no failed checks** (19 individual checks).
- `public.shops`, `public.menu_items`, `public.shops_with_availability` all exist. `shops` / `menu_items` RLS are ON and had **0** policies before release.
- Proposed `cf2_catalog_reader` role and `catalog_cf2` schema do **not** exist.
- `anon` and `authenticated` cannot SELECT `shops`, `menu_items` or the existing availability view; `service_role` can.
- Current function definitions are **SECURITY INVOKER** (not SECURITY DEFINER). `shop_effective_open` checks approved/unarchived status, and `shop_schedule_open` uses the `Africa/Johannesburg` clock.
- Underlying `shops` stores `latitude` and `longitude`; the new private view must alias them to `lat`/`lng`.
- Additional read-only ACL inspection found **0 relations in `public` with SELECT granted to `PUBLIC`**, and **0 `public` functions with PUBLIC EXECUTE grants** at that moment. This does not authorize broad grants in the future.
- Supabase security advisors currently report **8 pre-existing RLS-enabled/no-policy notices**, including the two catalogue tables; CF2-E proposes policies **only for its dedicated role**, not fixes for unrelated tables. Reference: [RLS no policy advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- **Important limitation:** other tables' row contents and personal identity isolation were **not inspected**, and no restorable backup status was confirmed.

## Reviewed action — exact proposed changes, NOT YET EXECUTED

Single atomic transaction in [CF2-D forward proposal](../supabase/drafts/cf2d_catalog_projection.REVIEW_ONLY.sql):

1. Fail-closed preflight for required tables/columns, RLS, no existing target role/schema, approved/archive function semantics and SAST clock.
2. Create one **`NOLOGIN, NOBYPASSRLS, NOINHERIT`** Postgres role `cf2_catalog_reader`; no password, database login or cloud secret.
3. Create one private schema `catalog_cf2`, not exposed through Supabase Data API; remove implicit `anon`, `authenticated` and PUBLIC privileges.
4. Add exactly two `FOR SELECT TO cf2_catalog_reader` RLS policies on existing `public.shops` and `public.menu_items`, filtering approved/unarchived shops and only those shops' menu items.
5. Grant **specific SELECT columns** from shops/menu and EXECUTE on `shop_schedule_open` only to the new role. Do not grant owner ID or any INSERT/UPDATE/DELETE.
6. Create `catalog_cf2.public_shops` / `catalog_cf2.public_menu` as `security_invoker=true`, `security_barrier=true` views with approved/archive filtering, server-calculated effective opening and coordinate aliases.
7. Verify no direct owner-column SELECT, no mutation privileges, and no public catalogue SELECT before COMMIT.

**Explicitly excluded:** creating a login/password/JWT, revealing service-role keys, enabling Data API exposure, changing existing account/order/RLS write policies, editing rows, connecting Cloudflare Hyperdrive, deploying Workers, enabling orders/payments/push, moving DNS or adding a paid plan.

## Acceptance test and rollback

- [Read-only preflight SELECT](../supabase/drafts/cf2e_catalog_staging_preflight.READ_ONLY.sql): 19 metadata checks; already **PASS** against actual connected staging.
- [Read-only postflight SELECT](../supabase/drafts/cf2e_catalog_staging_postflight.READ_ONLY.sql): verify NOLOGIN, no role memberships, RLS policy scope, private view options, allowed SELECT, denials for `anon`/`authenticated`, no DML, owner ID denial, and no other public relation reads. **Not executed on hosted staging because the change is not authorized.**
- [Rollback SQL](../supabase/drafts/cf2d_catalog_projection_rollback.REVIEW_ONLY.sql) removes **only** the two proposed views/policies/schema and the no-login role, using `RESTRICT` rather than cascade.
- [Disposable PostgreSQL runner](../localeats-api/tests/cf2d/run-reviewed-sql-pg17.sh) now runs **preflight → forward proposal → postflight → negative access/price/availability tests → rollback → preflight restored** on an invented PostgreSQL 17 database. See latest [draft PR #222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222) CI; **do not claim this new CF2-E test is green until the exact commit finishes**.
- No real backups were created here. Per [Supabase backup guidance](https://supabase.com/docs/guides/platform/backups), automatic daily backups are not included in the Free plan; the actual staging project's billing plan/backup eligibility and a restorable schema snapshot must be confirmed before hosted DDL. No free-to-paid upgrade is authorized.

## Founder decision gate before applying hosted DDL

Owner must explicitly approve the **staging-only security change**, for example:

> I approve CF2-E to execute only `supabase/drafts/cf2d_catalog_projection.REVIEW_ONLY.sql` on **LocalEats-Profile-Staging**, after confirming the latest preflight/backup and rollback readiness. No login key, Hyperdrive, new Worker, Production change, paid upgrade or merge.

After such approval, worker must independently reconfirm target project name/ref, exact GitHub commit/SQL, backup/restore evidence, grant baseline and preflight; use the supported Supabase migration action only once, then run the exact read-only postflight and scoped negative access tests. Stop and report if the postflight fails; don't roll back or destroy unrelated schema without reviewing impact.

**This document itself is not a request to perform a hosted operation and never overrides the founder charter.**

## Current state

CF1 Cloudflare bootstrap only, real shop/menu API still denied. Customer/Merchant/Admin Production unchanged. [LocalAdmin Founder Briefing draft PR #5](https://github.com/mehey9184-maker/Super-LocalAdmin/pull/5) remains separate and unmerged. Future Oracle AI FAQ helper is deferred behind the pickup release.

[Project memory](LOCALEATS_PROJECT_MEMORY.md) · [CF2-D hosted-staging review](CLOUDFLARE_CF2D_HOSTED_STAGING_REVIEW.md) · [CF2 migration issue #223](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/223).
