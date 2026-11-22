# CF2-B — Least-privilege catalogue reader technical acceptance

**Date:** 2026-11-22 · **Status:** Source + synthetic rehearsal only, pending CI at final head.
**Founder scope:** SAFE autonomy; GitHub draft [Merchant/API PR #222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222). No connected database privilege or Worker change authorized.

## Recommended architecture for LocalEats

Use **Cloudflare Hyperdrive → PostgreSQL** with a **dedicated, tightly restricted, read-only database role**, while keeping all Customer and Merchant browsers talking only to the LocalEats API. Hyperdrive supports Supabase and is available with a Workers Free quota, but real request/CPU/query costs, Supabase pooler/network compatibility and TLS need separate verification. Do **not** use a direct browser service-role key or assume a basic publishable key can read the protected database view. See [Cloudflare Hyperdrive/Supabase guidance](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/) and [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/).

**Alternative if Hyperdrive or a database role does not fit the free-tier pilot:** a separately reviewed, public-only, versioned snapshot table with explicit SELECT policy, controlled refresh and limited fields. It must not leak owner or payment information, create unapproved public grants on existing tables, or imply cached prices/open states are current. This remains a design option, not implemented.

## Security boundary: why a new projection is necessary

The existing `public.shops_with_availability` view is `security_invoker=true` but selects `s.*` and calls `shop_effective_open(s,...)`. The staging database currently grants SELECT only to `service_role`; its underlying tables have RLS on but no policies. A role reading that view unmodified may need broad column privileges and could gain access to owner/private fields. **Do not grant it SELECT to a newly public or broadly privileged role.**

Before a real database connection, **in the separate staging project only**, design and test a new **non-exposed** `catalog_cf2` schema with fixed public shop/menu projections; a no-privilege role except schema USAGE and SELECT on these projections, plus narrowly scoped underlying column SELECT and RLS SELECT policies that filter approved, unarchived shops and their menus. Ensure the projected `effective_is_active` exactly matches the existing Johannesburg-time authoritative SQL function, not a JavaScript clock. Its feasibility must be checked on real staging schema in a disposable rehearsal before any grant. The project administrator's service role remains out of this API.

**No real schema has been created.** The synthetic SQL fixtures model an already computed `effective_is_active` boolean and do *not* prove the current composite-row function can be invoked with column-scoped privileges. That SQL privilege and computed-availability compatibility is a mandatory CF2-C acceptance gate.

## Implemented source-only code and tests

- [`cf2ReadOnlyPgCatalog.mjs`](../localeats-api/cloudflare-staging/cf2ReadOnlyPgCatalog.mjs): a strictly dependency-injected `executeRead(sql, params)` catalogue repository. It contains only fixed `SELECT` statements against prospective `catalog_cf2.public_shops` and `catalog_cf2.public_menu` views, parameterized IDs, approval/archived filters, limits (201 to detect over 200 shops, 401 to detect over 400 menu items), and generic fail-closed errors.
- Parses PostgreSQL NUMERIC prices such as `"25.00"` into validated numeric prices before the existing public API response code. Rejects negative, over-precision, unrealistic or malformed prices and cross-shop menu rows. Validates coordinates/availability revisions, strips unexpected private fields and rejects oversized responses (192 KiB).
- [`cloudflare-cf2b-readonly-pg-catalog.test.mjs`](../localeats-api/tests/cloudflare-cf2b-readonly-pg-catalog.test.mjs): synthetic query-injection, price, role-boundary, cross-shop, bad provider response, row/byte-cap and default-Worker-disconnection checks.
- [`readonly-catalog.SYNTHETIC_ONLY.sql`](../localeats-api/tests/cf2b/readonly-catalog.SYNTHETIC_ONLY.sql) and [`run-readonly-catalog-pg17.sh`](../localeats-api/tests/cf2b/run-readonly-catalog-pg17.sh): disposable PG17 scheme; invented shop/menu identities; `NOLOGIN NOBYPASSRLS NOINHERIT` reader for local `SET ROLE` tests, non-exposed projection views, RLS policies, column SELECT grants and explicit denials of private owner/cost columns, UPDATE/INSERT/DELETE. **This is not a Supabase migration; never apply it to any connected project.** A future real reader role would require separate approved LOGIN/credential provisioning.
- [GitHub Actions CF2-B PG17 rehearsal](../.github/workflows/cloudflare-cf2b-pg17-rehearsal.yml) runs in a disposable `postgres:17-alpine` Docker container, no exposed ports, no remote account, no database credentials, and removes the container. Existing CF1 safety workflow also runs the new pure-JS regression. **Judge the final milestone by the exact GitHub workflow result, not this documentation.**

## Additional costs and scaling considerations

At five staging shops, the strict SQL query caps are appropriate. At hundreds or thousands of shops, the current all-shops response will fail closed once it exceeds 200, preventing a false partial catalogue. Before scaling, introduce **cursor pagination / batch loading**, location-appropriate radius filters, bounds on per-shop menu requests, response caching with authoritative invalidation and normalized image sizes. Don't increase poll frequency or weaken pickup push/recovery fallback.

Use real traffic measurements at pilot scale before any plan upgrade; **free-tier quotas are not reliability or scale guarantees**. Under the current founder agreement, no billing plan changes may be executed without approval.

## Mandatory next release gates

1. Re-check fixture provenance and account separation before any protected data source; CF2-A confirmed only 5+3 shop/menu fixtures, not absence of sensitive data elsewhere.
2. Rehearse the **actual** authoritative SQL view/function permissions in a disposable, privacy-safe schema-only copy; prove that an independently restricted DB role can read intended views and absolutely cannot read private records or perform INSERT/UPDATE/DELETE.
3. Test role creation, connection-pool/TLS permissions, secret handling, rollback and the Hyperdrive free-tier quota using a separate founder-approved staging project scope; no main DB or prod Firebase tokens.
4. Only then seek a new, narrowly scoped founder approval to apply reviewed SQL grants/role to **LocalEats-Profile-Staging**, create a separate CF2 Worker/Hyperdrive connection and publish **synthetic staging catalogue only**, with all real writes/orders/payments/auth/FCM disabled. No Customer/Merchant deployment, domain/DNS change or `main` merge.
5. Verify real remote positive/negative GET/HEAD/OPTIONS, exact origins, public/private column denial, 4-km eligibility and closed-shop browse-only behavior. Confirm CPU/request/query budgets and rollback.

**Permanent decision:** CF2-B source + disposable rehearsal is within SAFE autonomy; staging SQL DDL, role credentials, Hyperdrive resource creation and new Worker deployment are not approved by the short “CF2-B” message. Release HOLD.
