# LocalEats — Pickup-first to Rewards launch execution (R5.2N)

**Date:** 2026-11-09  
**State:** EXECUTION IN PROGRESS / DRAFT ONLY. No customer rewards, live orders, Production DB writes, payment integrations, or merges have been authorized by this PR.

## Immediate release order

1. **Recoverable isolated staging first (BLOCKED)** — Complete actual staging PostgreSQL 17 backup from project `rgpbdajhlrwfmhopzgzk`, protect the export and independently restore it. The Supabase organization is on Free; metadata-only baselines or synthetic test dumps cannot pass this. Existing R5.2M [backup/restore plan](LOCALEATS_R52M_ACTUAL_STAGING_BACKUP_RECOVERY_GATE_20261109.md) remains authoritative for safety, and PR #129 stays draft.
2. **Pickup staging (PENDING)** — After separate Schema Approval A, run the reviewed staging-only catalogue schema. Confirm a real 200 `shops:[]` read **before** approval B for synthetic shops. After B, verify original ShopCard, menu and cart with fabricated shops; after C, synthetic Firebase identity and merchant read/accept/ready/collection, token revocation and owner permissions. No real transactions yet.
3. **Pickup pilot release readiness (PENDING)** — Verify Production data backup/restore, role escalation/rider notification permission fixes, matching API/Customer/Merchant release versions, pickup idempotency and retry proofs, and owner manual acceptance on real devices. Approve a tightly controlled pickup pilot separately. Customer pays at the shop.
4. **Rewards pilot (PREPARATION STARTED, NOT LIVE)** — The *first* Rewards offer is **Bronze-only**: 4 genuinely paid-and-collected kota units (including 4 in one order/day) -> one eligible free kota of up to R25, **once** per enrolled customer. Up to **12 participants**; planned total cap R500, of which up to R300 covers all 12 gifts and R200 is buffer. No budget is considered funded until real ring-fenced money is evidenced. No owner approval for activation is inferred from this plan.
5. **Rewards settlement (BLOCKED ON END-TO-END PROOFS)** — Server-authoritative immutable paid-and-collected unit evidence, funding reserve, anti-replay and refunds, redemption at any participating shop, Super Admin payables and external bank-transfer recording, merchant confirmation/dispute, participant terms, opt-in, and regulator/legal review; never trust browser flags or simulate a real reward. Introduce visibly as COMING SOON before actual release approval.
6. **Future higher tiers (DEFERRED)** — Gold eligibility at 24 cumulative eligible paid-and-collected units, Platinum at 54, with **future** R80/R150 spendable promotional food-credit grants each valid 36 months and preserving existing unspent grants. These higher rewards require separate funded campaign versions, terms, financial ledger, and launch approval. Do **not** offer them under the Bronze-only R500 pilot. LocalPay remains a future restricted credit *brand*, not a deposit, bank, online top-up, cash-out, or a formed separate company.

## Actions executed in this draft

- Added `localeats-api/src/rewards/r52nPilotPolicy.ts`, a **pure offline** release policy contract. It does not issue credit, create offers, trust browser purchases, expose routes, or switch on flags.
- Added `r52nPilotPolicy.test.ts` to make approved 4/24/54 milestones, R25 gift, R500 budget ceiling, 12-person cap, 36-month future credits, and all missing launch proofs machine-checkable. The existing `rewardsModel.ts` remains an explicitly **superseded R2 offline prototype** (its R125/R200 and +40 milestone are not to be promoted to Production).
- Added `scripts/staging/r52n-export-staging-backup.ps1` for owner-controlled Windows CLI **read-only** exports of staging roles, schema and data to a private non-Git folder, requiring explicit project ref confirmation and generating hash/size manifest with `restoreStatus=NOT_VERIFIED`. It does **not** produce a guaranteed full Supabase backup nor do an independent restoration, and must not be run on Production.
- Added the `r52nBackupRunner.static.test.mjs` guard and wired both new tests into the regular API `npm test` script.
- An isolated Vercel sandbox built the API and ran all API script tests with no real Supabase credentials, test orders, account creations, or Production network writes.

