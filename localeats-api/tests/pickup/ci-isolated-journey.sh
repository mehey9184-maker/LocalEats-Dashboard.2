#!/usr/bin/env bash
# PostgreSQL / API / two actual client adapter tests.
# This script is deliberately UNSAFE to run against any live or existing DB:
# it refuses all but a dedicated CI-only loopback database and synthetic roles.
set -euo pipefail

if [[ "${PICKUP_TEST_ISOLATED:-}" != "1" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGDATABASE:-}" != "local_pickup_qa" ||
      "${PGUSER:-}" != "postgres" ||
      "${PGPORT:-}" != "5432" ||
      "${PGSSLMODE:-}" != "disable" ]]; then
  echo "REFUSED: requires disposable local_pickup_qa on 127.0.0.1:5432" >&2
  exit 18
fi
if [[ -n "${SUPABASE_URL:-}" || -n "${DATABASE_URL:-}" || -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "REFUSED: real project/database environment variables are forbidden" >&2
  exit 19
fi

psql_bin="$(command -v psql)"
test -x "$psql_bin"
actual_db="$(psql -X -v ON_ERROR_STOP=1 -At -c 'select current_database()')"
if [[ "$actual_db" != "local_pickup_qa" ]]; then
  echo "REFUSED: connection is not the isolated test database" >&2
  exit 20
fi
if [[ "$(psql -X -v ON_ERROR_STOP=1 -At -c "select count(*) from pg_tables where schemaname='public' and tablename='orders'")" != "0" ]]; then
  echo "REFUSED: test database contains an existing orders table" >&2
  exit 21
fi

for file in \
  localeats-api/tests/pickup/schema.sql \
  supabase/drafts/pickup_launch_foundation.sql \
  supabase/drafts/pickup_zero_fee.sql \
  supabase/drafts/merchant_availability.sql \
  localeats-api/tests/pickup/availability.sql \
  localeats-api/tests/pickup/verify.sql; do
  echo "ISOLATED_PICKUP_SQL_FIXTURE: $file"
  psql -X -v ON_ERROR_STOP=1 -f "$file" >/dev/null
done

# Test adapters are checked out as pinned public source at the exact owner
# preview commit, not copied into a production build.
test -f customer-original-ui/src/pickup/client.ts
connection="host=127.0.0.1 hostaddr=127.0.0.1 port=5432 user=postgres dbname=local_pickup_qa sslmode=disable connect_timeout=5"
node --experimental-strip-types localeats-api/tests/pickup/journey.mjs "$connection" "$psql_bin"

# Assert no new pickup record has even one delivery/rider field.
psql -X -v ON_ERROR_STOP=1 -At -c "
  DO \$test\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE create_intent_hash IS NOT NULL AND status='collected' AND payment_status='paid') THEN
      RAISE EXCEPTION 'No completed and paid synthetic pickup order found';
    END IF;
    IF EXISTS (SELECT 1 FROM public.orders WHERE create_intent_hash IS NOT NULL
      AND (delivery_type IS DISTINCT FROM 'collection' OR delivery_status IS DISTINCT FROM 'none'
           OR rider_id IS NOT NULL OR delivery_fee IS DISTINCT FROM 0)) THEN
      RAISE EXCEPTION 'Pickup test inserted rider/delivery data';
    END IF;
  END
  \$test\$;
" >/dev/null
echo "PICKUP_ONLY_TWO_APP_REAL_HTTP_POSTGRES_PASS"
echo "All data and credentials were isolated CI fixtures. Live order activation remains off."
