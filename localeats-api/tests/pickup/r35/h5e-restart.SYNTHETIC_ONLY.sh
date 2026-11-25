#!/usr/bin/env bash
# Only called by the existing digest-verified disposable PG17 replay.
set -Eeuo pipefail
name="$1"
[[ "$name" =~ ^localeats_pickup_r35_[0-9]+$ ]]
[[ "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$name")" == none ]]
[[ "$(docker inspect -f '{{index .Config.Labels "localeats.h2d1"}}' "$name")" == synthetic ]]
tmp="$(mktemp -d)";trap 'rm -rf "$tmp"' EXIT
pg(){ docker exec -e PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000' "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d pickup_r35_lab -c "$1"; }
expect(){ local got;got="$(pg "$1")";[[ "$got" == "$2" ]] || { echo "H5E expected=$2 actual=$got" >&2;exit 1; }; }
reject(){ local rc=0;pg "$1" >"$tmp/reject.out" 2>"$tmp/reject.err" || rc=$?;[[ "$rc" != 0 ]];grep -q "$2" "$tmp/reject.err"; }
key='00000000-0000-4000-8000-000000009201'
create="select public.pickup_create_order('synthetic-customer',repeat('9',64),r34_fixture.make_record('$key'::uuid))"
expect "select count(*) from public.orders where idempotency_key='$key'" 0
# Real commit in PG, discard response at caller boundary. New connection proves durability.
pg "begin;set local role service_role;$create;commit;" >/dev/null
oid="$(pg "select id from public.orders where idempotency_key='$key'")"
[[ "$oid" =~ ^[0-9a-f-]{36}$ ]]
# Replay after a real committed price change; original authoritative result must win.
pg "update public.menu_items set price=26 where id='kota-synthetic-25'" >/dev/null
expect "set role service_role; $create->>'replayed'" true
expect "set role service_role; $create->'order'->>'id'" "$oid"
reject "set role service_role;select public.pickup_create_order('synthetic-customer-2',repeat('9',64),r34_fixture.make_record('$key'::uuid))" IDEMPOTENCY_CONFLICT
pg "update public.menu_items set price=25 where id='kota-synthetic-25'" >/dev/null
expect "select count(*) from public.orders where idempotency_key='$key'" 1
expect "select count(*) from public.pickup_order_events where order_id='$oid' and kind='created'" 1
echo 'H5E_BASELINE DB_COMMIT_DISCARDED_RESPONSE replay=true orders=1 created_events=1 foreign_replay=denied'
cmd(){ printf "select public.pickup_order_command('synthetic-merchant','%s'::uuid,'%s','%s'::uuid,%s,null,%s,%s)" "$oid" "$1" "$2" "$3" "$4" "$5"; }
accept="$(cmd accept '00000000-0000-4000-8000-000000009202' 0 null false)"
ready="$(cmd ready '00000000-0000-4000-8000-000000009203' 1 null false)"
pay="$(cmd confirm_payment '00000000-0000-4000-8000-000000009204' 2 "'cash'" false)"
collect="$(cmd collect '00000000-0000-4000-8000-000000009205' 3 null true)"
expect "set role service_role;$accept->>'replayed'" false
expect "set role service_role;$ready->>'replayed'" false
job="$(pg "select q.id from public.pickup_push_outbox q join public.pickup_order_events e on e.id=q.event_id where e.order_id='$oid'")"
[[ "$job" =~ ^[0-9a-f-]{36}$ ]]
# Earlier collected fixture queues may be abandoned by the claim; new ready job is the only eligible one.
expect "set role service_role;select public.pickup_claim_push('unrelated-fixture') is null" t
expect "set role service_role;select public.pickup_claim_push('synthetic-customer')->>'id'" "$job"
lease1="$(pg "select lease_until from public.pickup_push_outbox where id='$job'")"
expect "select attempts from public.pickup_push_outbox where id='$job'" 1
expect "select (lease_until > statement_timestamp() and lease_until <= statement_timestamp()+interval '30 seconds') from public.pickup_push_outbox where id='$job'" t
finish(){ printf "select public.pickup_finish_push('%s','%s'::uuid,%s,'%s'::timestamptz,%s,false)" "$1" "$job" "$2" "$3" "$4"; }
sendable(){ printf "select public.pickup_push_sendable('%s','%s'::uuid,%s,'%s'::timestamptz,'%s')" "$1" "$job" "$2" "$3" "$4"; }
expect "set role service_role;$(sendable synthetic-customer 1 "$lease1" LOCAL_FAKE_FCM_TOKEN_DO_NOT_SEND)" t
expect "set role service_role;$(sendable unrelated-fixture 1 "$lease1" LOCAL_FAKE_FCM_TOKEN_DO_NOT_SEND)" f
expect "set role service_role;$(sendable synthetic-customer 1 "$lease1" WRONG_TOKEN)" f
expect "set role service_role;select public.pickup_claim_push('synthetic-customer') is null" t
# Advance ONLY synthetic row deadline (not production SQL/function clock).
pg "update public.pickup_push_outbox set lease_until=statement_timestamp()-interval '1 second' where id='$job'" >/dev/null
expired="$(pg "select lease_until from public.pickup_push_outbox where id='$job'")"
expect "set role service_role;$(finish synthetic-customer 1 "$expired" true)" f
expect "set role service_role;select public.pickup_claim_push('synthetic-customer')->>'id'" "$job"
lease2="$(pg "select lease_until from public.pickup_push_outbox where id='$job'")"
expect "select attempts from public.pickup_push_outbox where id='$job'" 2
expect "set role service_role;$(finish synthetic-customer 1 "$lease1" true)" f
expect "set role service_role;$(finish unrelated-fixture 2 "$lease2" true)" f
expect "set role service_role;$(sendable synthetic-customer 2 "$lease2" LOCAL_FAKE_FCM_TOKEN_DO_NOT_SEND)" t
expect "set role service_role;$(finish synthetic-customer 2 "$lease2" false)" t
expect "select state||':'||attempts from public.pickup_push_outbox where id='$job'" pending:2
expect "select (next_attempt_at>statement_timestamp()+interval '115 seconds' and next_attempt_at<=statement_timestamp()+interval '120 seconds') from public.pickup_push_outbox where id='$job'" t
expect "set role service_role;select public.pickup_claim_push('synthetic-customer') is null" t
echo 'H5E_BASELINE SQL_LEASE_FENCE expired_finish=denied old_attempt=denied foreign=denied backoff=120s'
# Simulated retry eligibility, exact functions again.
pg "update public.pickup_push_outbox set next_attempt_at=statement_timestamp()-interval '1 second' where id='$job'" >/dev/null
expect "set role service_role;select public.pickup_claim_push('synthetic-customer')->>'id'" "$job"
lease3="$(pg "select lease_until from public.pickup_push_outbox where id='$job'")"
expect "set role service_role;$(finish synthetic-customer 3 "$lease3" true)" t
expect "set role service_role;$(finish synthetic-customer 3 "$lease3" true)" f
expect "select state||':'||attempts from public.pickup_push_outbox where id='$job'" sent:3
# Commit payment and collection independently; response discarded, retry original command.
pg "begin;set local role service_role;$pay;commit;" >/dev/null
expect "set role service_role;$pay->>'replayed'" true
pg "begin;set local role service_role;$collect;commit;" >/dev/null
expect "set role service_role;$collect->>'replayed'" true
expect "select status||':'||payment_status||':'||revision from public.orders where id='$oid'" collected:paid:4
expect "select count(*) from public.pickup_order_events where order_id='$oid' and kind='payment_confirmed'" 1
expect "select count(*) from public.pickup_order_events where order_id='$oid' and kind='collected'" 1
expect "select count(*) from public.pickup_push_outbox q join public.pickup_order_events e on e.id=q.event_id where e.order_id='$oid'" 1
echo 'H5E_BASELINE COMMITTED_COMMAND_REPLAY payment_events=1 collected_events=1 outbox=1'
echo H5E_DISPOSABLE_DB_PASS
