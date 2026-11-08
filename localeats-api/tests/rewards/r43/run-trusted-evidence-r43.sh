#!/usr/bin/env bash
# LocalPay R4.3: PG17 scratch only. No connected Supabase or real orders.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
r42="$(cd "$here/../r42" && pwd)"
if [[ "${LOCALPAY_R43_ISOLATED:-}" != 1 || "${PGHOST:-}" != 127.0.0.1 ||
 "${PGPORT:-}" != 5432 || "${PGDATABASE:-}" != localpay_r43_disposable ||
 "${PGUSER:-}" != postgres || "${PGSSLMODE:-}" != disable ||
 "${PGPASSWORD:-}" != localpay-r43-synthetic-only || -n "${DATABASE_URL:-}" ||
 -n "${DIRECT_URL:-}" || -n "${SUPABASE_URL:-}" || -n "${SUPABASE_DB_URL:-}" ||
 -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" || -n "${PGSERVICEFILE:-}" ]]; then
 echo R43_REFUSED_NON_DISPOSABLE_DATABASE_ENVIRONMENT >&2; exit 2
fi
command -v psql >/dev/null || { echo R43_PSQL_REQUIRED >&2; exit 2; }
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
pg(){ psql -X -qAt -v ON_ERROR_STOP=1 "$@"; }
assert(){
 local got
 got="$(pg -c "$1")"
 [[ "$got" == "$2" ]] || { echo "R43_ASSERT_FAILED expected=$2 got=$got query=$1" >&2; exit 1; }
}
deny(){
 local output
 if output="$(pg -c "$1" 2>&1)"; then echo "R43_UNEXPECTED_SUCCESS $1" >&2; exit 1; fi
 grep -Fq "$2" <<< "$output" || { echo "$output" >&2; exit 1; }
}
race(){
 pg -c "$1" >"$work/a.out" 2>"$work/a.err" & local pid_a=$!
 pg -c "$2" >"$work/b.out" 2>"$work/b.err" & local pid_b=$!
 if wait "$pid_a"; then status_a=0; else status_a=$?; fi
 if wait "$pid_b"; then status_b=0; else status_b=$?; fi
}
assert "SELECT current_database();" localpay_r43_disposable
assert "SELECT current_setting('server_version_num')::int BETWEEN 170000 AND 179999;" t
assert "SELECT inet_server_addr() IS NOT NULL AND inet_client_addr() IS NOT NULL;" t
pg -f "$r42/ledger.SYNTHETIC_ONLY.sql" >/dev/null
pg -f "$here/trusted-source.SYNTHETIC_ONLY.sql" >/dev/null
assert "SELECT r42_lab.reconcile();" t
assert "SELECT has_schema_privilege('r43_untrusted','r43_lab','USAGE');" f
deny "SET ROLE r43_untrusted; SELECT r43_lab.credit_from_verified_source('order-valid');" "permission denied"
deny "SET ROLE r43_untrusted; SELECT * FROM r43_lab.verified_sessions;" "permission denied"
deny "SET ROLE r43_untrusted; SELECT r42_lab.credit_paid_collected('x','line','customer-1','my-kota',4,true,true,false,false,false);" "permission denied"
assert "SELECT r42_lab.admit('customer-1');" ADMITTED
echo R43_PRIVATE_SOURCE_NO_BROWSER_CREDIT_AUTHORITY_PASS

cases=(
 "unpaid:R43_NOT_AUTHENTIC_PAID_COLLECTED_ORDER"
 "uncollected:R43_NOT_AUTHENTIC_PAID_COLLECTED_ORDER"
 "simulated:R43_NOT_AUTHENTIC_PAID_COLLECTED_ORDER"
 "test-account:R43_NOT_AUTHENTIC_PAID_COLLECTED_ORDER"
 "delivery:R43_NOT_AUTHENTIC_PAID_COLLECTED_ORDER"
 "before-programme:R43_SHOP_NOT_ELIGIBLE_AT_PURCHASE"
 "revoked-session:R43_AUTHENTICATED_SHOP_ACTOR_REQUIRED"
 "browser-session:R43_AUTHENTICATED_SHOP_ACTOR_REQUIRED"
 "wrong-merchant:R43_AUTHENTICATED_SHOP_ACTOR_REQUIRED"
 "other-shop:R43_AUTHENTICATED_SHOP_ACTOR_REQUIRED"
 "missing-payment:R43_PAYMENT_AND_COLLECTION_EVENTS_REQUIRED"
 "missing-handover:R43_PAYMENT_AND_COLLECTION_EVENTS_REQUIRED"
 "reverse-events:R43_PAYMENT_AND_COLLECTION_EVENTS_REQUIRED"
 "missing-code:R43_CUSTOMER_HANDOVER_CONFIRMATION_REQUIRED"
 "wrong-customer-code:R43_CUSTOMER_HANDOVER_CONFIRMATION_REQUIRED"
 "wrong-shop-code:R43_CUSTOMER_HANDOVER_CONFIRMATION_REQUIRED"
 "request-body-code:R43_CUSTOMER_HANDOVER_CONFIRMATION_REQUIRED"
 "unverified-code:R43_CUSTOMER_HANDOVER_CONFIRMATION_REQUIRED"
 "refunded:R43_REFUND_OR_DISPUTE_REQUIRES_REVIEW"
 "reward-funded:R43_IMMUTABLE_PAID_ITEM_EVIDENCE_REQUIRED"
 "wrong-snapshot-shop:R43_IMMUTABLE_PAID_ITEM_EVIDENCE_REQUIRED"
 "client-snapshot:R43_IMMUTABLE_PAID_ITEM_EVIDENCE_REQUIRED"
 "ineligible:R43_NO_QUALIFYING_BOUGHT_KOTA"
)
for entry in "${cases[@]}"; do
 variant="${entry%%:*}"
 expected="${entry#*:}"
 assert "SELECT r43_lab.seed_fixture('$variant');" "order-$variant"
 deny "SELECT r43_lab.credit_from_verified_source('order-$variant');" "$expected"
done
deny "SELECT r43_lab.credit_from_verified_source('missing-order');" R43_NOT_AUTHENTIC_PAID_COLLECTED_ORDER
assert "SELECT count(*) FROM r42_lab.purchases;" 0
assert "SELECT count(*) FROM r42_lab.grants;" 0
assert "SELECT reserved_minor||':'||customer_minor FROM r42_lab.pool;" "2500:0"
assert "SELECT r42_lab.reconcile();" t
echo R43_23_FORGED_PAYMENT_REFUND_AND_SHOP_CASES_REJECTED_PASS

assert "SELECT r43_lab.seed_fixture('valid');" order-valid
deny "BEGIN; UPDATE r43_lab.shops SET approved=false WHERE shop_id='my-kota';
 SELECT r43_lab.credit_from_verified_source('order-valid'); COMMIT;" R43_SHOP_NOT_ELIGIBLE_AT_PURCHASE
deny "BEGIN; UPDATE r43_lab.shops SET participating=false WHERE shop_id='my-kota';
 SELECT r43_lab.credit_from_verified_source('order-valid'); COMMIT;" R43_SHOP_NOT_ELIGIBLE_AT_PURCHASE
deny "BEGIN; UPDATE r43_lab.customers SET anonymous=true WHERE uid='customer-1';
 SELECT r43_lab.credit_from_verified_source('order-valid'); COMMIT;" R43_CUSTOMER_NOT_VERIFIED
deny "BEGIN; UPDATE r43_lab.customers SET registered=false WHERE uid='customer-1';
 SELECT r43_lab.credit_from_verified_source('order-valid'); COMMIT;" R43_CUSTOMER_NOT_VERIFIED
deny "UPDATE r43_lab.pickup_events SET session_id='sess-owner';" R43_SOURCE_IMMUTABLE
deny "DELETE FROM r43_lab.lines WHERE order_id='order-valid';" R43_SOURCE_IMMUTABLE
deny "UPDATE r43_lab.customer_pickup_proofs SET verified=false;" R43_SOURCE_IMMUTABLE
assert "SELECT r42_lab.reconcile();" t
echo R43_SHOP_CUSTOMER_MUTATION_AND_IMMUTABLE_EVIDENCE_GATES_PASS

race "SELECT r43_lab.credit_from_verified_source('order-valid');" \
 "SELECT r43_lab.credit_from_verified_source('order-valid');"
[[ "$status_a" == 0 && "$status_b" == 0 ]] || { cat "$work/a.err" "$work/b.err" >&2; exit 1; }
assert "SELECT count(*) FROM r42_lab.purchases;" 1
assert "SELECT count(*) FROM r42_lab.grants;" 1
assert "SELECT bought_units FROM r42_lab.customers WHERE customer_id='customer-1';" 4
assert "SELECT count(*) FROM r43_lab.credit_audit WHERE order_id='order-valid';" 1
assert "SELECT reserved_minor||':'||customer_minor FROM r42_lab.pool;" "0:2500"
assert "SELECT r42_lab.reconcile();" t
echo R43_TWO_PG_CONNECTIONS_ONE_VERIFIED_ORDER_ONE_BRONZE_GRANT_PASS

assert "SELECT r43_lab.record_refund_fixture('order-valid','refund-later');" REFUND_REVIEW_OPEN
deny "SELECT r43_lab.credit_from_verified_source('order-valid');" R43_REFUND_OR_DISPUTE_REQUIRES_REVIEW
assert "SELECT count(*) FROM r42_lab.grants;" 1
assert "SELECT count(*) FROM r42_lab.payables;" 0
assert "SELECT r42_lab.reconcile();" t
echo R43_LATER_REFUND_BLOCKS_AUTO_REPLAY_NO_AUTOMATIC_GIFT_CLAWBACK_PASS

# Refund-report and claim racing on the same order must serialize on its row.
# Depending which session locks first, either credit succeeds before a review
# opens or credit is rejected. It cannot credit AFTER the refund is recorded.
assert "SELECT r42_lab.admit('customer-2');" ADMITTED
assert "SELECT r43_lab.seed_fixture('race-refund');" order-race-refund
race "SELECT r43_lab.credit_from_verified_source('order-race-refund');" \
 "SELECT r43_lab.record_refund_fixture('order-race-refund','race-refund-report');"
[[ "$status_b" == 0 ]] || { cat "$work/b.err" >&2; exit 1; }
if [[ "$status_a" != 0 ]]; then
 grep -Fq R43_REFUND_OR_DISPUTE_REQUIRES_REVIEW "$work/a.err" ||
 { cat "$work/a.err" >&2; exit 1; }
fi
assert "SELECT count(*) FROM r43_lab.refund_reviews WHERE order_id='order-race-refund';" 1
deny "SELECT r43_lab.credit_from_verified_source('order-race-refund');" R43_REFUND_OR_DISPUTE_REQUIRES_REVIEW
assert "SELECT (SELECT bought_units FROM r42_lab.customers WHERE customer_id='customer-2') IN (0,4);" t
assert "SELECT count(*) <= 1 FROM r42_lab.grants WHERE customer_id='customer-2';" t
assert "SELECT r42_lab.reconcile();" t
echo R43_REFUND_VS_CREDIT_SAME_ORDER_LOCK_RACE_PASS
echo R43_DISPOSABLE_PG17_TRUSTED_PAYMENT_PICKUP_EVIDENCE_PASS
