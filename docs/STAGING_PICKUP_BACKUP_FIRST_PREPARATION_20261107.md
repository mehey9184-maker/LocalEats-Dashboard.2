# LocalEats — full pickup staging expansion: backup-first runbook
Date: 2026-11-07. Owner has approved **staging-only preparation**, conditioned on a **verified backup and reviewed SQL before modifying the connected project**. Production changes, merges, public order activation, payments, Rider and Delivery are not approved.

## Project identities (never interchange)
- Existing Supabase profile staging: `rgpbdajhlrwfmhopzgzk`, **LocalEats-Profile-Staging**, PostgreSQL 17.11, eu-west-1.
- Production Supabase: `phdjumtqkooyppxozqsi`. Never pass this project to any backup, test-write or schema-change workflow intended for staging.
- Dedicated Firebase staging: `localeats-pickup-stage-261105`; Production Firebase: `localeats-5e26e`.
- Supabase organisation is on the **Free** plan. There are no guaranteed daily automatic backups on Free.

## Read-only preflight performed today

Ran `security/preflight/pickup_stage_prebootstrap_READ_ONLY.sql` against the connected staging project. Result:
`BASELINE_PRECHECK_PASS_BACKUP_AND_RESTORE_STILL_REQUIRED`

This result is based on **zero** `public.profiles` rows, zero `auth.users`, zero `storage.objects`, **one** existing `20261103140914_create_isolated_profile_staging_p5` migration, `public.profiles` with RLS enabled and no RLS policies, no direct anon SELECT or authenticated UPDATE, and no `shops`, `orders`, or `admin_users` tables. Supabase security advisor reported one INFO item: `public.profiles` has RLS but no policies; this is expected for the existing **server-only** profile model. Do **not** add permissive policies to silence it.

The corrected pickup-only parity audit in draft PR #87 now requires **23** shop/approval/ordering objects and columns (not dormant Rider or Supabase-signup objects): **3 are present and 20 are missing** on the latest read-only staging inspection. This means the current staging project is fit for profile tests, **not yet** complete Super Admin→Merchant→Customer pickup integration.

## Fastest safe route now that you have Docker and Supabase CLI

From a checked-out copy of **draft PR #88 branch** on your Windows computer, run one PowerShell command:

    powershell -ExecutionPolicy Bypass -File .\localeats-api\scripts\staging\run-private-backup-and-restore.ps1

