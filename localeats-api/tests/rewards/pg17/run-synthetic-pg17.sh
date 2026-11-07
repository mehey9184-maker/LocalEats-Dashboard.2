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
  # The official image starts and stops a temporary init server; only use
  # the final service AFTER the initialization shutdown/restart has finished.
  if docker logs "$name" 2>&1 | grep -q 'PostgreSQL init process complete; ready for start up.' &&
    docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d rewards_lab -c 'SELECT 1' 2>/dev/null | grep -qx '1'; then
    ready=1
    break
  fi
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

# R2.3: add additive synthetic recovery tables to the SAME isolated PG17 only.
echo "R2.3 PG17: loading refund, cancellation and settlement recovery assertions"
run_file "$here/recovery-r23.SYNTHETIC_ONLY.sql" >"$tmp/recovery-schema.out"
reset
pg -c "UPDATE reward_lab.program SET limit_minor=20000 WHERE id=1;" >/dev/null
run_file "$here/recovery-r23-assertions.SYNTHETIC_ONLY.sql" >"$tmp/recovery-assertions.out"
grep -q 'R23_PG17_REFUND_AND_SETTLEMENT_ASSERTIONS_PASS' "$tmp/recovery-assertions.out"
assert_query "SELECT balanced FROM reward_lab.reconcile_allocated_budget();" "t"

# Simultaneous identical refund notifications must create exactly one hold/event.
reset
pg -c "INSERT INTO reward_lab.order_line_facts VALUES
  ('race-refund','line','race-customer','shop-1',4,true,true,true,false,false);" >/dev/null
pg -c "SELECT reward_lab.credit_paid_order('race-refund');" >/dev/null
paired \
 "SELECT reward_lab.record_verified_refund('race-refund-id','bank-ref-race','race-refund','line',1,'Verified synthetic refund');" \
 "SELECT reward_lab.record_verified_refund('race-refund-id','bank-ref-race','race-refund','line',1,'Verified synthetic refund');"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "concurrent refund replay failure" >&2; exit 1
fi
assert_query "SELECT count(*) FROM reward_lab.refund_events;" "1"
assert_query "SELECT count(*) FROM reward_lab.customer_holds;" "1"
assert_query "SELECT status FROM reward_lab.grants WHERE customer_id='race-customer';" "earned"
assert_query "SELECT count(*) FROM reward_lab.payables;" "0"
assert_query "SELECT allocated_minor FROM reward_lab.program WHERE id=1;" "2500"

# Competing partial refunds totalling more than the original qualifying
# quantity: precisely one commits; the loser rolls back with a specific error.
reset
pg -c "INSERT INTO reward_lab.order_line_facts VALUES
  ('race-partial','line','race-partial-user','shop-1',4,true,true,true,false,false);" >/dev/null
pg -c "SELECT reward_lab.credit_paid_order('race-partial');" >/dev/null
paired \
 "SELECT reward_lab.record_verified_refund('partial-ref-a','bank-partial-a','race-partial','line',3,'Partial refund A');" \
 "SELECT reward_lab.record_verified_refund('partial-ref-b','bank-partial-b','race-partial','line',3,'Partial refund B');"
