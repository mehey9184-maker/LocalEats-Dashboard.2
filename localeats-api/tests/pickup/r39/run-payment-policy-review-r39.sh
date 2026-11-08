#!/usr/bin/env bash
# R3.9: render non-executable review template ONLY into disposable PG17.
# No keys, ports, network destinations or Supabase connections.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
name="localeats_r39_$RANDOM"
tmp="$(mktemp -d)"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT

base="$root/localeats-api/tests/pickup/r38/payments-source.SYNTHETIC_ONLY.sql"
plan="$here/payments-access-hardening.REVIEW_ONLY.sql.txt"
[[ -f "$base" && -f "$plan" ]] || { echo "R39_MISSING_SYNTHETIC_INPUT" >&2; exit 1; }
sed -e 's/__SCHEMA__/r38_lab/g' \
    -e 's/__ANON_ROLE__/r38_anon/g' \
    -e 's/__CLIENT_ROLE__/r38_authenticated/g' \
    -e 's/__BACKEND_ROLE__/r38_backend/g' "$plan" > "$tmp/plan.sql"
if grep -Eq '__SCHEMA__|__ANON_ROLE__|__CLIENT_ROLE__|__BACKEND_ROLE__' "$tmp/plan.sql"; then
  echo "R39_UNEXPANDED_PLACEHOLDER" >&2;exit 1
fi

docker run -d --name "$name" --rm -e POSTGRES_PASSWORD=disposable_only \
 -e POSTGRES_DB=r39_test postgres:17-alpine >/dev/null
ready=0
for i in $(seq 1 45); do
 if docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d r39_test -c 'SELECT 1' 2>/dev/null | grep -qx '1'; then
    ready=1; break
 fi
 sleep 1
done
[[ "$ready" == 1 ]] || { echo "R39_POSTGRES_NOT_READY" >&2; exit 1; }
pg(){ docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d r39_test -c "$1"; }
load(){ docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d r39_test <"$1"; }
check(){
  local got;got="$(pg "$1")"
  [[ "$got" == "$2" ]] || { echo "R39_EXPECTED=$2 GOT=$got" >&2;exit 1; }
}
must_deny(){
 local failure
 if failure="$(pg "$1" 2>&1)";then echo "R39_UNEXPECTED_BROWSER_ACCESS" >&2;exit 1;fi
 [[ "$failure" == *"permission denied"* ]] || { echo "$failure" >&2;exit 1; }
}
load "$base" >"$tmp/seed.log"
check "SELECT count(*) FROM r38_lab.payments;" "2"
check "SELECT sum(amount) FROM r38_lab.payments;" "4250"
# Malicious drift or a changed historical policy MUST prevent execution,
# and a failed preflight must leave all fake grants/payments unchanged.
pg "DROP POLICY \"Payments access\" ON r38_lab.payments;
 CREATE POLICY \"Payments access\" ON r38_lab.payments FOR ALL TO r38_authenticated
 USING (false) WITH CHECK (false);" >/dev/null
if load "$tmp/plan.sql" >"$tmp/drift.log" 2>&1;then
 echo "R39_DRIFT_GUARD_DID_NOT_ABORT" >&2;exit 1
fi
grep -q "R39_LEGACY_PAYMENT_POLICY_NOT_AS_REVIEWED" "$tmp/drift.log" || {
 cat "$tmp/drift.log" >&2; exit 1;
}
check "SELECT has_table_privilege('r38_authenticated','r38_lab.payments','SELECT');" "t"
check "SELECT count(*) FROM r38_lab.payments;" "2"
pg "DROP POLICY \"Payments access\" ON r38_lab.payments;
 CREATE POLICY \"Payments access\" ON r38_lab.payments FOR ALL TO r38_authenticated
 USING (true) WITH CHECK (true);" >/dev/null
# Real template exactly as authored, only with scratch identifiers substituted.
load "$tmp/plan.sql" >"$tmp/applied.log"
check "SELECT count(*) FROM r38_lab.payments;" "2"
check "SELECT sum(amount) FROM r38_lab.payments;" "4250"
check "SELECT has_table_privilege('r38_authenticated','r38_lab.payments','SELECT');" "f"
check "SELECT has_table_privilege('r38_authenticated','r38_lab.payments','INSERT');" "f"
check "SELECT has_table_privilege('r38_authenticated','r38_lab.payments','UPDATE');" "f"
check "SELECT has_table_privilege('r38_authenticated','r38_lab.payments','DELETE');" "f"
check "SELECT has_table_privilege('r38_backend','r38_lab.payments','SELECT');" "t"
must_deny "SET SESSION AUTHORIZATION r38_authenticated; SELECT * FROM r38_lab.payments;"
must_deny "SET SESSION AUTHORIZATION r38_authenticated; UPDATE r38_lab.payments SET amount=0;"
must_deny "SET SESSION AUTHORIZATION r38_anon; SELECT * FROM r38_lab.payments;"
must_deny "SET SESSION AUTHORIZATION r38_authenticated; SET ROLE r38_backend;"
check "SET SESSION AUTHORIZATION r38_backend; SELECT count(*) FROM r38_lab.payments;" "2"
# A second application is unsafe and should fail rather than claim idempotency.
if load "$tmp/plan.sql" >"$tmp/replay.log" 2>&1;then
 echo "R39_REPEAT_MIGRATION_NOT_BLOCKED" >&2;exit 1
fi
grep -q "R39_LEGACY_PAYMENT_POLICY_NOT_AS_REVIEWED" "$tmp/replay.log" || {
 cat "$tmp/replay.log" >&2; exit 1;
}
check "SELECT sum(amount) FROM r38_lab.payments;" "4250"
# Schema-only recovery, no customer/payout/payment values in artifact.
docker exec "$name" pg_dump -U postgres -d r39_test --schema-only -n r38_lab -F c -f /tmp/r39-schema.dump
docker exec "$name" createdb -U postgres r39_restored
docker exec "$name" pg_restore -U postgres --no-owner -d r39_restored /tmp/r39-schema.dump >"$tmp/restore.log"
restore(){
 docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d r39_restored -c "$1"
}
[[ "$(restore 'SELECT count(*) FROM r38_lab.payments;')" == 0 ]] || { echo "R39_DATA_IN_SCHEMA_RESTORE" >&2;exit 1; }
[[ "$(restore "SELECT has_table_privilege('r38_authenticated','r38_lab.payments','SELECT');")" == f ]] || { echo "R39_RESTORED_CLIENT_ACCESS" >&2;exit 1; }
[[ "$(restore "SELECT has_table_privilege('r38_backend','r38_lab.payments','SELECT');")" == t ]] || { echo "R39_RESTORED_BACKEND_UNAVAILABLE" >&2;exit 1; }
echo "R39_GUARDED_REVIEW_ONLY_PAYMENT_POLICY_AND_RESTORE_PASS"
