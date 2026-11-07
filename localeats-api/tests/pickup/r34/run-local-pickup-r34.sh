#!/usr/bin/env bash
# R3.4: free/disposable PostgreSQL 17 pickup contract test.
# Run this from a repo checkout. Does NOT connect to Supabase or publish ports.
# Executes UNMODIFIED checked-in pickup SQL drafts, NEVER production SQL.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
name="localeats_pickup_r34_$$"
tmp="$(mktemp -d)"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT

for required in \
  "$here/baseline.SYNTHETIC_ONLY.sql" \
  "$here/fixtures.SYNTHETIC_ONLY.sql" \
  "$here/checkout-e2e.SYNTHETIC_ONLY.sql" \
  "$repo/supabase/drafts/pickup_launch_foundation.sql" \
  "$repo/supabase/drafts/pickup_zero_fee.sql" \
  "$repo/supabase/drafts/merchant_availability.sql"; do
  if [[ ! -f "$required" ]]; then
    echo "R34_MISSING_CHECKED_IN_PICKUP_SQL: $required" >&2; exit 1
  fi
done
docker run -d --name "$name" --rm \
  -e POSTGRES_PASSWORD=disposable_only \
  -e POSTGRES_DB=pickup_r34_lab postgres:17-alpine >/dev/null
ready=0
for attempt in $(seq 1 45); do
 if docker logs "$name" 2>&1 | grep -q 'PostgreSQL init process complete; ready for start up.' &&
  docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d pickup_r34_lab -c 'SELECT 1' 2>/dev/null | grep -qx '1'; then
   ready=1;break
 fi
 sleep 1
done
if [[ "$ready" -ne 1 ]]; then echo "R34_POSTGRES17_NOT_READY" >&2;exit 1; fi

pg(){
 docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d pickup_r34_lab -c "$1"
}
run_file(){
 docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d pickup_r34_lab <"$1"
}
assert_query(){
 local value
 value="$(pg "$1")"
 if [[ "$value" != "$2" ]]; then
  echo "R34_ASSERT_FAIL expected='$2' actual='$value' query=$1" >&2
  exit 1
 fi
}
expect_error(){
 local token="$1" sql="$2"
 if pg "$sql" >"$tmp/negative.out" 2>"$tmp/negative.err"; then
   echo "R34_UNEXPECTED_SUCCESS: $sql" >&2;exit 1
 fi
 if ! grep -Fq "$token" "$tmp/negative.err"; then
  cat "$tmp/negative.err" >&2
  echo "R34_UNEXPECTED_ERROR expected=$token" >&2;exit 1
 fi
}
paired(){
 local a b
 pg "$1" >"$tmp/a.out" 2>"$tmp/a.err" & a=$!
 pg "$2" >"$tmp/b.out" 2>"$tmp/b.err" & b=$!
 if wait "$a"; then status_a=0; else status_a=$?; fi
 if wait "$b"; then status_b=0; else status_b=$?; fi
}

echo "R34: bootstrap synthetic legacy prerequisites in disposable PostgreSQL 17"
run_file "$here/baseline.SYNTHETIC_ONLY.sql" >"$tmp/baseline.out"
echo "R34: apply exact checked-in pickup foundation DDL/RPCs (no rewriting)"
run_file "$repo/supabase/drafts/pickup_launch_foundation.sql" >"$tmp/foundation.out"
echo "R34: apply zero service-fee draft, with its original function drift preflight"
run_file "$repo/supabase/drafts/pickup_zero_fee.sql" >"$tmp/zero-fee.out"
echo "R34: apply original merchant availability draft and order availability guard"
run_file "$repo/supabase/drafts/merchant_availability.sql" >"$tmp/availability.out"
run_file "$here/fixtures.SYNTHETIC_ONLY.sql" >"$tmp/fixture.out"
echo "R34: verify real pickup function fingerprints and one complete paid pickup flow"
run_file "$here/checkout-e2e.SYNTHETIC_ONLY.sql" >"$tmp/e2e.out"
grep -q 'R34_UNMODIFIED_PICKUP_SQL_ZERO_FEE_CREATE_TO_COLLECT_AND_PUSH_PASS' "$tmp/e2e.out"
assert_query "SELECT count(*) FROM public.orders;" "2"
assert_query "SELECT count(*) FROM public.pickup_order_events;" "7"
assert_query "SELECT count(*) FROM public.pickup_push_outbox;" "1"
assert_query "SELECT status FROM public.pickup_push_outbox LIMIT 1;" "sent" 2>/dev/null && {
 echo "R34 wrong push column check should not pass" >&2;exit 1;
} || true
assert_query "SELECT state FROM public.pickup_push_outbox LIMIT 1;" "sent"

