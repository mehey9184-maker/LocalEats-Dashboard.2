#!/usr/bin/env bash
# L3-N7A: Restore only fabricated, local PostgreSQL 17 acceptance data.
# Never use with Supabase or a remote database; never upload the archive.
set -Eeuo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ||
      "${PICKUP_TEST_ISOLATED:-}" != "1" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGPORT:-}" != "5432" ||
      "${PGDATABASE:-}" != "local_acceptance_qa" ||
      "${PGUSER:-}" != "postgres" ||
      "${PGSSLMODE:-}" != "disable" ||
      -n "${DATABASE_URL:-}" ||
      -n "${SUPABASE_URL:-}" ||
      -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ||
      -n "${SUPABASE_SECRET_KEY:-}" ||
      -n "${DOCKER_HOST:-}" ]]; then
  echo 'L3_N7A_RESTORE_REFUSED_NON_DISPOSABLE_TARGET' >&2
  exit 18
fi
query(){
 PGDATABASE="$1" psql -X -At -v ON_ERROR_STOP=1 -c "$2"
}
test "$(query local_acceptance_qa 'select current_database()')" = local_acceptance_qa
test "$(query postgres "select count(*) from pg_database where datname='local_acceptance_qa_restore'")" = 0
test "$(query local_acceptance_qa 'select count(*)>2000 from public.orders where acceptance_deadline_at is not null')" = t
test "$(query local_acceptance_qa 'select count(*)>0 from public.pickup_acceptance_notices')" = t
test "$(query local_acceptance_qa 'select count(*)>0 from public.pickup_acceptance_push_jobs')" = t
test "$(query local_acceptance_qa 'select count(*)=1 from public.pickup_acceptance_settings')" = t

temp="$(mktemp -d)"
cleanup(){
 PGDATABASE=postgres dropdb --if-exists local_acceptance_qa_restore >/dev/null 2>&1 || true
 rm -rf "$temp"
}
trap cleanup EXIT

# Use PG17's own pg_dump/pg_restore in the temporary GitHub service container.
containers="$(docker ps --filter 'ancestor=postgres:17-alpine' --format '{{.ID}}')"
if [[ ! "$containers" =~ ^[a-f0-9]{12,64}$ ]]; then
 echo 'L3_N7A_RESTORE_REFUSED_MISSING_SINGLE_LOCAL_POSTGRES_17' >&2
 exit 30
fi
docker exec --user postgres "$containers" pg_dump --format=custom --no-owner --dbname=local_acceptance_qa > "$temp/acceptance-synthetic.dump"
PGDATABASE=postgres createdb local_acceptance_qa_restore
PGDATABASE=local_acceptance_qa_restore psql -X -q -v ON_ERROR_STOP=1 -c 'drop schema if exists public cascade; create schema public;' > "$temp/create.log"
docker exec -i --user postgres "$containers" pg_restore --no-owner --exit-on-error --dbname=local_acceptance_qa_restore < "$temp/acceptance-synthetic.dump" > "$temp/restore.log" 2> "$temp/restore.err" || {
 echo 'L3_N7A_RESTORE_DISPOSABLE_SCHEMA_FAILED' >&2
 exit 31
}

for table in orders shops pickup_order_events pickup_push_subscriptions pickup_push_outbox pickup_acceptance_settings pickup_acceptance_notices pickup_acceptance_push_jobs; do
 count_source="$(query local_acceptance_qa "select count(*) from public.$table")"
 count_restored="$(query local_acceptance_qa_restore "select count(*) from public.$table")"
 if [[ "$count_source" != "$count_restored" ]]; then
  echo "L3_N7A_RESTORE_COUNT_MISMATCH: $table" >&2
  exit 32
 fi
 echo "L3_N7A_RESTORE_MATCHED $table=$count_restored"
done

assert_restore(){
 local value
 value="$(query local_acceptance_qa_restore "$1")"
 if [[ "$value" != "$2" ]]; then
  echo "L3_N7A_RESTORE_INVARIANT_FAILED: $3" >&2
  exit 33
 fi
}
assert_restore "select count(*) from public.orders where shop_id='private-test-my-kota-preview'" 0 sample_shop_never_orderable
assert_restore "select count(*) from public.pickup_acceptance_settings where singleton and enabled" 1 db_enabled_flag_restored_as_test_only
assert_restore "select count(*)>0 from public.orders where acceptance_expired_at is not null" t expired_orders_retained
assert_restore "select count(*)>0 from public.pickup_acceptance_notices where kind='merchant_reminder'" t reminders_restored
assert_restore "select count(*)>0 from public.pickup_acceptance_notices where kind='customer_expired'" t customer_expiry_restored
assert_restore "select count(*)>0 from public.pickup_acceptance_push_jobs" t push_jobs_retained_without_sending
assert_restore "select count(*) from public.pickup_order_events e left join public.orders o on e.order_id=o.id where o.id is null" 0 no_orphan_events
assert_restore "select count(*) from public.pickup_acceptance_notices n left join public.orders o on n.order_id=o.id where o.id is null" 0 no_orphan_notices
assert_restore "select count(*) from public.pickup_acceptance_push_jobs j left join public.pickup_acceptance_notices n on j.notice_id=n.id where n.id is null" 0 no_orphan_push_jobs
assert_restore "select bool_and(relrowsecurity) from pg_class where oid in (
 'public.pickup_order_events'::regclass,
 'public.pickup_acceptance_settings'::regclass,
 'public.pickup_acceptance_notices'::regclass,
 'public.pickup_acceptance_push_jobs'::regclass
)" t event_acceptance_rls
assert_restore "select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid
 where n.nspname='public' and p.proname in ('pickup_create_order','pickup_order_command',
 'pickup_sweep_acceptance','pickup_reception_status','pickup_resume_reception')" 5 core_and_acceptance_functions_restored

echo 'L3_N7A_DISPOSABLE_ACCEPTANCE_BACKUP_RESTORE_PASS'
