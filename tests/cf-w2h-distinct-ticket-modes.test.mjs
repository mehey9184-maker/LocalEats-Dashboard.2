import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const focused=read("src/components/OrdersFocusedWorkspace.tsx");
const board=read("src/components/OrdersStyleBoard.tsx");
const fake=read("src/components/PreviewFakeOrders.tsx");
const worker=read("preview/merchant-pitch/worker.ts");
const gate=read("src/services/cloudflareMerchantPitchGate.ts");

test("A is original full ticket and B is distinct, collapsed scan-first row (not a relabeled duplicate)",()=>{
 assert.match(fake,/function CompactFakeOrderRow/);
 assert.match(fake,/data-style="compact"/);
 assert.match(fake,/data-testid="compact-fake-actions"/);
 assert.match(fake,/aria-expanded={open}/);
 assert.match(fake,/aria-controls={detailsId}/);
 assert.match(fake,/if\(variant==="compact" && isIsolatedCloudflareMerchantPitchPreviewEnabled\(\)\)/);
 assert.match(fake,/return <CompactFakeOrderRow/);
 assert.match(fake,/\bconst roomy=variant==="expediter"/);
 assert.match(fake,/getCustomerPreparationNotes\(order\)/);
 assert.match(fake,/Special request/);
 assert.match(fake,/Fake · Test only/);
 assert.match(fake,/PickupOrderActions order={order} compact/);
 assert.match(board,/data-testid="compact-real-actions"/);
 assert.match(board,/if\(!roomy && pitchPolish\)/);
 assert.match(board,/getCustomerPreparationNotes\(order\)/);
 assert.match(board,/Full order details/);
 assert.match(board,/laneWindow=style==="compact"&&isIsolatedCloudflareMerchantPitchPreviewEnabled\(\)\?16:6/);
 assert.match(focused,/A: full order/);
 assert.match(focused,/B: scan many orders/);
 assert.match(focused,/closest\("details"\)\?\.removeAttribute\("open"\)/);
});

test("A/B only affect rendering on the exact fictional Cloudflare host, not production",()=>{
 assert.match(gate,/window.location.hostname === CF_MERCHANT_PITCH_HOST/);
 assert.match(gate,/VITE_MERCHANT_CF_DEMO_READ_ONLY/);
 assert.match(gate,/VITE_MERCHANT_PREVIEW_READ_ONLY/);
 assert.match(gate,/VITE_PICKUP_ORDERING_ENABLED !== "true"/);
 assert.match(worker,/connect-src 'none'/);
 assert.match(worker,/worker-src 'none'/);
 assert.match(worker,/form-action 'none'/);
 for(const src of [fake,board,focused]) assert.match(src,/isIsolatedCloudflareMerchantPitchPreviewEnabled/);
 for(const src of [fake,board,focused])assert.doesNotMatch(src,/MerchantWorkshopDemo/);
 for(const forbidden of [/\bfetch\s*\(/,/\bMerchantApi\b/,/\bsupabase\b/,/\bsendPushNotification\b/])assert.doesNotMatch(fake,forbidden);
 assert.match(fake,/pickupCommand\(order,action,extra\)/);
 assert.match(fake,/onDemoAction\(order.id,action,extra\)/);
 assert.match(board,/renderRealOrder\(order,index\)/);
});

test("Original mobile kitchen stages, FIFO simulation and mode preference are preserved",()=>{
 assert.match(board,/mobile-kitchen-stages/);
 assert.match(board,/grid grid-cols-4 md:hidden/);
 assert.match(fake,/const arrivals=\[3,1,10,1,3,10\]/);
 assert.match(focused,/window.localStorage.setItem\(styleStorageKey,choice\)/);
 assert.match(focused,/stored==="expediter"\|\|stored==="compact"/);
 assert.match(focused,/aria-pressed={boardStyle==="expediter"}/);
 assert.match(focused,/aria-pressed={boardStyle==="compact"}/);
});
