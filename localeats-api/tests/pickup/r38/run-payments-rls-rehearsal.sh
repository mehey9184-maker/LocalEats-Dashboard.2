#!/usr/bin/env bash
# R3.8: synthetic PostgreSQL 17 financial RLS permissions; NO hosted DB.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
name="localeats_r38_$RANDOM"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$name" --rm -e POSTGRES_PASSWORD=disposable_only \
 -e POSTGRES_DB=r38_finance_lab postgres:17-alpine >/dev/null
ready=0
for i in $(seq 1 45); do
 if docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres \
 -d r38_finance_lab -c 'SELECT 1' 2>/dev/null | grep -qx '1'; then
  ready=1;break
 fi
 sleep 1
done
[[ "$ready" == 1 ]] || { echo "R38_POSTGRES_NOT_READY" >&2;exit 1; }
pg(){
 docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d r38_finance_lab -c "$1"
}
load(){
 docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d r38_finance_lab <"$1" >/dev/null
}
assert(){
 local got
 got="$(pg "$1")"
 if [[ "$got" != "$2" ]];then
   echo "R38_EXPECTED=$2 ACTUAL=$got QUERY=$1" >&2;exit 1
 fi
}
deny(){
 local err
 if err="$(pg "$1" 2>&1)";then
  echo "R38_CLIENT_OPERATION_NOT_DENIED" >&2;exit 1
 fi
 if [[ "$err" != *"permission denied"* ]];then
  echo "$err" >&2;echo "R38_UNEXPECTED_ERROR" >&2;exit 1
 fi
}
load "$here/payments-source.SYNTHETIC_ONLY.sql"
assert "SET SESSION AUTHORIZATION r38_authenticated;
 SELECT count(*) FROM r38_lab.payments;" "2"
assert "SET SESSION AUTHORIZATION r38_authenticated;
 UPDATE r38_lab.payments SET amount=1 WHERE shop_id=202 RETURNING amount;" "1"
assert "SET SESSION AUTHORIZATION r38_authenticated;
 DELETE FROM r38_lab.payments WHERE shop_id=101 RETURNING shop_id;" "101"
assert "SET SESSION AUTHORIZATION r38_authenticated;
 INSERT INTO r38_lab.payments(id,shop_id,amount,payment_method,status)
 VALUES('00000000-0000-4000-8000-000000000383'::uuid,303,99,'cash','paid')
 RETURNING shop_id;" "303"
echo "R38_BROAD_AUTHENTICATED_PAYMENT_MUTATION_REPRODUCED"
# Restore fabricated input to verify policy-only change does not edit records.
pg "DELETE FROM r38_lab.payments WHERE shop_id=303;
 UPDATE r38_lab.payments SET amount=1750 WHERE shop_id=202;
 INSERT INTO r38_lab.payments(id,shop_id,amount,payment_method,transaction_id,status)
 VALUES('00000000-0000-4000-8000-000000000381'::uuid,101,2500,'cash','TESTONLY-1','paid');" >/dev/null
assert "SELECT count(*) FROM r38_lab.payments;" "2"
assert "SELECT sum(amount) FROM r38_lab.payments;" "4250"

load "$here/payments-restricted.SYNTHETIC_ONLY.sql"
deny "SET SESSION AUTHORIZATION r38_authenticated;
 SELECT * FROM r38_lab.payments;"
deny "SET SESSION AUTHORIZATION r38_authenticated;
 UPDATE r38_lab.payments SET amount=0 WHERE shop_id=202;"
deny "SET SESSION AUTHORIZATION r38_authenticated;
 DELETE FROM r38_lab.payments WHERE shop_id=202;"
deny "SET SESSION AUTHORIZATION r38_authenticated;
 INSERT INTO r38_lab.payments(id,shop_id,amount,payment_method,status)
 VALUES('00000000-0000-4000-8000-000000000384'::uuid,404,999,'cash','paid');"
deny "SET SESSION AUTHORIZATION r38_anon; SELECT * FROM r38_lab.payments;"
deny "SET SESSION AUTHORIZATION r38_authenticated; SET ROLE r38_backend;"
assert "SET SESSION AUTHORIZATION r38_backend;
 SELECT count(*) FROM r38_lab.payments;" "2"
assert "SELECT sum(amount) FROM r38_lab.payments;" "4250"
assert "SELECT relrowsecurity AND relforcerowsecurity FROM pg_catalog.pg_class
 WHERE oid='r38_lab.payments'::regclass;" "t"
assert "SELECT count(*) FROM pg_catalog.pg_policies
 WHERE schemaname='r38_lab' AND tablename='payments'
 AND policyname='Payments access';" "0"
docker exec "$name" pg_dump -U postgres -d r38_finance_lab --schema-only \
 -n r38_lab -F c -f /tmp/r38-schema-only.dump
docker exec "$name" createdb -U postgres r38_restored
docker exec "$name" pg_restore -U postgres --no-owner \
 -d r38_restored /tmp/r38-schema-only.dump >/dev/null
restored(){
 docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres \
 -d r38_restored -c "$1"
}
[[ "$(restored 'SELECT count(*) FROM r38_lab.payments;')" == 0 ]] || {
 echo "R38_SCHEMA_ONLY_RESTORE_CONTAINED_FAKE_ROWS" >&2;exit 1;
}
[[ "$(restored "SELECT has_table_privilege('r38_authenticated','r38_lab.payments','SELECT');")" == f ]] || {
 echo "R38_RESTORE_EXPOSED_PAYMENT_ROWS" >&2;exit 1;
}
[[ "$(restored "SELECT has_table_privilege('r38_backend','r38_lab.payments','SELECT');")" == t ]] || {
 echo "R38_RESTORE_REMOVED_BACKEND_ACCESS" >&2;exit 1;
}
echo "R38_PAYMENTS_CLIENT_DENIAL_AND_SCHEMA_RESTORE_PASS"