## Tested command and outcome

`cd localeats-api && npm ci --no-audit --no-fund && npm test`

Observed on this branch in a disposable Vercel sandbox:
- Core API Node test suite: **231/231 pass**
- Additional R4.1 finance: **23/23 pass**
- R4.4 contract: **15/15 pass**
- R4.5 evidence: **56/56 pass**
- R4.7 authenticated evidence: **49/49 pass**
- R4.8 revocation middleware: **8/8 pass**
- Backup-script static guards: **3/3 pass**
- Every aggregate is *offline tests*, not a successful browser transaction or release-ready Rewards system.

## Owner-controlled Windows staging export

Before use, create a private local folder on encrypted storage outside any Git checkout or sync folder and privately log into Supabase on your own computer. Install Docker Desktop + Supabase CLI and use PowerShell:

```powershell
# Example PRIVATE folder (change to your encrypted local drive/folder):
.\scripts\staging\r52n-export-staging-backup.ps1 -BackupRoot "C:\LocalEats-Private-Staging-Backups"
```

It will ask you to type the exact staging project ref (`rgpbdajhlrwfmhopzgzk`) and handle any official Supabase CLI login/database password prompts *only on your local machine*. Never share credentials, generated SQL dumps, or complete connection strings in chat/GitHub. The script does **not** encrypt the files automatically; place it on an encrypted volume and keep an encrypted off-site copy. For managed Auth/Storage and migration-history recovery and an independent restoration test, follow the R5.2M guide. Your non-secret manifest metadata is safe to discuss; the manifest's `restoreStatus` is intentionally `NOT_VERIFIED` until an independent test passes.

## Actual owner-operated staging recovery evidence (2026-11-09)

**PARTIAL RECOVERY PASS; full staging backup-and-independent-restore gate still BLOCKED.**

The owner ran Supabase CLI 3.0.0 and Docker 29.9.2 on their own Windows PC. Three separate remote exports were created with explicit `--remote=rgpbdajhlrwfmhopzgzk`, moved into a private local folder, and hashed. **Never upload the exported SQL or credentials to GitHub.**

| Export | Bytes | SHA-256 |
| --- | ---: | --- |
| `roles.sql` | 297 | `25873CEC56A2CC6514E204F420231777F85C03DA818CAA7090CDCDFA89776ECD` |
| `schema.sql` | 5,057 | `AB421EA0F29A65AFE889C67952A70C3C8609776A2727A6798508524FA4BD293F` |
| `data.sql` | 11,618 | `CA28252CCCC08733FB5E056C509BF963CA9BA7C6580EB28E85AB26536E3DF3D0` |

Initial plain PostgreSQL 17 restore failed on absent managed Supabase role/schema; it was stopped. A new isolated Supabase local stack started on `127.0.0.1:55421` (API) / port `55422` (PostgreSQL 17.11). The original schema and data were not mutated.

First all-in-one import into local Supabase failed within `--single-transaction -v ON_ERROR_STOP=1` due to `storage.buckets_vectors` INSERT restrictions. An owner-generated local **testing copy only** of `data.sql` omitted one verified-empty `storage.buckets_vectors` COPY and retried. That import also failed and rolled back due to `storage.vector_indexes` permissions. Neither failure should be treated as a recovered full database.

Actual connected staging read-only metadata confirmed `storage.buckets_vectors` and `storage.vector_indexes` each had 0 rows and INSERT for role postgres was disallowed. Also `auth.schema_migrations` had 82 rows and `storage.migrations` had 80 rows: **do not strip managed nonempty migration data or grant broad privileges to force a restore**. `supabase_migrations.schema_migrations` had one application migration. No connected hosted DB changes were made.

The owner then restored only `roles.sql` + `schema.sql` into local Supabase using one transaction and `ON_ERROR_STOP=1`. The command printed `LOCAL APPLICATION SCHEMA RESTORED`. A follow-up local SQL query returned:

