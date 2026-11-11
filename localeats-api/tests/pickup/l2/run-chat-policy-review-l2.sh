#!/usr/bin/env bash
# L2A: disposable PostgreSQL17 only. Never connects to hosted Supabase.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
name="localeats_l2_chat_$RANDOM"
tmp="$(mktemp -d)"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
base="$root/localeats-api/tests/pickup/r38/payments-source.SYNTHETIC_ONLY.sql"
plan="$here/chat-access-hardening.REVIEW_ONLY.sql.txt"
[[ -f "$base" && -f "$plan" ]] || { echo 'L2_MISSING_SYNTHETIC_INPUT' >&2; exit 1; }
sed -e 's/__SCHEMA__/r38_lab/g' \
    -e 's/__ANON_ROLE__/r38_anon/g' \
    -e 's/__CLIENT_ROLE__/r38_authenticated/g' \
    -e 's/__BACKEND_ROLE__/r38_backend/g' "$plan" > "$tmp/plan.sql"
if grep -Eq '__SCHEMA__|__ANON_ROLE__|__CLIENT_ROLE__|__BACKEND_ROLE__' "$tmp/plan.sql"; then
  echo 'L2_UNEXPANDED_PLACEHOLDER' >&2;exit 1
fi
docker run -d --name "$name" --rm -e POSTGRES_PASSWORD=disposable_only \
  -e POSTGRES_DB=l2_chat_synthetic postgres:17-alpine >/dev/null
ready=0
for i in $(seq 1 45); do
  if docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres \
      -d l2_chat_synthetic -c 'SELECT 1' 2>/dev/null | grep -qx '1'; then ready=1;break;fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'L2_PG_NOT_READY' >&2; exit 1; }
pg(){ docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d l2_chat_synthetic -c "$1"; }
load(){ docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d l2_chat_synthetic < "$1"; }
check(){
  local got
  got="$(pg "$1")"
  [[ "$got" == "$2" ]] || { echo "L2_EXPECTED=$2 GOT=$got" >&2;exit 1; }
}
must_deny(){
  local failure
  if failure="$(pg "$1" 2>&1)";then echo 'L2_UNEXPECTED_BROWSER_ACCESS' >&2;exit 1;fi
  [[ "$failure" == *"permission denied"* ]] || { echo "$failure" >&2;exit 1; }
}
load "$base" >"$tmp/base.log"
pg "CREATE TABLE r38_lab.chat_messages(
   id uuid PRIMARY KEY, shop_id bigint, order_id uuid,
   sender_id uuid, sender_role text, message text, created_at timestamptz
 );
 ALTER TABLE r38_lab.chat_messages ENABLE ROW LEVEL SECURITY;
 GRANT SELECT, INSERT, UPDATE, DELETE ON r38_lab.chat_messages TO r38_anon,r38_authenticated,r38_backend;
 CREATE POLICY \"Allow all on chat_messages\" ON r38_lab.chat_messages FOR ALL TO PUBLIC
 USING (true) WITH CHECK (true);
 CREATE POLICY \"Chat message access\" ON r38_lab.chat_messages FOR ALL TO PUBLIC
 USING (true) WITH CHECK (true);
 INSERT INTO r38_lab.chat_messages(id,shop_id,order_id,sender_id,sender_role,message)
 VALUES
 ('00000000-0000-4000-8000-000000000401',101,'00000000-0000-4000-8000-000000000411',
  '00000000-0000-4000-8000-000000000421','customer','synthetic only first'),
 ('00000000-0000-4000-8000-000000000402',202,'00000000-0000-4000-8000-000000000412',
  '00000000-0000-4000-8000-000000000422','merchant','synthetic only second');" >/dev/null
check 'SELECT count(*) FROM r38_lab.chat_messages;' '2'
check 'SELECT count(*) FROM r38_lab.chat_messages WHERE length(message)>0;' '2'
# No broad policy may be removed if the observed pattern or policy set drifted.
pg 'DROP POLICY "Chat message access" ON r38_lab.chat_messages;
    CREATE POLICY "Chat message access" ON r38_lab.chat_messages FOR ALL TO PUBLIC
    USING (false) WITH CHECK (false);' >/dev/null
