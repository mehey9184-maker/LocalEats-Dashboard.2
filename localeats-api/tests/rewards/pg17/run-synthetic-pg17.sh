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

# R2.8: private schema is NEW and ISOLATED in the same scratch PostgreSQL 17.
# It is NOT a hosted Supabase schema, not in migrations and not Production SQL.
echo "R2.8 PG17: private ledger, budget commitments, refunds and access denial"
run_file "$here/private-r28.SYNTHETIC_ONLY.sql" >"$tmp/private-r28-schema.out"
run_file "$here/private-r28-assertions.SYNTHETIC_ONLY.sql" >"$tmp/private-r28-assertions.out"
grep -q 'R28_PRIVATE_PG17_DETERMINISTIC_FINANCE_AND_PRIVILEGES_PASS' "$tmp/private-r28-assertions.out"
assert_query "SELECT balanced FROM r28_private.reconcile_commitment();" "t"

reset_r28(){
  pg -c "TRUNCATE r28_private.programme, r28_private.customers, r28_private.shops,
     r28_private.admins, r28_private.audit_events RESTART IDENTITY CASCADE;" >/dev/null 2>&1
  pg -c "INSERT INTO r28_private.programme(version,active,budget_minor,committed_minor)
     VALUES('pilot-v1',true,2500,0);" >/dev/null
  pg -c "INSERT INTO r28_private.customers(customer_uid,registered,is_test) VALUES
     ('race-user-1',true,false),('race-user-2',true,false);" >/dev/null
  pg -c "INSERT INTO r28_private.shops(shop_id,owner_uid,approval_status)
     VALUES('shop-1','merchant-1','approved');" >/dev/null
  pg -c "INSERT INTO r28_private.shop_enrolments(shop_id,version,enrolled_at,enabled)
     VALUES('shop-1','pilot-v1',now()-interval '1 day',true);" >/dev/null
  pg -c "INSERT INTO r28_private.menu_current(shop_id,item_id,revision,unit_minor,eligible_kota,kind)
     VALUES('shop-1','kota',1,2500,true,'standard_kota'),
           ('shop-1','kota2',1,2500,true,'standard_kota');" >/dev/null
  pg -c "INSERT INTO r28_private.admins(uid,role,active)
     VALUES('admin-1','super_admin',true);" >/dev/null
}
r28_pickup(){
  local order="$1" prefix="$2"
  pg -c "SELECT r28_private.record_pickup_event('$order','$prefix-pay','payment_confirmed',1,'merchant-1');" >/dev/null
  pg -c "SELECT r28_private.record_pickup_event('$order','$prefix-collected','collected',2,'merchant-1');" >/dev/null
}
reset_r28
# Same checkout ID in separate database processes: one immutable snapshot.
paired \
 "SELECT r28_private.capture_checkout('race-order','race-user-1','shop-1','[{\"item_id\":\"kota\",\"quantity\":4}]'::jsonb);" \
 "SELECT r28_private.capture_checkout('race-order','race-user-1','shop-1','[{\"item_id\":\"kota\",\"quantity\":4}]'::jsonb);"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "R28 parallel checkout replay FAILED" >&2; exit 1
fi
assert_query "SELECT count(*) FROM r28_private.orders;" "1"
assert_query "SELECT count(*) FROM r28_private.purchase_lines;" "1"
r28_pickup race-order r1
paired \
 "SELECT r28_private.credit_collected_order('race-order');" \
 "SELECT r28_private.credit_collected_order('race-order');"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "R28 parallel duplicate credit FAILED" >&2; exit 1
fi
assert_query "SELECT count(*) FROM r28_private.credits;" "1"
assert_query "SELECT count(*) FROM r28_private.grants;" "1"
assert_query "SELECT committed_minor FROM r28_private.programme;" "2500"
assert_query "SELECT balanced FROM r28_private.reconcile_commitment();" "t"

# Two customers compete for one R25 owner commitment: exactly one wins.
reset_r28
pg -c "SELECT r28_private.capture_checkout('race-a','race-user-1','shop-1','[{\"item_id\":\"kota\",\"quantity\":4}]'::jsonb);" >/dev/null
pg -c "SELECT r28_private.capture_checkout('race-b','race-user-2','shop-1','[{\"item_id\":\"kota\",\"quantity\":4}]'::jsonb);" >/dev/null
r28_pickup race-a a
r28_pickup race-b b
paired \
 "SELECT r28_private.credit_collected_order('race-a');" \
 "SELECT r28_private.credit_collected_order('race-b');"
r28_wins=0
if [[ "$status_a" -eq 0 ]]; then r28_wins=$((r28_wins+1)); else grep -q 'R28_REWARD_BUDGET_EXHAUSTED' "$tmp/a.err"; fi
if [[ "$status_b" -eq 0 ]]; then r28_wins=$((r28_wins+1)); else grep -q 'R28_REWARD_BUDGET_EXHAUSTED' "$tmp/b.err"; fi
if [[ "$r28_wins" -ne 1 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "R28 owner budget overcommitted" >&2; exit 1
fi
assert_query "SELECT count(*) FROM r28_private.credits;" "1"
assert_query "SELECT count(*) FROM r28_private.grants;" "1"
assert_query "SELECT committed_minor FROM r28_private.programme;" "2500"
assert_query "SELECT balanced FROM r28_private.reconcile_commitment();" "t"

# Multi-line (4+20 units) must roll back the ENTIRE transaction if budget
# cannot pay both Bronze R25 and Silver R125 commitments.
reset_r28
pg -c "SELECT r28_private.capture_checkout('race-multiline','race-user-1','shop-1',
 '[{\"item_id\":\"kota\",\"quantity\":4},{\"item_id\":\"kota2\",\"quantity\":20}]'::jsonb);" >/dev/null
r28_pickup race-multiline multi
if pg -c "SELECT r28_private.credit_collected_order('race-multiline');" >"$tmp/r28-budget.out" 2>"$tmp/r28-budget.err"; then
 echo "R28 partial multi-line budget failure was incorrectly accepted" >&2; exit 1
fi
grep -q 'R28_REWARD_BUDGET_EXHAUSTED' "$tmp/r28-budget.err"
assert_query "SELECT count(*) FROM r28_private.credits;" "0"
assert_query "SELECT count(*) FROM r28_private.grants;" "0"
assert_query "SELECT count(*) FROM r28_private.progress;" "0"
assert_query "SELECT committed_minor FROM r28_private.programme;" "0"

# Refund/credit order is serialized: refund first rejects credit, or credit
# first keeps grant reserved and creates a customer hold. Never double-award.
reset_r28
pg -c "SELECT r28_private.capture_checkout('race-refund','race-user-1','shop-1',
 '[{\"item_id\":\"kota\",\"quantity\":4}]'::jsonb);" >/dev/null
