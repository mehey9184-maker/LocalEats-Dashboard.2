#!/usr/bin/env bash
# Disposable synthetic PostgreSQL 17; no Supabase connection or port publishing.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
name="localeats_reward_lab_$$"
tmp="$(mktemp -d)"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
docker run -d --name "$name" --rm \
  -e POSTGRES_PASSWORD=local_ci_only -e POSTGRES_DB=rewards_lab postgres:17-alpine >/dev/null
ready=0
for attempt in $(seq 1 45); do
  if docker exec "$name" pg_isready -U postgres -d rewards_lab >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then echo "isolated PostgreSQL 17 did not start" >&2; exit 1; fi
pg(){ docker exec "$name" psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d rewards_lab "$@"; }
run_file(){ docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d rewards_lab < "$1"; }
assert_query(){
  local actual
  actual="$(pg -c "$1")"
  if [[ "$actual" != "$2" ]]; then
    echo "Assertion failed: $1; expected $2, got $actual" >&2
    exit 1
  fi
}
reset(){
  pg -c "TRUNCATE reward_lab.shops, reward_lab.order_line_facts, reward_lab.progress, reward_lab.audit RESTART IDENTITY CASCADE;" >/dev/null
  pg -c "UPDATE reward_lab.program SET active=true,limit_minor=2500,allocated_minor=0 WHERE id=1;" >/dev/null
  pg -c "INSERT INTO reward_lab.shops(shop_id) VALUES('shop-1');" >/dev/null
  pg -c "INSERT INTO reward_lab.catalogue(shop_id,item_id,item_kind,price_minor) VALUES ('shop-1','kota-24','standard_kota',2400);" >/dev/null
}
paired(){
  local sql1="$1" sql2="$2" a b
  pg -c "$sql1" >"$tmp/a.out" 2>"$tmp/a.err" & a=$!
  pg -c "$sql2" >"$tmp/b.out" 2>"$tmp/b.err" & b=$!
  if wait "$a"; then status_a=0; else status_a=$?; fi
  if wait "$b"; then status_b=0; else status_b=$?; fi
}
echo "R2-PG17: loading disposable schema and deterministic SQL assertions"
run_file "$here/schema.SYNTHETIC_ONLY.sql" >"$tmp/schema.out"
run_file "$here/assertions.SYNTHETIC_ONLY.sql" >"$tmp/assertions.out"
grep -q 'R2_PG17_SERIAL_LEDGER_ASSERTIONS_PASS' "$tmp/assertions.out"

reset
pg -c "INSERT INTO reward_lab.order_line_facts VALUES('race-same','line-1','race-user','shop-1',4,true,true,true,false,false);" >/dev/null
paired "SELECT reward_lab.credit_paid_order('race-same');" "SELECT reward_lab.credit_paid_order('race-same');"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "same-order retry failed" >&2; exit 1
fi
assert_query "SELECT count(*) FROM reward_lab.credited_lines;" "1"
assert_query "SELECT count(*) FROM reward_lab.grants;" "1"
assert_query "SELECT allocated_minor FROM reward_lab.program WHERE id=1;" "2500"

paired \
  "SELECT reward_lab.fulfil_grant('reward:race-user:bronze','race-user','shop-1','kota-24','handover-same');" \
  "SELECT reward_lab.fulfil_grant('reward:race-user:bronze','race-user','shop-1','kota-24','handover-same');"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "same-handover retry failed" >&2; exit 1
fi
assert_query "SELECT count(*) FROM reward_lab.payables;" "1"
assert_query "SELECT count(*) FROM reward_lab.handovers;" "1"
assert_query "SELECT allocated_minor FROM reward_lab.program WHERE id=1;" "2400"

paired \
  "SELECT reward_lab.record_transfer('payable:reward:race-user:bronze','transfer-same','admin-trusted','BANK-1',2400);" \
  "SELECT reward_lab.record_transfer('payable:reward:race-user:bronze','transfer-same','admin-trusted','BANK-1',2400);"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "same-transfer retry failed" >&2; exit 1
fi
assert_query "SELECT count(*) FROM reward_lab.transfers;" "1"
assert_query "SELECT status FROM reward_lab.payables LIMIT 1;" "sent"

reset
pg -c "INSERT INTO reward_lab.order_line_facts VALUES
  ('race-a','line-1','customer-a','shop-1',4,true,true,true,false,false),
  ('race-b','line-1','customer-b','shop-1',4,true,true,true,false,false);" >/dev/null
paired "SELECT reward_lab.credit_paid_order('race-a');" "SELECT reward_lab.credit_paid_order('race-b');"
success=0
if [[ "$status_a" -eq 0 ]]; then success=$((success+1)); else grep -q 'REWARD_BUDGET_EXHAUSTED' "$tmp/a.err"; fi
if [[ "$status_b" -eq 0 ]]; then success=$((success+1)); else grep -q 'REWARD_BUDGET_EXHAUSTED' "$tmp/b.err"; fi
if [[ "$success" -ne 1 ]]; then
  echo "Expected exactly 1 committed funded grant, got $success" >&2
  cat "$tmp/a.err" "$tmp/b.err" >&2
  exit 1
fi
assert_query "SELECT count(*) FROM reward_lab.credited_lines;" "1"
assert_query "SELECT count(*) FROM reward_lab.grants;" "1"
assert_query "SELECT allocated_minor FROM reward_lab.program WHERE id=1;" "2500"
assert_query "SELECT count(*) FROM reward_lab.payables;" "0"
echo "R2_PG17_CONCURRENCY_AND_BUDGET_PASS"
