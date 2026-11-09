# R5.2L — Schema Approval A readiness report (REVIEW ONLY)

**Date:** 2026-11-09  
**Decision:** **NOT APPROVED FOR REMOTE MIGRATION**. The exact PostgreSQL version and read-only staging baseline passed, but there is no verified recoverable backup of the connected Free-plan Supabase staging project. API service-role credential provenance also remains unverified.

**Scope:** Supabase **LocalEats-Profile-Staging** project ref `rgpbdajhlrwfmhopzgzk` and isolated Vercel API project `localeats-api-staging-r52d`. The other Supabase project `phdjumtqkooyppxozqsi` is **Production** and excluded. No migrations, data, accounts, orders, or policies have been changed in either connected project.

## Gate summary

| Gate | Result |
| --- | --- |
| Actual staging baseline matches R5.2K preflight | **PASS** — read-only SQL on connected staging |
| PostgreSQL 17.11 compatibility | **PASS** — complete draft migration/fixture/contract/rollback in disposable PG **17.11** |
| Backup/restore mechanics on synthetic dataset | **PASS** — separate disposable PostgreSQL 17.11 restore |
| Independently recoverable backup of actual staging database | **BLOCKED** — not yet created/verified; connected Supabase organization is on **Free** plan |
| API-to-staging Supabase network path | **OBSERVED** — real staging Supabase API logs show four `/rest/v1/shops_with_availability` 404s |
| API staging `service_role` key permissions & provenance | **NOT PROVEN** — Vercel sensitive env values are masked; no permitted successful real profile/catalogue read |
| Approval A to modify staging database | **NOT GRANTED** |
| Synthetic fixture/data approval | **NOT GRANTED** |

## Real staging metadata — READ ONLY

Executed `tests/staging/r52l_schema_approval_a_preflight_READ_ONLY.sql` through the Supabase connector against **exact ref** `rgpbdajhlrwfmhopzgzk`. Verified:

