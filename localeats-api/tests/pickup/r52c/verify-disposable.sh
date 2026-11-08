#!/usr/bin/env bash
set -euo pipefail

# R5.2C: ONLY disposable PostgreSQL on loopback, never hosted Supabase.
test "$PGHOST" = '127.0.0.1'
test "$PGPORT" = '5432'
test "$PGDATABASE" = 'r52c_synthetic_only'
test "$PGUSER" = 'postgres'
test "$R52C_SYNTHETIC_ONLY" = 'yes'
for key in DATABASE_URL DIRECT_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY FIREBASE_PROJECT_ID FIREBASE_PRIVATE_KEY GOOGLE_APPLICATION_CREDENTIALS; do
  test -z "$(printenv "$key" || true)"
done
test "$PICKUP_WRITES_ENABLED" = 'false'
test "$REWARDS_ACTIVATION_ENABLED" = 'false'
test "$LOCALPAY_LIVE_WALLET_ENABLED" = 'false'

sql='localeats-api/tests/pickup/r52c/schema.SYNTHETIC_ONLY.sql'

# Wrong database must fail before CREATE ROLE, CREATE TABLE or other DDL.
if PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 -f "$sql" >/dev/null 2>&1; then
  echo 'UNSAFE: R5.2C SQL accepted a non-disposable database' >&2; exit 1
fi
if PGOPTIONS='' psql -X -v ON_ERROR_STOP=1 -f "$sql" >/dev/null 2>&1; then
  echo 'UNSAFE: R5.2C SQL accepted a missing synthetic flag' >&2; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -f "$sql" >/dev/null

# No implicit data or public access.
test "$(psql -X -At -c "select count(*) from public.orders")" = '0'
test "$(psql -X -At -c "select count(*) from public.shops")" = '0'
test "$(psql -X -At -c "select count(*) from public.pickup_order_events")" = '0'
test "$(psql -X -At -c "select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('shops','menu_items','orders','pickup_order_events') and c.relrowsecurity and c.relforcerowsecurity")" = '4'
test "$(psql -X -At -c "select count(*) from pg_catalog.pg_policies where schemaname='public' and policyname like 'r52c_api_ro_%' and cmd='SELECT'")" = '4'
test "$(psql -X -At -c "select data_type from information_schema.columns where table_schema='public' and table_name='orders' and column_name='revision'")" = 'bigint'
test "$(psql -X -At -c "select data_type from information_schema.columns where table_schema='public' and table_name='orders' and column_name='items'")" = 'jsonb'
test "$(psql -X -At -c "select data_type from information_schema.columns where table_schema='public' and table_name='pickup_order_events' and column_name='order_id'")" = 'uuid'

if psql -X -v ON_ERROR_STOP=1 -c 'SET ROLE r52c_browser; SELECT count(*) FROM public.orders' >/dev/null 2>&1; then
 echo 'UNSAFE: R5.2C synthetic browser could read orders' >&2; exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c 'SET ROLE r52c_browser; SELECT count(*) FROM public.shops_with_availability' >/dev/null 2>&1; then
 echo 'UNSAFE: R5.2C synthetic browser could read availability view' >&2; exit 1
fi
test "$(psql -X -At -c 'SET ROLE r52c_api_reader; SELECT count(*) FROM public.orders' | tail -n1)" = '0'
if psql -X -v ON_ERROR_STOP=1 -c "SET ROLE r52c_api_reader; INSERT INTO public.shops(id,name) VALUES ('should-not-write','no')" >/dev/null 2>&1; then
 echo 'UNSAFE: R5.2C API-reader role could insert shops' >&2; exit 1
fi
test "$(psql -X -At -c "select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('pickup_create_order','pickup_order_command')")" = '0'

# A completely fictitious shop is inserted only into the disposable lab.
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO public.shops (id,name,is_active,approval_status) VALUES ('r52c-fixture','Synthetic never-live shop',true,'approved')" >/dev/null
test "$(psql -X -At -c "SELECT effective_is_active FROM public.shops_with_availability WHERE id='r52c-fixture'")" = 'f'
echo "R5.2C synthetic PG17 schema: isolated, read-only, RLS-denied, forced-closed PASS"