r28_pickup race-refund ref
paired \
 "SELECT r28_private.record_verified_refund('refund-race','race-refund','race-refund:line:1',1,
  'merchant-1','admin-1','Verified synthetic shop refund');" \
 "SELECT r28_private.credit_collected_order('race-refund');"
if [[ "$status_a" -ne 0 ]]; then
  cat "$tmp/a.err" >&2; echo "R28 refund source failed" >&2; exit 1
fi
if [[ "$status_b" -ne 0 ]]; then
  grep -q 'R28_REFUNDED_OR_HELD' "$tmp/b.err"
fi
assert_query "SELECT count(*) FROM r28_private.refund_events;" "1"
assert_query "SELECT CASE WHEN (SELECT count(*) FROM r28_private.grants)=0
 THEN (SELECT count(*) FROM r28_private.credits)=0
 ELSE (SELECT count(*) FROM r28_private.credits)=1 AND
      (SELECT count(*) FROM r28_private.refund_holds)=1
 END;" "t"
assert_query "SELECT balanced FROM r28_private.reconcile_commitment();" "t"

# Menu UPDATE and checkout race, but saved price and eligibility always come
# from ONE complete revision (never a Frankenstein price/eligibility snapshot).
reset_r28
paired \
 "BEGIN; UPDATE r28_private.menu_current SET revision=2,unit_minor=3300,
  eligible_kota=false WHERE shop_id='shop-1' AND item_id='kota';
  SELECT pg_sleep(0.4); COMMIT;" \
 "SELECT r28_private.capture_checkout('race-menu','race-user-1','shop-1',
  '[{\"item_id\":\"kota\",\"quantity\":4}]'::jsonb);"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
  cat "$tmp/a.err" "$tmp/b.err" >&2; echo "R28 menu vs checkout FAILED" >&2; exit 1
fi
assert_query "SELECT CASE WHEN
 (menu_revision=1 AND unit_minor=2500 AND qualifies_kota=true) OR
 (menu_revision=2 AND unit_minor=3300 AND qualifies_kota=false)
 THEN true ELSE false END FROM r28_private.purchase_lines WHERE order_id='race-menu';" "t"
assert_query "SELECT count(*) FROM r28_private.purchase_lines WHERE order_id='race-menu';" "1"

# Final check of scratch schema access: read, write, functions and public grant
# all denied for an explicit untrusted role.
assert_query "SELECT has_schema_privilege('r28_untrusted','r28_private','USAGE');" "f"
assert_query "SELECT has_table_privilege('r28_untrusted','r28_private.orders','INSERT');" "f"
assert_query "SELECT has_function_privilege('r28_untrusted',
 'r28_private.credit_collected_order(text)','EXECUTE');" "f"
echo "R28_PRIVATE_PG17_CONCURRENCY_BUDGET_AND_ACCESS_PASS"

# R2.9 is a distinct isolated lab that mimics the *types* of real pickup
# source contracts; it does not read or modify connected Supabase data.
echo "R2.9 PG17: UUID pickup source, private source FKs and actual role switching"
run_file "$here/compat-r29.SYNTHETIC_ONLY.sql" >"$tmp/r29-schema.out"
run_file "$here/compat-r29-assertions.SYNTHETIC_ONLY.sql" >"$tmp/r29-assertions.out"
grep -q 'R29_UUID_IDENTITY_PRIVATE_RLS_AND_SNAPSHOT_PASS' "$tmp/r29-assertions.out"
assert_query "SELECT committed_minor FROM r29_private.programme WHERE version='future-pilot';" "2500"

# Confirm actual execution permissions under these nonlogin roles, not merely
# querying information_schema. The test owner may SET ROLE inside the scratch DB.
expect_r29_denied(){
  local candidate="$1"
  if pg -c "$candidate" >"$tmp/r29-denied.out" 2>"$tmp/r29-denied.err"; then
    echo "R29 UNEXPECTED SQL ACCESS: $candidate" >&2
    exit 1
  fi
  if ! grep -q "permission denied" "$tmp/r29-denied.err"; then
    cat "$tmp/r29-denied.err" >&2
    echo "R29 denied for unexpected reason" >&2
    exit 1
  fi
}
assert_query "SET ROLE r29_observer; SELECT feature_status FROM r29_private.safe_status;" "not-live"
expect_r29_denied "SET ROLE r29_browser; SELECT feature_status FROM r29_private.safe_status;"
expect_r29_denied "SET ROLE r29_browser; INSERT INTO r29_private.progress(customer_uid) VALUES('alice');"
expect_r29_denied "SET ROLE r29_observer; SELECT count(*) FROM r29_private.purchase_lines;"
expect_r29_denied "SET ROLE r29_observer; UPDATE r29_private.programme SET active=true;"
expect_r29_denied "SET ROLE r29_observer; SELECT r29_private.credit_from_pickup('00000000-0000-4000-8000-000000000029'::uuid);"

