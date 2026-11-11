import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../supabase/migrations/20261111060000_l2_private_chat_payment_acl.sql",import.meta.url),"utf8");
const runner=readFileSync(new URL("./l2_private_data_acl_release.sh",import.meta.url),"utf8");

test("L2 release: only ACL and policy changes, no business-row modifications",()=>{
 assert.match(sql,/^BEGIN;/m);
 assert.match(sql,/SET LOCAL lock_timeout/);
 assert.match(sql,/SET LOCAL statement_timeout/);
 assert.match(sql,/COMMIT;\s*$/);
 assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE\s+FROM|TRUNCATE|INSERT\s+INTO)\s+public\.(chat_messages|payments)\b/i);
 assert.doesNotMatch(sql,/ALTER\s+TABLE\s+public\.(orders|profiles|shops|menu_items)/i);
});
test("L2 release: guarded against policy drift and preserves trusted service role",()=>{
 assert.match(sql,/L2_CHAT_POLICIES_DRIFTED/);
 assert.match(sql,/L2_PAYMENTS_POLICY_DRIFTED/);
 assert.match(sql,/L2_PRIVATE_TABLE_RLS_MUST_BE_ENABLED/);
 assert.match(sql,/L2_SERVER_ROLE_NEEDS_EXPLICIT_PRIVILEGES/);
 assert.match(sql,/L2_SERVER_PRIVILEGE_LOST/);
 assert.match(sql,/REVOKE ALL PRIVILEGES ON TABLE public\.chat_messages FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/REVOKE ALL PRIVILEGES ON TABLE public\.payments FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/DROP POLICY "Allow all on chat_messages"/);
 assert.match(sql,/DROP POLICY "Chat message access"/);
 assert.match(sql,/DROP POLICY "Payments access"/);
});
test("L2 release: runtime is not activated and rehearsal cannot touch hosted database",()=>{
 assert.match(runner,/postgres:17-alpine/);
 assert.match(runner,/SET SESSION AUTHORIZATION r38_authenticated/);
 assert.match(runner,/L2_EXACT_RELEASE_MIGRATION_DISPOSABLE_PG17_PASS/);
 assert.doesNotMatch(runner,/(supabase\.co|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|db push|apply_migration|--remote|--publish|-p\s+[0-9]+:)/i);
});