| Metadata | Actual staging baseline | Owner's local restored database |
| --- | ---: | ---: |
| public.profiles row count | 0 | 0 |
| public.profiles columns | 14 | 14 |
| public.profiles constraints | 13 | 13 |
| public.profiles RLS policies | 0 | 0 |
| RLS enabled | true | true |
| FORCE RLS | true | true |

**Result:** Local P5 application schema structure restored and matching six core metrics. **Still not proven:** cross-role read denial/service-only read, complete column-by-column/type/index/ACL equivalence, source data recoverability, Supabase Auth/Storage/application migration restore, actual file objects (if any), durable encrypted copy, production backup, or full end-to-end pickup behavior. Schema Approval A remains on hold until the comprehensive recovery decision is approved; no R5.2K schema or fixtures applied.

### Owner's executable role-access security tests — PASS (2026-11-09)

Against the isolated local PostgreSQL 17.11 container `supabase_db_LocalEats-Restore-Lab` (not hosted staging), following the **manual** privilege correction, the owner executed three separate read-only sessions:

- `SET ROLE anon; SELECT COUNT(*) FROM public.profiles;` → `permission denied for table profiles` (expected)
- `SET ROLE authenticated; SELECT COUNT(*) FROM public.profiles;` → `permission denied for table profiles` (expected)
- `SET ROLE service_role; SELECT COUNT(*) FROM public.profiles;` → `count = 0` (expected)

**PASS: local database authorization check.** This is stronger than inspecting `has_table_privilege` alone. PostgreSQL's suggested `GRANT SELECT` hints must NOT be followed; those roles are intentionally denied. No direct public profile reads. The local privilege test does not validate Firebase-authenticated API pathways or independently prove full backup recoverability. **Clean-room, unmanaged/default-privilege-safe source restoration plus managed Auth/Storage/migration recovery remain required before Schema Approval A.** No hosted DB migration, Production changes, app merge or feature activation was performed.

### Owner local-only ACL repair verification — PASS after manual correction (2026-11-09)

Using the isolated `supabase_db_LocalEats-Restore-Lab` PostgreSQL 17.11 container **only**, the owner executed:

```sql
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon, authenticated;
```

The SQL returned `REVOKE`; subsequent *local* `has_table_privilege` verification returned: `anon SELECT = f`, `authenticated SELECT = f`, `service_role SELECT = t`, matching the observed real staging source grants. **This is a post-import manual privilege repair, NOT evidence that the unmodified database export automatically recovered source ACLs.** Original staging and Production remain untouched. RLS and FORCE RLS remain enabled, with zero policies; no live order, rewards, payment or merge activation.

**Next:** exercise `SET ROLE anon` and `SET ROLE authenticated` in the local restore lab, expecting permission-denied on `public.profiles`; also confirm service role access. Rehearse a *fresh* clean-room restore with destination default privilege revocation and real dump fidelity, then confirm auth/storage managed schema and application migration recovery before clearing Schema Approval A.

### Owner's local access-control comparison — FAIL, needs local-only ACL correction

The owner executed the read-only local `has_table_privilege` probe. Results from the locally restored `public.profiles`: `anon SELECT=true`, `authenticated SELECT=true`, `service_role SELECT=true`, index count 1. Rechecked **actual hosted staging via SELECT only**: `anon=false`, `authenticated=false`, `service_role=true`, index count 1; table owner `postgres`; exact source `relacl`: `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`. Both local and source have RLS enabled/forced and zero policies. **Schema restore does not currently preserve privilege parity.**

This mismatch is consistent with local Supabase database default grants when importing a backup containing only grants that explicitly existed on the source; `public.profiles` must be denied to anon and authenticated by SQL privileges as well as RLS. Supabase CLI documentation explicitly advises revoking target public table default privileges before restore to preserve source grants: https://supabase.com/docs/reference/cli/supabase-db-dump

**Release gate remains BLOCKED.** Proposed next owner-controlled lab step: `REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon, authenticated;` on the isolated local container only, then recheck `has_table_privilege` and table/index/RLS counts. This is an explicit **post-restore local repair**, so success cannot be misreported as an unmodified exact restore. A stronger future clean-room restore must first revoke target default privileges in the disposable destination, then load the original SQL under a single transaction and compare exact ACLs, without hosted changes. Do not apply these REVOKEs to hosted staging or Production and do not remove RLS.



