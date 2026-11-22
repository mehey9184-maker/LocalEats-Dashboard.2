#!/usr/bin/env bash
# CF2-D: disposable PostgreSQL 17 ONLY — never connect to hosted Supabase.
set -Eeuo pipefail
fixture="localeats-api/tests/cf2d/staging-shape.SYNTHETIC_ONLY.sql"
proposal="supabase/drafts/cf2d_catalog_projection.REVIEW_ONLY.sql"
rollback="supabase/drafts/cf2d_catalog_projection_rollback.REVIEW_ONLY.sql"
preflight="supabase/drafts/cf2e_catalog_staging_preflight.READ_ONLY.sql"
postflight="supabase/drafts/cf2e_catalog_staging_postflight.READ_ONLY.sql"
[[ $# -eq 0 && -f "$fixture" && -f "$proposal" && -f "$rollback" && -f "$preflight" && -f "$postflight" ]] ||
  { echo "CF2D_INVALID_INPUT" >&2; exit 1; }
command -v docker >/dev/null || { echo "CF2D_DOCKER_REQUIRED" >&2; exit 1; }
name="cf2d-pg17-$(date +%s)-$RANDOM"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --rm --name "$name" \
 -e POSTGRES_PASSWORD=synthetic_test_only \
 -e POSTGRES_DB=cf2d_lab postgres:17-alpine >/dev/null
ready=0
for _ in $(seq 1 45); do
 if docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
   -U postgres -d cf2d_lab -c 'SELECT 1' 2>/dev/null | grep -qx 1; then
   ready=1; break
 fi
 sleep 1
done
[[ "$ready" == 1 ]] || { echo "CF2D_POSTGRES_NOT_READY" >&2; exit 1; }

docker exec -i "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
 -U postgres -d cf2d_lab < "$fixture" >/dev/null
# Assert the very same SELECT-only CF2-E preflight before any synthetic DDL.
docker exec -i "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
 -U postgres -d cf2d_lab < "$preflight" | grep -Fq CF2E_STAGING_READ_ONLY_PREFLIGHT_PASS
docker exec -i "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
 -U postgres -d cf2d_lab < "$proposal" >/dev/null
# Assert no unintended role, RLS or anonymous permissions after synthetic DDL.
docker exec -i "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
 -U postgres -d cf2d_lab < "$postflight" | grep -Fq CF2E_STAGING_READ_ONLY_POSTFLIGHT_PASS

# Role-scoped projections: 3 approved shops, 2 menu items. Original source
# table with private owner/price-cost columns remains inaccessible.
assert_exact() {
 local expected="$1" sql="$2"
 local actual
 actual=$(docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
  -U postgres -d cf2d_lab -c "SET ROLE cf2_catalog_reader; $sql" | tail -n 1)
 if [[ "$actual" != "$expected" ]]; then
  echo "CF2D_ASSERT_MISMATCH expected=$expected actual=$actual" >&2
  exit 1
 fi
}
assert_exact 3 "SELECT count(*) FROM catalog_cf2.public_shops;"
assert_exact 2 "SELECT count(*) FROM catalog_cf2.public_menu;"
assert_exact 0 "SELECT count(*) FROM catalog_cf2.public_shops WHERE id='stg-test-pending' OR id='stg-test-archived';"
assert_exact 0 "SELECT count(*) FROM catalog_cf2.public_menu WHERE shop_id='stg-test-pending';"
assert_exact '-25.98' "SELECT lat::text FROM catalog_cf2.public_shops WHERE id='stg-test-open';"

# No private fields, broad view, schema creation, updates or menu deletes.
must_deny() {
 local scenario="$1" statement="$2"
 if docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
    -U postgres -d cf2d_lab \
    -c "SET ROLE cf2_catalog_reader; $statement" >/dev/null 2>&1; then
   echo "CF2D_UNEXPECTED_ALLOW_$scenario" >&2
   exit 1
 fi
}
must_deny OWNER "SELECT owner_id FROM public.shops;"
must_deny SECRET "SELECT private_notes FROM public.shops;"
must_deny COST "SELECT cost_price FROM public.menu_items;"
must_deny SHOP_WIDE "SELECT * FROM public.shops;"
must_deny SHOP_UPDATE "UPDATE public.shops SET name='bad' WHERE id='stg-test-open';"
must_deny ITEM_INSERT "INSERT INTO public.menu_items(id,shop_id,name,price,is_available) VALUES ('bad','stg-test-open','bad',25,true);"
must_deny ITEM_DELETE "DELETE FROM public.menu_items WHERE id='test-kota-open';"
must_deny SCHEMA_CREATE "CREATE TABLE catalog_cf2.bad (id integer);"

# The corrected projection matches the deployed staging function's approval
# and archive checks, not the older GitHub draft's weaker function.
docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d cf2d_lab \
  -c "DO \$\$ DECLARE differences integer; BEGIN
   SELECT count(*) INTO differences FROM public.shops s
    JOIN catalog_cf2.public_shops p ON p.id=s.id
   WHERE p.effective_is_active IS DISTINCT FROM
       public.shop_effective_open(s,statement_timestamp());
   IF differences<>0 THEN RAISE EXCEPTION 'CF2D_LIVE_FUNCTION_PARITY_FAILED';
   END IF;
   IF public.shop_effective_open((SELECT s FROM public.shops s WHERE id='stg-test-pending'),'2026-11-22 10:00+00')
      OR public.shop_effective_open((SELECT s FROM public.shops s WHERE id='stg-test-archived'),'2026-11-22 10:00+00')
   THEN RAISE EXCEPTION 'CF2D_APPROVAL_OR_ARCHIVE_BYPASS'; END IF;
   END \$\$;" >/dev/null

# The proposal remains transactionally reversible; original synthetic rows
# must survive the rollback and the projected objects must disappear.
docker exec -i "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
 -U postgres -d cf2d_lab < "$rollback" >/dev/null
# Rollback must restore original metadata preflight conditions.
docker exec -i "$name" psql -X -qAt -v ON_ERROR_STOP=1 \
 -U postgres -d cf2d_lab < "$preflight" | grep -Fq CF2E_STAGING_READ_ONLY_PREFLIGHT_PASS
docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d cf2d_lab \
 -c "DO \$\$ BEGIN
   IF to_regclass('catalog_cf2.public_shops') IS NOT NULL
     OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cf2_catalog_reader')
   THEN RAISE EXCEPTION 'CF2D_ROLLBACK_DID_NOT_CLEAN'; END IF;
   IF (SELECT count(*) FROM public.shops)<>5
     OR (SELECT count(*) FROM public.menu_items)<>3
   THEN RAISE EXCEPTION 'CF2D_ROLLBACK_ALTERED_FIXTURES'; END IF;
   END \$\$;" >/dev/null
echo "CF2E_PRE_POST_AND_ROLLBACK_ISOLATED_PG17_PASS"