# A failed SERIALIZABLE transaction MUST roll back, and a retried decision
# must re-evaluate funding. Two independent sessions start with the same
# original snapshot, then compete for the single R25 budget row.
paired \
 "BEGIN ISOLATION LEVEL SERIALIZABLE;
  SELECT reserved_minor FROM r29_private.isolation_budget WHERE id=1;
  SELECT pg_sleep(0.6);
  SELECT r29_private.reserve_isolation_budget('serial-a',2500);
  COMMIT;" \
 "BEGIN ISOLATION LEVEL SERIALIZABLE;
  SELECT reserved_minor FROM r29_private.isolation_budget WHERE id=1;
  SELECT pg_sleep(0.6);
  SELECT r29_private.reserve_isolation_budget('serial-b',2500);
  COMMIT;"
r29_winner=""
r29_loser=""
if [[ "$status_a" -eq 0 && "$status_b" -ne 0 ]]; then
  r29_winner="serial-a"
  r29_loser="serial-b"
  grep -q 'could not serialize access' "$tmp/b.err"
elif [[ "$status_b" -eq 0 && "$status_a" -ne 0 ]]; then
  r29_winner="serial-b"
  r29_loser="serial-a"
  grep -q 'could not serialize access' "$tmp/a.err"
else
  echo "Expected one SERIALIZABLE winner and one conflict" >&2
  cat "$tmp/a.err" "$tmp/b.err" >&2
  exit 1
fi
assert_query "SELECT count(*) FROM r29_private.isolation_claims;" "1"
assert_query "SELECT reserved_minor FROM r29_private.isolation_budget WHERE id=1;" "2500"
# Idempotent replay is allowed for the winning claim only.
assert_query "SELECT r29_private.reserve_isolation_budget('$r29_winner',2500);" "$r29_winner"
if pg -c "SELECT r29_private.reserve_isolation_budget('$r29_loser',2500);" >"$tmp/r29-retry.out" 2>"$tmp/r29-retry.err"; then
  echo "R29 unfunded serialization retry was incorrectly accepted" >&2
  exit 1
fi
grep -q 'R29_ISOLATION_BUDGET_EXHAUSTED' "$tmp/r29-retry.err"
assert_query "SELECT count(*) FROM r29_private.isolation_claims;" "1"

# Aborted PREVIEW migration must leave exactly zero objects behind.
pg -c "BEGIN; CREATE TABLE r29_private.preview_draft_should_rollback(id integer); ROLLBACK;" >/dev/null
assert_query "SELECT to_regclass('r29_private.preview_draft_should_rollback') IS NULL;" "t"
assert_query "SELECT committed_minor FROM r29_private.programme WHERE version='future-pilot';" "2500"

# Real schema-level restore rehearsal: a pg_dump *of the synthetic schemas
# only* is restored into a NEW scratch database in the SAME temporary Docker
# container. No hosted project, credentials, users or backups are touched.
r29_source_before="$(pg -c "SELECT count(*) FROM r29_source.orders;")"
r29_private_before="$(pg -c "SELECT count(*) FROM r29_private.purchase_lines;")"
r29_credit_before="$(pg -c "SELECT count(*) FROM r29_private.credits;")"
docker exec "$name" pg_dump -U postgres -d rewards_lab \
  -n r29_source -n r29_private -F c -f /tmp/r29-private-restore.dump
docker exec "$name" createdb -U postgres rewards_r29_restore
docker exec "$name" pg_restore -U postgres --no-owner \
  -d rewards_r29_restore /tmp/r29-private-restore.dump
r29_restore(){
  docker exec "$name" psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres \
    -d rewards_r29_restore -c "$1"
}
if [[ "$(r29_restore "SELECT count(*) FROM r29_source.orders;")" != "$r29_source_before" ||
      "$(r29_restore "SELECT count(*) FROM r29_private.purchase_lines;")" != "$r29_private_before" ||
      "$(r29_restore "SELECT count(*) FROM r29_private.credits;")" != "$r29_credit_before" ]]; then
  echo "R29 private UUID source/ledger backup restore mismatch" >&2
  exit 1
fi
if [[ "$(r29_restore "SELECT committed_minor FROM r29_private.programme WHERE version='future-pilot';")" != "2500" ||
      "$(r29_restore "SELECT count(*) FROM r29_private.bronze_grants;")" != "1" ||
      "$(r29_restore "SELECT has_schema_privilege('r29_browser','r29_private','USAGE');")" != "f" ]]; then
  echo "R29 restored private financial invariants or role access diverged" >&2
  exit 1
fi
if [[ "$(r29_restore "SELECT count(*) FROM r29_private.purchase_snapshots s
  JOIN r29_source.orders o ON o.id=s.order_id
    AND o.shop_id=s.shop_id AND o.user_id=s.customer_uid;")" != \
      "$(r29_restore "SELECT count(*) FROM r29_private.purchase_snapshots;")" ]]; then
  echo "R29 restored source/customer/shop identity FKs failed" >&2
  exit 1
fi
echo "R29_UUID_PRIVILEGES_SERIALIZABLE_RETRY_AND_RESTORE_PASS"

# R3.0: restricted NOLOGIN executor in disposable PostgreSQL 17 only.
echo "R3.0 PG17: NOLOGIN financial owner, limited SQL executor, forgery and races"
run_file "$here/executor-r30.SYNTHETIC_ONLY.sql" >"$tmp/r30-schema.out"
run_file "$here/executor-r30-assertions.SYNTHETIC_ONLY.sql" >"$tmp/r30-assertions.out"
grep -q 'R30_PRIVATE_EXECUTOR_SOURCE_IDENTITY_AND_BUDGET_PASS' "$tmp/r30-assertions.out"
assert_query "SELECT count(*) FROM r30_private.bronze_grants;" "1"
assert_query "SELECT committed_minor FROM r30_private.programme WHERE version='synthetic-v1';" "2500"

