#!/usr/bin/env bash
# Synthetic PostgreSQL row-lock and transactional race assertions only.
# Invoked AFTER ci-isolated-journey.sh creates its disposable schema.
set -euo pipefail

if [[ "${PICKUP_TEST_ISOLATED:-}" != "1" ||
      "${PGDATABASE:-}" != "local_pickup_qa" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGUSER:-}" != "postgres" ||
      "${PGPORT:-}" != "5432" ||
      "${PGSSLMODE:-}" != "disable" ||
      -n "${DATABASE_URL:-}" || -n "${SUPABASE_URL:-}" ]]; then
  echo "REFUSED: concurrent tests must use the disposable loopback fixture" >&2
  exit 22
fi

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
run() { psql -X -v ON_ERROR_STOP=1 -f "localeats-api/tests/pickup/$1.sql"; }

# Two identical requests must serialize through the advisory lock. The
# function returns the same id, but only one persisted order/event exists.
run race-create >"$dir/create1.out" 2>"$dir/create1.err" &
a=$!
run race-create >"$dir/create2.out" 2>"$dir/create2.err" &
b=$!
wait "$a"; wait "$b"
if [[ "$(psql -X -At -v ON_ERROR_STOP=1 -c "
select count(*) from public.orders where idempotency_key='550e8400-e29b-41d4-a716-000000000050'
")" != "1" ]]; then
  echo "Concurrent create persisted duplicate orders" >&2;exit 23
fi
if [[ "$(psql -X -At -v ON_ERROR_STOP=1 -c "
select count(*) from public.pickup_order_events e join public.orders o on o.id=e.order_id
where o.idempotency_key='550e8400-e29b-41d4-a716-000000000050' and e.kind='created'
")" != "1" ]]; then
  echo "Concurrent create persisted duplicate events" >&2;exit 24
fi
echo "PICKUP_CONCURRENT_IDEMPOTENT_CREATE_PASSED"

# Accept/cancel races must have exactly one successful revision-0 update.
run race-accept >"$dir/accept.out" 2>"$dir/accept.err" & accept_pid=$!
run race-cancel >"$dir/cancel.out" 2>"$dir/cancel.err" & cancel_pid=$!
accepted=0; cancelled=0
if wait "$accept_pid";then accepted=1;fi
if wait "$cancel_pid";then cancelled=1;fi
if [[ "$((accepted+cancelled))" != "1" ]]; then
  echo "Accept/cancel race did not have exactly one winner" >&2;exit 25
fi
if [[ "$accepted" == "1" ]];then loser="cancel";else loser="accept";fi
if ! grep -q 'ORDER_STATE_CHANGED' "$dir/$loser.err";then
  echo "Unexpected losing race error" >&2;exit 26
fi
run race-verify >"$dir/race-verify.out"
echo "PICKUP_ACCEPT_CANCEL_EXCLUSIVE_RACE_PASSED"

# A shop-close transaction must win before an order create if it takes the
# shop lock first. The blocked create must fail without persisting an order.
run availability-race-close >"$dir/close.out" 2>"$dir/close.err" & close_pid=$!
lock_seen=0
for i in $(seq 1 80);do
  if [[ "$(psql -X -At -v ON_ERROR_STOP=1 -c "
select exists(select 1 from pg_locks where relation='public.shops'::regclass
and mode='RowExclusiveLock' and granted)")" == "t" ]];then
    lock_seen=1;break
  fi
  sleep .02
done
if [[ "$lock_seen" != "1" ]];then
  wait "$close_pid" || true
  echo "Shop close transaction did not establish the expected lock" >&2;exit 27
fi
run availability-race-create >"$dir/attempt.out" 2>"$dir/attempt.err" & create_pid=$!
if ! wait "$close_pid";then
  echo "Shop-close transaction failed" >&2;exit 28
fi
if wait "$create_pid";then
  echo "A new pickup order was accepted after a concurrent shop close" >&2;exit 29
fi
if ! grep -q 'SHOP_UNAVAILABLE' "$dir/attempt.err";then
  echo "Unexpected close/create race result" >&2;exit 30
fi
run availability-race-verify >"$dir/availability.out"
echo "PICKUP_CLOSE_DURING_CREATE_PROTECTION_PASSED"
