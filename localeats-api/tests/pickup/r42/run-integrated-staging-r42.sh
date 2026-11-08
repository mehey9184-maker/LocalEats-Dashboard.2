#!/usr/bin/env bash
# R4.2: One disposable PG17 database. Archived pickup DDL plus fake legacy
# payments, R3.9 permission hardening, checkout and schema-only restore.
# NEVER connects to Supabase or publishes a database port.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
r34="$root/localeats-api/tests/pickup/r34"
r35="$root/localeats-api/tests/pickup/r35"
archive="$root/supabase/recovered_applied_readonly"
plan="$root/localeats-api/tests/pickup/r39/payments-access-hardening.REVIEW_ONLY.sql.txt"
name="localeats_r42_disposable_$$"
tmp="$(mktemp -d)"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT

for f in \
 "$r34/baseline.SYNTHETIC_ONLY.sql" "$r34/fixtures.SYNTHETIC_ONLY.sql" \
 "$r34/checkout-e2e.SYNTHETIC_ONLY.sql" \
 "$r35/payment-pre-e2e.SYNTHETIC_ONLY.sql" "$r35/payment-post-e2e.SYNTHETIC_ONLY.sql" \
 "$archive/20261030111305_pickup_launch_foundation.sql.txt" \
 "$archive/20261031073608_pickup_zero_fee.sql.txt" \
 "$archive/20261031073645_merchant_availability.sql.txt" \
 "$archive/20261101160331_pickup_payment_methods.sql.txt" \
 "$here/legacy-payment-fixture.SYNTHETIC_ONLY.sql" "$plan";do
 [[ -f "$f" ]] || { echo "R42_SOURCE_MISSING" >&2;exit 1; }
done

# Unchanged R3.9 review template; only substitute known FAKE scratch roles.
sed -e 's/__SCHEMA__/public/g' \
 -e 's/__ANON_ROLE__/anon/g' \
 -e 's/__CLIENT_ROLE__/authenticated/g' \
 -e 's/__BACKEND_ROLE__/service_role/g' "$plan" > "$tmp/hardening.sql"
if grep -Eq '__SCHEMA__|__ANON_ROLE__|__CLIENT_ROLE__|__BACKEND_ROLE__' "$tmp/hardening.sql";then
 echo "R42_UNEXPANDED_REVIEW_PLACEHOLDER" >&2;exit 1
fi

docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=R42_disposable_only \
 -e POSTGRES_DB=r42_rehearsal postgres:17-alpine >/dev/null
ready=0
for attempt in $(seq 1 45);do
 if docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres \
  -d r42_rehearsal -c "SELECT 1" 2>/dev/null | grep -qx 1;then ready=1;break;fi
 sleep 1
done
[[ "$ready" == 1 ]] || { echo "R42_POSTGRES_NOT_READY" >&2;exit 1; }

pg(){ docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d r42_rehearsal -c "$1"; }
load(){ docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d r42_rehearsal < "$1"; }
expect(){ local got;got="$(pg "$1")";[[ "$got" == "$2" ]] || {
 echo "R42_EXPECTED:$2 GOT:$got" >&2;exit 1; }; }
denied(){
 local failure
 if failure="$(pg "$1" 2>&1)";then echo "R42_UNEXPECTED_CLIENT_ACCESS" >&2;exit 1;fi
 [[ "$failure" == *"permission denied"* ]] || { echo "R42_UNEXPECTED_ERROR:$failure" >&2;exit 1; }
}
restore(){ docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d r42_restored -c "$1"; }
restore_expect(){ local got;got="$(restore "$1")";[[ "$got" == "$2" ]] || {
 echo "R42_RESTORE_EXPECTED:$2 GOT:$got" >&2;exit 1; }; }

# Historical pickup chain as recorded in the applied-migrations ledger.
load "$r34/baseline.SYNTHETIC_ONLY.sql" > "$tmp/baseline.log"
load "$archive/20261030111305_pickup_launch_foundation.sql.txt" > "$tmp/foundation.log"
load "$archive/20261031073608_pickup_zero_fee.sql.txt" > "$tmp/zero-fee.log"
load "$archive/20261031073645_merchant_availability.sql.txt" > "$tmp/availability.log"
load "$archive/20261101160331_pickup_payment_methods.sql.txt" > "$tmp/methods.log"
load "$r34/fixtures.SYNTHETIC_ONLY.sql" > "$tmp/fixtures.log"
load "$r35/payment-pre-e2e.SYNTHETIC_ONLY.sql" > "$tmp/payment-before.log"
grep -q "R35_EFFECTIVE_PAYMENT_METHODS_PRECHECK_PASS" "$tmp/payment-before.log"
load "$r34/checkout-e2e.SYNTHETIC_ONLY.sql" > "$tmp/pickup.log"
grep -q "R34_UNMODIFIED_PICKUP_SQL_ZERO_FEE_CREATE_TO_COLLECT_AND_PUSH_PASS" "$tmp/pickup.log"
load "$r35/payment-post-e2e.SYNTHETIC_ONLY.sql" > "$tmp/payment-after.log"
grep -q "R35_EFFECTIVE_PAYMENT_METHODS_AND_PICKUP_E2E_PASS" "$tmp/payment-after.log"
expect "SELECT count(*) FROM public.orders;" "3"
expect "SELECT count(*) FROM public.pickup_order_events;" "8"
expect "SELECT count(*) FROM public.pickup_push_outbox;" "1"
expect "SELECT count(*) FROM public.orders WHERE delivery_type IS DISTINCT FROM 'collection' OR rider_id IS NOT NULL;" "0"

