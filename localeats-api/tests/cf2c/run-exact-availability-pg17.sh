#!/usr/bin/env bash
# CF2-C exact-source availability + narrow-role probe, DISPOSABLE ONLY.
set -Eeuo pipefail
sql="localeats-api/tests/cf2c/exact-availability.SYNTHETIC_ONLY.sql"
[[ $# == 0 && -f "$sql" ]] || { echo "CF2C_INVALID_INPUT" >&2; exit 1; }
command -v docker >/dev/null || { echo "CF2C_DOCKER_REQUIRED" >&2; exit 1; }
name="cf2c-pg17-$(date +%s)-$RANDOM"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$name" --rm \
  -e POSTGRES_PASSWORD=synthetic_test_only \
  -e POSTGRES_DB=cf2c_fixture postgres:17-alpine >/dev/null

ready=0
for _ in $(seq 1 45); do
 if docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
  -U postgres -d cf2c_fixture -c 'SELECT 1' 2>/dev/null | grep -qx 1; then
  ready=1; break
 fi
 sleep 1
done
[[ $ready == 1 ]] || { echo "CF2C_PG17_NOT_READY" >&2; exit 1; }

node --test localeats-api/tests/cf2c/exact-availability-source-parity.test.mjs
docker exec -i "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
  -U postgres -d cf2c_fixture < "$sql" \
  | grep -qx CF2C_EXACT_AVAILABILITY_SQL_AND_RESTRICTED_ROLE_PARITY_PASS

must_deny() {
 local test_case="$1" statement="$2"
 if docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
     -U postgres -d cf2c_fixture \
     -c "SET ROLE cf2c_reader; $statement" >/dev/null 2>&1; then
   echo "CF2C_UNEXPECTED_ALLOWED_$test_case" >&2
   exit 1
 fi
}
must_deny "OWNER" "SELECT owner_id FROM public.shops;"
must_deny "PRIVATE_NOTES" "SELECT private_notes FROM public.shops;"
must_deny "MENU_COST" "SELECT cost_price FROM public.menu_items;"
must_deny "ORIGINAL_WIDE_VIEW" "SELECT * FROM public.shops_with_availability;"
must_deny "SHOP_UPDATE" "UPDATE public.shops SET name='BAD' WHERE id='stg-test-shop-open';"
must_deny "MENU_DELETE" "DELETE FROM public.menu_items WHERE id='stg-test-item-kota-open';"
must_deny "MENU_INSERT" "INSERT INTO public.menu_items(id,shop_id,name,price,is_available) VALUES ('bad','stg-test-shop-open','x',25,true);"
echo "CF2C_EXACT_FUNCTION_PROJECTION_PRIVATE_FIELDS_AND_DML_DENIED_PASS"
