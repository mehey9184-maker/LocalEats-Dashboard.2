#!/usr/bin/env bash
# R3.7: Docker-only payments RLS weakness proof and proposed no-data-api guard.
# Not an applied migration. Do NOT pass Supabase connection strings to this.
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
name="localeats_r37_rls_${BASHPID}"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
if [[ ! -f "$here/payments-rls-lab.SYNTHETIC_ONLY.sql" ]]; then
 echo "R37_SYNTHETIC_LAB_MISSING" >&2; exit 1
fi
docker run -d --name "$name" --rm \
 -e POSTGRES_PASSWORD=disposable_only \
 -e POSTGRES_DB=r37_rls_lab postgres:17-alpine >/dev/null
ready=0
for i in $(seq 1 45); do
 if docker exec "$name" pg_isready -U postgres -d r37_rls_lab >/dev/null 2>&1; then ready=1; break; fi
 sleep 1
done
if [[ "$ready" != 1 ]]; then echo "R37_POSTGRES_NOT_READY" >&2; exit 1;fi
pg(){
 docker exec "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d r37_rls_lab -c "$1"
}
assert_query(){
 local got
 got="$(pg "$1")"
 if [[ "$got" != "$2" ]]; then
   echo "R37_ASSERT failed: wanted=$2 got=$got" >&2; exit 1
 fi
}
deny(){
 local err
 if err="$(pg "$1" 2>&1)"; then
    echo "R37_ILLEGAL_ROLE_ACCESS_SUCCEEDED" >&2; exit 1
 fi
 if [[ "$err" != *"permission denied"* ]]; then
    echo "$err" >&2;echo "R37_UNEXPECTED_SQL_FAILURE" >&2;exit 1
 fi
}
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres \
 -d r37_rls_lab <"$here/payments-rls-lab.SYNTHETIC_ONLY.sql" >/dev/null
# The current permissive RLS policy permits one unrelated authenticated user
# to see/change/delete any shop's synthetic payment records. This is a
# proof of the *database policy*, NOT a live exploit or real user's token.
assert_query "SET SESSION AUTHORIZATION r37_authenticated;
 SELECT count(*) FROM r37_lab.payments;" "2"
assert_query "SET SESSION AUTHORIZATION r37_authenticated;
 UPDATE r37_lab.payments SET amount=1 WHERE id=2;
 SELECT amount FROM r37_lab.payments WHERE id=2;" "1"
assert_query "SET SESSION AUTHORIZATION r37_authenticated;
 DELETE FROM r37_lab.payments WHERE id=1;
 SELECT count(*) FROM r37_lab.payments;" "1"
assert_query "SET SESSION AUTHORIZATION r37_authenticated;
 INSERT INTO r37_lab.payments VALUES(3,303,9999,'cash','paid');
 SELECT count(*) FROM r37_lab.payments;" "2"
echo "R37_SYNTHETIC_UNRESTRICTED_PAYMENTS_ACCESS_REPRODUCED"
# Explore a FUTURE, SEPARATELY APPROVED server-only policy in the
# disposable lab; do not apply this to Production, where dependencies must
# be audited first. Current pickup uses pay-at-shop and authoritative API.
pg "BEGIN;
 REVOKE ALL ON r37_lab.payments FROM r37_authenticated,r37_anon;
 DROP POLICY payments_access ON r37_lab.payments;
 COMMIT;" >/dev/null
deny "SET SESSION AUTHORIZATION r37_authenticated;
 SELECT * FROM r37_lab.payments;"
deny "SET SESSION AUTHORIZATION r37_authenticated;
 UPDATE r37_lab.payments SET amount=0 WHERE id=2;"
deny "SET SESSION AUTHORIZATION r37_authenticated;
 INSERT INTO r37_lab.payments VALUES(4,404,1,'cash','paid');"
deny "SET SESSION AUTHORIZATION r37_authenticated;
 DELETE FROM r37_lab.payments WHERE id=3;"
deny "SET SESSION AUTHORIZATION r37_anon; SELECT * FROM r37_lab.payments;"
assert_query "SET SESSION AUTHORIZATION r37_service;
 SELECT count(*) FROM r37_lab.payments;" "2"
assert_query "SELECT count(*) FROM pg_catalog.pg_policies
 WHERE schemaname='r37_lab' AND tablename='payments'
 AND policyname='payments_access';" "0"
echo "R37_OFFLINE_LEAST_PRIVILEGE_DENIALS_PASS"
