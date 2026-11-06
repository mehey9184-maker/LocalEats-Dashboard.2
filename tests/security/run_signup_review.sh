#!/usr/bin/env bash
set -euo pipefail
if [[ "${SIGNUP_REVIEW_ISOLATED:-}" != "1" || "${PGHOST:-}" != "127.0.0.1" ||
"${PGDATABASE:-}" != "local_signup_role_qa" || "${PGUSER:-}" != "postgres" ||
-n "${SUPABASE_URL:-}" || -n "${DATABASE_URL:-}" || -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
 echo "REFUSED: requires disposable local-only PostgreSQL fixture" >&2;exit 31
fi
test "$(psql -X -At -v ON_ERROR_STOP=1 -c 'select current_database()')" = "local_signup_role_qa"
psql -X -v ON_ERROR_STOP=1 -f tests/security/signup_metadata_fixture.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -f security/drafts/signup_role_metadata_lockdown_REVIEW_ONLY.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -f tests/security/signup_metadata_assertions.sql
echo 'No Production database, user or privileged migration was touched.'
