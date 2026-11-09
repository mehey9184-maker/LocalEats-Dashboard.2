# LocalEats L1A — Staging Backup, Restore & Pickup Schema Readiness

**Audit date:** 10 November 2026 (Africa/Johannesburg)
**Status:** Read-only baseline **PASS**; independently restorable **current** backup **NOT VERIFIED**; hosted pickup schema and RPCs **NOT READY**.
**Authorization:** Owner approved verification and a plan only. No remote DDL/DML, no hosted staging or Production mutation, no actual order, no feature activation, no merge. This branch is docs and SELECT-only evidence.

## 1. Explicit environment boundaries

| Resource | Exact identification / boundary |
|---|---|
| Allowed database for read-only checks | Supabase **LocalEats-Profile-Staging**, project **`rgpbdajhlrwfmhopzgzk`**, `eu-west-1`, `ACTIVE_HEALTHY`, PostgreSQL 17.11 |
| API staging | Vercel project `prj_eroDrVcFOPlvRJzjCU7vbwGnleFT`; staging API alias `https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app` |
| Customer staging | Vercel project `prj_F4szeGF8BxmYpdUVA2yLYrjAmMUN`; isolated Preview remains on C1E |
| Production | **Never query, migrate, restore, promote, roll back, merge, or change** as part of L1A |
| Customer / Merchant / Rider apps | No UI replacements, rider activation, production merge or live write promotion |
| Credentials | No secret values, user emails, Firebase ID tokens, passwords, dumped SQL, or database connection strings committed or copied to chat |

The environment settings were inspected **without displaying secret values**. Both app projects have staging-only flags; Customer order/profile writes and API order/profile writes are explicitly **disabled**, as are Rider activation, Rewards and LocalPay wallet features. API/Customer staging source snapshots were confirmed via GitHub/Vercel. Changes in config or deployed commit require rechecking.

## 2. Verified live Supabase database on 10 November 2026

The exact versioned query `tests/staging/l1a_current_staging_baseline_READ_ONLY.sql` was executed using the connected Supabase read-only SQL route on the **explicit staging project ref**. Result: **`L1A_CURRENT_STAGING_BASELINE_PASS`**.

| Component | Actual staging observation |
|---|---|
| `public.profiles` | exists, **0 rows**, **14 columns**, **13 constraints**, RLS + FORCE RLS, no direct browser read |
| `public.shops` | exists, **5 synthetic rows**, **18 columns**, RLS enabled, no direct browser read |
| `public.menu_items` | exists, **3 synthetic rows**, **11 columns**, RLS enabled, no direct browser read |
| `public.shops_with_availability` | exists, `security_invoker=true`, service-role SELECT only |
| `public.orders` | **absent** |
| `public.pickup_order_events` | **absent** |
| `public.pickup_create_order` RPC | **absent** |
| `public.pickup_order_command` RPC | **absent** |
| Applied application migrations | **2**: `20261103140914` (P5 profile), `20261109165612` (R5.2O staging catalogue) |
| Supabase Auth users | 0; **not** the separate Firebase test accounts |
| Supabase Storage objects / buckets | 0 / 0 |
| Managed Auth / Storage migration-history rows | **82 / 80** |
| Browser access | `anon`/`authenticated` direct SELECT denied for app tables and catalogue view |
| Backend access | `service_role` SELECT allowed for profile/shop/menu; catalogue INSERT not granted |
| Supabase Security Advisor | One INFO `rls_enabled_no_policy` group (3 tables), **intentional server-only access model**, not a reason to add public RLS policies |

Additional read-only query confirmed only the catalogue schedule/effective-open/availability trigger functions are installed in public; **neither pickup write RPC** is installed.

**Interpretation:** the existing catalogue is preserved and works in read-only Preview. No hosted pickup order could complete at this stage. The status `L1A_CURRENT_STAGING_BASELINE_PASS` confirms today's metadata snapshot only; it is **NOT evidence that a backup was restored**.

## 3. Backup evidence reviewed — the real blocker

Sources: draft API PR #129 R5.2M, #130 R5.2N, and the owner's 9 November local restore evidence embedded in the R5.2N report.

**What actually passed earlier**
- Owner used Supabase CLI and Docker privately on Windows to export `roles.sql`, `schema.sql` and `data.sql` from the then-current isolated staging project. GitHub records non-secret file sizes and SHA-256 digests; the SQL dump contents were not committed.
- The owner also reported encrypted 7-Zip/offsite copies. External backup provider permissions, actual availability and independent restore of the encrypted copy are **not observable through current connectors**.
- An isolated local Supabase PostgreSQL 17.11 stack successfully restored the **application profile schema**, with 14 columns, 13 constraints, RLS, and 0 profile rows matching the prior baseline.
- After a local-only ACL correction, isolated local `anon` and `authenticated` reads were denied and a `service_role` profile read worked.

