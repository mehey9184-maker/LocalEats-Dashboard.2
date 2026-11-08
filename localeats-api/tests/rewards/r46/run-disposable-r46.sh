#!/usr/bin/env bash
# R4.6 LOCALPAY -- synthetic, disposable localhost PostgreSQL 17 ONLY.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
r42="$(cd "$here/../r42" && pwd)"
if [[ "${LOCALPAY_R46_ISOLATED:-}" != "1" || "${PGHOST:-}" != "127.0.0.1" ||
  "${PGPORT:-}" != "5432" || "${PGDATABASE:-}" != "localpay_r46_disposable" ||
  "${PGUSER:-}" != "postgres" || "${PGSSLMODE:-}" != "disable" ||
  "${PGPASSWORD:-}" != "localpay-r46-synthetic-only" ||
  -n "${DATABASE_URL:-}" || -n "${DIRECT_URL:-}" || -n "${SUPABASE_URL:-}" ||
  -n "${SUPABASE_DB_URL:-}" || -n "${PGHOSTADDR:-}" ||
  -n "${PGSERVICE:-}" || -n "${PGSERVICEFILE:-}" ]]; then
 echo R46_REFUSED_NON_DISPOSABLE_DATABASE_ENVIRONMENT >&2; exit 2
fi
command -v psql >/dev/null || { echo R46_PSQL_REQUIRED >&2; exit 2; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
pg(){ psql -X -qAt -v ON_ERROR_STOP=1 "$@"; }
assert(){
 local got; got="$(pg -c "$1")"
 [[ "$got" == "$2" ]] || { echo "R46_ASSERT_FAILED expected=$2 got=$got query=$1" >&2; exit 1; }
}
deny(){
 local output
 if output="$(pg -c "$1" 2>&1)"; then echo "R46_UNEXPECTED_SUCCESS $1" >&2; exit 1; fi
 grep -Fq "$2" <<< "$output" || { echo "$output" >&2; exit 1; }
}
race(){
 pg -c "$1" >"$tmp/a.out" 2>"$tmp/a.err" & local pid_a=$!
 pg -c "$2" >"$tmp/b.out" 2>"$tmp/b.err" & local pid_b=$!
 if wait "$pid_a"; then code_a=0; else code_a=$?; fi
 if wait "$pid_b"; then code_b=0; else code_b=$?; fi
 if [[ "$code_a" != 0 || "$code_b" != 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; exit 1
 fi
}
buyer='pilot-customer-1'
secret='SYNTHETIC_ONLY_FAKE_CHALLENGE_128BIT_EXAMPLE_XYZ'
order1='550e8400-e29b-41d4-a716-000000000661'
order2='550e8400-e29b-41d4-a716-000000000662'
order3='550e8400-e29b-41d4-a716-000000000663'
order4='550e8400-e29b-41d4-a716-000000000664'
order5='550e8400-e29b-41d4-a716-000000000665'
assert "SELECT current_database();" localpay_r46_disposable
assert "SELECT current_setting('server_version_num')::int BETWEEN 170000 AND 179999;" t
assert "SELECT inet_server_addr() IS NOT NULL AND inet_client_addr() IS NOT NULL;" t
assert "SELECT to_regnamespace('r46_lab') IS NULL;" t
pg -f "$r42/ledger.SYNTHETIC_ONLY.sql" >/dev/null
pg -f "$here/trusted-evidence.SYNTHETIC_ONLY.sql" >/dev/null
assert "SELECT r42_lab.reconcile();" t
assert "SELECT has_schema_privilege('r46_browser','r46_lab','USAGE');" f
deny "SET ROLE r46_browser; SELECT r46_lab.inspect_candidate('$order1');" "permission denied"
deny "SET ROLE r46_browser; SELECT * FROM r46_lab.purchase_lines;" "permission denied"
deny "SET ROLE r46_browser; SELECT r42_lab.admit('spoof');" "permission denied"
echo R46_PRIVATE_SCHEMA_AND_UNTRUSTED_ROLE_DENIAL_PASS

assert "SELECT r46_lab.admit_mock_customer('$buyer','2026-11-07T09:00Z');" ADMITTED_WITH_MOCK_FUND_RESERVATION
assert "SELECT r46_lab.admit_mock_customer('$buyer','2026-11-07T09:00Z');" REPLAY
assert "SELECT reserved_minor||':'||uncommitted_minor FROM r42_lab.pool;" "2500:47500"
deny "SELECT r46_lab.capture_mock_order_and_line('$order5','$buyer','my-kota','2026-11-01T01:00Z',4,true);" R46_NO_RETROACTIVE_OR_UNCONSENTED_ELIGIBILITY

deny "INSERT INTO r46_lab.orders(order_id,customer_uid,shop_id,programme_version,
 created_at,intent_hash,total_minor) VALUES('$order5','$buyer','my-kota',
 'bronze-only-v1','2026-11-07T10:00Z',repeat('b',64),10000);" R46_ATOMIC_ELIGIBILITY_SNAPSHOT_REQUIRED
assert "SELECT count(*) FROM r46_lab.orders;" 0
assert "SELECT r46_lab.capture_mock_order_and_line('$order1','$buyer','my-kota',
 '2026-11-07T10:00Z',4,true);" ORDER_AND_IMMUTABLE_LINE_CAPTURED
assert "SELECT line_total_minor FROM r46_lab.purchase_lines WHERE order_id='$order1';" 10000
deny "UPDATE r46_lab.purchase_lines SET qualifying_kota=false WHERE order_id='$order1';" R46_APPEND_ONLY
deny "DELETE FROM r46_lab.purchase_lines WHERE order_id='$order1';" R46_APPEND_ONLY
deny "BEGIN; SELECT r46_lab.capture_mock_order_and_line('$order5','$buyer','my-kota','2026-11-07T10:00Z',1,true); SELECT 1/0; COMMIT;" "division by zero"
assert "SELECT count(*) FROM r46_lab.orders;" 1
assert "SELECT count(*) FROM r46_lab.purchase_lines;" 1
echo R46_ATOMIC_PURCHASE_SNAPSHOT_AND_ROLLBACK_PASS

assert "SELECT r46_lab.inspect_candidate('$order1');" BLOCKED_INVALID_SOURCE_ORDER_OR_CONSENT
deny "SELECT r46_lab.attach_mock_paid_collection('$order1',
 '550e8400-e29b-41d4-a716-000000000671',
 '550e8400-e29b-41d4-a716-000000000672','merchant-2',
 '2026-11-07T10:05Z','2026-11-07T10:10Z','FAKE-CASH-1');" R46_MOCK_PAYMENT_COLLECTION_INVALID