expect_r30_denied(){
  local sql="$1"
  if pg -c "$sql" >"$tmp/r30-denied.out" 2>"$tmp/r30-denied.err"; then
    echo "R3.0 illegal privilege succeeded: $sql" >&2; exit 1
  fi
  if ! grep -q 'permission denied' "$tmp/r30-denied.err"; then
    cat "$tmp/r30-denied.err" >&2
    echo "R3.0 denial was not a permissions error" >&2; exit 1
  fi
}
assert_query "SELECT has_function_privilege('r30_api_executor',
 'r30_private.credit_verified_pickup(uuid)','EXECUTE');" "t"
assert_query "SELECT has_function_privilege('r30_browser',
 'r30_private.credit_verified_pickup(uuid)','EXECUTE');" "f"
assert_query "SELECT has_function_privilege('r30_api_executor',
 'r30_private.no_mutation()','EXECUTE');" "f"
expect_r30_denied "SET ROLE r30_browser;
 SELECT r30_private.credit_verified_pickup('00000000-0000-4000-8000-000000000301'::uuid);"
expect_r30_denied "SET ROLE r30_merchant;
 SELECT r30_private.credit_verified_pickup('00000000-0000-4000-8000-000000000301'::uuid);"
expect_r30_denied "SET ROLE r30_api_executor; SELECT * FROM r30_private.credits;"
expect_r30_denied "SET ROLE r30_api_executor;
 INSERT INTO r30_private.credits(order_id,line_index,customer_uid,units)
 VALUES('00000000-0000-4000-8000-000000000399'::uuid,1,'forged',100);"
expect_r30_denied "SET ROLE r30_api_executor;
 UPDATE r30_private.programme SET committed_minor=0;"
expect_r30_denied "SET ROLE r30_api_executor;
 UPDATE r30_source.orders SET registered=true;"
# SET ROLE alone preserves a superuser session_user in our Docker harness.
# SET SESSION AUTHORIZATION drops that privilege for this fresh psql session.
expect_r30_denied "SET SESSION AUTHORIZATION r30_api_executor; SET ROLE r30_finance_owner;"
expect_r30_denied "SET ROLE r30_finance_owner;
 INSERT INTO r30_source.orders(id,customer_uid,shop_id,origin,registered,test_order,status,payment_status)
 VALUES('00000000-0000-4000-8000-000000000398'::uuid,'fake','fake','server_created_pickup',
 true,false,'collected','paid');"
assert_query "SET ROLE r30_api_executor;
 SELECT r30_private.credit_verified_pickup('00000000-0000-4000-8000-000000000301'::uuid);" "0"
assert_query "SELECT count(*) FROM r30_private.credits;" "1"

reset_r30(){
 pg -c "TRUNCATE r30_source.orders,r30_private.programme,r30_private.progress
   RESTART IDENTITY CASCADE;" >/dev/null 2>&1
 pg -c "INSERT INTO r30_private.programme(version,active,budget_minor)
    VALUES('synthetic-v1',true,2500);" >/dev/null
 pg -c "INSERT INTO r30_source.orders(id,customer_uid,shop_id,origin,registered,test_order,status,payment_status)
 VALUES('00000000-0000-4000-8000-000000000351'::uuid,'racer-a','shop-a',
        'server_created_pickup',true,false,'collected','paid'),
       ('00000000-0000-4000-8000-000000000352'::uuid,'racer-b','shop-a',
        'server_created_pickup',true,false,'collected','paid');
 INSERT INTO r30_source.purchase_lines(order_id,line_index,quantity,qualifies_kota,provenance,snapshot_at)
 SELECT id,1,4,true,'immutable_checkout_snapshot',created_at FROM r30_source.orders;
 INSERT INTO r30_source.pickup_events(order_id,revision,command_id,kind,occurred_at)
 SELECT id,1,CASE customer_uid WHEN 'racer-a' THEN
 '00000000-0000-4000-8000-000000000361'::uuid ELSE
 '00000000-0000-4000-8000-000000000362'::uuid END,
 'payment_confirmed',created_at FROM r30_source.orders;
 INSERT INTO r30_source.pickup_events(order_id,revision,command_id,kind,occurred_at)
 SELECT id,2,CASE customer_uid WHEN 'racer-a' THEN
 '00000000-0000-4000-8000-000000000371'::uuid ELSE
 '00000000-0000-4000-8000-000000000372'::uuid END,
 'collected',created_at FROM r30_source.orders;" >/dev/null
}
# Two separately executing restricted-role API sessions compete for one owner cap.
reset_r30
paired \
 "SET ROLE r30_api_executor;
 SELECT r30_private.credit_verified_pickup('00000000-0000-4000-8000-000000000351'::uuid);" \
 "SET ROLE r30_api_executor;
 SELECT r30_private.credit_verified_pickup('00000000-0000-4000-8000-000000000352'::uuid);"
r30_wins=0
if [[ "$status_a" -eq 0 ]]; then r30_wins=$((r30_wins+1)); else grep -q 'R30_BUDGET_EXHAUSTED' "$tmp/a.err"; fi
if [[ "$status_b" -eq 0 ]]; then r30_wins=$((r30_wins+1)); else grep -q 'R30_BUDGET_EXHAUSTED' "$tmp/b.err"; fi
if [[ "$r30_wins" -ne 1 ]]; then
 cat "$tmp/a.err" "$tmp/b.err" >&2; echo "R3.0 backend-role race overcommitted budget" >&2; exit 1
