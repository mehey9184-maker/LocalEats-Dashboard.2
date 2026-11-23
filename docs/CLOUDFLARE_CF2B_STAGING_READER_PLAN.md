# CF2-B — Isolated catalogue reader and staging Worker plan

**State:** DRAFT DESIGN ONLY; not approved for execution (2026-11-22).
**Founder boundary:** No database grants, SQL migrations, keys, secrets, Worker deployments, frontend releases or Production changes from this file.

## CF2-B SOURCE / DISPOSABLE MILESTONE — 2026-11-22

The first bounded **CF2-B proof** is now in [draft PR #222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222): the fixed-query, parameterized, source-only `cf2ReadOnlyPgCatalog.mjs` adapter; the synthetic [Node security tests](../localeats-api/tests/cloudflare-cf2b-readonly-pg-catalog.test.mjs); and the isolated [PostgreSQL 17 reader/RLS rehearsal](../localeats-api/tests/cf2b/readonly-catalog.SYNTHETIC_ONLY.sql) run by [a no-port disposable Docker script](../localeats-api/tests/cf2b/run-readonly-catalog-pg17.sh). The [GitHub Actions CI rehearsal run #45067699808](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/45067699808) **passed**: 8 Node tests and synthetic PostgreSQL role/RLS/denied-DML and private-column checks. It used no hosted database credentials and did not deploy.

**Design outcome:** prefer a separately approved, column- and row-scoped PostgreSQL reader and **Hyperdrive** against `LocalEats-Profile-Staging`, not the unscoped `service_role` PostgREST route. The reader targets future `catalog_cf2.public_shops` / `catalog_cf2.public_menu` views in a **non-exposed schema**; these relations and the reader role **do not exist** in connected staging. A disposable no-login role is not an active database account. The real existing availability SQL uses `shop_effective_open(s,...)` on a full composite shop row; compatibility with column-only GRANTs and precise active-state semantics remains **unproven**. Preserve all current shop, profile and order rules. See [CF2-B technical/negative-test record](CLOUDFLARE_CF2B_ROLE_REHEARSAL.md).

**Approved now:** local/synthetic code, tests, documents, CI. **Not authorized:** live staging role creation, grants, RLS changes, secrets, Hyperdrive resource creation, any new Worker deployment, real authenticated Firebase, DNS or Production release.

---

## CF2-A facts behind the proposal

Existing LocalEats-Profile-Staging has 5 synthetic-marker shops and 3 synthetic-marker menu rows with no untagged shop/menu data; 3 approved/unarchived shops (currently 2 effective-open, one closed), 1 pending, 1 archived; all three menus linked; two R25 items and one R10 item; far-vs-open fixture distance 8.9 km. Provenance of *fixture creation* and account/identity isolation remains unverified. See [CF2-A acceptance](CLOUDFLARE_CF2A_FIXTURE_ACCEPTANCE.md).

## Critical API permission incompatibility

The existing `public.shops_with_availability` security-invoker view and both underlying tables deny `anon` and `authenticated` SELECT in the inspected staging project; `service_role` has SELECT. The current *synthetic-only* PostgREST reader sends an `apikey` header but no bearer authorization and **has not been tested with a real Supabase Data API**. It cannot be treated as a working live data connection or as proof of access to the restricted view.

Do not fix this by granting unrestricted view or table access to `anon`/`authenticated`. Do not use the Production service-role key, expose any credential in browser JavaScript, or rely on only in-memory write flags to protect a broadly privileged database key.

## Proposed safe architecture

1. Inspect current staging migration provenance and capture schema-only ACL/RLS permissions to support rollback. Stage-specific synthetic fixtures only; do not read customer/account/order data.
2. Design a minimal *read-only* database/data-API identity for public catalogue and menus with schema-scoped SELECT limited to approved/unarchived items, allowing server-side effective availability from the existing view. A database role + JWT claim/REST authorization path must be proven against current Supabase docs and a disposable test environment before granting privileges; a simple `apikey` header is insufficient evidence.
3. Keep the privileged reader entirely server-side in a **new**, separately named test Worker (proposed `localeats-api-cf2-catalog-staging`), not in the existing accepted CF1 bootstrap. Inject an isolated staging origin and credential via Cloudflare **secret** after separate explicit founder consent. It must never be available in Vite `VITE_*` environment variables.
4. In that Worker permit only public shop/list/menu GET/HEAD and precise read-only OPTIONS, with strict Origin allowlist, no credentials in URLs, explicit 503 for all orders, payments, profiles, merchant/admin and all mutation verbs; bounded max results, payload/time limits and no fabricated prices/open status. No real identity or authentication path. Do not promote Customer #140 until real API parity and owner acceptance.
5. Benchmark small synthetic workloads and confirm Cloudflare CPU/request budget and Supabase query cost. Current pilot limits (200 shops / 400 menu items per shop) must fail closed; before national expansion, design controlled pagination/batching plus invalidation for shop availability and prices.
6. At release gate, test exactly the 5 synthetic shops and 3 synthetic menu items with negative cases: pending/archived never public, closed shop menu browsable but ordering denied, far shop visible in discovery but outside 4km pickup eligibility, and all request/response data only from the staging project.

## Release checklist before seeking a single scoped founder approval

- Reviewed and reproducible SQL privilege design with negative tests; verify no `service_role` JWT is exposed in a public route without additional isolation, and avoid broad RLS bypass.
- Confirm isolated staging fixture creation history and absence of PII in rows to be exposed; no main/Production identity or database reuse.
- Real Cloudflare Worker identity and exact staging Supabase project verified, rollback prepared, zero production domains, free-tier cost ceiling identified, and staging service secrets protected.
- Draft PR #222 code tests and Workers dry-run pass, and a separate deploy plan identifies specific resource/permissions to change. Until then **no authority to execute SQL DDL, bind keys, deploy or change DNS**.

## Next permitted work

Source-only SQL/privilege threat modelling, synthetic contract tests and drafts are permitted under the founder's SAFE autonomy; actual staging grants, secrets and another Cloudflare deployment require founder's separate informed approval.

Reference: [Operating charter](LOCALEATS_FOUNDER_CHARTER.md), [Durable handoff](LOCALEATS_PROJECT_MEMORY.md), [CF2 security review](CLOUDFLARE_CF2_STAGING_DATA_AUTH_REVIEW.md).
