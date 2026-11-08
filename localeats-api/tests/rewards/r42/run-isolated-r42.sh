#!/usr/bin/env bash
# LOCALPAY R4.2: postgres:17-alpine disposable localhost-only; NEVER hosted DB.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
if [[ "${LOCALPAY_R42_ISOLATED:-}" != 1 || "${PGHOST:-}" != 127.0.0.1 ||
 "${PGPORT:-}" != 5432 || "${PGDATABASE:-}" != localpay_r42_disposable ||
 "${PGUSER:-}" != postgres || "${PGSSLMODE:-}" != disable ||
 "${PGPASSWORD:-}" != localpay-synthetic-only || -n "${DATABASE_URL:-}" ||
 -n "${SUPABASE_URL:-}" || -n "${DIRECT_URL:-}" || -n "${PGHOSTADDR:-}" ||
 -n "${PGSERVICE:-}" || -n "${PGSERVICEFILE:-}" ]]; then
 echo R42_REFUSED_NON_DISPOSABLE_DATABASE_ENVIRONMENT >&2; exit 2
fi
command -v psql >/dev/null || { echo R42_PSQL_NOT_FOUND >&2; exit 2; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
pg(){ psql -X -qAt -v ON_ERROR_STOP=1 "$@"; }
expect(){ local got; got="$(pg -c "$1")"; [[ "$got" == "$2" ]] ||
 { echo "R42_EXPECTED=$2 GOT=$got QUERY=$1" >&2; exit 1; }; }
deny(){ local out; if out="$(pg -c "$1" 2>&1)"; then echo R42_UNEXPECTED_SUCCESS >&2; exit 1; fi
 grep -Fq "$2" <<< "$out" || { echo "$out" >&2; exit 1; }; }
reset(){
 pg -c "TRUNCATE r42_lab.receipts,r42_lab.transfers,r42_lab.bank_proofs,
 r42_lab.payables,r42_lab.handover_proofs,r42_lab.holds,r42_lab.grants,
 r42_lab.purchases,r42_lab.customers,r42_lab.journal RESTART IDENTITY CASCADE;" >/dev/null
 pg -c "UPDATE r42_lab.pool SET uncommitted_minor=50000,reserved_minor=0,
 customer_minor=0,held_minor=0,payable_minor=0,paid_out_minor=0,admissions=0 WHERE id=1;" >/dev/null
}
race(){
 pg -c "$1" >"$tmp/a.out" 2>"$tmp/a.err" & local pid_a=$!
 pg -c "$2" >"$tmp/b.out" 2>"$tmp/b.err" & local pid_b=$!
 if wait "$pid_a"; then code_a=0; else code_a=$?; fi
 if wait "$pid_b"; then code_b=0; else code_b=$?; fi
}
expect "SELECT current_database();" localpay_r42_disposable
expect "SELECT current_setting('server_version_num')::int BETWEEN 170000 AND 179999;" t
expect "SELECT inet_server_addr()::text='127.0.0.1';" t
pg -f "$here/ledger.SYNTHETIC_ONLY.sql" >/dev/null
expect "SELECT r42_lab.reconcile();" t
expect "SELECT has_schema_privilege('r42_untrusted','r42_lab','USAGE');" f
deny "SET ROLE r42_untrusted; SELECT * FROM r42_lab.pool;" "permission denied"
deny "SET ROLE r42_untrusted; SELECT r42_lab.admit('x');" "permission denied"
echo R42_POSTGRES_ISOLATION_PASS

# Thirteen different psql connections race for twelve R25 admission reservations.
pids=()
for n in $(seq 1 13); do
 pg -c "SELECT r42_lab.admit('c$n');" >"$tmp/en$n.out" 2>"$tmp/en$n.err" & pids+=("$!")
done
success=0; rejected=0
for n in $(seq 1 13); do
 if wait "${pids[$((n-1))]}"; then success=$((success+1))
 else grep -Fq R42_COHORT_FULL "$tmp/en$n.err"; rejected=$((rejected+1)); fi
done
[[ "$success" == 12 && "$rejected" == 1 ]] || { echo R42_ENROLLMENT_RACE_FAILED >&2; exit 1; }
expect "SELECT admissions||':'||reserved_minor||':'||uncommitted_minor FROM r42_lab.pool;" "12:30000:20000"
expect "SELECT r42_lab.admit('c1');" REPLAY
deny "SELECT r42_lab.admit('c14');" R42_COHORT_FULL
expect "SELECT r42_lab.reconcile();" t
echo R42_POSTGRES_CONCURRENT_12_CUSTOMER_CAP_PASS

# SQL errors and forcefully terminated database sessions roll back all writes.
reset
deny "BEGIN; SELECT r42_lab.admit('rollback'); SELECT 1/0; COMMIT;" "division by zero"
expect "SELECT admissions||':'||reserved_minor FROM r42_lab.pool;" "0:0"
pg -c "BEGIN; SELECT r42_lab.admit('crash'); SELECT pg_sleep(20) /*R42_KILL_PENDING*/; COMMIT;" >"$tmp/crash.out" 2>"$tmp/crash.err" & crash_pid=$!
killed=0
for attempt in $(seq 1 50); do
  if [[ "$(pg -c "SELECT coalesce(bool_or(pg_terminate_backend(pid)),false)
     FROM pg_stat_activity WHERE datname='localpay_r42_disposable'
     AND pid<>pg_backend_pid() AND query LIKE '%R42_KILL_PENDING%' AND state='active';")" == t ]]; then
    killed=1; break
  fi
  sleep 0.1
done
[[ "$killed" == 1 ]] || { kill "$crash_pid" 2>/dev/null || true; echo R42_CRASH_TEST_INCONCLUSIVE >&2; exit 1; }
if wait "$crash_pid"; then echo R42_CRASH_MUST_ROLLBACK >&2; exit 1; fi
expect "SELECT admissions||':'||reserved_minor FROM r42_lab.pool;" "0:0"
expect "SELECT count(*) FROM r42_lab.journal;" 0
expect "SELECT r42_lab.admit('crash');" ADMITTED
expect "SELECT r42_lab.reconcile();" t
echo R42_POSTGRES_FORCED_BACKEND_TERMINATION_ROLLBACK_PASS

reset
expect "SELECT r42_lab.admit('buyer');" ADMITTED
race "SELECT r42_lab.credit_paid_collected('order1','line1','buyer','my-kota',4,true,true,false,false,false);" "SELECT r42_lab.credit_paid_collected('order1','line1','buyer','my-kota',4,true,true,false,false,false);"
[[ "$code_a" == 0 && "$code_b" == 0 ]] || { cat "$tmp/a.err" "$tmp/b.err" >&2; exit 1; }
expect "SELECT count(*) FROM r42_lab.purchases;" 1
expect "SELECT count(*) FROM r42_lab.grants;" 1
expect "SELECT bought_units FROM r42_lab.customers WHERE customer_id='buyer';" 4
deny "SELECT r42_lab.credit_paid_collected('order1','line1','buyer','my-kota',5,true,true,false,false,false);" R42_PURCHASE_REPLAY_CONFLICT
deny "SELECT r42_lab.credit_paid_collected('fake1','line2','buyer','my-kota',4,false,true,false,false,false);" R42_NOT_VALID_PAID_COLLECTED_PURCHASE
deny "SELECT r42_lab.credit_paid_collected('fake2','line2','buyer','my-kota',4,true,false,false,false,false);" R42_NOT_VALID_PAID_COLLECTED_PURCHASE
deny "SELECT r42_lab.credit_paid_collected('fake3','line2','buyer','my-kota',4,true,true,true,false,false);" R42_NOT_VALID_PAID_COLLECTED_PURCHASE
deny "SELECT r42_lab.credit_paid_collected('fake4','line2','buyer','my-kota',4,true,true,false,true,false);" R42_NOT_VALID_PAID_COLLECTED_PURCHASE
deny "SELECT r42_lab.credit_paid_collected('fake5','line2','buyer','my-kota',4,true,true,false,false,true);" R42_NOT_VALID_PAID_COLLECTED_PURCHASE
deny "UPDATE r42_lab.purchases SET qty=99;" R42_APPEND_ONLY
expect "SELECT r42_lab.reconcile();" t
echo R42_POSTGRES_ONE_TIME_BRONZE_AND_REPLAY_PASS

# 2 simultaneous connections fight over the same R25 free-food entitlement.
race "SELECT r42_lab.reserve_gift('hold-a','food-a','buyer','my-kota',2400);" "SELECT r42_lab.reserve_gift('hold-b','food-b','buyer','my-kota',2400);"
wins=0
if [[ "$code_a" == 0 ]]; then wins=$((wins+1)); else grep -Fq R42_GIFT_ALREADY_SPENT_OR_HELD "$tmp/a.err"; fi
if [[ "$code_b" == 0 ]]; then wins=$((wins+1)); else grep -Fq R42_GIFT_ALREADY_SPENT_OR_HELD "$tmp/b.err"; fi
[[ "$wins" == 1 ]] || { echo R42_TWO_SPENDS_COMMITTED >&2; exit 1; }
expect "SELECT held_minor||':'||customer_minor FROM r42_lab.pool;" "2400:100"
hold="$(pg -c "SELECT hold_id FROM r42_lab.holds;")"
expect "SELECT r42_lab.cancel_gift('$hold');" CANCELLED
expect "SELECT r42_lab.cancel_gift('$hold');" REPLAY
expect "SELECT held_minor||':'||customer_minor FROM r42_lab.pool;" "0:2500"
expect "SELECT r42_lab.reconcile();" t
echo R42_POSTGRES_CONCURRENT_HOLDS_AND_CANCEL_PASS

expect "SELECT r42_lab.reserve_gift('final-hold','food-final','buyer','shop-b',2400);" HELD
deny "SELECT r42_lab.capture_gift('final-hold','handover');" R42_PAYMENT_AND_HANDOVER_PROOF_REQUIRED
expect "SELECT count(*) FROM r42_lab.payables;" 0
pg -c "INSERT INTO r42_lab.handover_proofs VALUES('handover','final-hold','shop-b',true,true,'SYNTHETIC_PRIVATE_DB_FIXTURE');" >/dev/null
race "SELECT r42_lab.capture_gift('final-hold','handover');" "SELECT r42_lab.capture_gift('final-hold','handover');"
[[ "$code_a" == 0 && "$code_b" == 0 ]] || { cat "$tmp/a.err" "$tmp/b.err" >&2; exit 1; }
expect "SELECT count(*) FROM r42_lab.payables;" 1
expect "SELECT customer_minor||':'||held_minor||':'||payable_minor||':'||uncommitted_minor FROM r42_lab.pool;" "0:0:2400:47600"
deny "SELECT r42_lab.reserve_gift('second-free','food-again','buyer','shop-b',100);" R42_GIFT_ALREADY_SPENT_OR_HELD
deny "UPDATE r42_lab.journal SET minor=1;" R42_APPEND_ONLY
expect "SELECT r42_lab.reconcile();" t
echo R42_POSTGRES_ONE_R24_FOOD_GIFT_NO_R1_REUSE_PASS

deny "SELECT r42_lab.record_bank_fixture('payable:final-hold','transfer-x','ref-x',2400,'synthetic-owner-admin');" R42_BANK_PROOF_UNAVAILABLE
deny "SELECT r42_lab.record_bank_fixture('payable:final-hold','transfer-x','ref-x',2400,'merchant');" R42_ADMIN_NOT_VERIFIED
pg -c "INSERT INTO r42_lab.bank_proofs VALUES('ref-x','transfer-x',2400,'SYNTHETIC_BANK_FIXTURE');" >/dev/null
race "SELECT r42_lab.record_bank_fixture('payable:final-hold','transfer-x','ref-x',2400,'synthetic-owner-admin');" "SELECT r42_lab.record_bank_fixture('payable:final-hold','transfer-x','ref-x',2400,'synthetic-owner-admin');"
[[ "$code_a" == 0 && "$code_b" == 0 ]] || { cat "$tmp/a.err" "$tmp/b.err" >&2; exit 1; }
expect "SELECT count(*) FROM r42_lab.transfers;" 1
expect "SELECT payable_minor||':'||paid_out_minor FROM r42_lab.pool;" "0:2400"
deny "SELECT r42_lab.record_merchant_receipt('payable:final-hold','my-kota','receipt','received');" R42_WRONG_MERCHANT
expect "SELECT r42_lab.record_merchant_receipt('payable:final-hold','shop-b','receipt','received');" RECEIPT_RECORDED
expect "SELECT r42_lab.record_merchant_receipt('payable:final-hold','shop-b','receipt','received');" REPLAY
expect "SELECT status FROM r42_lab.payables;" confirmed
deny "DELETE FROM r42_lab.transfers;" R42_APPEND_ONLY
expect "SELECT r42_lab.reconcile();" t
echo R42_POSTGRES_BANK_EVIDENCE_AND_MERCHANT_ACK_PASS
echo R42_DISPOSABLE_PG17_FINANCIAL_INTEGRITY_PASS
