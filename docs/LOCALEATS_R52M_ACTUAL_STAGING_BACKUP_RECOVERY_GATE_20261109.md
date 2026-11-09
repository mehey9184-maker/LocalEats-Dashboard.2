# R5.2M — Actual staging backup and recovery verification gate

**Date:** 2026-11-09  
**Status: BLOCKED — no verified full backup of the actual Supabase project exists through available connections.**  
**Scope:** `LocalEats-Profile-Staging` — `rgpbdajhlrwfmhopzgzk` ONLY. Do not use the other LocalEats Supabase project `phdjumtqkooyppxozqsi` (Production). Do not run any R5.2K migration or fixture SQL here.

## What was actually completed

1. Confirmed via connected Supabase that the staging project is `ACTIVE_HEALTHY`, PostgreSQL `17.11`, in organization `fayoalqacqpijwvqvezp` on the **Free** plan.
2. Captured a **metadata-only** read-only baseline of the actual project, containing **no user rows, credentials or backup contents**:
   - `public.profiles`: 0 rows, 14 columns, 13 constraints, 1 primary key index, RLS enabled, zero policies, original P5 staging sentinel comment intact.
   - No SELECT on `public.profiles` for `anon` or `authenticated`; SELECT granted to `service_role`.
   - `auth.users`: 0 rows; `storage.objects`: 0 rows (aggregate counts only).
   - `supabase_migrations.schema_migrations`: exactly one migration `20261103140914:create_isolated_profile_staging_p5`.
   - `public.shops`, `public.menu_items`, `public.shops_with_availability`: absent.
3. Committed `tests/staging/r52m_actual_backup_restore_baseline_READ_ONLY.sql` and executed it against the **real staging** database using only SELECT queries. Returned `R52M_BASELINE_METADATA_PASS`.
4. Discovered the available Supabase connection supports schema inspection and SELECT queries but **no inventory, full logical dump, backup download, or backup restoration to a new target**. No actual remote backup has been taken, inspected or restored by this phase.
5. Previous R5.2L **disposable** PostgreSQL 17.11 dump/restore passed. This is useful procedure testing, **NOT a backup of the connected staging project**.

## Why Approval A must remain blocked

Supabase documentation says daily automatic backups are included for eligible Pro/Team/Enterprise plans; Free projects are encouraged to use the Supabase CLI `db dump` and keep an off-site backup. We found the organization is on **Free**, and did not confirm any platform-scheduled backup:

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/self-hosting/restore-from-platform

An unverified export, metadata manifest, copy of a migration, checksum, or local synthetic restore does **not** meet the actual-staging backup requirement.

## Owner-controlled export procedure — no upload of secrets, no database writes

Do these steps on **your own trusted Windows computer** with Docker Desktop and Supabase CLI installed. Work in a dedicated **encrypted, non-Git, access-restricted folder**. Don't run in a shared terminal and do not commit the exported files, screenshots of credentials, or connection strings.

1. Open the **correct** [staging Supabase dashboard](https://supabase.com/dashboard/project/rgpbdajhlrwfmhopzgzk). Verify project name **LocalEats-Profile-Staging** and exact project ref `rgpbdajhlrwfmhopzgzk`. Do **not** open or select the Production project. Check **Database → Backups** to see whether any recoverable snapshot exists, but do not presume availability on Free.
2. In an empty, private local directory, check `supabase --version`, `supabase db dump --help`, and Docker Desktop is running. Sign in with `supabase login` through the CLI's supported secure flow.
3. Use `supabase init` to create the local project config, then link **only the isolated staging ref** using:
   `supabase link --project-ref rgpbdajhlrwfmhopzgzk`
   If prompted, supply the staging *database password privately at your own computer*; do not use `--password` or paste the password/URL into the chat, GitHub, CI or a URL.
4. After independently checking that the CLI reports the exact linked project, run the **read-only** exports in the protected backup directory (not under a Git checkout):
   ```powershell
   supabase db dump --linked -f roles.sql --role-only
   supabase db dump --linked -f schema.sql
   supabase db dump --linked -f data.sql --use-copy --data-only
   ```
   These commands may require Docker. The default dump deliberately excludes certain Supabase-managed `auth` and `storage` schemas: explicitly verify coverage of the full recovery requirement and separately inventory managed state. Do not claim a complete project restore if Auth/Storage, secrets, configuration, extensions or migration history are missing.
5. Check the files are **nonempty** and record hashes privately:
   ```powershell
   Get-Item .\roles.sql, .\schema.sql, .\data.sql | Select-Object Name,Length
   Get-FileHash .\roles.sql -Algorithm SHA256
   Get-FileHash .\schema.sql -Algorithm SHA256
   Get-FileHash .\data.sql -Algorithm SHA256
   ```
   Secure them in encrypted storage with an off-site copy. Backup files may include private user data even when currently empty; no public GitHub/ChatGPT/Cloudinary uploads.
6. **Independent restore test required:** Prepare a sacrificial Supabase-compatible PostgreSQL 17 environment, never the remote staging or Production project. Using the [official Supabase restore guide](https://supabase.com/docs/guides/self-hosting/restore-from-platform), restore the exported roles/schema/data in the documented order, while preserving grants, RLS, extensions, and managed schema dependencies. Be especially careful: running generic `pg_restore` or raw `psql` on a fresh ordinary PostgreSQL server is not proof the Supabase project has been fully recovered. Do not run `supabase db reset --linked`.
7. Run `tests/staging/r52m_actual_backup_restore_baseline_READ_ONLY.sql` against **the restored sacrificial database only**. `R52M_BASELINE_METADATA_PASS` is required, along with a verified functional recovery of any relevant managed Auth/Storage configuration, roles, extensions, and migrations. If the SQL fails because a managed schema or migration history was omitted, the backup set is **incomplete**; STOP rather than rewriting the verifier to hide it.
8. Keep an audit record **without credentials or exported data**: correct staging project ref, export UTC date, file sizes and SHA-256 hashes, encrypted backup storage location/retention, restoration target identifier, verification PASS/FAIL, and who can authorize recovery.

## Pre-Approval A exit criteria

**All mandatory:**

- [ ] Verified, recent **actual staging** backup exists and is accessible to the owner (not a synthetic lab dump).
- [ ] Restore tested independently in a different sacrificial database; no remote staging overwrite.
- [ ] Restored roles, profile RLS, columns/constraints, empty rows, migration record, and relevant Supabase-managed Auth/Storage state have been verified.
- [ ] Backup encrypted, access controlled, off-site, checksummed, and recovery owner identified.
- [x] Verified read-only real staging metadata baseline in this phase.
- [x] R5.2L schema/fixture/rollback rehearsal already passed on disposable PostgreSQL 17.11.
- [ ] Owner separately authorizes **Schema Approval A** with exact migration SHA, recovery evidence and staging project ref.

**Never conflate** a checked source manifest with a recoverable database backup. Never approve or apply a schema migration automatically from this document.

## Decision and next step

**R5.2M metadata baseline is complete, but the actual staging backup/restore gate remains blocked.** Next step is the owner-private export and recovery test. Once its non-secret PASS evidence is available, confirm Approval A again; do not insert synthetic fixtures or activate ordering, profile writes, payments, LocalPay, rewards, or Production.
