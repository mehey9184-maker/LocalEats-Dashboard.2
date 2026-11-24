#!/usr/bin/env bash
# H2D.1: only invoked by the recorded-applied disposable PG17 lab. No remote DB.
set -Eeuo pipefail
name="$1"
[[ "$name" =~ ^localeats_pickup_r35_[0-9]+$ ]]
[[ "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$name")" == none ]]
[[ "$(docker inspect -f '{{index .Config.Labels "localeats.h2d1"}}' "$name")" == synthetic ]]
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
pg(){ docker exec -e PGOPTIONS='-c statement_timeout=12000 -c lock_timeout=10000' "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d pickup_r35_lab -c "$1"; }
expect(){ local got; got="$(pg "$1")"; [[ "$got" == "$2" ]] || { printf 'H2D1 assertion expected=%s got=%s\n' "$2" "$got" >&2; exit 1; }; }
key='00000000-0000-4000-8000-000000009101'
accept='00000000-0000-4000-8000-000000009102'
ready='00000000-0000-4000-8000-000000009103'
pay='00000000-0000-4000-8000-000000009104'
otherpay='00000000-0000-4000-8000-000000009105'
collect='00000000-0000-4000-8000-000000009106'
bad='00000000-0000-4000-8000-000000009107'
# Require the known fake baseline already exercised by R35/R36.
expect "select count(*) from public.orders" 3
expect "select count(*) from public.shops where id='my-kota-synthetic' and owner_id='synthetic-merchant'" 1
expect "select count(*) from public.orders where idempotency_key='$key'" 0
# The fixture schema is created by postgres; permit the local synthetic service role to construct the test record.
pg "grant usage on schema r34_fixture to service_role; grant execute on all functions in schema r34_fixture to service_role" >/dev/null
create="select public.pickup_create_order('synthetic-customer',repeat('e',64),r34_fixture.make_record('$key'::uuid))->>'replayed'"
# Run separate SQL sessions. Observe the losing backend waiting on the winner's lock,
# rather than treating two sequential calls as a concurrency test.
start(){ local app="$1" sql="$2"; docker exec -e "PGAPPNAME=$app" -e PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=12000' "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d pickup_r35_lab -c "$sql"; }
wait_for(){ local filter="$1" i; for i in $(seq 1 45); do if [[ "$(pg "select count(*) from pg_stat_activity where $filter")" == 1 ]]; then return 0; fi; sleep 0.05; done; echo "H2D1 expected concurrent wait not observed: $filter" >&2; return 1; }
race(){
 local label="$1" first="$2" second="$3" expected="$4" a b rc=0
 start h2d1_first "begin; set local role service_role; $first; select pg_sleep(5); commit;" >"$tmp/$label.a" 2>"$tmp/$label.a.err" & a=$!
 wait_for "application_name='h2d1_first' and wait_event='PgSleep'"
 start h2d1_second "set role service_role; $second;" >"$tmp/$label.b" 2>"$tmp/$label.b.err" & b=$!
 wait_for "application_name='h2d1_second' and wait_event_type='Lock'"
 wait "$a" || { cat "$tmp/$label.a.err" >&2; return 1; }
 wait "$b" || rc=$?
 grep -qx false "$tmp/$label.a"
 if [[ "$expected" == replay ]]; then
  [[ "$rc" == 0 ]]; grep -qx true "$tmp/$label.b"
 else
  [[ "$rc" != 0 ]]; grep -q "$expected" "$tmp/$label.b.err"
 fi
 echo "H2D1_RACE_PASS $label observed_lock=true"
}
race duplicate_create "$create" "$create" replay
expect "select count(*) from public.orders where idempotency_key='$key'" 1
oid="$(pg "select id from public.orders where idempotency_key='$key'")"
[[ "$oid" =~ ^[0-9a-f-]{36}$ ]]
cmd(){ printf "select public.pickup_order_command('synthetic-merchant','%s'::uuid,'%s','%s'::uuid,%s,null,%s,%s)->>'replayed'" "$oid" "$1" "$2" "$3" "$4" "$5"; }
expect "set role service_role; $(cmd accept "$accept" 0 null false)" false
expect "set role service_role; $(cmd ready "$ready" 1 null false)" false
pay_sql="$(cmd confirm_payment "$pay" 2 "'cash'" false)"
other_sql="$(cmd confirm_payment "$otherpay" 2 "'card_machine'" false)"
race competing_payment "$pay_sql" "$other_sql" ORDER_STATE_CHANGED
expect "set role service_role; $pay_sql" true
expect "select status||':'||payment_status||':'||revision||':'||payment_method from public.orders where id='$oid'" ready_for_pickup:paid:3:cash
expect "select count(*) from public.pickup_order_events where order_id='$oid' and kind='payment_confirmed'" 1
# Explicit transaction rollback models failure before commit, not a real network outage.
collect_sql="$(cmd collect "$collect" 3 null true)"
pg "begin; set local role service_role; $collect_sql; rollback;" >/dev/null
expect "select status||':'||payment_status||':'||revision from public.orders where id='$oid'" ready_for_pickup:paid:3
expect "select count(*) from public.pickup_order_events where order_id='$oid' and kind='collected'" 0
echo 'H2D1_ROLLBACK_PASS'
race duplicate_collection "$collect_sql" "$collect_sql" replay
expect "select status||':'||payment_status||':'||revision from public.orders where id='$oid'" collected:paid:4
expect "select count(*) from public.pickup_order_events where order_id='$oid'" 5
expect "select count(*) from public.pickup_order_events where order_id='$oid' and kind='collected'" 1
expect "select count(*) from public.pickup_push_outbox q join public.pickup_order_events e on e.id=q.event_id where e.order_id='$oid'" 1
# A stale quote cannot create an order after committed price or availability changes.
reject(){ local sql="$1" code="$2" rc=0; pg "$sql" >"$tmp/reject.out" 2>"$tmp/reject.err" || rc=$?; [[ "$rc" != 0 ]]; grep -q "$code" "$tmp/reject.err"; }
bad_create="set role service_role; select public.pickup_create_order('synthetic-customer',repeat('f',64),r34_fixture.make_record('$bad'::uuid))"
pg "update public.menu_items set price=26 where id='kota-synthetic-25'" >/dev/null
reject "$bad_create" PRICE_CHANGED
pg "update public.menu_items set price=25,is_available=false where id='kota-synthetic-25'" >/dev/null
reject "$bad_create" MENU_ITEM_UNAVAILABLE
pg "update public.menu_items set is_available=true where id='kota-synthetic-25'" >/dev/null
expect "select count(*) from public.orders where idempotency_key='$bad'" 0
expect "select count(*) from public.orders" 4
echo 'H2D1_PRICE_AND_AVAILABILITY_PASS'
echo 'H2D1_DISPOSABLE_CONCURRENCY_PASS'
