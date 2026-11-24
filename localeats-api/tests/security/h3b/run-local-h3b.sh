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
pg <"$here/baseline.SYNTHETIC_ONLY.sql"
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