assert "SELECT r46_lab.issue_mock_challenge(
 '550e8400-e29b-41d4-a716-000000000681','$order1','$buyer','$secret',
 '2026-11-07T10:03Z','2026-11-07T10:13Z');" MOCK_CHALLENGE_ISSUED_DIGEST_ONLY
assert "SELECT count(*) FROM information_schema.columns
 WHERE table_schema='r46_lab' AND table_name='pickup_challenges'
 AND column_name IN ('raw_code','plaintext_pin','secret','otp');" 0
assert "SELECT length(secret_digest) FROM r46_lab.pickup_challenges WHERE order_id='$order1';" 64
assert "SELECT r46_lab.attach_mock_paid_collection('$order1',
 '550e8400-e29b-41d4-a716-000000000671',
 '550e8400-e29b-41d4-a716-000000000672','merchant-1',
 '2026-11-07T10:05Z','2026-11-07T10:10Z','FAKE-CASH-1');" MOCK_EVENTS_ATTACHED_NOT_REAL_PAYMENT
assert "SELECT r46_lab.inspect_candidate('$order1');" BLOCKED_PAYMENT_PICKUP_OR_CODE_PROOF
echo R46_MERCHANT_PAID_AND_COLLECTED_FLAGS_ALONE_BLOCKED_PASS

