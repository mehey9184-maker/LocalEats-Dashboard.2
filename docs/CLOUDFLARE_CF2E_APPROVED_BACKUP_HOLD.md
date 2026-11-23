# CF2-E — Founder approval accepted, execution held on current-backup verification

**Date:** 2026-11-22 · **Founder approval:** “i approve” in direct answer to CF2-E request to apply the reviewed catalogue permissions **only to LocalEats-Profile-Staging, provided the backup and security preflight are verified first**.

**Execution decision:** **HOLD — no hosted DDL applied**, because there is no independently accessible, **current** restorable backup of the staging project after its latest migrations. Do not reinterpret old restore/dump evidence as a verified present-state restore point. Approval remains limited to the exact forward SQL and excludes passwords/keys, Hyperdrive, any Cloudflare Worker, Production, Firebase, DNS and paid changes.

## 2026-11-23 local backup-verification update (reported by founder from Codex)

**Outcome: NOT READY / STOP maintained.** The user supplied a local Codex verification summary (not the full text file): extracted SQL files dated **9 November**, before the **20 November** staging migrations; **three password-protected archives** remain uninspected/unrestored; encrypted **V:** drive not mounted. Codex reports **no SQL applied and no hosted settings changed**. The underlying local report `CF2E-backup-check-2026-11-23.txt` lives on the founder's Windows machine and was **not accessible for direct inspection in this chat**. Do not represent its complete contents as independently audited evidence.

**Next condition:** Founder locally unlocks/mounts V: through the secure prompt (no password in chat). Then local Codex may use the approved [workstation backup runbook](CLOUDFLARE_CF2E_LOCAL_BACKUP_VERIFICATION_CODEX.md) to check archive manifests and verify a **current** staging project backup plus a disposable restore. If only Nov 9 backups exist, a fresh **staging-only** encrypted backup taken after the latest migrations and restore verification is needed. Only sanitized evidence comes back to ChatGPT; no data dump, authentication secrets or customer records. Conditional hosted staging SQL approval remains held.

## 2026-11-22 connected pre-execution checks

The only project inspected was **LocalEats-Profile-Staging** (PostgreSQL **17.11**, ACTIVE_HEALTHY, Europe West/Ireland), not the primary LocalEats project.

- Re-fetched the **exact** checked-in [SELECT-only CF2-E preflight](../supabase/drafts/cf2e_catalog_staging_preflight.READ_ONLY.sql), verified it contains no DDL or DML, and ran it as a SQL SELECT on the connected staging database. Result: **`CF2E_STAGING_READ_ONLY_PREFLIGHT_PASS`; 19 checks; no failures.**
- Verified the proposed `cf2_catalog_reader` role and `catalog_cf2` schema remain **absent**; there are **0 pre-existing shop/menu RLS policies**; both tables still have RLS enabled; anonymous and authenticated roles still cannot read their restricted data.
- Captured **non-sensitive metadata digests** of deployed source objects, for later drift detection (MD5 of SQL definitions, **not** content or customer/merchant rows):
  - `shop_schedule_open(text,text,timestamptz)`: `a6ba9b72599d4436a4851089cb4b62ca`
  - `shop_effective_open(public.shops,timestamptz)`: `49cde3f96449247dca6e365d3f560a3b`
  - `shops_with_availability` view: `745201825efdf688799a7c6aa0279ef1`
- Current connected Supabase migration inventory (metadata only): `20261103140914_create_isolated_profile_staging_p5`, `20261109165612_r52o_isolated_staging_catalogue_schema_approval_a`, `20261118120852_l3_n2_staging_customer_push_subscriptions_and_quota`, `20261120190238_l3_n8o_staging_pickup_orders_hard_off`, `20261120191636_l3_n8o_staging_push_outbox_fk_index`. **CF2-D/E is not in the applied migration list.**
- Current checkout: [Merchant/API draft PR #222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222). Before founder approval, all six CI workflows passed on head `df751e807a0220c25947dc23dfd0b6103e0fbf21`, including synthetic CF2-E pre/post/rollback. This does not prove live restore readiness.

## Why backup validation remains a blocker

- Historical founder-supplied context documents an encrypted local staging export on **10 November 2026**, with `roles.sql`, `schema.sql`, `data.sql`, and file/hash checks. It was **not available inside this ChatGPT container** for restoration or inspection.
- A subsequent **18 November** staging restore/health acceptance was reported in project history, but the restore's underlying backup file/manifest was not available in connected tool output this turn.
- **Two separate staging migrations were applied on 20 November** after those earlier exports/restore checks. No verified current post-20-November backup/restore point was located in connected GitHub or Google Drive metadata search, and the existing local encrypted drive is not mounted in this session.
- Supabase's official [backup policy](https://supabase.com/docs/guides/platform/backups) provides daily automated backups to **Pro/Team/Enterprise** and recommends the CLI export/offsite backup for Free projects. The actual staging billing tier and Dashboard > Database > Backups contents were **not** visible through installed Supabase actions. **Do not claim there are no backups; claim only that a usable current one was not verified.**
- The already-tested [reversible CF2-D permission rollback](../supabase/drafts/cf2d_catalog_projection_rollback.REVIEW_ONLY.sql) covers the proposed schema objects and RLS, but it is **not a replacement for a current project-level backup** if an unrelated failure or environment issue occurs.
- This block cannot be resolved by another synthetic test, an unverified old dump, upgrading paid billing, or silently switching to the primary/Production database.

## Required safe next step to release the existing approval

Locate a **current, restorable staging backup** created after `20261120191636` (or generate and restore-test a new encrypted staging-only logical backup using the trusted local PostgreSQL/Supabase CLI), with verifiable filename, creation date, database target, safe storage, SHA-256 verification and a disposable restore result. **Never paste passwords, full SQL data dumps, private records or database URL secrets into chat or GitHub.** On a Free plan, a new private offline export and test may be necessary; this requires access to the founder's secured workstation/backup environment, which this ChatGPT session does not have. A backup of the primary LocalEats database is **not** evidence for this staging project.

After valid backup proof is accessible:
1. Reconfirm Supabase project identity `LocalEats-Profile-Staging` and its latest migration inventory.
2. Re-fetch and checksum the reviewed forward SQL and [rollback](../supabase/drafts/cf2d_catalog_projection_rollback.REVIEW_ONLY.sql), compare object-definition hashes and existing role/schema/RLS state, rerun [CF2-E preflight](../supabase/drafts/cf2e_catalog_staging_preflight.READ_ONLY.sql).
3. If all pass, perform exactly **one** atomic approved staging DDL using the supported migration action and record the migration version.
4. Verify the exact [read-only postflight](../supabase/drafts/cf2e_catalog_staging_postflight.READ_ONLY.sql) and negative `SET ROLE` SELECT/INSERT/UPDATE/DELETE tests. Stop and investigate any non-pass before considering rollback, without touching non-CF2 objects.
5. Report the result to founder and GitHub issue #223. Do **not** create login credentials, Hyperdrive, Worker, production DNS, main merge, real orders or spending.

**No hosted mutation, schema/policy/grant creation, key retrieval, deployment or paid commitment was performed in this approval follow-up.**

[Founder charter](LOCALEATS_FOUNDER_CHARTER.md) · [CF2-E release plan](CLOUDFLARE_CF2E_STAGING_PERMISSION_RELEASE_GATE.md) · [Canonical project handoff](LOCALEATS_PROJECT_MEMORY.md).
