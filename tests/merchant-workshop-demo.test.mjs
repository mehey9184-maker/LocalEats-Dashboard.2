import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  WORKSHOP_STAGES, advanceWorkshop, initialWorkshopState,
} from "../src/services/merchantWorkshopDemoEngine.ts";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const previewGate=read("../src/services/merchantPreviewSimulator.ts");
const trigger=read("../src/components/PreviewFakeOrders.tsx");
const workshop=read("../src/components/MerchantWorkshopDemo.tsx");
const engine=read("../src/services/merchantWorkshopDemoEngine.ts");

test("workshop illustrates every order stage in the correct sequence",()=>{
  assert.deepEqual(WORKSHOP_STAGES,["incoming","accepted","preparing","ready","collected"]);
  let s=initialWorkshopState();
  const observed=[s.orders.find(o=>o.id==="DEMO-001").stage];
  for(let t=1;t<=10;t++){
    s=advanceWorkshop(s);
    const order=s.orders.find(o=>o.id==="DEMO-001");
    observed.push(order.stage);
  }
  assert.deepEqual(observed,[
    "incoming","incoming","accepted","accepted","preparing","preparing",
    "preparing","ready","ready","ready","collected"
  ]);
  assert.equal(s.completedTotal,1);
  assert.equal(s.orders.find(o=>o.id==="DEMO-001").sampleName,"Sample customer 1");
  assert.ok(s.events.some(e=>e.message.includes("Payment at shop")));
});

test("finite bounded workshop does not mutate existing state or leak customer data",()=>{
  let s=initialWorkshopState();
  const initialSnapshot=JSON.stringify(s);
  for(let i=0;i<160;i++) s=advanceWorkshop(s);
  assert.equal(initialSnapshot,JSON.stringify(initialWorkshopState()));
  assert.ok(s.orders.length<=10);
  assert.ok(s.events.length<=7);
  assert.equal(s.orders.every(x=>x.id.startsWith("DEMO-")),true);
  assert.ok(s.orders.every(x=>x.sampleName.startsWith("Sample customer ")));
  assert.ok(s.completedTotal>10);
  assert.ok(s.orders.every(x=>Number.isFinite(x.examplePrice)&&x.examplePrice>0));
});

test("autoplay is local, stoppable, visibility gated and separate from real orders",()=>{
  assert.match(workshop,/window\.setInterval/);
  assert.match(workshop,/window\.clearInterval/);
  assert.match(workshop,/document\.visibilityState === "hidden"/);
  assert.match(workshop,/setPlaying\(\(prev\) => !prev\)/);
  assert.match(workshop,/setState\(advanceWorkshop\)/);
  assert.match(workshop,/setState\(initialWorkshopState\(\)\)/);
  assert.match(workshop,/createPortal/);
  assert.match(workshop,/aria-modal="true"/);
  assert.match(workshop,/onKeyDown=\{onDialogKeyDown\}/);
  assert.match(workshop,/motion-reduce:animate-none/);
  assert.match(workshop,/No real orders/);
  assert.match(workshop,/FAKE/);
  assert.match(workshop,/not Firebase or device notifications/);
  assert.doesNotMatch(engine+workshop,/\bfetch\s*\(|\.from\s*\(|\bsupabase\s*\.|\.send\s*\(|\blocalStorage\s*\.|\bsessionStorage\s*\.|\.print\s*\(/);
  assert.doesNotMatch(engine+workshop,/from ["'].*(?:OrderService|firebase|supabaseAdmin|pickupCommand|MerchantApi|axios)/);
});

test("workshop launcher is protected by the original restricted Preview gate",()=>{
  assert.match(trigger,/isMerchantPreviewSimulatorEnabled\(\)/);
  assert.match(trigger,/workshopOpen&&<MerchantWorkshopDemo onClose=\{closeWorkshop\}\/>/);
  assert.match(trigger,/Workshop Demo/);
  assert.match(workshop,/isMerchantPreviewSimulatorEnabled\(\) \|\| isIsolatedCloudflareWorkshopPreviewEnabled\(\)/);
  assert.doesNotMatch(trigger,/isIsolatedCloudflareWorkshopPreviewEnabled/);
  assert.match(previewGate,/VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(previewGate,/VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true"/);
  assert.match(previewGate,/VITE_PICKUP_ORDERING_ENABLED !== "true"/);
  assert.match(previewGate,/vercel\\\.app/);
  assert.doesNotMatch(trigger,/setFakeOrders\(.*MerchantWorkshopDemo/);
});