echo "R34: real SQL privileges under untrusted session authorization"
expect_error 'permission denied' "SET SESSION AUTHORIZATION anon; SELECT public.pickup_create_order(
 'fake',repeat('a',64),'{}'::jsonb);"
expect_error 'permission denied' "SET SESSION AUTHORIZATION authenticated;
 SELECT public.pickup_order_command('fake',gen_random_uuid(),'accept',gen_random_uuid(),0);"
expect_error 'permission denied' "SET SESSION AUTHORIZATION authenticated;
 INSERT INTO public.orders(shop_id,status) VALUES('my-kota-synthetic','pending');"

echo "R34: deferred event constraint must roll back direct state-only changes"
rollback_order="$(pg "SELECT (public.pickup_create_order('rollback-user',repeat('d',64),
 r34_fixture.make_record('00000000-0000-4000-8000-000000008940'::uuid))->'order'->>'id')")"
[[ "$rollback_order" =~ ^[0-9a-f-]{36}$ ]] || { echo "R34 invalid rollback fixture id" >&2;exit 1; }
expect_error 'PICKUP_ATOMIC_EVENT_REQUIRED' "BEGIN;
 UPDATE public.orders SET status='preparing',revision=1
 WHERE id='$rollback_order'::uuid;
 COMMIT;"
assert_query "SELECT status||':'||revision FROM public.orders
 WHERE id='$rollback_order'::uuid;" "pending:0"
assert_query "SELECT count(*) FROM public.pickup_order_events
 WHERE order_id='$rollback_order'::uuid;" "1"
expect_error 'PICKUP_CREATION_FACTS_IMMUTABLE' "UPDATE public.orders SET price=1
 WHERE id='$rollback_order'::uuid;"
expect_error 'PICKUP_EVENT_REVISION_INVALID' "INSERT INTO public.pickup_order_events(
 order_id,revision,command_id,command_hash,kind,actor_uid)
 VALUES('$rollback_order'::uuid,10,gen_random_uuid(),repeat('a',64),'accepted','synthetic-merchant');"
assert_query "SELECT count(*) FROM public.pickup_order_events
 WHERE order_id='$rollback_order'::uuid;" "1"

echo "R34: concurrent identical create intents cannot produce duplicate orders/events"
intent="SELECT public.pickup_create_order('race-customer',repeat('e',64),
 r34_fixture.make_record('00000000-0000-4000-8000-000000008950'::uuid));"
paired "$intent" "$intent"
if [[ "$status_a" -ne 0 || "$status_b" -ne 0 ]];then
 cat "$tmp/a.err" "$tmp/b.err" >&2
 echo "R34_CONCURRENT_CREATE_FAILED" >&2;exit 1
fi
assert_query "SELECT count(*) FROM public.orders
 WHERE idempotency_key='00000000-0000-4000-8000-000000008950';" "1"
assert_query "SELECT count(*) FROM public.pickup_order_events e JOIN public.orders o
 ON o.id=e.order_id WHERE o.idempotency_key=
 '00000000-0000-4000-8000-000000008950' AND e.kind='created';" "1"
assert_query "SELECT count(*) FROM public.orders;" "4"
assert_query "SELECT count(*) FROM public.pickup_push_outbox;" "1"
assert_query "SELECT COALESCE(sum(service_fee),0) FROM public.orders;" "0"
assert_query "SELECT count(*) FROM public.orders WHERE delivery_type IS DISTINCT FROM 'collection'
 OR rider_id IS NOT NULL;" "0"

echo "R34_ACTUAL_REPO_PICKUP_SQL_OFFLINE_E2E_ATOMICITY_CONCURRENCY_PASS"