**What failed / remains unverified**
- Complete source `data.sql` restore rolled back on managed `storage.buckets_vectors` / `storage.vector_indexes` insert privileges. Do **not** bypass managed permissions, strip nonempty managed Auth/Storage migration rows, or regard the failed restore as successful.
- Recovery of the source managed `auth` and `storage` state, original migration history and complete source privileges was **not proven**. Supabase CLI logical dumps can exclude managed schemas; a schema-only restoration is not a whole-project restoration.
- The earlier export preceded the successful **R5.2O catalogue migration and R5.2P fixture insertion** (current state: 5 shops, 3 menu items, 2 app migrations). The old export is therefore **not a verified recent backup of today's exact staging baseline**, even though the old files were hashed.
- No current encrypted archive or its decryption/restore receipt was provided in this L1A review. No connector here can independently download or restore a full managed Supabase project backup.
- Owner's **Production** backup must be a separate future approval gate and must not be implied by this staging export.

**Decision:** `STAGING_BACKUP_RECOVERY_NOT_VERIFIED`. This blocks hosted pickup-schema execution at L1A.

## 4. Safe backup + independent-restore sequence (owner/private execution, NOT started in L1A)

1. **Verify the source** in the Supabase dashboard. Confirm project display name and project ref **`rgpbdajhlrwfmhopzgzk`**. Verify the current two migrations and 5/3 synthetic catalogue counts against `l1a_current_staging_baseline_READ_ONLY.sql`. Never assume `current_database()='postgres'` distinguishes staging from Production.
2. **Capture a fresh backup of today's state** using the reviewed owner-run helper `scripts/staging/r52n-export-staging-backup.ps1` from PR #130 **on the owner's trusted computer**, after privately verifying the installed CLI's `db dump --help` and the explicit remote project ref. Use an access-restricted **encrypted** local destination outside Git and outside unprotected sync folders. The helper dumps roles, schema and data, generates file sizes/SHA-256 evidence, and deliberately writes `restoreStatus=NOT_VERIFIED`. It does not encrypt files automatically. A successful command is **export evidence, not restore proof**.
3. **Verify provider and retained backups.** Confirm an encrypted off-site copy exists, can be decrypted using an owner-controlled recovery key, and that SHA-256 file hashes match after extraction. Do **not** send raw SQL, archives, passwords, private keys, or tokens to GitHub or chat. Share only non-secret manifest fields and PASS/FAIL receipts.
4. **Perform a clean-room restore** into a separately created sacrificial **local or disposable Supabase-compatible PostgreSQL 17** environment with no customer/Production connection or reused hosted credentials. Follow current official Supabase restoration guidance for compatible roles, schemas, extensions, migrations, Auth/Storage state and required object order. Restore the **new** export, not the older pre-catalogue backup.
5. **Stop on any managed-schema failure.** Never grant broad access, delete nonempty managed migrations, silently omit problematic tables, patch source dumps without documenting a separately reviewed recovery method, or interpret a transaction rollback as PASS. Supabase Storage database metadata and actual stored objects are different assets; object files need separate recovery if present.
6. **Independent read-only comparison.** Run this same exact `l1a_current_staging_baseline_READ_ONLY.sql` against the disposable restored database. Require `L1A_CURRENT_STAGING_BASELINE_PASS`, full table/column/constraint/index/grant equivalence, migration versions, absence of unauthorized grants, shop/menu fixture counts, service-only access checks and managed Auth/Storage history reconciliation. Do not adjust expected counts just to force PASS.
7. **Record a safe evidence receipt:** source project ref, export UTC timestamp, hashes/sizes, encrypted custody/retention, sacrificial restore environment ID, restore tool/version, restore result, comparator result, differences/exclusions, operator and cleanup result. The owner retains the actual encrypted files privately; do not put them in GitHub.

**If provider-supported full managed recovery remains impossible**, stop and flag a residual recovery risk. A narrower staging-only, explicit **risk-accepted** schema decision would require a different owner approval; this L1A approval does not confer it.

