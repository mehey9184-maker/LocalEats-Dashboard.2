#!/usr/bin/env bash
set -Eeuo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
name="localeats_h3b_$BASHPID"
tmp="$(mktemp -d)"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
docker run -d --rm --network none --name "$name" -e POSTGRES_PASSWORD=synthetic_only -e POSTGRES_DB=h3b_lab postgres:17-alpine >/dev/null
ready=0
for i in $(seq 1 45); do
 if docker logs "$name" 2>&1 | grep -q 'PostgreSQL init process complete; ready for start up.' && docker exec "$name" pg_isready -U postgres -d h3b_lab >/dev/null; then ready=1;break;fi
 sleep 1
done
[[ "$ready" == 1 ]]
[[ "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$name")" == none ]]
pg(){ docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d h3b_lab "$@"; }
sed 's/ON shops TO authenticated;/ON shops TO service_role;/' "$here/baseline.SYNTHETIC_ONLY.sql" >"$tmp/baseline.sql"
# Match hosted column grants: service-role only, with SELECT also on payment methods.
printf '\nGRANT SELECT(pickup_payment_methods) ON shops TO service_role;\n' >>"$tmp/baseline.sql"
pg <"$tmp/baseline.sql"
snapshot(){ pg -At <<'SQL'
SELECT c.relname, c.relrowsecurity, coalesce((SELECT string_agg(grantee::text||':'||privilege_type||':'||is_grantable::text,',' ORDER BY grantee,privilege_type,is_grantable) FROM aclexplode(c.relacl)), '') FROM pg_class c WHERE c.oid IN ('shops'::regclass,'menu_items'::regclass,'reviews'::regclass,'announcements'::regclass) ORDER BY c.relname;
SELECT c.relname,a.attname,coalesce((SELECT string_agg(grantee::text||':'||privilege_type||':'||is_grantable::text,',' ORDER BY grantee,privilege_type,is_grantable) FROM aclexplode(a.attacl)), '') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.oid IN ('shops'::regclass,'menu_items'::regclass,'reviews'::regclass,'announcements'::regclass) AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attname;
SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('shops','menu_items','reviews','announcements') ORDER BY tablename,policyname;
SQL
}
snapshot >"$tmp/before.acl"
patch="$root/supabase/drafts/catalog_api_only_acl_h3b.sql"
# Prove a policy drift at the last table rolls back earlier revocations.
pg -c 'CREATE POLICY h3b_unexpected ON announcements FOR SELECT TO authenticated USING(true)'
if pg <"$patch" >"$tmp/drift.log" 2>&1; then echo H3B_DRIFT_WAS_ACCEPTED >&2;exit 1;fi
grep 'H3B_POLICY_DRIFT: announcements' "$tmp/drift.log"
[[ "$(pg -At -c "SELECT has_table_privilege('anon','public.shops','SELECT') AND EXISTS(SELECT 1 FROM pg_policy WHERE polname='shops_select_public')")" == t ]]
pg -c 'DROP POLICY h3b_unexpected ON announcements'
echo H3B_DRIFT_ATOMIC_ROLLBACK_PASS
pg <"$patch"
pg <"$here/verify.SYNTHETIC_ONLY.sql"
echo H3B_DISPOSABLE_ACL_PASS
pg <"$root/supabase/drafts/catalog_api_only_acl_h3b_rollback.sql"
snapshot >"$tmp/after.acl"
diff -u "$tmp/before.acl" "$tmp/after.acl"
echo H3B1_EXACT_ACL_ROUNDTRIP_PASS
# Reapply hardened candidate to prove repeatable recovery; finish in safe state.
pg <"$patch"
pg <"$here/verify.SYNTHETIC_ONLY.sql"
echo H3B1_REAPPLY_PASS
