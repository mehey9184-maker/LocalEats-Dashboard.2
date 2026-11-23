import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const focused=read("src/components/OrdersFocusedWorkspace.tsx");
const board=read("src/components/OrdersStyleBoard.tsx");
const fake=read("src/components/PreviewFakeOrders.tsx");
const gate=read("src/services/cloudflareMerchantPitchGate.ts");
const worker=read("preview/merchant-pitch/worker.ts");

test("All new soft-card styling is gated to the EXACT Cloudflare fictional preview",()=>{
  for(const src of [focused,board,fake]){
    assert.match(src,/isIsolatedCloudflareMerchantPitchPreviewEnabled/);
    assert.match(src,/pitchPolish\?/);
  }
  assert.match(gate,/window.location.hostname === CF_MERCHANT_PITCH_HOST/);
  assert.match(gate,/VITE_MERCHANT_CF_DEMO_READ_ONLY/);
  assert.match(gate,/VITE_MERCHANT_PREVIEW_READ_ONLY/);
  assert.match(gate,/VITE_MERCHANT_FAKE_ORDERS_ENABLED/);
  assert.match(gate,/VITE_PICKUP_ORDERING_ENABLED !== "true"/);
  assert.match(worker,/connect-src 'none'/);
  assert.match(worker,/worker-src 'none'/);
  assert.match(worker,/form-action 'none'/);
});

test("Original Orders structure and unmistakable fictional labels are preserved",()=>{
  assert.match(focused,/orders-mobile-header/);
  assert.match(focused,/orders-queue-card/);
  assert.match(focused,/OrdersStyleBoard/);
  assert.match(board,/mobile-kitchen-stages/);
  assert.match(board,/grid grid-cols-4 md:hidden/);
  assert.match(board,/lane.key==="preparing"\?"Prep"/);
  assert.match(fake,/Fake · Test only/);
  assert.match(fake,/<PickupOrderActions order={order} compact/);
  assert.match(fake,/Start simulation/);
  assert.match(fake,/Try demo alert/);
  assert.match(fake,/pickupCommand\(order,action,extra\)/);
  for(const src of [focused,board,fake]){
    assert.doesNotMatch(src,/MerchantWorkshopDemo/);
  }
  for(const forbidden of [/\bfetch\s*\(/,/\bMerchantApi\b/,/\bsupabase\b/,/\bsendPushNotification\b/]){
    assert.doesNotMatch(fake,forbidden);
  }
});

test("Soft hierarchy, layered shadows and reversible reduced-motion-safe feedback exist",()=>{
  assert.match(focused,/antialiased/);
  assert.match(focused,/tracking-tight/);
  assert.match(focused,/shadow-\[0_9px_28px/);
  assert.match(focused,/shadow-\[0_10px_30px/);
  assert.match(fake,/shadow-\[0_8px_24px/);
  assert.match(fake,/motion-safe:transition-\[transform,box-shadow,border-color\]/);
  assert.match(fake,/motion-safe:active:scale-\[0.995\]/);
  assert.match(board,/motion-safe:md:hover:-translate-y-0.5/);
  assert.match(board,/shadow-\[0_5px_13px/);
  assert.match(fake,/min-h-11/); // tactile buttons stay at least 44px
});
