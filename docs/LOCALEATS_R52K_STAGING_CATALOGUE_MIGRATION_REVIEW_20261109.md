# R5.2K — Isolated staging catalogue migration review

**Status: REVIEWED IN DISPOSABLE POSTGRES ONLY — NOT APPROVED / NOT DEPLOYED.**  
**Date:** 2026-11-09  
**Project for any later explicit authorization:** Supabase `LocalEats-Profile-Staging` (`rgpbdajhlrwfmhopzgzk`); never the `LocalEats` Production project (`phdjumtqkooyppxozqsi`).

## Review artifacts (all draft)

| File | Purpose |
| --- | --- |
| `supabase/drafts/r52k_catalogue_staging_REVIEW_ONLY.sql` | New synthetic-only shop and menu tables, time-based availability view, RLS and service-role grants |
| `supabase/drafts/r52k_catalogue_fixture_SYNTHETIC_ONLY.sql` | Separate opt-in insert of five fictional shops and three fictional menu products |
| `supabase/drafts/r52k_catalogue_rollback_REVIEW_ONLY.sql` | Restrictive rollback that preserves existing `profiles` and refuses unknown dependencies |
| `tests/staging/r52k_catalogue_contract_READ_ONLY.sql` | Reproducible read-only contract and permission checks |

The SQL is deliberately under `supabase/drafts`, **not** an auto-applied migration directory. The current draft PR is **not permission to apply SQL**. Running these files requires a separately approved execution process.

## Current real staging baseline — inspected read-only

- Database engine: PostgreSQL **17.11**.
- `public.profiles`: present, RLS enabled, **0 rows**, existing P5 staging sentinel comment retained.
- `public.shops`, `public.menu_items`, `public.shops_with_availability`: **all absent**.
- Three Postgres API roles exist: `anon`, `authenticated`, `service_role`. Supabase credential provenance has **not** been verified by a successful catalogue request.
- API staging /health returns 200, while /api/v1/catalog/shops still returns 500. R5.2J CORS exact-origin check already passed.
- Do not misinterpret API health as a verified Supabase connection.

## SQL design reviewed

The schema matches fields and filters used by `localeats-api/src/routes/catalog.ts`:

- Shop view fields: `effective_is_active`, availability revision/override, ID/name/description/location/category/logo/rating/schedule/is_active, latitude/longitude and compatible `lat`/`lng` aliases, and public story. `approval_status` and `archived_at` are present for PostgREST filters.
- `owner_id` is stored on the table but **not** projected by the view; route select is already allowlisted.
- The view uses PostgreSQL `security_invoker=true`; both tables have RLS enabled, with **no anon/authenticated policies**. Direct browser role grants are revoked; only server `service_role` has SELECT on shops, menus and the view. No general INSERT/UPDATE/DELETE grants.
- The availability function respects South Africa local hours and any explicit expiry-limited override; an approved closed shop is still included in the catalogue as **closed**. Closed-shop menu browsing remains possible; ordering remains blocked independently.
- Only synthetic ID prefixes, labels and owner IDs are accepted in this staging-only schema. Price, geographic coordinates, name, schedule, JSON customizations and long-text fields have constraints. Menu rows have foreign keys.
- A revision trigger increments the availability revision on changes to active state, hours or override. No order tables, payment functions or merchant write RPCs are introduced.
- All SQL is one transaction per file. The migration and rollback demand deliberate session-level approval and verify the exact existing staging `profiles` comment; the migration refuses existing catalogue objects and a changed profiles baseline. **These guards cannot cryptographically prove the Supabase project identity**: an operator must verify the project ref independently.

## Disposable PostgreSQL tests (actual execution, not remote Supabase)

Tested in a temporary Ubuntu PostgreSQL **18.6** cluster using an isolated repository checkout, with synthetic stand-in `profiles` and API roles. The following passed:

1. Applying schema without explicit approval flag **failed closed** and created no catalogue tables.
2. After intentionally arming the disposable session, schema creation **succeeded** and optional fixture added **5 fictional shops / 3 menu items**.
3. `tests/staging/r52k_catalogue_contract_READ_ONLY.sql` validated view columns, view security-invoker mode, RLS, absence of browser grants/policies, service-only selects, availability and closed-shop menu.
4. Re-running the migration or re-inserting fixtures **failed closed**; malformed shop ID and negative menu price were rejected.
5. Availability revision incremented when the open flag was changed in a rolled-back local transaction.
6. Rollback without the approval flag **failed closed**; an armed rollback successfully removed only the R5.2K catalogue objects and left the profiles-only baseline intact.
7. The final repeat of schema → 5 shops/3 menu items → read-only contract → rollback **passed**, restoring the synthetic database baseline.

The very first local execution surfaced an unsupported `isfinite(double precision)` expression. It was replaced by finite-bounded range checks before the successful final run. The open synthetic fixture now has a seven-day availability override to avoid false failure at the 23:59 minute.

### Limits of the evidence

- Postgres **18.6** passed, but the actual isolated staging runs **17.11**: require a Postgres 17-compatible disposable rehearsal or approved staged application before final sign-off.
- No real Supabase schema, policies, data, credentials, customer identities, API code or Vercel deployment changed as part of R5.2K.
- The actual staging API may still return 500 after schema creation if its masked sensitive credentials or permissions are wrong. Confirm via a 200 `{success:true,shops:[]}` read **before inserting fixtures**.
- Database tests do not replace actual HTTP CORS, source-unit, 4 km boundary, menu rendering, guest/auth or browser verification.

## Required separate owner approvals and stop gates

**Approval A — Schema only.** Owner reviews exact SQL, independently confirms target project `rgpbdajhlrwfmhopzgzk` and existing empty `profiles` baseline, approves a staging-specific backup/recovery procedure, and authorizes that exact `r52k_catalogue_staging_REVIEW_ONLY.sql` execution. First verify `/api/v1/catalog/shops` succeeds with an **empty** catalogue. Stop if 403/500, credential provenance, schema or privilege checks fail.

**Approval B — Synthetic test data only.** After A passes, owner separately approves inserting **only** the five fictional shops and three menu items using the fixture file. No real merchants, prices, customer profiles, order records or rewards credits. API and Customer browser reads must be tested without writes.

**Approval C — Identity and end-to-end tests.** After A and B, separately approve registered synthetic Firebase staging users and verify revoked/disabled-account rejection, user-scoped profiles, ShopCard/menu/cart and closed-shop semantics. No real orders or checkout writes.

**Rollback:** If schema or synthetic verification fails, stop, preserve diagnostic records, validate that only synthetic R5.2K rows exist, then execute the review-only RESTRICT rollback **only with separate owner approval**. Rollback never drops `profiles` or uses `CASCADE`. Take a verified staging baseline/snapshot before A.

**Always forbidden without further explicit release approval:** Production Supabase/Vercel, merge, real ordering, order mutations, payment activation, LocalPay rewards, real merchant data or creating real accounts.

## R5.2L recommendation

An owner-controlled **Approval A readiness gate**, with a PostgreSQL 17 dry run (or equivalent controlled validation), staging backup assurance and independently verified service credentials. Do not move to B or C based solely on the source-level green tests.
