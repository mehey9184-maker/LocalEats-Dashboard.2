#!/usr/bin/env bash
# R3.5 disposable PostgreSQL 17 ONLY, no remote Supabase connection.
# Apply UNMODIFIED reviewed pickup drafts + observed effective payment guard.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
r34="$here/../r34"
# Two explicit, disconnected sources: historical recorded statement archive
# or the previous review-draft/effective-behavior lab. NEVER choose by URL.
case "${R36_PICKUP_REPLAY_MODE:-r35_draft}" in
  r35_draft)
    foundation="$repo/supabase/drafts/pickup_launch_foundation.sql"
    zero_fee="$repo/supabase/drafts/pickup_zero_fee.sql"
    availability="$repo/supabase/drafts/merchant_availability.sql"
    methods="$here/effective-payment-methods.SYNTHETIC_ONLY.sql"
    ;;
  recorded_applied)
    archive="$repo/supabase/recovered_applied_readonly"
    foundation="$archive/20261030111305_pickup_launch_foundation.sql.txt"
    zero_fee="$archive/20261031073608_pickup_zero_fee.sql.txt"
    availability="$archive/20261031073645_merchant_availability.sql.txt"
    methods="$archive/20261101160331_pickup_payment_methods.sql.txt"
    ;;
  *)
    echo "R36_INVALID_DISPOSABLE_REPLAY_MODE" >&2;exit 1
    ;;
esac
name="localeats_pickup_r35_${BASHPID}"
tmp="$(mktemp -d)"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT

for file in \
 "$r34/baseline.SYNTHETIC_ONLY.sql" \
 "$r34/fixtures.SYNTHETIC_ONLY.sql" \
 "$r34/checkout-e2e.SYNTHETIC_ONLY.sql" \
 "$methods" \
 "$here/payment-pre-e2e.SYNTHETIC_ONLY.sql" \
 "$here/payment-post-e2e.SYNTHETIC_ONLY.sql" \
 "$foundation" \
 "$zero_fee" \
 "$availability"; do
 if [[ ! -f "$file" ]]; then
   echo "R35_REQUIRED_SOURCE_MISSING: $file" >&2;exit 1
 fi
done

docker run -d --name "$name" --rm \
 -e POSTGRES_PASSWORD=isolated_ci_only \
 -e POSTGRES_DB=pickup_r35_lab postgres:17-alpine >/dev/null
ready=0
for attempt in $(seq 1 45); do
 if docker logs "$name" 2>&1 | grep -q 'PostgreSQL init process complete; ready for start up.' &&
    docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d pickup_r35_lab -c 'SELECT 1' 2>/dev/null | grep -qx '1'; then
   ready=1;break
 fi
 sleep 1
done
if [[ "$ready" -ne 1 ]]; then echo "R35_POSTGRES17_NOT_READY" >&2;exit 1;fi
pg(){
 docker exec "$name" psql -X -A -t -q -v ON_ERROR_STOP=1 \
  -U postgres -d pickup_r35_lab -c "$1"
}
run_file(){
 docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 \
  -U postgres -d pickup_r35_lab <"$1"
}
assert_query(){
 local actual
 actual="$(pg "$1")"
 if [[ "$actual" != "$2" ]]; then
   echo "R35_ASSERTION_FAILED expected=$2 actual=$actual" >&2
   echo "$1" >&2;exit 1
 fi
}
restore_query(){
 docker exec "$name" psql -X -A -t -q -v ON_ERROR_STOP=1 \
  -U postgres -d pickup_r35_restore -c "$1"
}
restore_expect(){
 local actual
 actual="$(restore_query "$1")"
 if [[ "$actual" != "$2" ]]; then
   echo "R35_SCHEMA_ONLY_RESTORE_MISMATCH expected=$2 actual=$actual" >&2
   echo "$1" >&2;exit 1
 fi
}

echo "R3.5: restore minimal legacy prerequisites and original checked-in pickup SQL"
run_file "$r34/baseline.SYNTHETIC_ONLY.sql" >"$tmp/baseline.log"
run_file "$foundation" >"$tmp/foundation.log"
run_file "$zero_fee" >"$tmp/zero-fee.log"
run_file "$availability" >"$tmp/availability.log"
echo "R3.5: apply SELECT-only OBSERVED effective payment-methods behavior, OFFLINE"
run_file "$methods" >"$tmp/pay-methods.log"
run_file "$r34/fixtures.SYNTHETIC_ONLY.sql" >"$tmp/fixtures.log"
run_file "$here/payment-pre-e2e.SYNTHETIC_ONLY.sql" >"$tmp/payment-pre.log"
grep -q 'R35_EFFECTIVE_PAYMENT_METHODS_PRECHECK_PASS' "$tmp/payment-pre.log"
echo "R3.5: original PG17 customer-to-merchant SQL journey with configured methods"
run_file "$r34/checkout-e2e.SYNTHETIC_ONLY.sql" >"$tmp/e2e.log"
grep -q 'R34_UNMODIFIED_PICKUP_SQL_ZERO_FEE_CREATE_TO_COLLECT_AND_PUSH_PASS' "$tmp/e2e.log"
run_file "$here/payment-post-e2e.SYNTHETIC_ONLY.sql" >"$tmp/payment-post.log"
grep -q 'R35_EFFECTIVE_PAYMENT_METHODS_AND_PICKUP_E2E_PASS' "$tmp/payment-post.log"

