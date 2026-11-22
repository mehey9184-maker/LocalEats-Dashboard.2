import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL(path,import.meta.url),"utf8");
const pre=read("../../../supabase/drafts/cf2e_catalog_staging_preflight.READ_ONLY.sql");
const post=read("../../../supabase/drafts/cf2e_catalog_staging_postflight.READ_ONLY.sql");
const forward=read("../../../supabase/drafts/cf2d_catalog_projection.REVIEW_ONLY.sql");
const rollback=read("../../../supabase/drafts/cf2d_catalog_projection_rollback.REVIEW_ONLY.sql");
const runner=read("../cf2d/run-reviewed-sql-pg17.sh");

function assertSelectOnly(sql){
 const uncomments=sql.replace(/^--.*$/gm,"");
 assert.match(uncomments,/^\s*WITH checks\(name, ok\) AS \(/);
 assert.match(uncomments,/\bSELECT CASE\b/);
 // "INSERT", "UPDATE" and "DELETE" occur as SQL string arguments to
 // has_table_privilege(); they're not mutation statements. Mask quoted literals.
 const withoutLiterals=uncomments.replace(/'(?:''|[^'])*'/g,"''");
 assert.doesNotMatch(withoutLiterals,/(?:^|[;\n])\s*(?:CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|INSERT|DELETE|UPDATE|CALL|COPY|DO)\b/im);
}

test("CF2-E same-file preflight and postflight are read-only",()=>{
 assertSelectOnly(pre);
 assertSelectOnly(post);
 assert.match(pre,/CF2E_STAGING_READ_ONLY_PREFLIGHT_PASS/);
 assert.match(post,/CF2E_STAGING_READ_ONLY_POSTFLIGHT_PASS/);
 assert.match(pre,/no_existing_catalogue_role/);
 assert.match(pre,/no_existing_catalogue_schema/);
 assert.match(pre,/approval_check_deployed/);
 assert.match(pre,/archive_check_deployed/);
 assert.match(pre,/johannesburg_clock_deployed/);
 assert.match(post,/reader_nonlogin_no_bypass/);
 assert.match(post,/reader_no_memberships/);
 assert.match(post,/anon_shops_projection_denied/);
 assert.match(post,/authenticated_menu_projection_denied/);
 assert.match(post,/reader_no_other_public_relation_reads/);
});

test("CF2-E uses rollback-tested CF2-D SQL with no account or deployment credentials",()=>{
 assert.match(forward,/CREATE ROLE cf2_catalog_reader NOLOGIN/);
 assert.match(forward,/NOBYPASSRLS/);
 assert.match(forward,/CREATE POLICY cf2_catalog_shops_select/);
 assert.match(forward,/CREATE POLICY cf2_catalog_menu_select/);
 assert.match(forward,/WITH \(security_invoker = true, security_barrier = true\)/);
 assert.match(forward,/s\.latitude AS lat, s\.longitude AS lng/);
 assert.match(forward,/CF2D_DEPLOYED_AVAILABILITY_DRIFT_STOP/);
 assert.match(rollback,/DROP VIEW catalog_cf2\.public_shops RESTRICT/);
 assert.match(rollback,/DROP SCHEMA catalog_cf2 RESTRICT/);
 assert.doesNotMatch(rollback,/\bCASCADE\b/);
 const src=pre+post+forward+rollback;
 assert.doesNotMatch(src,/SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|SECRET_ACCESS_KEY|CLOUDFLARE_API_TOKEN/);
});

test("CF2-E rehearsal uses only disposable postgres with pre/post/rollback assertions",()=>{
 assert.match(runner,/postgres:17-alpine/);
 assert.match(runner,/CF2E_STAGING_READ_ONLY_PREFLIGHT_PASS/);
 assert.match(runner,/CF2E_STAGING_READ_ONLY_POSTFLIGHT_PASS/);
 assert.match(runner,/CF2E_PRE_POST_AND_ROLLBACK_ISOLATED_PG17_PASS/);
 assert.doesNotMatch(runner,/supabase\.co|--publish|DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|db push|apply_migration/);
});