fi
assert_query "SELECT count(*) FROM r30_private.bronze_grants;" "1"
assert_query "SELECT count(*) FROM r30_private.credits;" "1"
assert_query "SELECT committed_minor FROM r30_private.programme WHERE version='synthetic-v1';" "2500"
assert_query "SELECT
  (SELECT COALESCE(sum(cap_minor),0) FROM r30_private.bronze_grants)=
  (SELECT committed_minor FROM r30_private.programme WHERE version='synthetic-v1');" "t"
if pg -c "UPDATE r30_source.purchase_lines SET qualifies_kota=false;" \
  >"$tmp/r30-tamper.out" 2>"$tmp/r30-tamper.err"; then
 echo "R30 synthetic source was not immutable" >&2;exit 1
fi
grep -q 'R30_IMMUTABLE_SOURCE' "$tmp/r30-tamper.err"
echo "R30_FINANCIAL_OWNER_PRIVATE_EXECUTION_AND_BUDGET_RACE_PASS"

# R3.1: inactive by default, source-only trigger creates a private outbox pointer.
# A restricted worker can claim/ack pointers but cannot manufacture source facts
# or credit financial ledgers. No hosted DB connection and no real Firebase.
echo "R3.1 PG17: genuine collected outbox events, private worker lease and crash replay"
run_file "$here/outbox-r31.SYNTHETIC_ONLY.sql" >"$tmp/r31-schema.out"
run_file "$here/outbox-r31-assertions.SYNTHETIC_ONLY.sql" >"$tmp/r31-assertions.out"
grep -q 'R31_TRUSTED_COLLECTED_EVENT_PRIVATE_OUTBOX_PASS' "$tmp/r31-assertions.out"
assert_query "SELECT count(*) FROM r31_private.outbox;" "1"

expect_r31_denied(){
 local sql="$1"
 if pg -c "$sql" >"$tmp/r31-denied.out" 2>"$tmp/r31-denied.err"; then
   echo "R31 unauthorized SQL succeeded: $sql" >&2;exit 1
 fi
 if ! grep -q 'permission denied' "$tmp/r31-denied.err"; then
   cat "$tmp/r31-denied.err" >&2
   echo "R31 unexpected denial cause" >&2;exit 1
 fi
}
expect_r31_denied "SET SESSION AUTHORIZATION r31_browser;
 SELECT * FROM r31_private.outbox;"
expect_r31_denied "SET SESSION AUTHORIZATION r31_browser;
 SELECT * FROM r31_private.claim_next('browser');"
expect_r31_denied "SET SESSION AUTHORIZATION r31_worker;
 SELECT * FROM r31_private.outbox;"
expect_r31_denied "SET SESSION AUTHORIZATION r31_worker;
 INSERT INTO r31_private.outbox(order_id,collected_command_id,collected_revision)
 VALUES('00000000-0000-4000-8000-000000000401'::uuid,
        '00000000-0000-4000-8000-000000000412'::uuid,2);"
expect_r31_denied "SET SESSION AUTHORIZATION r31_worker;
 INSERT INTO r31_pickup.command_events(order_id,command_id,revision,kind,actor_uid)
 VALUES('00000000-0000-4000-8000-000000000402'::uuid,
        '00000000-0000-4000-8000-000000000499'::uuid,3,'collected','merchant-1');"
expect_r31_denied "SET SESSION AUTHORIZATION r31_worker;
 SET ROLE r31_definer;"

# Parallel worker requests may both succeed but exactly one may lease the row.
paired \
 "SET SESSION AUTHORIZATION r31_worker; SELECT * FROM r31_private.claim_next('worker-a');" \
 "SET SESSION AUTHORIZATION r31_worker; SELECT * FROM r31_private.claim_next('worker-b');"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
 cat "$tmp/a.err" "$tmp/b.err" >&2; echo "R31 parallel worker claim FAILED" >&2;exit 1
fi
assert_query "SELECT count(*) FROM r31_private.outbox WHERE state='leased';" "1"
assert_query "SELECT attempt FROM r31_private.outbox;" "1"
# An acknowledgement must match the actual lease owner and immutable command.
if pg -c "SET SESSION AUTHORIZATION r31_worker;
 SELECT r31_private.acknowledge(
   '00000000-0000-4000-8000-000000000402'::uuid,
   '00000000-0000-4000-8000-000000000422'::uuid,
   'wrong-worker');" >"$tmp/r31-badack.out" 2>"$tmp/r31-badack.err"; then
 echo "R31 cross-worker acknowledgement unexpectedly succeeded" >&2;exit 1
fi
grep -q 'R31_STALE_OR_FORGED_ACK' "$tmp/r31-badack.err"
leased_worker="$(pg -c "SELECT leased_to FROM r31_private.outbox;")"
assert_query "SET SESSION AUTHORIZATION r31_worker;
 SELECT r31_private.acknowledge(
  '00000000-0000-4000-8000-000000000402'::uuid,
  '00000000-0000-4000-8000-000000000422'::uuid,'$leased_worker');" "t"
assert_query "SELECT state FROM r31_private.outbox;" "consumed"
assert_query "SET SESSION AUTHORIZATION r31_worker;
 SELECT count(*) FROM r31_private.claim_next('worker-c');" "0"

# Simulate worker crash: a lease past its expiry becomes available to another
# worker without duplicating the physical event pointer or paying anything.
pg -c "UPDATE r31_private.outbox SET state='pending',attempt=0,
 leased_to=NULL,lease_until=NULL,processed_at=NULL;" >/dev/null
assert_query "SET SESSION AUTHORIZATION r31_worker;
 SELECT attempt FROM r31_private.claim_next('crashed-worker');" "1"
pg -c "UPDATE r31_private.outbox SET lease_until=clock_timestamp()-interval '2 seconds'
 WHERE leased_to='crashed-worker';" >/dev/null
