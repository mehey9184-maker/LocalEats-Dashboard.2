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

## Approval gates that remain distinct

- **Staging Schema Approval A:** actual staging backup restored successfully and reviewed exact SQL + signed owner scope.
- **Fixture Approval B:** synthetic shop/menu inserts separately authorized, once schema and empty API read work.
- **Identity Approval C:** staged Firebase identities separately authorized, with permission and revoked-token testing.
- **Production pickup launch:** explicit owner sign-off after Production backup/security/recovery, real-device acceptance and safety gate checks.
- **Rewards Bronze pilot:** actual R500 ring-fenced budget, 12-participant cap, merchant agreements, clear terms, proven immutable evidence/credits/payables, and separate owner activation approval.
- **Gold/Platinum/LocalPay:** separate funding, compliant terms, API/ledger and explicit release.

**Operational priority:** Do not bypass a real recoverable backup just to show a demo shop. A broken recovery path could destroy the progress needed to go live safely.
