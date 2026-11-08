import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"../../../..");
const read=path=>readFileSync(resolve(root,path),"utf8");

test("R4.1: R3.9 security fix still a deliberately non-deployable template",()=>{
  const candidate=read("localeats-api/tests/pickup/r39/payments-access-hardening.REVIEW_ONLY.sql.txt");
  const migrations=readdirSync(resolve(root,"supabase/migrations"));
  assert.match(candidate,/NEVER EXECUTE ON CONNECTED SUPABASE/);
  assert.match(candidate,/__SCHEMA__\.payments/);
  assert.match(candidate,/__BACKEND_ROLE__/);
  assert.doesNotMatch(candidate,/ALTER\s+TABLE\s+public\.payments/i);
  assert.deepEqual(migrations.filter(name=>/r4[01]|r39|payment.*hardening/i.test(name)),[]);
});

test("R4.1: Preview API blocks mutations and side-effecting notifications GET/HEAD",()=>{
  const gate=read("localeats-api/src/middleware/previewReadOnlyGate.ts");
  assert.match(gate,/VERCEL_ENV\s*!==\s*"preview"/);
  assert.match(gate,/LOCALEATS_PREVIEW_READ_ONLY\s*!==\s*"true"/);
  assert.match(gate,/\["POST","PUT","PATCH","DELETE"\]/);
  assert.match(gate,/\["GET","HEAD"\]/);
  assert.match(gate,/\^\/api\/v1\/notifications/);
  assert.match(gate,/PREVIEW_READ_ONLY/);
});

test("R4.1: actual API uses durable notification inbox and an optional fenced FCM attempt",()=>{
  const route=read("localeats-api/src/routes/pickupNotifications.ts");
  const push=read("localeats-api/src/orders/pickupPush.ts");
  assert.match(route,/pickup_order_events/);
  assert.match(route,/recipient_uid/);
  assert.match(route,/drainPickupPush\(supabaseAdmin,uid\)/);
  assert.match(push,/pickup_claim_push/);
  assert.match(push,/pickup_push_sendable/);
  assert.match(push,/pickup_finish_push/);
  assert.doesNotMatch(push,/setInterval\s*\(|setTimeout\s*\(/);
});

test("R4.1: written staging acceptance does not certify profile-only staging or real FCM",()=>{
  const plan=read("docs/R41_OFFLINE_STAGING_AND_PUSH_ACCEPTANCE.md");
  assert.match(plan,/Profile-Staging/);
  assert.match(plan,/NOT a pickup-schema staging clone/);
  assert.match(plan,/real-device FCM delivery remains unverified/);
  assert.match(plan,/NO Production database migration/);
});