assert_query "SET SESSION AUTHORIZATION r31_worker;
 SELECT attempt FROM r31_private.claim_next('recovery-worker');" "2"
if pg -c "SET SESSION AUTHORIZATION r31_worker;
 SELECT r31_private.acknowledge(
 '00000000-0000-4000-8000-000000000402'::uuid,
 '00000000-0000-4000-8000-000000000422'::uuid,
 'crashed-worker');" >"$tmp/r31-stale.out" 2>"$tmp/r31-stale.err"; then
 echo "R31 crashed worker accepted stale lease" >&2;exit 1
fi
grep -q 'R31_STALE_OR_FORGED_ACK' "$tmp/r31-stale.err"
assert_query "SET SESSION AUTHORIZATION r31_worker;
 SELECT r31_private.acknowledge(
 '00000000-0000-4000-8000-000000000402'::uuid,
 '00000000-0000-4000-8000-000000000422'::uuid,
 'recovery-worker');" "t"
assert_query "SELECT count(*) FROM r31_private.outbox;" "1"
assert_query "SELECT state FROM r31_private.outbox;" "consumed"

# Queuing is part of the *same transaction* as verified collected command.
# A rollback must undo both event insertion and outbox row.
pg -c "BEGIN;
INSERT INTO r31_pickup.orders(id,shop_id,customer_uid,owner_uid,origin,
 registered,is_test,status,payment_status)
VALUES('00000000-0000-4000-8000-000000000410'::uuid,'shop-1','rollback','merchant-1',
'authoritative_pickup',true,false,'collected','paid');
INSERT INTO r31_pickup.checkout_proofs(order_id,shop_id,customer_uid,programme_version,
 eligible_units,approved_at_purchase,enrolled_at_purchase,captured_at)
SELECT id,shop_id,customer_uid,'future-v1',4,true,true,created_at
 FROM r31_pickup.orders WHERE customer_uid='rollback';
INSERT INTO r31_pickup.command_events(order_id,command_id,revision,kind,actor_uid)
VALUES('00000000-0000-4000-8000-000000000410'::uuid,
 '00000000-0000-4000-8000-000000000431'::uuid,1,'payment_confirmed','merchant-1'),
('00000000-0000-4000-8000-000000000410'::uuid,
 '00000000-0000-4000-8000-000000000432'::uuid,2,'collected','merchant-1');
ROLLBACK;" >/dev/null
assert_query "SELECT count(*) FROM r31_private.outbox;" "1"
assert_query "SELECT count(*) FROM r31_pickup.orders WHERE customer_uid='rollback';" "0"
echo "R31_PRIVATE_WORKER_LEASE_REPLAY_ATOMIC_ENQUEUE_PASS"

# R3.2: reduced read-only observed pickup command order -> private worker source.
# Every row, dollar amount, order and worker here is synthetic Docker-only.
echo "R3.2 PG17: internal worker SQL identity, fenced leases, crash rollback and poison DLQ"
run_file "$here/worker-r32.SYNTHETIC_ONLY.sql" >"$tmp/r32-schema.out"
run_file "$here/worker-r32-assertions.SYNTHETIC_ONLY.sql" >"$tmp/r32-assertions.out"
grep -q 'R32_REAL_ORDER_COMMAND_SEQUENCE_AND_OUTBOX_PASS' "$tmp/r32-assertions.out"
assert_query "SELECT count(*) FROM r32_private.outbox;" "1"

r32_denied(){
 local sql="$1"
 if pg -c "$sql" >"$tmp/r32-denied.out" 2>"$tmp/r32-denied.err"; then
   echo "R32 illegal worker SQL succeeded: $sql" >&2;exit 1
 fi
 if ! grep -q 'permission denied' "$tmp/r32-denied.err"; then
   cat "$tmp/r32-denied.err" >&2
   echo "R32 SQL failure not an access denial" >&2;exit 1
 fi
}
r32_denied "SET SESSION AUTHORIZATION r32_browser; SELECT * FROM r32_private.outbox;"
r32_denied "SET SESSION AUTHORIZATION r32_worker; SELECT * FROM r32_private.outbox;"
r32_denied "SET SESSION AUTHORIZATION r32_worker; SELECT * FROM r32_private.credit_receipts;"
r32_denied "SET SESSION AUTHORIZATION r32_worker;
 INSERT INTO r32_private.credit_receipts(order_id,collected_command,customer_uid,kota_units,reserved_minor)
 VALUES('00000000-0000-4000-8000-000000000510'::uuid,
 '00000000-0000-4000-8000-000000000540'::uuid,'fake',4,2500);"
r32_denied "SET SESSION AUTHORIZATION r32_worker; UPDATE r32_private.programme SET reserved_minor=0;"
r32_denied "SET SESSION AUTHORIZATION r32_worker; SET ROLE r32_owner;"
r32_denied "SET SESSION AUTHORIZATION r32_worker;
 SELECT r32_pickup.command('00000000-0000-4000-8000-000000000510'::uuid,
 'owner-1','collect','00000000-0000-4000-8000-000000000599'::uuid,2);"
r32_denied "SET SESSION AUTHORIZATION r32_browser;
 SELECT * FROM r32_private.claim_next();"

