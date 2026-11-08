// R4.4 review-only boundary checks: never open a live payment route or migrate
// anything through a test PR. No network, credentials, Firebase or Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../../../..");
const read=path=>readFileSync(resolve(root,path),"utf8");

test("R4.4: the merchant payment-history service is not registered in Express",()=>{
 const server=read("localeats-api/src/server.ts");
 const merchant=read("localeats-api/src/routes/merchant.ts");
 const service=read("localeats-api/src/payments/merchantPaymentHistoryR44.ts");
 assert.doesNotMatch(server,/merchantPaymentHistoryR44|\/merchant\/payments/);
 assert.doesNotMatch(merchant,/merchantPaymentHistoryR44|router\.get\(["']\/payments/);
 assert.match(service,/checkRevoked/);
 assert.match(service,/verified_legacy_payment_mapping/);
 assert.match(service,/readScopedPayments\(legacyId,offset,51\)/);
 assert.match(service,/PAYMENT_HISTORY_INTEGRITY_FAILURE/);
 assert.match(service,/PAYMENT_HISTORY_PAGING_LIMIT/);
 assert.doesNotMatch(service,/(supabaseAdmin|firebase-admin|createClient|\.update\(|\.insert\(|\.delete\()/i);
});

test("R4.4: no active database migrations, production flags or app UI changes",()=>{
 const migrationFiles=readdirSync(resolve(root,"supabase/migrations"));
 assert.deepEqual(migrationFiles.filter(name=>/r4[1-4]|merchant.*payment.*history|legacy.*mapping/i.test(name)),[]);
 const plan=read("docs/R44_SERVER_PAYMENT_HISTORY_ACCEPTANCE.md");
 assert.match(plan,/not a mounted Express route/i);
 assert.match(plan,/Production payments policy is still insecure and unchanged/);
 assert.match(plan,/No Production or hosted database writes/);
});

test("R4.4: real primary bigint vs text mismatch remains an explicit owner gate",()=>{
 const plan=read("docs/R44_SERVER_PAYMENT_HISTORY_ACCEPTANCE.md");
 const service=read("localeats-api/src/payments/merchantPaymentHistoryR44.ts");
 assert.match(plan,/payments\.shop_id is nullable bigint and shops\.id is text/);
 assert.match(service,/9223372036854775807n/);
 assert.match(service,/mapping\.shopId!==shop\.id/);
 assert.match(service,/mapping\.ownerUid!==principal\.uid/);
 assert.match(plan,/existing LocalEats-Profile-Staging project has profiles only/);
});

test("R4.4: original UI and live order paths are untouched by the service contract",()=>{
 const plan=read("docs/R44_SERVER_PAYMENT_HISTORY_ACCEPTANCE.md");
 assert.match(plan,/Do not redesign the original UI/);
 assert.match(plan,/no live orders/i);
 assert.match(plan,/public ordering stays off/i);
});
