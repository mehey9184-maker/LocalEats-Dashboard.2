import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync("src/App.tsx","utf8");
const api=readFileSync("src/services/MerchantApi.ts","utf8");
const sw=readFileSync("public/firebase-messaging-sw.js","utf8");
const server=readFileSync("localeats-api/src/routes/pickupNotifications.ts","utf8");
const testService=readFileSync("localeats-api/src/orders/merchantPushTest.ts","utf8");

test("Merchant Settings has a labeled test button, no artificial purchase or order",()=>{
 assert.match(app,/Send test notification/);
 assert.match(app,/scheduleMerchantPushTest/);
 assert.match(app,/setTimeout\(async\(\)=>\{/);
 assert.match(app,/},7000\)/);
 assert.match(app,/auth\.currentUser\?\.uid!==uid/);
 assert.match(app,/MerchantApi\.sendTestPushNotification\(installation!\)/);
 assert.match(app,/No customer order or payment is created/);
 assert.match(app,/role="status" aria-live="polite"/);
 assert.match(app,/relative z-10 pointer-events-auto min-h-11 cursor-pointer/);
 assert.match(app,/setPushTestStatus\("Test scheduled\. Minimize Chrome now/);
 assert.match(app,/Firebase accepted the test request\. Check for a Windows notification; delivery is not yet confirmed/);
 assert.match(api,/POST|method:"POST"/);
 assert.match(api,/api\/v1\/push-subscriptions\/\$\{encodeURIComponent\(installationId\)\}\/test/);
 assert.doesNotMatch(api,/method:"POST"[\s\S]{0,130}order_id/);
});
test("test sends only using authenticated Merchant API and server-side owned device",()=>{
 assert.match(server,/post\("\/push-subscriptions\/:installationId\/test",\s*authenticateFirebase/);
 assert.match(server,/\.eq\("owner_id",uid\)\.is\("archived_at",null\)/);
 assert.match(server,/\.eq\("user_id",uid\)\.eq\("installation_id",installationId\)/);
 assert.match(server,/\.is\("revoked_at",null\)/);
 assert.match(server,/code:result\.code/);
 assert.match(testService,/FCM_ACCEPTED_NOT_DEVICE_DELIVERED/);
});
test("FCM background test is distinct from real pickup order and says no order was created",()=>{
 assert.match(sw,/payload\.data\?\.type==='merchant_push_test'/);
 assert.match(sw,/LocalEats notification test/);
 assert.match(sw,/No customer order or payment was created/);
 assert.match(sw,/payload\.data\?\.type!=='pickup_new_order'/);
 assert.match(app,/payload\.data\?\.type==="merchant_push_test"/);
});
