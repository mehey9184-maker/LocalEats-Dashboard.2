#!/usr/bin/env bash
# L3-N5: restore fabricated pickup state from a disposable PostgreSQL backup.
# Never run against Supabase, a shared staging database or Production.
set -Eeuo pipefail
if [[ "${PICKUP_TEST_ISOLATED:-}" != "1" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGPORT:-}" != "5432" ||
      "${PGDATABASE:-}" != "local_pickup_qa" ||
      "${PGUSER:-}" != "postgres" ||
      "${PGSSLMODE:-}" != "disable" ||
      -n "${SUPABASE_URL:-}" ||
      -n "${DATABASE_URL:-}" ||
      -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ||
      -n "${SUPABASE_SECRET_KEY:-}" ||
      "${GITHUB_ACTIONS:-}" != "true" ||
      -n "${DOCKER_HOST:-}" ]]; then
  echo "L3_N5_REFUSED_NON_DISPOSABLE_DATABASE" >&2
  exit 18
fi
test "$(psql -X -At -v ON_ERROR_STOP=1 -c 'select current_database()')" = "local_pickup_qa"
test "$(PGDATABASE=postgres psql -X -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_database where datname='local_pickup_qa_restore'")" = "0"
tmp="$(mktemp -d)"
cleanup(){
  PGDATABASE=postgres dropdb --if-exists local_pickup_qa_restore >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

scalar(){
  PGDATABASE="$1" psql -X -At -v ON_ERROR_STOP=1 -c "$2"
}
# Only fixture rows are present: the original script starts from a brand-new,
# empty local_pickup_qa and creates all test identities and synthetic orders.
test "$(scalar local_pickup_qa "select count(*)>=1 from public.orders where create_intent_hash is not null and status='collected' and payment_status='paid'")" = "t"
test "$(scalar local_pickup_qa "select count(*)>0 from public.pickup_order_events")" = "t"
test "$(scalar local_pickup_qa "select count(*)>0 from public.pickup_push_outbox")" = "t"

# This archive is never published as an artifact. Clone only to a new loopback
# DB inside the same disposable GitHub Actions Postgres service.
# The Ubuntu runner may ship PostgreSQL 16 client tools while the CI service
# runs PostgreSQL 17. Use the trusted local postgres:17-alpine service's own
# matching client tools; NEVER connect to a hosted database.
pg_container="$(docker ps --filter 'ancestor=postgres:17-alpine' --format '{{.ID}}')"
if [[ ! "$pg_container" =~ ^[a-f0-9]{12,64}$ ]];then
  echo "L3_N5_REFUSED_MISSING_SINGLE_DISPOSABLE_PG17_CONTAINER" >&2
  exit 30
fi
docker exec --user postgres "$pg_container" pg_dump --version
docker exec --user postgres "$pg_container" pg_dump --format=custom --no-owner --dbname=local_pickup_qa >"$tmp/pickup-synthetic-only.dump"
PGDATABASE=postgres createdb local_pickup_qa_restore
PGDATABASE=local_pickup_qa_restore psql -X -q -v ON_ERROR_STOP=1 -c 'drop schema if exists public cascade;' >"$tmp/drop.log"
# pg_dump omits CREATE SCHEMA for PostgreSQL's implicit public schema;
# recreate it in the empty recovery database before restoring objects.
PGDATABASE=local_pickup_qa_restore psql -X -q -v ON_ERROR_STOP=1 -c 'create schema public;' >"$tmp/create.log"
docker exec -i --user postgres "$pg_container" pg_restore --no-owner --exit-on-error --dbname=local_pickup_qa_restore <"$tmp/pickup-synthetic-only.dump" >"$tmp/restore.log" 2>"$tmp/restore.err" || {
  # Do not print rows or SQL containing fabricated customer information.
  echo "L3_N5_DISPOSABLE_RESTORE_FAILED" >&2
  exit 31
}
for table in orders pickup_order_events pickup_push_subscriptions pickup_push_outbox; do
  source_count="$(scalar local_pickup_qa "select count(*) from public.$table")"
  restored_count="$(scalar local_pickup_qa_restore "select count(*) from public.$table")"
  if [[ "$source_count" != "$restored_count" ]]; then
    echo "L3_N5_RESTORE_COUNT_MISMATCH: $table" >&2
    exit 32
  fi
  echo "L3_N5_RESTORED_COUNT_OK $table=$restored_count"
done

# Match essential cross-table semantics and forbid private test fixtures and
# Rider assignment in the restored order history.
assert_sql(){
  local actual
  actual="$(scalar local_pickup_qa_restore "$1")"
  [[ "$actual" == "$2" ]] || {
    echo "L3_N5_RESTORE_INVARIANT_FAILED: $3" >&2
    exit 33
  }
}
assert_sql "select count(*)>=1 from public.orders where create_intent_hash is not null and status='collected' and payment_status='paid'" "t" completed_payment_handover
assert_sql "select count(*) from public.orders where shop_id='private-test-my-kota-preview'" "0" private_sample_not_orderable
assert_sql "select count(*) from public.orders where create_intent_hash is not null and
  (delivery_type is distinct from 'collection' or rider_id is not null or delivery_fee is distinct from 0)" "0" no_rider_or_delivery
assert_sql "select count(*) from public.pickup_order_events e
  left join public.orders o on e.order_id=o.id where o.id is null" "0" all_event_orders_present
assert_sql "select count(*) from public.pickup_order_events where kind='ready'" "$(scalar local_pickup_qa "select count(*) from public.pickup_order_events where kind='ready'")" ready_events_retained
assert_sql "select bool_and(c.relrowsecurity) from pg_catalog.pg_class c
  where c.oid in ('public.pickup_order_events'::regclass,
                  'public.pickup_push_subscriptions'::regclass,
                  'public.pickup_push_outbox'::regclass)" "t" rls_enabled
assert_sql "select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n
  on n.oid=p.pronamespace where n.nspname='public'
  and p.proname in ('pickup_create_order','pickup_order_command')" "2" core_pickup_rpcs_restored
echo "L3_N5_DISPOSABLE_POSTGRES_RESTORE_PASS"
