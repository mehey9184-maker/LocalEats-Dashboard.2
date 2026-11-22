#!/usr/bin/env bash
# CF2-B: disposable PostgreSQL 17 synthetic rehearsal only.
# Must never connect to Supabase, Production, or a published Docker port.
set -Eeuo pipefail

# GitHub Actions and the documented local command run this from repo root.
SQL="localeats-api/tests/cf2b/readonly-catalog.SYNTHETIC_ONLY.sql"
if [[ $# -ne 0 || ! -f "$SQL" ]]; then
  echo "CF2B_INVALID_REHEARSAL_INPUT" >&2
  exit 1
fi
command -v docker >/dev/null || { echo "CF2B_DOCKER_REQUIRED" >&2; exit 1; }

name="cf2b-pg17-$(date +%s)-$RANDOM"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$name" \
  -e POSTGRES_PASSWORD=cf2b_synthetic_only \
  -e POSTGRES_DB=cf2b_synthetic \
  postgres:17-alpine >/dev/null

ready=0
for _ in $(seq 1 45); do
  if docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
    -U postgres -d cf2b_synthetic -c 'SELECT 1' 2>/dev/null | grep -qx 1; then
    ready=1
    break
  fi
  sleep 1
done
[[ $ready -eq 1 ]] || { echo "CF2B_PG17_NOT_READY" >&2; exit 1; }

docker exec -i "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
  -U postgres -d cf2b_synthetic < "$SQL" | grep -qx CF2B_SYNTHETIC_POSTGRES_ROLE_AND_RLS_PASS

# All negative checks use the disposable local database and the synthetic
# no-login role via SET ROLE. They must be denied. No real user or order data.
must_deny() {
  local case_label="$1" statement="$2"
  if docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
      -U postgres -d cf2b_synthetic \
      -c "SET ROLE cf2_catalog_reader; $statement" >/dev/null 2>&1; then
    echo "CF2B_UNEXPECTED_ALLOW_$case_label" >&2
    exit 1
  fi
}

must_deny "PRIVATE_OWNER_ID" "SELECT owner_id FROM cf2_fixture.shops LIMIT 1;"
must_deny "PRIVATE_NOTES" "SELECT private_notes FROM cf2_fixture.shops LIMIT 1;"
must_deny "PRIVATE_MENU_COST" "SELECT cost_price FROM cf2_fixture.menu_items LIMIT 1;"
must_deny "SHOP_UPDATE" "UPDATE cf2_fixture.shops SET name='UNAUTHORIZED' WHERE id='stg-test-shop-open';"
must_deny "MENU_INSERT" "INSERT INTO cf2_fixture.menu_items(id,shop_id,name,price,is_available) VALUES ('bad','stg-test-shop-open','bad',25,true);"
must_deny "MENU_DELETE" "DELETE FROM cf2_fixture.menu_items WHERE id='stg-test-item-kota-open';"

echo "CF2B_SYNTHETIC_PG17_ROLE_RLS_PRIVATE_FIELDS_AND_DML_DENIED_PASS"