assert_query "SELECT count(*) FROM public.orders;" "3"
assert_query "SELECT count(*) FROM public.pickup_order_events;" "8"
assert_query "SELECT count(*) FROM public.pickup_push_outbox;" "1"
assert_query "SELECT count(*) FROM public.orders WHERE delivery_type IS DISTINCT FROM 'collection' OR rider_id IS NOT NULL;" "0"
assert_query "SELECT COALESCE(sum(service_fee),0) FROM public.orders;" "0"
assert_query "SELECT md5(regexp_replace(btrim(p.prosrc),'[[:space:]]+',' ','g'))
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='pickup_payment_method_guard';" \
 "adcd87f7cb49525cd18876c8b2cd057a"

echo "R3.5: SCHEMA-ONLY dump of fabricated public tables and checked-in SQL"
docker exec "$name" pg_dump -U postgres -d pickup_r35_lab \
 --schema-only --schema=public -F c -f /tmp/r35-synthetic-schema.dump
docker exec "$name" createdb -U postgres pickup_r35_restore
docker exec "$name" psql -X -q -v ON_ERROR_STOP=1 -U postgres \
 -d pickup_r35_restore -c 'DROP SCHEMA IF EXISTS public CASCADE;' >"$tmp/drop-empty-public.log"
docker exec "$name" pg_restore -U postgres --no-owner \
 -d pickup_r35_restore /tmp/r35-synthetic-schema.dump >"$tmp/restore.log" 2>"$tmp/restore.err" || {
  cat "$tmp/restore.err" >&2;exit 1;
 }

# Schema-only recovery must contain ZERO synthetic data but all protection.
restore_expect "SELECT count(*) FROM public.orders;" "0"
restore_expect "SELECT count(*) FROM public.pickup_order_events;" "0"
restore_expect "SELECT count(*) FROM public.pickup_push_outbox;" "0"
restore_expect "SELECT pg_catalog.format_type(a.atttypid,a.atttypmod)
 FROM pg_catalog.pg_attribute a
 WHERE a.attrelid='public.shops'::regclass AND a.attname='pickup_payment_methods';" "text[]"
restore_expect "SELECT md5(regexp_replace(btrim(p.prosrc),'[[:space:]]+',' ','g'))
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='pickup_create_order';" \
 "70cb4891b1ff47c5f15cb112e192bad8"
restore_expect "SELECT md5(regexp_replace(btrim(p.prosrc),'[[:space:]]+',' ','g'))
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='pickup_order_command';" \
 "303bef1097192d096ba3340d87c16f02"
restore_expect "SELECT md5(regexp_replace(btrim(p.prosrc),'[[:space:]]+',' ','g'))
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='merchant_set_pickup_payment_methods';" \
 "149d5a7fbe51f29561800479b1c2ca2c"
restore_expect "SELECT count(*) FROM pg_catalog.pg_trigger t
 JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
 WHERE c.oid='public.orders'::regclass AND t.tgname IN
 ('guard_pickup_order','pickup_payment_method_before_insert',
 'pickup_shop_availability','require_pickup_fact_event') AND t.tgenabled='O';" "4"
restore_expect "SELECT convalidated FROM pg_catalog.pg_constraint
 WHERE conrelid='public.shops'::regclass
 AND conname='shops_pickup_payment_methods_valid';" "f"
restore_expect "SELECT has_function_privilege('anon',
 'public.pickup_order_command(text,uuid,text,uuid,bigint,text,text,boolean)','EXECUTE');" "f"
restore_expect "SELECT has_function_privilege('authenticated',
 'public.merchant_set_pickup_payment_methods(text,text,text[],text[])','EXECUTE');" "f"
restore_expect "SELECT has_function_privilege('service_role',
 'public.pickup_create_order(text,text,jsonb)','EXECUTE');" "t"
restore_expect "SELECT c.relrowsecurity FROM pg_catalog.pg_class c
 WHERE c.oid='public.pickup_order_events'::regclass;" "t"

echo "R35_OFFLINE_EFFECTIVE_PAYMENT_SOURCE_AND_SCHEMA_ONLY_RESTORE_PASS"
