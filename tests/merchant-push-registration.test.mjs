import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const hook=readFileSync("src/hooks/usePushNotifications.ts","utf8");
const api=readFileSync("src/services/MerchantApi.ts","utf8");
const ui=readFileSync("src/App.tsx","utf8");
const route=readFileSync("localeats-api/src/routes/pickupNotifications.ts","utf8");
const orders=readFileSync("localeats-api/src/routes/orders.ts","utf8");

test("merchant push toggle is a real server-confirmed enable/disable, not browser permission text",()=>{
 assert.match(hook,/disablePushNotifications=useCallback\(async\(\)=>/);
 assert.match(hook,/MerchantApi\.unregisterPushDevice\(installation\)/);
 assert.match(api,/static async unregisterPushDevice\(installationId:string\)/);
 assert.match(api,/method:"DELETE",headers:await getApiAuthHeaders\(\)/);
 assert.match(route,/pickupNotificationRoutes\.delete\("\/push-subscriptions\/:installationId",authenticateFirebase/);
 assert.match(route,/\.eq\("user_id",req\.authUser!\.uid\)\.eq\("installation_id",installation\)/);
 assert.match(ui,/role="switch"/);
 assert.match(ui,/aria-checked=\{pushEnabled\}/);
 assert.match(ui,/aria-busy=\{pushBusy\}/);
 assert.match(ui,/disabled=\{pushBusy\}/);
 assert.match(ui,/void disablePushNotifications\(\)/);
 assert.doesNotMatch(ui,/To disable push notifications, please change your browser settings/);
});

test("only previously confirmed installations revalidate without permission prompting",()=>{
 assert.match(hook,/const existing=localStorage\.getItem\(installationKey\(uid\)\)/);
 assert.match(hook,/if\(!existing \|\| !VALID_INSTALLATION\.test\(existing\)\)return/);
 assert.match(hook,/if\(Notification\.permission!=="granted"\)/);
 assert.match(hook,/if\(!token\)\{setPushEnabled\(false\);return;\}/);
 assert.match(hook,/sequence\.current!==epoch/);
 assert.match(hook,/if\(auth\.currentUser\?\.uid!==userId \|\| sequence\.current!==epoch\)return;/);
 assert.match(hook,/localStorage\.setItem\(key,installation\);[\s\S]*?setPushEnabled\(true\)/);
 assert.match(hook,/localStorage\.removeItem\(key\);[\s\S]*?setPushEnabled\(false\)/);
 assert.match(hook,/window\.addEventListener\("focus",refresh\)/);
});

test("push payload is never treated as authoritative order details",()=>{
 assert.match(orders,/if \(!result\.replayed\)/);
 assert.match(orders,/await tryMerchantPickupPush\(/);
 assert.match(ui,/if\(payload\.data\?\.type==="pickup_new_order" && active\) void fetchOrders\(\)/);
 assert.match(ui,/setInterval\(refreshVisibleOrders, 15000\)/);
 assert.match(ui,/if \(document\.visibilityState === "visible" && navigator\.onLine\) void fetchOrders\(\)/);
});