race \
 "SELECT r46_lab.consume_mock_challenge('$order1','$secret','550e8400-e29b-41d4-a716-000000000691','2026-11-07T10:07Z');" \
 "SELECT r46_lab.consume_mock_challenge('$order1','$secret','550e8400-e29b-41d4-a716-000000000692','2026-11-07T10:07Z');"
both="$(cat "$tmp/a.out" "$tmp/b.out")"
[[ "$(grep -Fc MOCK_SINGLE_USE_HANDOVER_PROVEN <<< "$both")" == 1 ]] || { echo R46_DOUBLE_CONSUMPTION >&2; exit 1; }
[[ "$(grep -Fc BLOCKED_CHALLENGE_ALREADY_CONSUMED <<< "$both")" == 1 ]] || { echo R46_NOT_BLOCKED_REUSE >&2; exit 1; }
assert "SELECT count(*) FROM r46_lab.audit_log WHERE action='mock-challenge-consumed' AND order_id='$order1';" 1
echo R46_TWO_CONNECTIONS_ONE_CUSTOMER_HANDOVER_PASS

race "SELECT r46_lab.inspect_candidate('$order1');" \
     "SELECT r46_lab.inspect_candidate('$order1');"
both="$(cat "$tmp/a.out" "$tmp/b.out")"
[[ "$(grep -Fc PASS_CANDIDATE_REVIEW_ONLY <<< "$both")" == 1 ]] || { echo R46_DUPLICATE_CANDIDATES >&2; exit 1; }
[[ "$(grep -Fc REPLAY_REVIEW_ONLY <<< "$both")" == 1 ]] || { echo R46_NON_IDEMPOTENT_DECISION >&2; exit 1; }
assert "SELECT count(*) FROM r46_lab.evidence_decisions WHERE order_id='$order1' AND status='candidate' AND can_grant=false;" 1
assert "SELECT count(*) FROM r42_lab.grants;" 0
assert "SELECT count(*) FROM r42_lab.payables;" 0
assert "SELECT r42_lab.reconcile();" t
echo R46_IDEMPOTENT_REVIEW_ONLY_NO_GRANT_OR_SHOP_DEBT_PASS

assert "SELECT r46_lab.report_mock_refund('$order1','550e8400-e29b-41d4-a716-000000000693','2026-11-07T10:12Z');" MOCK_REFUND_REVIEW_OPEN
assert "SELECT status FROM r46_lab.evidence_decisions WHERE order_id='$order1';" review_pending
assert "SELECT r46_lab.inspect_candidate('$order1');" BLOCKED_REFUND_REVIEW
echo R46_REFUND_PAUSES_EARLIER_REVIEW_NO_SILENT_CLAWBACK_PASS

assert "SELECT r46_lab.capture_mock_order_and_line('$order2','$buyer','my-kota','2026-11-07T11:00Z',1,true);" ORDER_AND_IMMUTABLE_LINE_CAPTURED
assert "SELECT r46_lab.issue_mock_challenge('550e8400-e29b-41d4-a716-000000000683',
 '$order2','$buyer','SYNTHETIC_ANOTHER_FAKE_CHALLENGE_A1',
 '2026-11-07T11:02Z','2026-11-07T11:12Z');" MOCK_CHALLENGE_ISSUED_DIGEST_ONLY
for n in $(seq 1 5); do
 assert "SELECT r46_lab.consume_mock_challenge('$order2','THIS_IS_A_WRONG_CHALLENGE_999',
 '550e8400-e29b-41d4-a716-00000000069$n','2026-11-07T11:05Z');" BLOCKED_WRONG_CHALLENGE
done
assert "SELECT attempts FROM r46_lab.pickup_challenges WHERE order_id='$order2';" 5
assert "SELECT r46_lab.consume_mock_challenge('$order2','SYNTHETIC_ANOTHER_FAKE_CHALLENGE_A1',
 '550e8400-e29b-41d4-a716-000000000697','2026-11-07T11:06Z');" BLOCKED_EXPIRED_OR_ATTEMPT_CAP