### Local default-privilege root cause observed (2026-11-09)

Owner's **read-only** `pg_default_acl` query on isolated `supabase_db_LocalEats-Restore-Lab` returned two sets of `public` default table privileges:

- `supabase_admin` objects: grants `arwdDxtm` to `postgres`, `anon`, `authenticated`, `service_role`.
- `postgres` objects: grants `arwdDxtm` to `postgres`, `anon`, `authenticated`, `service_role`.

This supports the observed restore drift: newly created `public.profiles` automatically inherited `anon/authenticated` privileges even though source `relacl` grants only `postgres` and `service_role`. The manual `REVOKE` fixed only the existing local table and cannot protect future clean restores. See official Supabase API grants/defaults guidance at https://supabase.com/docs/guides/api/securing-your-api and dump migration note at https://supabase.com/docs/reference/cli/supabase-db-dump.

**Next safe local action:** change the **local `postgres` table defaults only** using `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated`, then create a *transaction-rolled-back* probe table to verify new future table access (expect `f/f/t`). This does not retroactively affect any existing table. Only after this preflight, consider a guarded new schema replay. Do not run the SQL against any remote Supabase project. Full managed-data recovery remains unverified.

### Owner local default-ACL test — PASS (2026-11-09)

The owner ran `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;` **only** in the isolated `supabase_db_LocalEats-Restore-Lab` Docker database. Then within `BEGIN ... ROLLBACK`, the owner created `public.r52n_acl_probe` and queried role SELECT privileges. Results: `anon=f`, `authenticated=f`, `service_role=t`; `ROLLBACK` completed. This confirms the intended defaults for future tables created **by postgres in this local lab**. It does not change existing tables, nor default privileges for objects created under `supabase_admin`, and it does not prove a fresh full restore.

**Next recovery validation:** safely inspect original immutable `data.sql` to enumerate source COPY table names and row counts (no row contents), check for managed Auth and Storage migration records, and choose an appropriate clean-room restoration strategy. Do not delete or rewrite the original SQL, remove nonempty migration history, or weaken roles to force a green import. Staging Schema Approval A remains blocked; no hosted writes or activation occurred.

### Owner export-data inventory and source migration baseline (2026-11-09)

The owner ran a **checksum-verified, read-only** PostgreSQL `COPY` block scan of the original `data.sql`; original SHA-256 `CA28252CCCC08733FB5E056C509BF963CA9BA7C6580EB28E85AB26536E3DF3D0` was verified unchanged.

| Data section | COPY rows in original export |
| --- | ---: |
| `public.profiles` | 0 |
| `auth.users` | 0 |
| `storage.objects` | 0 |
| `storage.buckets_vectors` | 0 |
| `storage.vector_indexes` | 0 |
| `auth.schema_migrations` | not present |
| `storage.migrations` | not present |
| `supabase_migrations.schema_migrations` | not present |

Independent **read-only** connected staging queries confirmed: `public.profiles` 0; `auth.users` 0; `storage.objects` 0; `storage.buckets` 0; `auth.schema_migrations` **82**; `storage.migrations` **80**; `supabase_migrations.schema_migrations` **1**. The one application migration is **`20261103140914_create_isolated_profile_staging_p5`** (version `20261103140914`, name `create_isolated_profile_staging_p5`). The source public schema contains only `public.profiles` (14 columns, 13 constraints, forced RLS).

**Interpretation:** Current staging application/Auth/Storage user-data tables are empty, but a successful export is NOT a complete migration-history or operational recovery. Managed Auth/Storage migration history is owned by the target Supabase installation; do not overwrite it with versions from a different stack. The missing application migration-history export must be recorded and reconciled by a controlled, target-compatible recovery procedure. The `data.sql` empty COPY sections and the absent migration tables are not proof that *all* recoverability requirements are met.

