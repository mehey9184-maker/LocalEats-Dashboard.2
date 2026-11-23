import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const svc=src("src/services/cloudflareDemoIncomingAlerts.ts");
const fake=src("src/components/PreviewFakeOrders.tsx");
const focused=src("src/components/OrdersFocusedWorkspace.tsx");
const orders=src("src/components/OrdersManagement.tsx");
const worker=src("preview/merchant-pitch/worker.ts");
const gate=src("src/services/cloudflareMerchantPitchGate.ts");
const api=src("src/services/merchantPreviewSimulator.ts");
test("Only isolated, already-gated Cloudflare merchant demo can produce simulated system alerts and original chime",()=>{
 assert.match(svc,/isIsolatedCloudflareMerchantPitchPreviewEnabled\(\)/);
 assert.match(gate,/window.location.hostname === CF_MERCHANT_PITCH_HOST/);
 assert.match(gate,/VITE_MERCHANT_CF_DEMO_READ_ONLY/);
 assert.match(gate,/VITE_MERCHANT_PREVIEW_READ_ONLY/);
 assert.match(gate,/VITE_MERCHANT_FAKE_ORDERS_ENABLED/);
 assert.match(gate,/VITE_PICKUP_ORDERING_ENABLED !== "true"/);
 assert.match(api,/isMerchantPreviewSimulatorEnabled/);
 assert.match(svc,/new Notification\("DEMO ONLY · New pickup order"/);
 assert.match(svc,/Fictional|fictional/);
 assert.match(svc,/document.visibilityState!=="visible"/);
 assert.match(svc,/askForDemoBrowserNotificationPermission/);
 assert.match(svc,/Notification.requestPermission\(\)/);
 assert.match(svc,/Original three-tone major arpeggio/);
 for(const forbidden of [/fetch\s*\(/,/\.post\s*\(/,/\.send\s*\(/,/serviceWorker\.register/,/firebase\.messaging/,/fcm.googleapis.com/,/SUPABASE_SERVICE_ROLE_KEY/]){
   assert.doesNotMatch(svc,forbidden);
 }
});
test("Order traffic emits an alert on actual fictional arrivals, not automatic processing or writes",()=>{
 assert.match(fake,/notifyDemoArrival\(1\)/);
 assert.match(fake,/notifyDemoArrival\(count\)/);
 assert.match(fake,/const arrivals=\[3,1,10,1,3,10\]/);
 assert.match(fake,/setInterval\(/);
 assert.match(fake,/document.visibilityState==="hidden"/);
 assert.match(fake,/soundEnabledRef.current/);
 assert.match(fake,/prepareDemoAudio\(\)/);
 assert.match(fake,/localNotificationPermission|showLocalExampleOrderNotification/);
 assert.match(fake,/Try demo alert/);
 assert.match(fake,/Enable simulated browser notifications/);
 assert.match(fake,/stopSimulation=\(\)=>setSimulationRunning\(false\)/);
 assert.match(fake,/pickupCommand\(order,action,extra\)/);
 for(const forbidden of [/\bfetch\s*\(/,/\bMerchantApi\b/,/\bsupabase\b/,/\bgetApiAuthHeaders\b/,/\bsendPushNotification\b/]){
   assert.doesNotMatch(fake,forbidden);
 }
});
test("Original Merchant Orders layouts and production-safe read-only worker remain unchanged",()=>{
 assert.match(orders,/OrdersFocusedWorkspace/);
 assert.match(orders,/usePreviewFakeOrders\(soundAlerts\)/);
 assert.match(orders,/onToggleDemoNotifications=\{\(\)=>\{void raiseDemoNotifications\(\);\}\}/);
 assert.match(focused,/onToggleDemoNotifications=\{onToggleDemoNotifications\}/);
 assert.match(worker,/connect-src 'none'/);
 assert.match(worker,/worker-src 'none'/);
 assert.match(worker,/form-action 'none'/);
 assert.doesNotMatch(worker,/push\.subscribe|\.sendNotification/);
 assert.doesNotMatch(orders,/MerchantWorkshopDemo/);
 assert.match(fake,/FAKE · TEST ONLY|Fake · Test only/);
});
