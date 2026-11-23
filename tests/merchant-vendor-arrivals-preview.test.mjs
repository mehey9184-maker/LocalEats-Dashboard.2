import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const fake=read("src/components/PreviewFakeOrders.tsx");
const orders=read("src/components/OrdersManagement.tsx");
const focused=read("src/components/OrdersFocusedWorkspace.tsx");
const gate=read("src/services/merchantPreviewSimulator.ts");
const actions=read("src/components/PickupOrderActions.tsx");
const app=read("src/App.tsx");

test("CF-W2B preserves the existing Home to Orders UI and existing pickup actions",()=>{
  assert.match(app,/activeTab === "orders"/);
  assert.match(orders,/<OrdersFocusedWorkspace/);
  assert.match(orders,/<PreviewFakeOrderTrigger/);
  assert.match(focused,/<PreviewFakeOrderTrigger/);
  assert.match(fake,/<PickupOrderActions order={order} compact/);
  assert.match(actions,/if\(simulated\) \{/);
  assert.match(actions,/await onSimulate!\(action,extra\)/);
  assert.match(actions,/await MerchantApi\.transitionPickupOrder\(order,action,extra\)/);
  assert.doesNotMatch(orders,/MerchantWorkshopDemo|Workshop Demo/);
  assert.doesNotMatch(focused,/MerchantWorkshopDemo|Workshop Demo/);
});

test("small Start and Stop controls appear only in existing preview toolbar",()=>{
  assert.match(fake,/Start simulation/);
  assert.match(fake,/Stop simulation/);
  assert.match(fake,/simulationRunning\?onStopSimulation:onStartSimulation/);
  assert.match(fake,/if\(!isMerchantPreviewSimulatorEnabled\(\)\)return null/);
  assert.match(orders,/simulationRunning={simulationRunning}/);
  assert.match(orders,/onStartSimulation=\{\(\)=>startSimulation\(soundAlerts\)\}/);
  assert.match(focused,/simulationRunning={simulationRunning}/);
  assert.match(focused,/onStartSimulation={onStartSimulation}/);
});

test("fictional traffic varies from quiet to busy and stops without finishing orders automatically",()=>{
  assert.match(fake,/addSimulationWave\(1\)/);
  assert.match(fake,/const arrivals=\[3,1,10,1,3,10\]/);
  assert.match(fake,/window\.setInterval/);
  assert.match(fake,/window\.clearInterval/);
  assert.match(fake,/document\.visibilityState==="hidden"/);
  assert.match(fake,/Math\.max\(0,18-awaiting\)/);
  assert.match(fake,/Math\.max\(0,40-active\.length\)/);
  assert.match(fake,/\.slice\(0,60\)/);
  assert.match(fake,/setSimulationRunning\(false\)/);
  assert.match(fake,/const onDemoAction:PreviewTestPickupAction=/);
  assert.doesNotMatch(fake,/setTimeout\([^)]*advanceLocal/);
  assert.doesNotMatch(fake,/setInterval\([^)]*advanceLocal/);
});

test("fictional simulation remains disconnected from production backend and payments",()=>{
  assert.match(gate,/VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(gate,/VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true"/);
  assert.match(gate,/VITE_PICKUP_ORDERING_ENABLED !== "true"/);
  assert.match(gate,/vercel/);
  for(const forbidden of [/\bfetch\s*\(/,/\bMerchantApi\b/,/\bsupabase\b/,/\bgetApiAuthHeaders\b/,/\bonUpdateStatus\b/,/\bonDeleteAllOrders\b/,/\blocalStorage\b/,/\bsessionStorage\b/,/\bsendPushNotification\b/]){
    assert.doesNotMatch(fake,forbidden);
  }
  assert.match(fake,/FAKE-L1C3-/);
  assert.match(fake,/Fake · Test only/);
  assert.match(fake,/pickupCommand\(order,action,extra\)/);
});
