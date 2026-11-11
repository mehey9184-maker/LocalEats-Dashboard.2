import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"../../../..");
const sql=readFileSync(resolve(here,"chat-access-hardening.REVIEW_ONLY.sql.txt"),"utf8");
const runner=readFileSync(resolve(here,"run-chat-policy-review-l2.sh"),"utf8");
const paymentPlan=readFileSync(resolve(root,"localeats-api/tests/pickup/r39/payments-access-hardening.REVIEW_ONLY.sql.txt"),"utf8");
const facade=readFileSync(resolve(root,"src/lib/supabase.ts"),"utf8");
const merchantChat=readFileSync(resolve(root,"src/services/OrderService.ts"),"utf8");
// Intentionally no Firebase deploy here: the deployed ruleset needs a separate authenticated read.

test("L2: candidate is review-only and cannot be executed against a real schema",()=>{
  assert.match(sql,/NEVER EXECUTE ON CONNECTED SUPABASE/);
  assert.match(sql,/__SCHEMA__\.chat_messages/);
  assert.match(sql,/__CLIENT_ROLE__/);
  assert.match(sql,/__ANON_ROLE__/);
  assert.match(sql,/__BACKEND_ROLE__/);
  const active=readdirSync(resolve(root,"supabase/migrations")).filter(x=>/l2.*chat|chat.*harden/i.test(x));
  assert.deepEqual(active,[]);
});
test("L2: drift, backend retention, client revocation and atomic transaction",()=>{
  assert.match(sql,/BEGIN;\s*SET LOCAL lock_timeout/);
  assert.match(sql,/L2_CHAT_LEGACY_POLICIES_NOT_AS_REVIEWED/);
  assert.match(sql,/L2_CHAT_UNEXPECTED_POLICY_COUNT/);
  assert.match(sql,/L2_CHAT_BACKEND_PERMISSIONS_MISSING/);
  assert.match(sql,/L2_CHAT_CLIENT_GRANT_STILL_PRESENT/);
  assert.match(sql,/L2_CHAT_BACKEND_PERMISSIONS_LOST/);
  assert.match(sql,/REVOKE ALL PRIVILEGES ON TABLE __SCHEMA__\.chat_messages/);
  assert.match(sql,/DROP POLICY "Allow all on chat_messages"/);
  assert.match(sql,/DROP POLICY "Chat message access"/);
  assert.match(sql,/COMMIT;\s*$/);
  assert.doesNotMatch(sql,/\b(?:DELETE FROM|UPDATE|TRUNCATE|INSERT INTO)\s+__SCHEMA__\.chat_messages/i);
});
test("L2: disposable local PG runner cannot connect to hosted resources or publish ports",()=>{
  assert.match(runner,/postgres:17-alpine/);
  assert.match(runner,/SET SESSION AUTHORIZATION r38_authenticated/);
  assert.match(runner,/L2_DRIFT_GUARD_DID_NOT_ABORT/);
  assert.match(runner,/L2_REPEAT_PLAN_NOT_BLOCKED/);
  assert.match(runner,/pg_dump -U postgres -d l2_chat_synthetic --schema-only/);
  assert.doesNotMatch(runner,/(supabase\.co|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|db push|apply_migration|--remote|--publish|-p\s+[0-9]+:)/i);
});
test("L2: preserve existing R3.9 payment hardening and never mistake Firestore facade for direct Supabase",()=>{
  assert.match(paymentPlan,/__SCHEMA__\.payments/);
  assert.match(paymentPlan,/REVOKE ALL ON TABLE __SCHEMA__\.payments/);
  assert.match(merchantChat,/from\("chat_messages"\)/);
  assert.match(facade,/firebase\/firestore/);
  assert.doesNotMatch(facade,/@supabase\/supabase-js/);
});
