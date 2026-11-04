# LocalEats — Phase 1 backup and restore readiness (review-only)

Updated 2026-11-05. Owner approval is required for any live database restoration, production migration, access change, paid plan change, or order activation.

## 1. Findings verified using read-only production queries

The connected **LocalEats** Supabase project was ACTIVE_HEALTHY. Snapshot: database total **21 MB**, 21 public tables, 9 shops, 1 existing order row, 5 pickup order-event rows, 0 pending pickup push-outbox rows. Supabase Storage metadata currently shows **0 buckets and 0 objects** (do not generalize this to Firebase or external image providers). Order idempotency key is uniquely indexed. A separate LocalEats-Profile-Staging project exists; this drill does **not** touch it.

**This is not a successful real backup.** There is no Supabase backup/export tool available through the connected project actions in this chat, and no production database credentials were read, copied or requested. The connected tool permits safe SQL reads, not downloading a restorable backup. No live customer data was exported.

## 2. Supabase Free backup limitation

Supabase Free does **not** provide automatic daily database backups. The provider recommends regular encrypted, off-site exports with the CLI. The managed Pro/Team/Enterprise daily backups and optional paid point-in-time recovery have different costs and guarantees. A manual once-per-day backup can still lose up to a day's new orders if the database fails just before the next backup.

Official:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/kb/faqs/platform/free-plan-backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/reference/cli/supabase-db-dump

**A SQL-only backup is not automatically a complete LocalEats restore.** Depending on CLI arguments, the Supabase CLI excludes Supabase-managed schemas such as auth/storage and extension objects. Supabase Storage object **bytes** are not part of the database dump. Firebase Auth/FCM, R2/Cloudinary images, secrets, GitHub/Vercel configuration, custom domains, and signed external service credentials must be separately documented and rebuilt. Never claim the platform can be fully restored based solely on a public-schema dump.

## 3. Readiness rehearsal that is already automated

GitHub workflow `.github/workflows/merchant-backup-restore-rehearsal.yml`:

1. Starts a **disposable** PostgreSQL 17 container, with synthetic roles and no production secrets.
2. Creates 20 fictional shops, 150 fictional orders distributed over 15 minutes (10/minute), 150 immutable order events and 150 synthetic notification-outbox jobs.
3. Creates a unique order idempotency index, foreign keys, a trigger, and a restrictive RLS policy.
4. Takes a compressed `pg_dump` of the synthetic `public` schema into a runner-local, permission-restricted temporary directory.
5. Simulates loss of all synthetic order/event/outbox rows in **only** the disposable source.
6. Restores into a **new** disposable database using one transaction and strict error handling.
7. Checks row counts, record fingerprint, foreign-key dependent records, idempotency uniqueness, replay-safe immutable key trigger, RLS policy and grants.
8. Rejects a deliberately corrupt dump.
9. Removes the temporary archive and never uploads it as a GitHub Actions artifact.

This is meaningful verification of the recovery script's behavior. It **does not** prove a complete Supabase managed-platform restore, a real backup of LocalEats, or a real-world recovery time.

## 4. First actual backup on a trusted Windows computer (requires owner action)

**Do not put backup files inside GitHub, Vercel, public links or this chat.** Use a private folder outside every Git checkout, and never paste a database password or connection string into a chat or a committed file. Use the official Supabase CLI and Docker Desktop as required by its documented `db dump` command. Follow version-specific CLI `--help` output; commands can change.

Open a PowerShell terminal on your own PC:

```powershell
supabase --version
supabase db dump --help

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$privateBackup = Join-Path $env:USERPROFILE "LocalEats-Private-Backups\$stamp"
New-Item -ItemType Directory -Path $privateBackup -Force | Out-Null
```