r32_reset(){
  # Only the PostgreSQL superuser test fixture can truncate synthetic rows.
  pg -c "TRUNCATE r32_pickup.orders,r32_private.programme RESTART IDENTITY CASCADE;" >/dev/null 2>&1
  pg -c "INSERT INTO r32_private.programme(version,active,starts_at,budget_minor)
    VALUES('future-v1',true,now()-interval '1 day',2500);" >/dev/null
}
r32_seed(){
  local id="$1" order="00000000-0000-4000-8000-0000000001"
  local pay="00000000-0000-4000-8000-000000000$((id+100))"
  local collected="00000000-0000-4000-8000-000000000$((id+200))"
  pg -c "INSERT INTO r32_pickup.orders(id,shop_id,customer_uid,merchant_uid,origin,
    registered,is_test,status,payment_status)
    VALUES('$order'::uuid,'shop-1','user-$id','merchant-1','server_created_pickup',
      true,false,'ready_for_pickup','unpaid');
    INSERT INTO r32_pickup.checkout_proofs(order_id,shop_id,customer_uid,
      programme_version,qualifies_kota,eligible_units,enrolled_at_purchase,
      approved_at_purchase,captured_at)
    SELECT id,shop_id,customer_uid,'future-v1',true,4,true,true,created_at
      FROM r32_pickup.orders WHERE id='$order'::uuid;" >/dev/null
  pg -c "SELECT r32_pickup.command('$order'::uuid,'merchant-1','confirm_payment',
      '$pay'::uuid,0);" >/dev/null
  pg -c "SELECT r32_pickup.command('$order'::uuid,'merchant-1','collect',
      '$collected'::uuid,1);" >/dev/null
}
r32_claim(){
  pg -c "SET SESSION AUTHORIZATION r32_worker;
    SELECT order_id::text||'|'||collected_command::text||'|'||lease_token::text||'|'||attempt
      FROM r32_private.claim_next();"
}
r32_reset
r32_seed 570
claim="$(r32_claim)"
IFS='|' read -r r32_order r32_event r32_token r32_attempt <<<"$claim"
if [[ "$r32_attempt" != "1" || "$r32_order" != "00000000-0000-4000-8000-000000000570" ]]; then
  echo "R32 worker could not claim valid event" >&2;exit 1
fi
assert_query "SET SESSION AUTHORIZATION r32_worker;
 SELECT r32_private.consume_job('$r32_order'::uuid,'$r32_token'::uuid);" "4"
assert_query "SELECT state FROM r32_private.outbox;" "consumed"
assert_query "SELECT count(*) FROM r32_private.credit_receipts;" "1"
assert_query "SELECT reserved_minor FROM r32_private.programme;" "2500"
assert_query "SET SESSION AUTHORIZATION r32_worker;
 SELECT count(*) FROM r32_private.claim_next();" "0"
echo "R32_DISPOSABLE_WORKER_CONSUMED_WITH_ATOMIC_CREDIT" 

# Simulated crash AFTER reservation and INSERT but BEFORE ACK: all work rolls
# back. A bounded retried lease can later commit exactly one receipt.
r32_reset
r32_seed 580
claim="$(r32_claim)"
IFS='|' read -r r32_order r32_event r32_oldtoken r32_attempt <<<"$claim"
pg -c "INSERT INTO r32_private.fault_injections(order_id,fault)
 VALUES('$r32_order'::uuid,'after_credit_before_consume');" >/dev/null
if pg -c "SET SESSION AUTHORIZATION r32_worker;
 SELECT r32_private.consume_job('$r32_order'::uuid,'$r32_oldtoken'::uuid);" \
    >"$tmp/r32-crash.out" 2>"$tmp/r32-crash.err"; then
 echo "R32 artificial crash incorrectly committed money" >&2; exit 1
fi
grep -q 'R32_SYNTHETIC_CRASH' "$tmp/r32-crash.err"
assert_query "SELECT count(*) FROM r32_private.credit_receipts;" "0"
assert_query "SELECT reserved_minor FROM r32_private.programme;" "0"
assert_query "SELECT state FROM r32_private.outbox;" "leased"
assert_query "SET SESSION AUTHORIZATION r32_worker;
 SELECT r32_private.fail_job('$r32_order'::uuid,'$r32_oldtoken'::uuid,'TRANSIENT_DB');" "retry"
assert_query "SELECT state FROM r32_private.outbox;" "retry"
assert_query "SET SESSION AUTHORIZATION r32_worker;
 SELECT count(*) FROM r32_private.claim_next();" "0"
pg -c "DELETE FROM r32_private.fault_injections WHERE order_id='$r32_order'::uuid;
 UPDATE r32_private.outbox SET retry_at=clock_timestamp()-interval '2 seconds'
 WHERE order_id='$r32_order'::uuid;" >/dev/null
claim="$(r32_claim)"
IFS='|' read -r r32_retryorder r32_event r32_newtoken r32_attempt <<<"$claim"
if [[ "$r32_attempt" != "2" || "$r32_oldtoken" == "$r32_newtoken" ]]; then
 echo "R32 retry reused stale lease token" >&2;exit 1
fi
if pg -c "SET SESSION AUTHORIZATION r32_worker;
 SELECT r32_private.consume_job('$r32_order'::uuid,'$r32_oldtoken'::uuid);" \
   >"$tmp/r32-stale.out" 2>"$tmp/r32-stale.err"; then
 echo "R32 stale token accepted" >&2;exit 1
fi
grep -q 'R32_STALE_LEASE' "$tmp/r32-stale.err"
assert_query "SET SESSION AUTHORIZATION r32_worker;
 SELECT r32_private.consume_job('$r32_order'::uuid,'$r32_newtoken'::uuid);" "4"
assert_query "SELECT count(*) FROM r32_private.credit_receipts;" "1"
assert_query "SELECT reserved_minor FROM r32_private.programme;" "2500"
assert_query "SELECT state FROM r32_private.outbox;" "consumed"

# Poison messages are retained for operator review, not silently dropped or
# redriven. A worker cannot alter historical credits or dead-letter audit.
r32_reset
r32_seed 590
claim="$(r32_claim)"
IFS='|' read -r r32_order r32_event r32_token r32_attempt <<<"$claim"
assert_query "SET SESSION AUTHORIZATION r32_worker;
 SELECT r32_private.fail_job('$r32_order'::uuid,'$r32_token'::uuid,
 'PERMANENT_INVALID_PROOF');" "dead_letter"
