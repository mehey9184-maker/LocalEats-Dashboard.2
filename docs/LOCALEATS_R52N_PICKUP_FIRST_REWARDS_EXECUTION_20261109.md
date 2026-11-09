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

## Approval gates that remain distinct

- **Staging Schema Approval A:** actual staging backup restored successfully and reviewed exact SQL + signed owner scope.
- **Fixture Approval B:** synthetic shop/menu inserts separately authorized, once schema and empty API read work.
- **Identity Approval C:** staged Firebase identities separately authorized, with permission and revoked-token testing.
- **Production pickup launch:** explicit owner sign-off after Production backup/security/recovery, real-device acceptance and safety gate checks.
- **Rewards Bronze pilot:** actual R500 ring-fenced budget, 12-participant cap, merchant agreements, clear terms, proven immutable evidence/credits/payables, and separate owner activation approval.
- **Gold/Platinum/LocalPay:** separate funding, compliant terms, API/ledger and explicit release.

**Operational priority:** Do not bypass a real recoverable backup just to show a demo shop. A broken recovery path could destroy the progress needed to go live safely.