From a local Supabase workspace (not this repository's Production settings), explicitly link the **LocalEats Production** project, ensuring the project reference matches the owner-approved target. The CLI may request your project database password in the local terminal.

```powershell
supabase link --project-ref phdjumtqkooyppxozqsi

supabase db dump -f "$privateBackup\roles.sql" --role-only
supabase db dump -f "$privateBackup\schema.sql"
supabase db dump -f "$privateBackup\data.sql" --use-copy --data-only
```

These are provider-recommended logical exports for a **migration/recovery starting point**, not a guarantee of complete/auth/storage restore. Validate expected schema and order/event table coverage and exact CLI exclusions after export. If the database is inaccessible or the CLI reports a failure, **do not mark the backup successful**.

Inspect only metadata locally, never print personal order contents:

```powershell
Get-ChildItem $privateBackup | Select-Object Name,Length
Get-ChildItem $privateBackup -File | ForEach-Object {
  Get-FileHash $_.FullName -Algorithm SHA256 | Select-Object Path,Hash
}
```

The exports may contain contact details, profile information, credentials or security definitions. Encrypt the complete folder locally with a strong, documented, recoverable key and store the encrypted copy off-site; maintain an independent second copy. **Do not upload raw SQL** to cloud storage. Verify the decryption key on a second trusted device, and do not store the only recovery key inside the encrypted archive.

## 5. Acceptance criteria for a first real recovery test

Restore a backup into a **separate disposable, version-compatible** PostgreSQL/Supabase environment, never over Production or the user's existing staging project. Use the provider's documented procedure for restoring roles, schema, then data; make sure extensions (PostGIS etc.), authentication schemas, functions/triggers and RLS are handled appropriately.

Verify:
- Successful restore log, no silently skipped errors, and recorded elapsed time.
- Exact counts and idempotency uniqueness for orders, pickup events, order items and push outbox, with foreign keys intact.
- Merchant ownership rules and `anon`/authenticated/server-role access are **safe** in the restored system. A *backup* can faithfully restore a vulnerable policy; restoration **does not** imply security hardening.
- Auth accounts and sessions (where supported), Storage object bytes, external image assets, and messaging credentials are independently accounted for. Recreate secrets in a secure secrets manager; don't embed them in a backup Git commit.
- A simulated order-read/merchant-inbox journey succeeds against the isolated restored environment with **no real customer notifications, charges or order delivery**.
- A separate human reviewer confirms the backup timestamp, encryption, restore completeness and recovery duration.

Only after this is complete should the owner separately approve a controlled Production security cutover for [Security PR #57](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/57). PR #57 remains a review-only privilege draft and is not in an auto-applied migrations folder.

## 6. Retention and low-cost operating decision

For an inactive pilot, take one backup **before any approved change** and store encrypted exports off-site. For real trading, set an explicit **RPO** (maximum orders we are prepared to lose) and **RTO** (maximum time the service may be unavailable). Daily manual exports cannot satisfy a 5–15 minute RPO. Do not launch paid customer/order operations on the assumption that Free hosting offers continuous backups or guaranteed high availability. Evaluate the cost of automated, tested exports vs a paid managed plan before accepting real orders.

Record only metadata in your backup register (never customer data): backup timestamp UTC, project reference, duration, archive size, encrypted-copy location reference, SHA-256, restore test date, restore test result, RPO/RTO target and responsible person. Suggested retention for an early private pilot: seven encrypted daily copies and four weekly copies, adjusted for data protection and cost.

## 7. Status and stop conditions

- **Automated synthetic restoration:** CI checked separately from live service.
- **Live Supabase export:** NOT PERFORMED.
- **Real-data restore and verified recovery:** NOT PERFORMED.
- **Security lockdown PR #57:** DRAFT, NOT APPLIED.
- **Order-inbox recovery PR #56:** DRAFT, NOT MERGED.
- **Production orders/payments/riders:** No activation or changes authorized here.

Do not merge a database migration, run SQL in Production, copy live user records into CI, or trigger a paid service because this document exists.
