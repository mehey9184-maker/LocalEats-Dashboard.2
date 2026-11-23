# CF2-D — LocalEats staged catalogue permissions review

**Date:** 2026-11-22 · **Approval:** founder SAFE autonomy for inspection, draft code and disposable testing only
**Status:** **PROPOSED / NOT APPLIED**, pending exact-head CI and a separate approval for any hosted SQL changes.
**Target if approved later:** *LocalEats-Profile-Staging* only, never the primary LocalEats Supabase project.

## Executive decision

Prepare a public-catalogue **read-only database role** that can retrieve shop names, verified prices and server-authoritative opening status without seeing private owner data or having authority to change orders, balances or shop records. Keep the production/customer apps on their existing contracts. CF2-D is a permission proposal, **not** a new live API.

## What the source audit discovered

Read-only metadata from the *actual connected* profile-staging project (PostgreSQL 17.11, no customer/merchant/order records queried):

| Source | Verified staging behavior | Consequence |
|---|---|---|
| `public.shops` | Has `latitude`/`longitude`, **not** physical `lat`/`lng` columns | New catalogue view should alias `latitude AS lat, longitude AS lng` |
| `public.shops_with_availability` | Existing view has `security_invoker=true` and exposes safe columns and coordinate aliases, but invokes whole-row function | New limited reader cannot simply reuse that whole-row invocation |
| Deployed `public.shop_effective_open` | Checks `is_active`, **approval_status='approved'** and **archived_at IS NULL**, then scheduled/override availability | **Stricter than older GitHub draft**; do not copy draft semantics into new view |
| Deployed `shop_schedule_open` | `Africa/Johannesburg` schedule interpretation with day/overnight windows | Reuse the existing function; don't recalculate time on client |
| `shops` and `menu_items` | RLS ON; no existing policies in inspected staging metadata | Dedicated `TO cf2_catalog_reader` SELECT policies must be carefully scoped |
| Database grants | `anon`/`authenticated` no SELECT on checked relations; `service_role` does | Never grant broad public SELECT or expose `service_role` to browsers |
| Existing CF2 role/schema | `cf2_catalog_reader` and `catalog_cf2.public_shops` **do not exist** | New objects can be proposed but have not been provisioned |

**Critical correction to CF2-C:** That disposable exercise compared with the original checked-in availability functions; the current deployed staging function adds approval and archived checks. CF2-D's synthetic fixture and proposal now contain those checks. Treat CF2-C's passed test as useful restricted-column evidence, **not proof of exact deployed semantics**.

## Exact review-only SQL files

- [CF2-D forward proposal](../supabase/drafts/cf2d_catalog_projection.REVIEW_ONLY.sql) includes fail-closed preflights, a **NOLOGIN, NOBYPASSRLS** role, a **non-exposed** `catalog_cf2` schema, specifically scoped SELECT-column grants, RLS SELECT policies for approved/unarchived shops and menus, and `security_invoker/security_barrier` views. It does not create credentials or permit any write verb.
- The `public_shops` view uses the full **verified deployed** opening formula with approval and archived checks, while calling the original server-side `shop_schedule_open` function. It aliases numeric coordinates to match client expectations without granting private owner columns.
- [CF2-D rollback proposal](../supabase/drafts/cf2d_catalog_projection_rollback.REVIEW_ONLY.sql) removes only the proposed views, policies and role without cascading deletion or modifying shop/menu fixtures. Rollback is review material, **not approved to run** in hosted staging.
- [Disposable staging-shaped fixture](../localeats-api/tests/cf2d/staging-shape.SYNTHETIC_ONLY.sql), [PostgreSQL 17 runner](../localeats-api/tests/cf2d/run-reviewed-sql-pg17.sh) and [static scope tests](../localeats-api/tests/cf2d/review-proposal.test.mjs) exercise role denial, correct public projections and full rollback **on a throwaway Docker database only**.
- [GitHub Actions source-only gate](../.github/workflows/cloudflare-cf2d-staging-review.yml) runs a local PostgreSQL 17 container with invented test owners and prices. **No Supabase URL or secret**, no public ports, no Cloudflare deployment. Do not claim the gate passed until checking the exact final CI run.

## Risks remaining before a live staging connection

**Database authority:** The proposed role has **NOLOGIN** intentionally. A future application credential, user/session/Hyperdrive binding, pooling/TLS configuration and source of credentials require a **separate** founder-approved plan. Do not copy a `service_role` key.

**Function drift:** If deployed `shop_effective_open` changes, scalar formula replication might drift. The proposed migration includes a static definition check that refuses to proceed when approval/archive or SAST evidence is missing. A real staging acceptance must additionally compare projected effective availability to the authoritative function across all synthetic fixture cases and timestamps.

**Supabase Data API:** `catalog_cf2` must remain **unexposed**. This proposal is for private PostgreSQL access from a server process only. It is not a new `anon` REST API, a public RLS grant or a browser client.

**Privacy and cost:** Profile-Staging has a checked synthetic shop/menu sample, but other account tables and source provenance were not reviewed. Existing free resource limits, traffic-based query costs and Hyperdrive free-tier usage must be verified before any new network link. API shop/menu/order reads must remain separated from authentication/merchant ownership writes.

**Rollback:** Keep a metadata/grant snapshot and disposable rehearsal results. If a real staging grant is approved later, validate role privileges and restricted negative SELECT/INSERT/UPDATE/DELETE behavior **before** publishing a Worker. A failed safety test must stop the rollout.

## Safe work vs founder decision

Safe without further permission: inspect staging **schema-only metadata**; maintain review-only SQL, code/test fixtures, CI, documentation and draft PRs. Not approved: running hosted SQL, creating a login role or secret, adding grants/policies to Supabase, creating a Hyperdrive connection, deploying or exposing a new Worker, merging main, changing live DNS, real orders, payments or paid tiers.

**Next proposed phase after CF2-D source tests pass:** present a narrowly scoped founder approval request for **staging-only DDL**, with exact object list, zero production impact, tested rollback and separate future approval for connectivity/deployment. The existing CF1 bootstrap Worker remains no-data.

## Owner education

A separate **read-only Founder Briefing** preview was added in [Super-LocalAdmin draft PR #5](https://github.com/mehey9184-maker/Super-LocalAdmin/pull/5). It explains Cloudflare vs Oracle hosting, optional AI/FAQ experimentation and why the API controls business actions, linked to GitHub facts. This does **not** activate AI or change shop review.

[Founder operating charter](LOCALEATS_FOUNDER_CHARTER.md) · [Cross-chat handoff](LOCALEATS_PROJECT_MEMORY.md) · [Cloudflare migration issue #223](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/223).