**Safe next check:** without adding another DB stack or touching any hosted DB, run a **transactional local-only** `DROP TABLE public.profiles RESTRICT` followed by replay of the original schema file, check `f/f/t` privileges *before any manual table REVOKE*, then `ROLLBACK` and verify the original local table still exists. This tests the corrected **local `postgres` default privileges** against the real schema without leaving changes behind. Any error triggers transaction rollback on connection close. Full data/managed migration recovery remains blocked.

### Transactional original schema replay with corrected defaults — PASS (2026-11-09)

The owner executed against **local-only** `supabase_db_LocalEats-Restore-Lab` Postgres 17.11, in a **single psql connection** with `ON_ERROR_STOP=1`:

1. `BEGIN`; `DROP TABLE public.profiles RESTRICT`.
2. Replayed **original immutable exported `schema.sql`**, receiving `CREATE TABLE`, `ALTER TABLE`, `COMMENT`, `GRANT`, and `ALTER DEFAULT PRIVILEGES` without an error.
3. Queried access on the freshly recreated local table: `anon_select=f`, `authenticated_select=f`, `service_role_select=t` **without post-creation REVOKE**.
4. `ROLLBACK`; `to_regclass('public.profiles')` returned `profiles`, demonstrating preservation of the pre-existing local application table.

The owner output ended `LOCAL TRANSACTIONAL SCHEMA TEST COMPLETED`. This is **PASS for transactional application schema replay and SELECT privilege parity under corrected local defaults**. It is not proof of a clean untouched target's default privileges, complete table ACL/grant equivalence across all operations, Auth/Storage managed migration version compatibility, backup of Production, or end-to-end app recovery. No remote DB modifications, payment, rewards or order activation.

**Next gap:** confirm local app-migration history availability and compare full profiles privilege matrix / RLS / ownership with hosted staging. The exported `data.sql` does not contain `supabase_migrations.schema_migrations`; the remote project still lists its single P5 migration. Do not fabricate migration history rows or deploy the R5.2K catalogue until the owner reviews the recovery gap and separate staging schema approval gate.

### Complete local profile privilege matrix and migration-table gap — PASS / OPEN (2026-11-09)

Owner's local-only read-only checks on the restored application table reported:

| Actor | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `anon` | f | f | f | f |
| `authenticated` | f | f | f | f |
| `service_role` | t | t | t | t |

Table owner is `postgres`; RLS `true`, FORCE RLS `true`. **Local migration history relation** `to_regclass('supabase_migrations.schema_migrations')` returned **null**. The staged source has one application migration `20261103140914` named `create_isolated_profile_staging_p5`. Do not fabricate migration history, promote a new catalogue migration, or claim full database recovery based on successful schema replay.

Independent source **read-only** schema fingerprint query over source `public.profiles` on staging PostgreSQL 17.11 provided the following expected SHA-like MD5 values:
- ordered columns (attnum, name, formatted type, nullable, default; joined with `|`, lines joined with LF): `cc36687e28c2c82e91c30f05d76cf915`; count 14.
- constraints (name, type, pg_get_constraintdef; sorted by name): `3221cebb96aee5898e53bd37ed0e3182`; count 13.
- indexes (indexname, indexdef; sorted by name): `fd08bb978aa63dbb2a08cd383c6cee2e`; count 1.
- table comment: `LocalEats Profile P5 isolated staging only; no direct anon/authenticated Data API access; Firebase UID scoped via server profile API.`

These are metadata-only consistency comparators, not independent backup receipts. A local comparison is the recommended next read-only acceptance test. Only then design the missing migration-history recovery procedure and full managed Auth/Storage compatibility plan.

### Complete owner source-vs-recovery metadata fingerprint parity — PASS (2026-11-09)

Owner executed the SQL CTE from the launch plan against the **isolated local PostgreSQL 17.11** recovery lab and returned three metadata-only digests. Every value **exactly equals** the independently queried live staging baseline for `public.profiles`:

