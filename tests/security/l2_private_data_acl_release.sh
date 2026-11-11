#!/usr/bin/env bash
# Rehearse the EXACT release migration against synthetic roles and rows in disposable PG17.
# No hosted endpoints, secrets, ports, production data, or Supabase connections.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
name="localeats_l2release_$RANDOM"
tmp="$(mktemp -d)"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true;rm -rf "$tmp"; }
trap cleanup EXIT
base="$root/localeats-api/tests/pickup/r38/payments-source.SYNTHETIC_ONLY.sql"
migration="$root/supabase/migrations/20261111060000_l2_private_chat_payment_acl.sql"
[[ -f "$base" && -f "$migration" ]] || { echo 'L2_MISSING_MIGRATION_OR_SYNTHETIC_FIXTURE' >&2;exit 1; }
# The entire release SQL is used: only schema and role names become scratch names.
sed -e 's/public\./r38_lab./g' -e "s/'public'/'r38_lab'/g" \
    -e 's/\bservice_role\b/r38_backend/g' \
    -e 's/\bauthenticated\b/r38_authenticated/g' \
    -e 's/\banon\b/r38_anon/g' "$migration" >"$tmp/migration.sql"
if grep -Pq 'public\.(chat_messages|payments)|\bservice_role\b|\bauthenticated\b|\banon\b' "$tmp/migration.sql"; then
  echo 'L2_SCRATCH_ROLE_RENDER_FAILED' >&2;exit 1
fi
docker run -d --name "$name" --rm -e POSTGRES_PASSWORD=disposable_only \
  -e POSTGRES_DB=l2_synthetic postgres:17-alpine >/dev/null
ready=0
for i in $(seq 1 45);do
 if docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d l2_synthetic -c 'SELECT 1' 2>/dev/null | grep -qx 1;then ready=1;break;fi
 sleep 1
done
[[ "$ready" == 1 ]] || { echo 'L2_POSTGRES_NOT_READY' >&2;exit 1; }
pg(){ docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d l2_synthetic -c "$1"; }
load(){ docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d l2_synthetic <"$1"; }
check(){ local got;got="$(pg "$1")";[[ "$got" == "$2" ]] || { echo "L2_EXPECTED=$2 GOT=$got QUERY=$1" >&2;exit 1; }; }
deny(){ local out;if out="$(pg "$1" 2>&1)";then echo 'L2_CLIENT_ACCESS_UNEXPECTEDLY_ALLOWED' >&2;exit 1;fi;[[ "$out" == *"permission denied"* ]] || { echo "$out" >&2;exit 1; }; }
load "$base" >"$tmp/fixture.log"
pg 'ALTER ROLE r38_backend BYPASSRLS;
    GRANT INSERT,UPDATE,DELETE ON r38_lab.payments TO r38_backend;
    DROP POLICY r38_backend_read ON r38_lab.payments;' >/dev/null
pg "CREATE TABLE r38_lab.chat_messages(id uuid PRIMARY KEY,shop_id bigint,order_id uuid,
      sender_id uuid,sender_role text,message text,created_at timestamptz);
    ALTER TABLE r38_lab.chat_messages ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE,DELETE ON r38_lab.chat_messages TO r38_anon,r38_authenticated,r38_backend;
    CREATE POLICY \"Allow all on chat_messages\" ON r38_lab.chat_messages
      FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
    CREATE POLICY \"Chat message access\" ON r38_lab.chat_messages
      FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
    INSERT INTO r38_lab.chat_messages(id,shop_id,message) VALUES
      ('00000000-0000-4000-8000-000000000501',101,'synthetic-only-1'),
      ('00000000-0000-4000-8000-000000000502',202,'synthetic-only-2');" >/dev/null
check 'SELECT count(*) FROM r38_lab.chat_messages;' 2
check 'SELECT sum(amount) FROM r38_lab.payments;' 4250
# Simulated policy drift MUST abort atomic transaction; both original ACLs must survive.
pg 'DROP POLICY "Payments access" ON r38_lab.payments;
 CREATE POLICY "Payments access" ON r38_lab.payments FOR ALL TO r38_authenticated USING(false) WITH CHECK(false);' >/dev/null