# The synthetic legacy payments are installed in the SAME pickup SQL database.
load "$here/legacy-payment-fixture.SYNTHETIC_ONLY.sql" > "$tmp/legacy-payments.log"
expect "SELECT count(*) FROM public.payments;" "2"
expect "SELECT sum(amount) FROM public.payments;" "4250"
expect "SET SESSION AUTHORIZATION authenticated; SELECT count(*) FROM public.payments;" "2"

# Unexpected policy drift MUST fail before any grant, row or policy changes.
pg 'ALTER POLICY "Payments access" ON public.payments USING (false) WITH CHECK (false);' >/dev/null
if load "$tmp/hardening.sql" > "$tmp/preflight.log" 2>&1;then
 echo "R42_POLICY_DRIFT_NOT_REJECTED" >&2;exit 1
fi
grep -q "R39_LEGACY_PAYMENT_POLICY_NOT_AS_REVIEWED" "$tmp/preflight.log" || {
 cat "$tmp/preflight.log" >&2;exit 1; }
expect "SELECT has_table_privilege('authenticated','public.payments','SELECT');" "t"
expect "SELECT count(*) FROM public.payments;" "2"
pg 'ALTER POLICY "Payments access" ON public.payments USING (true) WITH CHECK (true);' >/dev/null

# Apply exact R3.9 candidate to synthetic public.payments, NOT connected DB.
load "$tmp/hardening.sql" > "$tmp/hardened.log"
for role in anon authenticated;do
 for privilege in SELECT INSERT UPDATE DELETE;do
  expect "SELECT has_table_privilege('$role','public.payments','$privilege');" "f"
 done
done
expect "SELECT has_table_privilege('service_role','public.payments','SELECT');" "t"
denied "SET SESSION AUTHORIZATION authenticated; SELECT * FROM public.payments;"
denied "SET SESSION AUTHORIZATION authenticated; UPDATE public.payments SET amount=0;"
denied "SET SESSION AUTHORIZATION anon; SELECT * FROM public.payments;"
denied "SET SESSION AUTHORIZATION authenticated; SET ROLE service_role;"
expect "SELECT count(*) FROM public.payments;" "2"
expect "SELECT sum(amount) FROM public.payments;" "4250"

# This is ONLY a synthetic example of a server-side shop-scoped read.
# Real API must independently verify Firebase UID and numeric/text ID mapping.
expect "SET SESSION AUTHORIZATION service_role;
 SELECT count(*) FROM public.payments p JOIN public.shops s
 ON s.id=p.shop_id::text WHERE s.owner_id='R42_FAKE_MERCHANT_A';" "1"
expect "SET SESSION AUTHORIZATION service_role;
 SELECT count(*) FROM public.payments p JOIN public.shops s
 ON s.id=p.shop_id::text WHERE s.owner_id='R42_FAKE_MERCHANT_B';" "1"

# A new fake cash pickup still persists after the permission change.
pg "DO \$r42_post\$
DECLARE result jsonb;
BEGIN
 result:=public.pickup_create_order('synthetic-customer',repeat('d',64),
  r34_fixture.make_record('00000000-0000-4000-8000-000000009042'::uuid));
 IF result->'order'->>'status'<>'pending'
 OR result->'order'->>'payment_status'<>'unpaid'
 OR (result->'order'->>'service_fee')::numeric<>0
 THEN RAISE EXCEPTION 'R42_POST_POLICY_PICKUP_BROKEN';END IF;
END;
\$r42_post\$;" >/dev/null
expect "SELECT count(*) FROM public.orders;" "4"
expect "SELECT count(*) FROM public.pickup_order_events;" "9"
expect "SELECT count(*) FROM public.pickup_push_outbox;" "1"
expect "SELECT count(*) FROM public.orders WHERE delivery_type IS DISTINCT FROM 'collection' OR rider_id IS NOT NULL;" "0"
expect "SELECT count(*) FROM public.payments;" "2"

# Backup contains SCHEMA ONLY, and restore must preserve security boundaries.
docker exec "$name" pg_dump -U postgres -d r42_rehearsal \
 --schema-only --schema=public --schema=r34_fixture -F c -f /tmp/r42-synthetic-schema.dump
docker exec "$name" createdb -U postgres r42_restored
docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres \
 -d r42_restored -c "DROP SCHEMA IF EXISTS public CASCADE;" >/dev/null
docker exec "$name" pg_restore -U postgres --no-owner -d r42_restored \
 /tmp/r42-synthetic-schema.dump > "$tmp/restore.log" 2> "$tmp/restore.err" || {
 cat "$tmp/restore.err" >&2;exit 1; }
for tablename in orders payments pickup_order_events pickup_push_outbox;do
 restore_expect "SELECT count(*) FROM public.$tablename;" "0"
done
restore_expect "SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='public.payments'::regclass;" "t"
restore_expect "SELECT has_table_privilege('authenticated','public.payments','SELECT');" "f"
restore_expect "SELECT has_table_privilege('anon','public.payments','INSERT');" "f"
restore_expect "SELECT has_table_privilege('service_role','public.payments','SELECT');" "t"
restore_expect "SELECT has_function_privilege('authenticated',
 'public.pickup_create_order(text,text,jsonb)','EXECUTE');" "f"
restore_expect "SELECT count(*) FROM pg_catalog.pg_trigger t
 WHERE t.tgrelid='public.orders'::regclass
 AND t.tgname IN ('guard_pickup_order','require_pickup_fact_event')
 AND t.tgenabled='O';" "2"
echo "R42_INTEGRATED_HISTORICAL_PICKUP_AND_PAYMENT_POLICY_RESTORE_PASS"