- PostgreSQL version **17.11**; engine healthy.
- `public.profiles` exists with **0 rows**, RLS enabled and the original P5 isolated-staging sentinel comment.
- `anon` and `authenticated` **cannot SELECT** the `public.profiles` table; `service_role` has SELECT.
- No `public.shops`, `public.menu_items`, or `public.shops_with_availability`.
- Exactly **1 existing migration**: `20261103140914 create_isolated_profile_staging_p5`; no development branches.
- Supabase security advisor returned `rls_enabled_no_policy` for `profiles` at **INFO** severity. The absence of browser-access policies is intentional in this Firebase UID / server-controlled profile design. Do **not** add an open SELECT policy to silence the notice. Health advisor returned no other notices.
- The separate API staging deployment remained `READY`, `/health` returned 200; `/api/v1/catalog/shops` returned 500, because the backing view is not yet present.
- Staging Supabase edge logs showed four GET requests to `/rest/v1/shops_with_availability` returning 404. This verifies requests reach the **staging** Supabase REST gateway and are attempting to read the missing object; it **does not** establish which privileged role the API credential uses.
- Project Vercel env metadata includes Preview-scoped `SUPABASE_SECRET_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and the exact staging Supabase URL/Firebase ID, but sensitive values are hidden. Do **not** reveal or paste credentials into GitHub, chat, SQL logs, or a test fixture.

## Exact PostgreSQL 17.11 compatibility evidence — DISPOSABLE DATABASE ONLY

Created a temporary PostgreSQL 17.11 cluster in a separate isolated test sandbox, with dummy database roles and an empty synthetic `profiles` table carrying the expected P5 sentinel.

1. Unarmed `supabase/drafts/r52k_catalogue_staging_REVIEW_ONLY.sql` refused to run: `R52K_OWNER_APPROVAL_REQUIRED`.
2. Intentionally armed **only the disposable test database**; the schema migrated without error.
3. Separately gated synthetic fixture inserted **5 fabricated shops and 3 fabricated menu items**.
4. `tests/staging/r52k_catalogue_contract_READ_ONLY.sql` passed both `R52K_SCHEMA_RLS_AND_COLUMN_CONTRACT_PASSED` and `R52K_FIXTURE_READ_CHECKS_PASSED`.
5. Took a `pg_dump -Fc` of that synthetic database (**16,130 bytes**), restored it to a **second disposable PostgreSQL 17.11 database**, and re-ran the read-only checks. Restored counts: profiles 0, shops 5, menu items 3.
6. Unarmed rollback refused to run: `R52K_ROLLBACK_OWNER_APPROVAL_REQUIRED`. Armed **local** rollback removed only synthetic catalogue objects. The original empty `profiles` table remained, and no catalogue objects remained.

**Limit:** The successful synthetic backup/restore is not a backup of the real remote Supabase project. The exact SQL is still a draft requiring separate owner authorization. No connected Supabase database schema or rows were modified.

## The critical remaining blocker: real staging backup (Free plan)

Supabase organization `fayoalqacqpijwvqvezp` reports `plan: free`. Supabase's database backup documentation describes automatic daily backups for **Pro, Team and Enterprise**, and recommends independently exporting Free-tier projects with the CLI and retaining protected off-site copies:
https://supabase.com/docs/guides/platform/backups

The connected Supabase plugin does not expose a backup listing/export action. **Do not assume** that any scheduled backup, PITR window, or recoverable snapshot exists.

Before authorizing Approval A:

1. Owner checks the staging project **Database → Backups** page for available scheduled/PITR backups. If none are available, create an owner-controlled **logical export** of the exact staging database. Do **not** perform the export against the Production project.
2. Supabase documents `supabase db dump` commands for **roles**, **schema**, and **data**:
   - `supabase db dump --db-url "<STAGING_CONNECTION_STRING>" -f roles.sql --role-only`
   - `supabase db dump --db-url "<STAGING_CONNECTION_STRING>" -f schema.sql`
   - `supabase db dump --db-url "<STAGING_CONNECTION_STRING>" -f data.sql --use-copy --data-only`
   Use these only on a trusted, owner-controlled machine, with credentials handled privately (never paste connection strings into this chat or commit backups to GitHub). The CLI may require Docker. See https://supabase.com/docs/guides/self-hosting/restore-from-platform.
3. Verify files are nonempty, protect them by encryption/access control, and retain a separately stored off-site copy. Check that the export covers the required profile schema, RLS, migration history and any relevant auth/storage metadata. Understand that database backups do not restore Storage objects.
4. Restore a copy **only into an isolated sacrificial database** and compare schema, `profiles` rows/RLS and migration state. Do not restore over the existing staging project during preparation.
5. Record the **backup timestamp, source staging project ref, retention/location (without credentials), restore test PASS/FAIL, and intended rollback owner**. A file existing is not sufficient proof of recoverability.

The above are **future owner-controlled tasks**, not actions already completed.

## Credentials and endpoint gates

- API staging uses `SUPABASE_SECRET_KEY` in the dedicated `LOCALEATS_STAGING_ONLY=true` mode. Its sensitive values are masked by the Vercel connector.
- The observed staging REST 404 indicates a request to the missing catalogue view, but is **not** a substitute for a successful privileged SELECT.
- After the backup gate is confirmed and the owner separately approves the exact staging-only schema, apply **schema only** and verify read-only `GET /api/v1/catalog/shops` returns **200 with empty `shops: []`** and the API does not leak credentials.
- Run actual security/permission checks. If it still returns 401/403/500, **stop**; do not insert fixtures or weaken RLS.
- An explicit owner decision remains required before synthetic fixture inserts and before synthetic identity tests. Keep `PICKUP_WRITES_ENABLED`, `PROFILE_WRITES_ENABLED`, reward, rider and LocalPay write flags off.

## What an Approval A request must contain

- Confirmation of exact staging Supabase project **ref** `rgpbdajhlrwfmhopzgzk` and current one-table baseline.
- Reviewed commit SHA for `supabase/drafts/r52k_catalogue_staging_REVIEW_ONLY.sql`; exact SQL approved without additional unreviewed edits.
- Evidence of recoverable actual-staging backup + independent restore test; PostgreSQL 17.11 compatibility evidence already supplied above.
- Owner/rollback plan, no live-order or data activation, explicit no-Production scope.
- Separate express approval before calling any remote DDL/migration action.

**Decision for R5.2L:** PG17 and preflight gates passed, but **Approval A is still blocked by the unverified real backup and unverified service-role read path**. No merge or remote changes.