if load "$tmp/migration.sql" >"$tmp/drift.log" 2>&1;then echo 'L2_DRIFT_GUARD_DID_NOT_ABORT' >&2;exit 1;fi
grep -q 'L2_PAYMENTS_POLICY_DRIFTED' "$tmp/drift.log" || { tail -30 "$tmp/drift.log" >&2;exit 1; }
check "SELECT has_table_privilege('r38_authenticated','r38_lab.chat_messages','SELECT');" t
check "SELECT has_table_privilege('r38_authenticated','r38_lab.payments','SELECT');" t
pg 'DROP POLICY "Payments access" ON r38_lab.payments;
 CREATE POLICY "Payments access" ON r38_lab.payments FOR ALL TO r38_authenticated USING(true) WITH CHECK(true);' >/dev/null
load "$tmp/migration.sql" >"$tmp/applied.log"
for table in chat_messages payments;do
 for role in r38_anon r38_authenticated;do
  for privilege in SELECT INSERT UPDATE DELETE;do
   check "SELECT has_table_privilege('$role','r38_lab.$table','$privilege');" f
  done
 done
 for privilege in SELECT INSERT UPDATE DELETE;do
  check "SELECT has_table_privilege('r38_backend','r38_lab.$table','$privilege');" t
 done
 deny "SET SESSION AUTHORIZATION r38_authenticated; SELECT * FROM r38_lab.$table;"
 deny "SET SESSION AUTHORIZATION r38_anon; SELECT * FROM r38_lab.$table;"
done
deny "SET SESSION AUTHORIZATION r38_authenticated; UPDATE r38_lab.payments SET amount=0;"
deny "SET SESSION AUTHORIZATION r38_authenticated; SET ROLE r38_backend;"
check 'SET SESSION AUTHORIZATION r38_backend; SELECT count(*) FROM r38_lab.chat_messages;' 2
check 'SET SESSION AUTHORIZATION r38_backend; SELECT sum(amount) FROM r38_lab.payments;' 4250
check 'SELECT count(*) FROM r38_lab.chat_messages;' 2
check 'SELECT sum(amount) FROM r38_lab.payments;' 4250
if load "$tmp/migration.sql" >"$tmp/replay.log" 2>&1;then echo 'L2_REPLAY_UNEXPECTEDLY_SUCCEEDED' >&2;exit 1;fi
grep -q 'L2_CHAT_POLICIES_DRIFTED' "$tmp/replay.log" || { tail -30 "$tmp/replay.log" >&2;exit 1; }
docker exec "$name" pg_dump -U postgres -d l2_synthetic --schema-only -n r38_lab -F c -f /tmp/l2_schema.dump
docker exec "$name" createdb -U postgres l2_restored
docker exec "$name" pg_restore -U postgres --no-owner -d l2_restored /tmp/l2_schema.dump >"$tmp/restore.log"
restore(){ docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d l2_restored -c "$1"; }
[[ "$(restore 'SELECT count(*) FROM r38_lab.payments;')" == 0 ]] || { echo 'L2_PAYMENT_ROWS_IN_SCHEMA_DUMP' >&2;exit 1; }
[[ "$(restore 'SELECT count(*) FROM r38_lab.chat_messages;')" == 0 ]] || { echo 'L2_CHAT_ROWS_IN_SCHEMA_DUMP' >&2;exit 1; }
[[ "$(restore "SELECT has_table_privilege('r38_authenticated','r38_lab.payments','SELECT');")" == f ]] || { echo 'L2_PAYMENT_ACL_RESTORED_BADLY' >&2;exit 1; }
[[ "$(restore "SELECT has_table_privilege('r38_authenticated','r38_lab.chat_messages','SELECT');")" == f ]] || { echo 'L2_CHAT_ACL_RESTORED_BADLY' >&2;exit 1; }
[[ "$(restore "SELECT has_table_privilege('r38_backend','r38_lab.payments','SELECT');")" == t ]] || { echo 'L2_BACKEND_ACL_RESTORED_BADLY' >&2;exit 1; }
echo 'L2_EXACT_RELEASE_MIGRATION_DISPOSABLE_PG17_PASS'