| Property | Actual staging | Local restore |
| --- | --- | --- |
| Ordered column definitions | `cc36687e28c2c82e91c30f05d76cf915` | **MATCH** |
| Ordered constraint definitions | `3221cebb96aee5898e53bd37ed0e3182` | **MATCH** |
| Ordered index definitions | `fd08bb978aa63dbb2a08cd383c6cee2e` | **MATCH** |

Previous owner evidence additionally proved source-aligned 14 columns, 13 constraints, one index, zero profile rows, zero RLS policies, `relrowsecurity=true`, `relforcerowsecurity=true`, table owner `postgres`, direct SQL privileges denied for `anon/authenticated` and allowed for `service_role`, plus transactional schema replay with correctly preconfigured local defaults and rollback.

**Status:** `R5.2N APPLICATION SCHEMA RECOVERY — PASS`. The checks are *source database metadata* compared with the owner's restored schema, **not** a full hosted staging recovery certification. Still unresolved: `supabase_migrations.schema_migrations` absent from local recovery, original Auth/Storage managed migration-history version compatibility, full supported restoration of all app/managed data, encrypted remote backup copy, and explicit staging Schema Approval A. Actual source migration ledger is one record: `20261103140914 / create_isolated_profile_staging_p5` (read-only confirmed through Supabase connector). The original `data.sql` does not contain that table, so source-vs-local migration history parity is **NOT verified**. Do **not** fabricate it or mark full restore complete.

**Next:** keep source exports immutable and secure; prepare a checked, owner-approved migration-ledger recovery strategy on disposable infrastructure and a scope-accurate restore report. No hosted schema changes or live app flags before separate owner acceptance.

### Owner's Windows backup-at-rest protection check — BLOCKED (2026-11-09)

On the trusted Windows workstation, owner ran `manage-bde -status C:` (read-only). Observed **Fully Decrypted**, **0.0% encrypted**, **Encryption Method None**, **Protection Status Off**, and no key protectors. All original exported database files are currently located on this unencrypted disk and there are local Docker copies of SQL exports used for restoration. **Do not claim encrypted storage, backup durability, or Schema Approval A ready.**

**Action for owner (outside repo):** create a password-protected encrypted archive containing only the original `roles.sql`, `schema.sql`, and `data.sql` using 7-Zip in `7z` format, AES-256, **Encrypt file names**; use a long unique passphrase that stays off ChatGPT/GitHub and is backed up separately; use **Test archive** and verify all expected files can be opened/checked before removing plaintext. Store a second separate encrypted copy on another trusted storage medium. Consider Windows Device Encryption/BitLocker for full-volume protection if edition/hardware allow. Merely creating an encrypted archive on a formerly unencrypted drive does not guarantee old plaintext is irrecoverable; encrypted drive protects future exports more robustly. Clean previous Docker `/tmp` plaintext export copies only after confirmed encrypted backup, and avoid exposing local Supabase services on untrusted networks. Do not disclose generated local Supabase credentials in logs or chat.

**No archive encryption completed/verified yet.** The owner should provide a non-secret "archive created and tested" status without sharing file bytes, passphrases or recovery keys. Original staging and Production unchanged. Full managed Auth/Storage and application migration-history recovery remains independently blocked.

## Approval gates that remain distinct

- **Staging Schema Approval A:** actual staging backup restored successfully and reviewed exact SQL + signed owner scope.
- **Fixture Approval B:** synthetic shop/menu inserts separately authorized, once schema and empty API read work.
- **Identity Approval C:** staged Firebase identities separately authorized, with permission and revoked-token testing.
- **Production pickup launch:** explicit owner sign-off after Production backup/security/recovery, real-device acceptance and safety gate checks.
- **Rewards Bronze pilot:** actual R500 ring-fenced budget, 12-participant cap, merchant agreements, clear terms, proven immutable evidence/credits/payables, and separate owner activation approval.
- **Gold/Platinum/LocalPay:** separate funding, compliant terms, API/ledger and explicit release.

**Operational priority:** Do not bypass a real recoverable backup just to show a demo shop. A broken recovery path could destroy the progress needed to go live safely.