**Updated one-prompt flow (after the owner's placeholder-format error):** The script now constructs the previously verified staging Session Pooler connection internally using the fixed staging project username (`postgres.rgpbdajhlrwfmhopzgzk`), known reachable pooler host (`aws-0-eu-west-1.pooler.supabase.com`), port 5432, database `postgres`, and SSL mode `require`. It asks for **only your staging DATABASE password in one hidden prompt**. Do **not** paste the full URL, connection template, `[YOUR-PASSWORD]` placeholder, Supabase dashboard login password or API key. The script percent-encodes special password characters automatically. You can verify the fixed non-secret host/port against [Supabase staging → Connect](https://supabase.com/dashboard/project/rgpbdajhlrwfmhopzgzk) before running. It exports five SQL dumps into a new private Documents folder, checks SHA-256 hashes, starts a **local no-network Docker PostgreSQL 17**, runs the full SQL restore, checks P5 profile structure/RLS and migration history, then destroys the container.

If successful, the script prints exactly:

    STAGING_BACKUP_AND_LOCAL_P5_RESTORE_VERIFIED

**Only this marker from your actual Windows run** confirms a real backup was locally restore-tested. GitHub's fictional-data CI does **not**. Encrypt the backup folder, keep an offsite copy and verify you can retrieve it before staging SQL is allowed. Do not paste database URLs, passwords, SQL backup data, manifests or screenshots of them into chat.

If the restore fails, do **not** disable its safety checks or run connected staging SQL. Describe the error without sharing secrets; the verifier can be reviewed and corrected then retried with a new private backup folder.

## Windows/Docker DNS issue — choose IPv4 Session pooler

The owner's Windows backup attempt reached `pg_dumpall` but the Docker container could not resolve `db.rgpbdajhlrwfmhopzgzk.supabase.co`. This is consistent with the **direct database endpoint being IPv6-only on Supabase Free**, while the local Docker/Windows route has no usable IPv6 DNS/address path. Supabase documents that **Session pooler is available over IPv4** on Free.

**No URL copy is required in the updated one-prompt wrapper.** It pins the staging session-pooler host and username already observed in the owner's successful DNS connection; verify them against **Supabase staging → Connect → Session pooler** before running. The only requested input is the staging database password, hidden. It should have **port 5432**, a hostname ending `.pooler.supabase.com`, and a username of `postgres.rgpbdajhlrwfmhopzgzk`. **Do not construct a pooler hostname from the region or paste the URI into GitHub or ChatGPT.** Use the copy action; host names vary by cluster. The wrapper percent-encodes reserved characters (`#`, `@`, `?`, `%`, spaces and others) in the database password, so you should enter the **ordinary literal database password** at the hidden prompt, without manually encoding it.

The underlying export helper verifies the staging-only host/account/database and refuses **Transaction pooler port 6543**. On a direct connection without IPv4 DNS, it now fails **before creating a backup folder** with `STAGING_DIRECT_IPV6_DNS_UNAVAILABLE`, explaining how to switch to Session pooler. This does not imply the Supabase database or password is incorrect, and does not require an IPv4 add-on or paid plan.

Reference: https://supabase.com/docs/guides/database/connecting-to-postgres and https://supabase.com/docs/reference/cli/supabase-db-dump .

### Pooler authentication failure — diagnose before retrying

A later owner's attempted backup reached the **Session pooler on port 5432**, but PostgreSQL rejected the password for role `postgres`. This means network/DNS is now working; it **does not imply that the Supabase username in the pooler URL was simply `postgres`**. The exporter had already confirmed the correct `postgres.rgpbdajhlrwfmhopzgzk` username. PostgreSQL may display the underlying role `postgres` in the server-side failure.

1. Supabase staging → **Connect → Session pooler**: verify the host shown there is `aws-0-eu-west-1.pooler.supabase.com`, the project-specific username is `postgres.rgpbdajhlrwfmhopzgzk`, and port is `5432`. The updated wrapper constructs this URL itself; **no template or URL paste**.
2. At the **one hidden password prompt**, enter the **database password** for **LocalEats-Profile-Staging** (not your Supabase login, service_role key, project API key, placeholder or connection URL).
3. If the database password was forgotten, changing it is a **staging credential rotation**, and may require updating any staging clients that use it. Review the staging project's **Database Settings → Reset database password** before deciding to rotate; do not repeatedly reset Production or paste credentials into chat.
4. If the same error persists with a known-good database password, stop repeated attempts. Supabase has documented shared-pooler password problems after rotation; contact Supabase Support with the staging project ref and redacted authentication error, without including the password.

Related official troubleshooting: https://supabase.com/kb/troubleshooting/fatal-password-authentication-failed .

## Backup first — run on a trusted computer, NOT CI

The connected Supabase integration available here has **no database dump / restore-backup action**. SQL catalogs and checksums are not a restorable backup, and the zero row count is **not** permission to overwrite the existing profile schema.

On your own Windows PC, install **Supabase CLI**, **Docker Desktop**, and Node.js 22+. Review the [official Supabase backup docs](https://supabase.com/docs/guides/platform/backups) and the [CLI db dump guide](https://supabase.com/docs/reference/cli/supabase-db-dump) for current commands. In **Supabase Dashboard → staging project → Connect**, get the staging-only database connection URL (the session pooler is often easier on IPv4). Set it in a **private, temporary** environment variable `LOCALEATS_STAGE_DB_URL`. The connection string contains a password: **never put it into chat, GitHub commits, screenshots, logs or issue comments**.

From a private PowerShell session, in a checked-out copy of the Merchant/API repository:

```powershell
# Obtain LOCALEATS_STAGE_DB_URL privately, NOT by writing the password into git.
# Example: set the variable using your trusted password-manager workflow.
powershell -ExecutionPolicy Bypass -File ./localeats-api/scripts/staging/export-private-staging-backup.ps1 -OutputDir "$HOME/Documents/LocalEats-Staging-Private-Backup"
```

The script rejects mismatched database identifiers and refuses to save inside a Git checkout or overwrite an existing directory. It creates **five** files in a new private folder:
- `roles.sql`
- `schema.sql`
- `data.sql`
- `history_schema.sql`
- `history_data.sql`

It then runs `verify-stage-dumps.mjs`, which verifies file presence and SHA-256 integrity and writes `integrity-manifest.json` **into the same private folder**. It intentionally reports **`RESTORE_NOT_VERIFIED`**. No secrets, data rows or SQL contents are printed by the verifier.

### Run the genuine offline restore (new)

After the export has finished, **do not stop at the SHA-256 manifest**. From the same checked-out PR #88 branch, with Docker Desktop running:

```powershell
.\localeats-api\scripts\staging\verify-stage-local-restore.ps1 -BackupDir "$HOME\Documents\LocalEats-Staging-Private-Backup"
```

The new script validates the five dump hashes against the private manifest, starts a **disposable Docker PostgreSQL 17 container with `--network none` and no published ports**, and executes roles/schema/data/migration-history SQL inside that container. It verifies the exact expected P5 table shape (14 columns, 13 constraints), forced RLS and server-only grants, zero profiles, and the pre-existing migration. It deletes the test container on both success and failure.

Only if **all actual restore statements and the P5 checks succeed** will it print `LOCAL_RESTORE_P5_VERIFIED` and write a sanitized `restore-evidence.json` into the same private folder. **If it errors or does not print that exact marker, the backup gate is NOT passed.** This local restore check does not validate managed Supabase Auth or Firebase data, and does not authorize connected staging SQL by itself.

Do not upload any dump/manifest/connection string. You may report only the marker and whether the container test succeeded; keep the evidence file private. The GitHub synthetic CI tests the script with fictional data but **cannot verify your actual backup**.


**Important:** Supabase CLI's standard dump excludes managed `auth` and `storage` schema contents, including service configuration. Today these schemas have no user or stored-object rows, but their service settings, Firebase credentials, public grants, custom triggers and roles still need separate documentation if changed. The five SQL files are not a complete backup of Firebase, Vercel or external image assets.

Before starting any cloud migration, encrypt the five SQL files and manifest at rest, store an **off-site** copy accessible only to the owner, then perform a **real restore in a fresh disposable PostgreSQL 17 or local Supabase environment**, never against Production or the existing staging project. Record whether the restore completed without errors; verify the restored `public.profiles` table, constraints, RLS/grants and the existing migration history. A file hash alone **does not prove the backup can be restored**. A failed restore blocks staging DDL.

Use a fresh, trusted, separately verified database to restore; do not use `supabase db reset --linked` or `--db-url` pointed at either live project. These can delete existing remote data. Do not include dumps or passwords in CI artifacts.

## Planned schema rollout AFTER verified restore

1. Independently verify dump source and the staging prebootstrap SQL still passes immediately before changes. Stop if any profile/auth record appeared, the staging migrations changed, or permissions drifted.
2. Review the **canonical Production schema and migration chain as source code**, not Production data. Rebuild or export **schema-only** and reconcile with the already existing P5 `profiles` table; never drop/recreate or change existing P5 profile semantics.
3. Resolve differences in protected roles, Firebase account identity mapping and RLS. **Do not replay the vulnerable Production `handle_new_user()`** or public rider notification GRANT/RLS. The current staging Firebase-to-API profile flow **does not require any Supabase signup trigger or Rider notification table/function**; leave those objects absent. The reviewed customer-only signup and Rider lockdown concern the separate legacy Production security cutover. Keep Rider verification disabled.
4. Rehearse the complete reviewed migration chain in a separate disposable PostgreSQL 17 instance. Require the integrated SQL tests for shop approvals, merchant availability, pickup creation, idempotency, 4km any-town matching, events and outbox. No real data copied.
5. Prepare a **stage-targeted, reviewed and fail-closed** migration after step 4. Apply only to `rgpbdajhlrwfmhopzgzk` with explicit environment and schema hash checks, and verify the resulting tables, RPC signatures, privileges, no unexpected tables/rows and the profile P5 regression suite.
6. Add synthetic Firebase staging identities and synthetic shops/menu/orders only after verifying their keys, role boundaries and row-level isolation; do not point staging APIs at Production Supabase or Firebase.
7. Run a real hosted three-app workflow: Super Admin verifies a shop, Merchant opens it, Customer browses closed menus then quotes/creates within 4km from any town, merchant Accept→Preparing→Ready→Collected, cross-account privacy, no duplicate orders, FCM failure/return and rollback tests.
8. Only after staging green, discuss a **separate** Production security/SQL release with backup, rollout plan and explicit owner approval. Do not enable public orders or merge code as a by-product of staging preparation.

## Scope of this PR

This PR adds **only** a read-only current-stage gate, a private Windows backup helper, an offline artifact-integrity checker, tests and a runbook. It **does not create or apply a new staging schema**, perform a restore, send notifications or mutate any Supabase/Vercel/Firebase resource. Actual stage migration awaits the verified restorable backup and review of the canonical migration chain.

Related: Merchant staging parity [draft PR #87](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/87), signup/Rider security [draft PR #79](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/79), cross-town SQL [draft PR #86](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/86), main launch [issue #73](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/73).

**All testing remains synthetic and pickup-only.**