assert_query "SELECT count(*) FROM r32_private.deadletter_audit;" "1"
assert_query "SELECT count(*) FROM r32_private.credit_receipts;" "0"
assert_query "SET SESSION AUTHORIZATION r32_worker;
 SELECT count(*) FROM r32_private.claim_next();" "0"
r32_denied "SET SESSION AUTHORIZATION r32_worker; DELETE FROM r32_private.deadletter_audit;"

# Even transient failures stop at three attempts, no infinite retry loop.
r32_reset
r32_seed 600
for attempt in 1 2 3; do
 claim="$(r32_claim)"
 IFS='|' read -r r32_order r32_event r32_token r32_attempt <<<"$claim"
 if [[ "$r32_attempt" != "$attempt" ]]; then
  echo "R32 attempt counter did not advance" >&2;exit 1
 fi
 expected="retry"
 if [[ "$attempt" -eq 3 ]]; then expected="dead_letter"; fi
 assert_query "SET SESSION AUTHORIZATION r32_worker;
 SELECT r32_private.fail_job('$r32_order'::uuid,'$r32_token'::uuid,
 'TRANSIENT_DB');" "$expected"
 if [[ "$attempt" -lt 3 ]]; then
  pg -c "UPDATE r32_private.outbox
   SET retry_at=clock_timestamp()-interval '2 seconds'
   WHERE order_id='$r32_order'::uuid;" >/dev/null
 fi
done
assert_query "SELECT count(*) FROM r32_private.deadletter_audit;" "1"
assert_query "SELECT count(*) FROM r32_private.credit_receipts;" "0"

# Two different pending orders compete for the only R25 budget. One must
# commit receipt+ack. The loser cannot leave a receipt or reserved funds.
r32_reset
r32_seed 610
r32_seed 611
paired \
 "SET SESSION AUTHORIZATION r32_worker; SELECT * FROM r32_private.claim_next();" \
 "SET SESSION AUTHORIZATION r32_worker; SELECT * FROM r32_private.claim_next();"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]]; then
 cat "$tmp/a.err" "$tmp/b.err" >&2
 echo "R32 parallel lease claim error" >&2;exit 1
fi
assert_query "SELECT count(*) FROM r32_private.outbox WHERE state='leased';" "2"
r32_token_a="$(pg -c "SELECT lease_token FROM r32_private.outbox
 WHERE order_id='00000000-0000-4000-8000-000000000610'::uuid;")"
r32_token_b="$(pg -c "SELECT lease_token FROM r32_private.outbox
 WHERE order_id='00000000-0000-4000-8000-000000000611'::uuid;")"
paired \
 "SET SESSION AUTHORIZATION r32_worker;
 SELECT r32_private.consume_job('00000000-0000-4000-8000-000000000610'::uuid,'$r32_token_a'::uuid);" \
 "SET SESSION AUTHORIZATION r32_worker;
 SELECT r32_private.consume_job('00000000-0000-4000-8000-000000000611'::uuid,'$r32_token_b'::uuid);"
wins=0
if [[ "$status_a" -eq 0 ]]; then wins=$((wins+1)); else grep -q 'R32_BUDGET_EXHAUSTED' "$tmp/a.err"; fi
if [[ "$status_b" -eq 0 ]]; then wins=$((wins+1)); else grep -q 'R32_BUDGET_EXHAUSTED' "$tmp/b.err"; fi
if [[ "$wins" -ne 1 ]]; then
 cat "$tmp/a.err" "$tmp/b.err" >&2
 echo "R32 budget double-spent or both rejected" >&2;exit 1
fi
assert_query "SELECT count(*) FROM r32_private.credit_receipts;" "1"
assert_query "SELECT count(*) FROM r32_private.outbox WHERE state='consumed';" "1"
assert_query "SELECT reserved_minor FROM r32_private.programme;" "2500"
assert_query "SELECT (SELECT COALESCE(sum(reserved_minor),0) FROM r32_private.credit_receipts)=
 (SELECT reserved_minor FROM r32_private.programme);" "t"

# Verify observed UPDATE-then-INSERT order is transactionally all-or-nothing:
# a failed future transaction must not create an orphan outbox row.
r32_reset
pg -c "BEGIN;
 INSERT INTO r32_pickup.orders(id,shop_id,customer_uid,merchant_uid,origin,
    registered,is_test,status,payment_status)
 VALUES('00000000-0000-4000-8000-000000000620'::uuid,'shop-1','rollback','merchant-1',
 'server_created_pickup',true,false,'ready_for_pickup','unpaid');
 INSERT INTO r32_pickup.checkout_proofs(order_id,shop_id,customer_uid,programme_version,
   qualifies_kota,eligible_units,enrolled_at_purchase,approved_at_purchase,captured_at)
 SELECT id,shop_id,customer_uid,'future-v1',true,4,true,true,created_at
 FROM r32_pickup.orders WHERE customer_uid='rollback';
 SELECT r32_pickup.command('00000000-0000-4000-8000-000000000620'::uuid,'merchant-1',
  'confirm_payment','00000000-0000-4000-8000-000000000720'::uuid,0);
 SELECT r32_pickup.command('00000000-0000-4000-8000-000000000620'::uuid,'merchant-1',
  'collect','00000000-0000-4000-8000-000000000820'::uuid,1);
 ROLLBACK;" >/dev/null
assert_query "SELECT count(*) FROM r32_pickup.orders WHERE customer_uid='rollback';" "0"
assert_query "SELECT count(*) FROM r32_private.outbox;" "0"
echo "R32_INTERNAL_WORKER_FENCING_POISON_RECOVERY_ATOMIC_CREDIT_PASS"
