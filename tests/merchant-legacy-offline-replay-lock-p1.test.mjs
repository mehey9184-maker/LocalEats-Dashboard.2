import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {processOfflineSyncQueue} from "../src/utils/offlineSyncQueue.ts";
const src=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const app=src("../src/App.tsx");
const monitor=src("../src/components/ConnectivityMonitor.tsx");
const queue=src("../src/utils/offlineSyncQueue.ts");

test("legacy offline replay fails closed without any browser or Firebase services",async()=>{
  // No IndexedDB, Firebase credentials, browser globals or network are present.
  // Returning zero cannot assert any order was saved.
  assert.equal(await processOfflineSyncQueue(),0);
  assert.equal(await processOfflineSyncQueue(),0);
  assert.doesNotMatch(queue,/import.*updateFirestoreOrder/);
  assert.doesNotMatch(queue,/import.*updateFirestoreMenuItem/);
  assert.doesNotMatch(queue,/await updateFirestoreOrder\(/);
  assert.doesNotMatch(queue,/await updateFirestoreMenuItem\(/);
  assert.match(queue,/Legacy direct-Firestore replay is disabled/);
});

test("existing legacy records are not silently cleared or deleted",()=>{
  assert.match(queue,/export async function getQueuedMutations/);
  assert.match(queue,/export async function removeQueuedMutation/);
  const disabled=queue.slice(queue.indexOf("export async function processOfflineSyncQueue"));
  assert.doesNotMatch(disabled,/removeQueuedMutation\(/);
  assert.doesNotMatch(disabled,/indexedDB/);
  assert.doesNotMatch(disabled,/\.clear\(|\.delete\(/);
  assert.match(disabled,/return 0/);
});

test("reconnect and service worker recovery only read authoritative API/server state",()=>{
  assert.doesNotMatch(app,/processOfflineSyncQueue\(/);
  assert.doesNotMatch(app,/import.*processOfflineSyncQueue/);
  assert.match(app,/const reconcileFromServer = \(\) => \{/);
  assert.match(app,/const reconcileFromServer = \(\) => \{[\s\S]*?void fetchOrders\(\);[\s\S]*?void fetchShops\(\);[\s\S]*?void fetchAllMenuItems\(\);/);
  assert.match(app,/const handleOnline = \(\) => \{[\s\S]*?reconcileFromServer\(\);/);
  assert.match(app,/event\.data\?\.type === "TRIGGER_OFFLINE_SYNC"\) reconcileFromServer\(\)/);
  assert.doesNotMatch(app,/Network Restored:.*offline operations synchronized/);
  assert.match(app,/The order list remains unverified until a successful API refresh/);
  assert.doesNotMatch(app,/Synchronizing local cache with cloud database/);
});

test("Connectivity Monitor never replays legacy updates and describes pending records truthfully",()=>{
  assert.doesNotMatch(monitor,/processOfflineSyncQueue/);
  assert.match(monitor,/Legacy offline changes require review/);
  assert.match(monitor,/Nothing was synchronized/);
  assert.match(monitor,/<span>\{pendingSyncs\} REVIEW<\/span>/);
  assert.doesNotMatch(monitor,/Successfully pushed .*pending offline/);
  assert.doesNotMatch(monitor,/All offline changes are fully synchronized/);
});

test("browser auto-accept cannot be enabled by stale localStorage and has no mutation effect",()=>{
  assert.match(app,/const \[autoAcceptOrders, setAutoAcceptOrders\] = useState<boolean>\(false\)/);
  assert.doesNotMatch(app,/localStorage\.getItem\("autoAcceptOrders"\)/);
  assert.doesNotMatch(app,/setAutoAcceptOrders\(true\)/);
  assert.doesNotMatch(app,/Auto-Accepted by system/);
  assert.doesNotMatch(app,/orders\.filter\(o => o\.status === "pending"\)/);
  assert.match(app,/Auto-Accept is paused until server-side acceptance is approved/);
  assert.match(app,/server-authoritative policy/);
  assert.match(app,/>Paused<\/span>/);
});

test("the authoritative API and safe pickup release flags remain separate from legacy queue",()=>{
  const merchantApi=src("../src/services/MerchantApi.ts");
  const pickup=src("../src/services/merchantPickupPolicy.ts");
  assert.match(merchantApi,/\/api\/v1\/merchant\/orders/);
  assert.match(pickup,/VITE_PICKUP_ORDERING_ENABLED === "true"/);
  assert.doesNotMatch(queue,/supabase\.from\("orders"\)/);
});

test("read-only Merchant Preview does not auto-write a shop heartbeat on page load",()=>{
  assert.match(app,/VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  const heartbeat=app.slice(app.indexOf("// --- Shop Live Heartbeat & Inactivity Tracker ---"));
  assert.match(heartbeat,/useEffect\(\(\) => \{\s*\/\/ Preview may reuse Production Supabase credentials/);
  const block=heartbeat.slice(0,heartbeat.indexOf("// --- Real-Time"));
  assert.match(block,/if \(import\.meta\.env\.VITE_MERCHANT_PREVIEW_READ_ONLY === "true"\) return;/);
  assert.match(block,/\.update\(\{ updated_at: timeNow \}\)/);
  // Direct writes from other settings remain and require separate write-path review.
  assert.match(app,/\.update\(\{ require_terminal_sync: newValue \}\)/);
});
