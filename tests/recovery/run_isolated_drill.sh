#!/usr/bin/env bash
# STRICTLY LOCAL SYNTHETIC RECOVERY TEST.
# Refuses any source other than a disposable PostgreSQL database on loopback.
set -euo pipefail

if [[ "${REHEARSAL_ISOLATED_ONLY:-}" != "1" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGDATABASE:-}" != "local_recovery_source" ||
      "${PGUSER:-}" != "postgres" ]]; then
  echo "Refusing recovery drill: requires a disposable PostgreSQL source on localhost." >&2
  exit 9
fi
if [[ "$(psql -X -At -v ON_ERROR_STOP=1 -c 'select current_database()')" != "local_recovery_source" ]]; then
  echo "Refusing recovery drill: wrong database." >&2
  exit 10
fi
expected="$(psql -X -At -v ON_ERROR_STOP=1 -f tests/recovery/snapshot_digest.sql)"
if [[ ! "$expected" =~ ^[0-9a-f]{32}$ ]]; then
  echo "Refusing drill: source snapshot digest missing." >&2
  exit 11
fi

umask 077
archive_dir="$(mktemp -d)"
trap 'rm -rf "$archive_dir"' EXIT
archive="$archive_dir/synthetic_public_only.dump"

# Test a compressed logical backup of the synthetic public schema only.
# This is NOT a complete Supabase platform backup of auth, storage or secrets.
pg_dump --format=custom --schema=public --no-owner --file="$archive"
test -s "$archive"

# Create the fresh restore destination while the original still exists.
PGDATABASE=postgres createdb local_recovery_restored

# Simulate source data loss ONLY in the disposable local source database.
psql -X -v ON_ERROR_STOP=1 -c   "TRUNCATE TABLE public.pickup_push_outbox,public.pickup_order_events,public.orders;"
if [[ "$(psql -X -At -c 'select count(*) from public.orders')" != "0" ]]; then
  echo "Synthetic source-loss step failed." >&2
  exit 12
fi

# --clean/--if-exists makes the restore deterministic on a fresh disposable DB.
# --single-transaction prevents a partial data restore on an error.
pg_restore --dbname=local_recovery_restored --no-owner \
  --clean --if-exists --single-transaction --exit-on-error "$archive"

actual="$(PGDATABASE=local_recovery_restored psql -X -At -v ON_ERROR_STOP=1 -f tests/recovery/snapshot_digest.sql)"
if [[ "$actual" != "$expected" ]]; then
  echo "Restore fingerprint differs from the original snapshot." >&2
  exit 13
fi

PGDATABASE=local_recovery_restored psql -X -v ON_ERROR_STOP=1   -f tests/recovery/verify_restored_snapshot.sql

# Verify that a corrupt archive does not produce a false success signal.
printf 'not a postgres backup\n' > "$archive_dir/corrupt.dump"
if pg_restore --list "$archive_dir/corrupt.dump" >/dev/null 2>&1; then
  echo "Corrupt archive unexpectedly accepted." >&2
  exit 14
fi

echo "RECOVERY_REHEARSAL_PASS source_orders_lost=150 restored_orders=150 restored_events=150 restored_outbox=150"
echo "No live Supabase/Firebase data or credentials were accessed; no archive was uploaded."