success=0
if [[ "$status_a" -eq 0 ]]; then success=$((success+1)); else grep -q 'REFUND_UNITS_EXCEED_QUALIFIED_QUANTITY' "$tmp/a.err"; fi
if [[ "$status_b" -eq 0 ]]; then success=$((success+1)); else grep -q 'REFUND_UNITS_EXCEED_QUALIFIED_QUANTITY' "$tmp/b.err"; fi
if [[ "$success" -ne 1 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "partial refund over-count" >&2; exit 1
fi
assert_query "SELECT coalesce(sum(units),0) FROM reward_lab.refund_events;" "3"
assert_query "SELECT count(*) FROM reward_lab.customer_holds;" "1"

# Refund vs fulfil cannot create an inconsistent state regardless of which
# serialized transaction obtains the programme lock first.
reset
pg -c "INSERT INTO reward_lab.order_line_facts VALUES
  ('race-handover','line','race-handover-user','shop-1',4,true,true,true,false,false);" >/dev/null
pg -c "SELECT reward_lab.credit_paid_order('race-handover');" >/dev/null
paired \
 "SELECT reward_lab.record_verified_refund('handover-refund','bank-race-handover','race-handover','line',4,'Full synthetic refund');" \
 "SELECT reward_lab.fulfil_grant('reward:race-handover-user:bronze','race-handover-user','shop-1','kota-24','handover-race');"
if [[ "$status_a" -ne 0 ]]; then
  cat "$tmp/a.err" >&2; echo "refund did not commit" >&2; exit 1
fi
if [[ "$status_b" -ne 0 ]]; then
  grep -q 'CUSTOMER_REWARDS_ON_REFUND_HOLD' "$tmp/b.err"
fi
assert_query "SELECT count(*) FROM reward_lab.customer_holds;" "1"
assert_query "SELECT count(*) FROM reward_lab.grants;" "1"
assert_query "SELECT CASE WHEN (SELECT status FROM reward_lab.grants LIMIT 1)='fulfilled'
  THEN (SELECT count(*)=1 FROM reward_lab.payables)
  ELSE (SELECT count(*)=0 FROM reward_lab.payables) END;" "t"
assert_query "SELECT balanced FROM reward_lab.reconcile_allocated_budget();" "t"

# Simultaneous merchant acknowledgement of the same investigated dispute
# is idempotent and cannot double-settle.
reset
pg -c "INSERT INTO reward_lab.order_line_facts VALUES
  ('race-dispute','line','race-dispute-user','shop-1',4,true,true,true,false,false);" >/dev/null
pg -c "SELECT reward_lab.credit_paid_order('race-dispute');" >/dev/null
pg -c "SELECT reward_lab.fulfil_grant('reward:race-dispute-user:bronze','race-dispute-user','shop-1','kota-24','handover-dispute');" >/dev/null
pg -c "SELECT reward_lab.record_transfer('payable:reward:race-dispute-user:bronze','race-transfer','admin-a','BANK-RACE',2400);" >/dev/null
pg -c "SELECT reward_lab.confirm_merchant_receipt('payable:reward:race-dispute-user:bronze','shop-1','merchant-disputes','disputed');" >/dev/null
pg -c "SELECT reward_lab.document_dispute_resolution('race-resolution','payable:reward:race-dispute-user:bronze','admin-a','Reviewed synthetic bank proof');" >/dev/null
paired \
 "SELECT reward_lab.merchant_acknowledge_dispute_resolution('ack-same','race-resolution','shop-1');" \
 "SELECT reward_lab.merchant_acknowledge_dispute_resolution('ack-same','race-resolution','shop-1');"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "concurrent merchant dispute acknowledgement failure" >&2; exit 1
fi
assert_query "SELECT count(*) FROM reward_lab.dispute_merchant_acks;" "1"
assert_query "SELECT status FROM reward_lab.payables;" "confirmed"
assert_query "SELECT balanced FROM reward_lab.reconcile_allocated_budget();" "t"
echo "R23_PG17_REFUND_CONCURRENCY_AND_SETTLEMENT_PASS"

# R2.5: freeze menu/eligibility at purchase in a separate disposable PG17 schema.
echo "R2.5 PG17: snapshotting purchase-time menu revisions, refunds and order proof"
run_file "$here/purchase-r25.SYNTHETIC_ONLY.sql" >"$tmp/purchase-schema.out"
reset
run_file "$here/purchase-r25-assertions.SYNTHETIC_ONLY.sql" >"$tmp/purchase-assertions.out"
grep -q 'R25_PG17_PURCHASE_TIME_ELIGIBILITY_AND_REFUND_PASS' "$tmp/purchase-assertions.out"
assert_query "SELECT balanced FROM reward_lab.reconcile_allocated_budget();" "t"

# These are all PRIVATE synthetic facts, never a browser or connected Supabase.
setup_snapshot_race(){
  reset
  pg -c "INSERT INTO reward_lab.purchase_customers VALUES('race-proof-user',true,false) ON CONFLICT DO NOTHING;" >/dev/null
  pg -c "INSERT INTO reward_lab.shop_programmes VALUES('shop-1','race-v1',true,true,now()-interval '1 day');" >/dev/null
  pg -c "INSERT INTO reward_lab.menu_eligibility_current VALUES('shop-1','race-kota',1,2500,true);" >/dev/null
  pg -c "UPDATE reward_lab.program SET active=true,limit_minor=2500,allocated_minor=0 WHERE id=1;" >/dev/null
}
setup_snapshot_race
paired \
  "SELECT reward_lab.capture_purchase_at_checkout('race-purchase','race-proof-user','shop-1','[{\"item_id\":\"race-kota\",\"quantity\":4}]'::jsonb);" \
  "SELECT reward_lab.capture_purchase_at_checkout('race-purchase','race-proof-user','shop-1','[{\"item_id\":\"race-kota\",\"quantity\":4}]'::jsonb);"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "concurrent immutable checkout replay failed" >&2; exit 1
fi
assert_query "SELECT count(*) FROM reward_lab.purchase_captures;" "1"
assert_query "SELECT count(*) FROM reward_lab.purchase_line_snapshots;" "1"
pg -c "INSERT INTO reward_lab.pickup_source_events
(order_id,command_id,revision,kind,actor_uid) VALUES
('race-purchase','race-payment',1,'payment_confirmed','merchant-a'),
('race-purchase','race-collected',2,'collected','merchant-a');" >/dev/null
paired \
  "SELECT reward_lab.credit_snapshotted_pickup('race-purchase');" \
  "SELECT reward_lab.credit_snapshotted_pickup('race-purchase');"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "concurrent purchase credit failed" >&2; exit 1
fi
assert_query "SELECT count(*) FROM reward_lab.credited_lines;" "1"
assert_query "SELECT count(*) FROM reward_lab.grants;" "1"
assert_query "SELECT allocated_minor FROM reward_lab.program WHERE id=1;" "2500"
paired \
  "SELECT reward_lab.record_snapshot_refund('race-refund-notice','race-purchase','race-purchase:line:1','RACE-REF',1,'Synthetic merchant refund');" \
  "SELECT reward_lab.record_snapshot_refund('race-refund-notice','race-purchase','race-purchase:line:1','RACE-REF',1,'Synthetic merchant refund');"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "concurrent source refund replay failed" >&2; exit 1
fi
assert_query "SELECT count(*) FROM reward_lab.source_refund_notices;" "1"
assert_query "SELECT count(*) FROM reward_lab.refund_events;" "1"
assert_query "SELECT count(*) FROM reward_lab.customer_holds;" "1"
assert_query "SELECT status FROM reward_lab.grants LIMIT 1;" "earned"
assert_query "SELECT balanced FROM reward_lab.reconcile_allocated_budget();" "t"

# Menu edit and checkout compete on the same row. Snapshot must contain ALL
# attributes from either complete revision, never a mixed revision/price/flag.
setup_snapshot_race
paired \
  "BEGIN; UPDATE reward_lab.menu_eligibility_current SET revision=2,unit_minor=3100,qualifies_kota=false WHERE shop_id='shop-1' AND item_id='race-kota'; SELECT pg_sleep(0.4); COMMIT;" \
  "SELECT reward_lab.capture_purchase_at_checkout('race-menu','race-proof-user','shop-1','[{\"item_id\":\"race-kota\",\"quantity\":4}]'::jsonb);"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "checkout vs merchant menu edit failure" >&2; exit 1
fi
assert_query "SELECT CASE WHEN
 (menu_revision=1 AND unit_minor=2500 AND qualifying_kota=true) OR
 (menu_revision=2 AND unit_minor=3100 AND qualifying_kota=false)
 THEN true ELSE false END FROM reward_lab.purchase_line_snapshots WHERE order_id='race-menu';" "t"
assert_query "SELECT count(*) FROM reward_lab.purchase_line_snapshots WHERE order_id='race-menu';" "1"

# Refund vs reward credit serializes around the budget row and retains the
# correct state whether refund wins or the credit wins first.
setup_snapshot_race
pg -c "SELECT reward_lab.capture_purchase_at_checkout('race-credit-refund','race-proof-user','shop-1','[{\"item_id\":\"race-kota\",\"quantity\":4}]'::jsonb);" >/dev/null
pg -c "INSERT INTO reward_lab.pickup_source_events
(order_id,command_id,revision,kind,actor_uid) VALUES
('race-credit-refund','cr-payment',1,'payment_confirmed','merchant-a'),
('race-credit-refund','cr-collected',2,'collected','merchant-a');" >/dev/null
paired \
  "SELECT reward_lab.record_snapshot_refund('notice-race-credit','race-credit-refund','race-credit-refund:line:1','RC-BANK-REF',1,'Refund racing with credit');" \
  "SELECT reward_lab.credit_snapshotted_pickup('race-credit-refund');"
if [[ "$status_a" -ne 0 ]]; then
  cat "$tmp/a.err" >&2; echo "refund vs credit failed to record refund" >&2; exit 1
fi
if [[ "$status_b" -ne 0 ]]; then grep -q 'REFUND_REQUIRES_REVIEW' "$tmp/b.err"; fi
assert_query "SELECT count(*) FROM reward_lab.source_refund_notices;" "1"
assert_query "SELECT CASE WHEN (SELECT count(*) FROM reward_lab.grants)=0
 THEN (SELECT count(*) FROM reward_lab.credited_lines)=0
 ELSE (SELECT count(*) FROM reward_lab.credited_lines)=1 AND
      (SELECT count(*) FROM reward_lab.customer_holds)=1
 END;" "t"
assert_query "SELECT balanced FROM reward_lab.reconcile_allocated_budget();" "t"
assert_query "SELECT count(*) FROM reward_lab.payables;" "0"
echo "R25_PG17_CHECKOUT_MENU_AND_REFUND_CONCURRENCY_PASS"