if load "$tmp/plan.sql" >"$tmp/drift.log" 2>&1;then
  echo 'L2_DRIFT_GUARD_DID_NOT_ABORT' >&2;exit 1
fi
grep -q 'L2_CHAT_LEGACY_POLICIES_NOT_AS_REVIEWED' "$tmp/drift.log" || {
  cat "$tmp/drift.log" >&2;exit 1;
}
check "SELECT has_table_privilege('r38_anon','r38_lab.chat_messages','SELECT');" 't'
check 'SELECT count(*) FROM r38_lab.chat_messages;' '2'
pg 'DROP POLICY "Chat message access" ON r38_lab.chat_messages;
    CREATE POLICY "Chat message access" ON r38_lab.chat_messages FOR ALL TO PUBLIC
    USING (true) WITH CHECK (true);' >/dev/null
# The exact template, rendered with scratch identifiers, is used unchanged.
load "$tmp/plan.sql" >"$tmp/applied.log"
check 'SELECT count(*) FROM r38_lab.chat_messages;' '2'
for role in r38_anon r38_authenticated; do
  for privilege in SELECT INSERT UPDATE DELETE; do
    check "SELECT has_table_privilege('$role','r38_lab.chat_messages','$privilege');" 'f'
  done
done
for privilege in SELECT INSERT UPDATE DELETE; do
  check "SELECT has_table_privilege('r38_backend','r38_lab.chat_messages','$privilege');" 't'
done
must_deny 'SET SESSION AUTHORIZATION r38_anon; SELECT * FROM r38_lab.chat_messages;'
must_deny 'SET SESSION AUTHORIZATION r38_authenticated; SELECT * FROM r38_lab.chat_messages;'
must_deny "SET SESSION AUTHORIZATION r38_authenticated;
 INSERT INTO r38_lab.chat_messages(id,message) VALUES
 ('00000000-0000-4000-8000-000000000499','forbidden');"
must_deny 'SET SESSION AUTHORIZATION r38_authenticated;
 UPDATE r38_lab.chat_messages SET message='\''tampered'\'';'
must_deny 'SET SESSION AUTHORIZATION r38_authenticated; SET ROLE r38_backend;'
check 'SET SESSION AUTHORIZATION r38_backend; SELECT count(*) FROM r38_lab.chat_messages;' '2'
check 'SELECT count(*) FROM r38_lab.chat_messages;' '2'
if load "$tmp/plan.sql" >"$tmp/replay.log" 2>&1;then
  echo 'L2_REPEAT_PLAN_NOT_BLOCKED' >&2;exit 1
fi
grep -q 'L2_CHAT_UNEXPECTED_POLICY_COUNT' "$tmp/replay.log" || {
  cat "$tmp/replay.log" >&2;exit 1;
}
# Schema-only restore: no user messages cross the isolated fixture boundary.
docker exec "$name" pg_dump -U postgres -d l2_chat_synthetic --schema-only -n r38_lab -F c -f /tmp/l2_chat_schema.dump
docker exec "$name" createdb -U postgres l2_chat_restored
docker exec "$name" pg_restore -U postgres --no-owner -d l2_chat_restored /tmp/l2_chat_schema.dump >"$tmp/restore.log"
restore(){ docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d l2_chat_restored -c "$1"; }
[[ "$(restore 'SELECT count(*) FROM r38_lab.chat_messages;')" == 0 ]] || { echo 'L2_SCHEMA_RESTORE_HAS_DATA' >&2;exit 1; }
[[ "$(restore "SELECT has_table_privilege('r38_anon','r38_lab.chat_messages','SELECT');")" == f ]] || { echo 'L2_RESTORED_PUBLIC_READ' >&2;exit 1; }
[[ "$(restore "SELECT has_table_privilege('r38_authenticated','r38_lab.chat_messages','INSERT');")" == f ]] || { echo 'L2_RESTORED_CLIENT_WRITE' >&2;exit 1; }
[[ "$(restore "SELECT has_table_privilege('r38_backend','r38_lab.chat_messages','SELECT');")" == t ]] || { echo 'L2_RESTORED_BACKEND_READ_BROKEN' >&2;exit 1; }
echo 'L2_GUARDED_CHAT_POLICY_CLIENT_DENIAL_AND_RESTORE_PASS'