assert "SELECT r46_lab.capture_mock_order_and_line('$order3','$buyer','my-kota','2026-11-07T12:00Z',1,true);" ORDER_AND_IMMUTABLE_LINE_CAPTURED
assert "SELECT r46_lab.issue_mock_challenge('550e8400-e29b-41d4-a716-000000000684',
 '$order3','$buyer','SYNTHETIC_EXPIRED_FAKE_CHALLENGE_A1',
 '2026-11-07T12:02Z','2026-11-07T12:12Z');" MOCK_CHALLENGE_ISSUED_DIGEST_ONLY
assert "SELECT r46_lab.consume_mock_challenge('$order3','SYNTHETIC_EXPIRED_FAKE_CHALLENGE_A1',
 '550e8400-e29b-41d4-a716-000000000698','2026-11-07T12:13Z');" BLOCKED_EXPIRED_OR_ATTEMPT_CAP
echo R46_PICKUP_TOKEN_ATTEMPT_CAP_AND_EXPIRY_PASS

assert "SELECT r46_lab.capture_mock_order_and_line('$order4','$buyer','my-kota','2026-11-07T13:00Z',4,true);" ORDER_AND_IMMUTABLE_LINE_CAPTURED
assert "SELECT r46_lab.issue_mock_challenge('550e8400-e29b-41d4-a716-000000000685',
 '$order4','$buyer','SYNTHETIC_REFUND_RACE_FAKE_CHALLENGE',
 '2026-11-07T13:03Z','2026-11-07T13:13Z');" MOCK_CHALLENGE_ISSUED_DIGEST_ONLY
assert "SELECT r46_lab.attach_mock_paid_collection('$order4',
 '550e8400-e29b-41d4-a716-000000000675','550e8400-e29b-41d4-a716-000000000676',
 'merchant-1','2026-11-07T13:05Z','2026-11-07T13:10Z','FAKE-CASH-4');" MOCK_EVENTS_ATTACHED_NOT_REAL_PAYMENT
assert "SELECT r46_lab.consume_mock_challenge('$order4','SYNTHETIC_REFUND_RACE_FAKE_CHALLENGE',
 '550e8400-e29b-41d4-a716-000000000699','2026-11-07T13:07Z');" MOCK_SINGLE_USE_HANDOVER_PROVEN
race "SELECT r46_lab.inspect_candidate('$order4');" \
 "SELECT r46_lab.report_mock_refund('$order4',
 '550e8400-e29b-41d4-a716-0000000006a0','2026-11-07T13:12Z');"
grep -Fq MOCK_REFUND_REVIEW_OPEN "$tmp/b.out" || { echo R46_REFUND_NOT_RECORDED >&2; exit 1; }
grep -Eq 'PASS_CANDIDATE_REVIEW_ONLY|BLOCKED_REFUND_REVIEW' "$tmp/a.out" || { cat "$tmp/a.out" >&2; exit 1; }
assert "SELECT count(*) FROM r46_lab.refund_reviews WHERE order_id='$order4';" 1
assert "SELECT count(*) FROM r46_lab.evidence_decisions WHERE order_id='$order4' AND status='candidate';" 0
assert "SELECT r46_lab.inspect_candidate('$order4');" BLOCKED_REFUND_REVIEW
assert "SELECT r42_lab.reconcile();" t
assert "SELECT reserved_minor||':'||uncommitted_minor FROM r42_lab.pool;" "2500:47500"
assert "SELECT count(*) FROM r42_lab.grants;" 0
assert "SELECT count(*) FROM r42_lab.payables;" 0
deny "UPDATE r46_lab.refund_reviews SET status='verified';" R46_APPEND_ONLY
deny "UPDATE r46_lab.pickup_events SET actor_uid='merchant-2';" R46_APPEND_ONLY
echo R46_REFUND_VS_CANDIDATE_ORDER_ROW_LOCK_RACE_PASS
echo R46_DISPOSABLE_PG17_FINANCIAL_EVIDENCE_TESTS_PASS