Official documentation: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups), [Restore a downloaded backup locally](https://supabase.com/docs/guides/local-development/restoring-downloaded-backup), [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project). Paid-plan physical restores and Free-plan logical exports differ; do not assume a Free project has PITR.

## 5. Pickup schema drafts audited — none is safe to run against current hosted staging

| Source | Review decision |
|---|---|
| PR #127 `supabase/drafts/r52k_catalogue_staging_REVIEW_ONLY.sql` | **Already applied** as R5.2O for the current catalogue. Its preflight refuses existing shops/menu/view. **Do not rerun.** |
| PR #90 `security/drafts/staging_pickup_secure_base_DISPOSABLE_ONLY.sql` | **Disposable-only**, hard-guards on database `localeats_stage_base_disposable`, assumes **no shops/menu** and proposes recreating them. The current remote DB already has both tables. **Do not repurpose or remove guard to run on staging.** |
| PR #124 `localeats-api/tests/pickup/r52c/schema.SYNTHETIC_ONLY.sql` | **Synthetic PG17 rehearsal**, hard-guards on database `r52c_synthetic_only` and test roles; creates dummy catalogue/view plus order/event tables, but **no production-equivalent pickup create/command RPCs**. Not a staging migration. |

**Critical compatibility facts for a NEW, separately reviewed additive migration:**
- Preserve the existing P5 `profiles` exactly and preserve **existing** `shops` and `menu_items` data, 4 km catalogue functions, view and their grants.
- Current shop IDs and menu item IDs are **text** constrained to `stg-test-` patterns. Do not follow an older proposal that recreates `menu_items.id` as UUID or drops existing fixtures. `orders.shop_id` must reference today's **text** `shops.id`; order IDs and event/command IDs can be UUID according to the API contract.
- The current `shops.owner_id` accepts only `stg-test-owner-...` strings and P5 profile rows are empty. It **does not prove actual Firebase UID ownership** for a Merchant. Do not create synthetic merchant mappings or loosen constraints without a separate reviewed identity/onboarding plan.
- The API source `localeats-api/src/routes/orders.ts` and `src/orders/pickupService.ts` require `public.orders`, `public.pickup_order_events` (for versioned history), and restricted RPCs `pickup_create_order` and `pickup_order_command`. Simply adding an `orders` table does **not** make the app order-ready.
- The new contract must include order intent hash, globally unique idempotency key, server-authoritative price/quantity, approved shop availability at the 4 km pickup radius, collection-only state/payment semantics, monotonic revision and immutable command/event receipts; protect against replay, cancelled/rejected transitions and repeat taps. Money stays in integer cents or exact bounded decimals, never inferred from browser totals.
- The migration must explicitly set appropriate ownership, RLS and FORCE RLS, deny browser `anon`/`authenticated` direct table DML, avoid `PUBLIC` function `EXECUTE`, and restrict backend RPC grants to the intended server identity. Every operation must be guarded by the **actual staging project ref externally**, expected schema fingerprints, reviewed commit/hash and an owner-approved transaction. A stale baseline or any failure must roll back.
- **Do not enable** controlled pickup identities, shop-owner fixtures, profile writes, order writes, rewards, payout, riders, notifications or wallet as part of the schema-only action.

A new **additive-only** hosted migration is therefore **not yet authored or approved in L1A**. Its draft and tests should be a separate L1B work item, first proved against an offline PG17 clone matching today's 3 public tables.

## 6. Required approval gates (in order)

| Gate | Evidence required | Current decision |
|---|---|---|
| **L1A backup export** | Fresh current staging roles/schema/data, exact project ID, checksum, encrypted custody | **NOT VERIFIED** for current baseline |
| **L1A isolated restore** | Unmodified current export independently restored, managed state assessed, exact current baseline comparator PASS | **BLOCKED** |
| **L1B additive SQL design** | Versioned SQL and rollback plan, expected P5+catalogue preservation, API contract/RPC compatibility tests on disposable PG17 | **NOT STARTED** |
| **L1B SQL execution** | Exact SQL source SHA, authenticated staging project ref, full L1A proof, dry run and rollback, **new explicit owner approval** | **NOT AUTHORIZED** |
| **L1C identity and write rehearsal** | Approved synthetic merchant/customer fixtures, token ownership, idempotency/revision/order-event audit, independent approval to open only necessary stage writes | **NOT AUTHORIZED** |
| **Production pilot** | Independent Production backup, compliance and safety acceptance, owner approval of exact release | **NOT AUTHORIZED** |

After a separately approved schema migration, the initial hosted **verification must remain read-only**: compare unchanged 5 shops / 3 menu / P5 profile baseline, ensure order and event tables start empty, confirm browser DML still denied, API order endpoints still 401 without auth, and API write flags still off. Do not send synthetic POST orders until **L1C** is separately approved.

## 7. Change log for L1A

- Inspected GitHub draft PRs #90, #124, #127, #129, #130 and staged API route code without merges.
- Queried actual staging Supabase for health, tables, counts, grants, RLS, functions, views, migrations and security advisories using SELECT/metadata tools.
- Inspected only non-secret staging Vercel config flags and their match against expected disabled write/activation state.
- Wrote and ran `tests/staging/l1a_current_staging_baseline_READ_ONLY.sql`: **PASS**.
- Created this plan as a **draft, document-only review artifact**. No actual backup created, no full archive opened, no restored database, no SQL migration, no fixture writes, no Firebase account changes, no Vercel deployment, no PR merge and no Production interaction.
