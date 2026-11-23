import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const orders=read("src/components/OrdersFocusedWorkspace.tsx");
const board=read("src/components/OrdersStyleBoard.tsx");
const fake=read("src/components/PreviewFakeOrders.tsx");
const app=read("src/App.tsx");
const management=read("src/components/OrdersManagement.tsx");
const gate=read("src/services/cloudflareMerchantPitchGate.ts");

test("Only the original Orders view is polished; no new fake workshop or order API",()=>{
 assert.match(orders,/OrdersStyleBoard/);
 assert.match(orders,/PreviewFakeOrderTrigger/);
 assert.match(orders,/OrdersFocusedWorkspace/);
 assert.match(orders,/onDemoAction={onDemoAction}/);
 assert.match(fake,/pickupCommand\(order,action,extra\)/);
 assert.match(gate,/window.location.hostname === CF_MERCHANT_PITCH_HOST/);
 assert.match(gate,/VITE_PICKUP_ORDERING_ENABLED !== "true"/);
 for(const forbidden of [/\bfetch\s*\(/,/\bMerchantApi\b/,/\bsupabase\b/,/\bonUpdateStatus\b/,/\bsendPushNotification\b/]){
   assert.doesNotMatch(fake,forbidden);
 }
 assert.doesNotMatch(orders+board,/MerchantWorkshopDemo/);
});

test("Mobile header puts original Start and optional Alert on one line while moving secondary controls to Tools",()=>{
 assert.match(orders,/data-testid="orders-mobile-header"/);
 assert.match(orders,/grid-cols-\[minmax\(0,1fr\)_auto\]/);
 assert.match(fake,/grid-cols-2 gap-2 sm:flex/);
 assert.match(fake,/hidden sm:inline-flex min-h-11/);
 assert.match(orders,/Simulate one fake incoming pickup order/);
 assert.match(orders,/Clear all test orders/);
 assert.match(orders,/hidden sm:flex flex-wrap items-center/);
 assert.match(orders,/Ticket display/);
 assert.match(orders,/A · Expediter/);
 assert.match(orders,/B · Compact/);
 assert.match(fake,/Start simulation/);
 assert.match(fake,/Try demo alert/);
});

test("Use only one mobile kitchen stage filter; four full-width tabs are never cut off",()=>{
 assert.match(orders,/className="hidden md:flex items-center justify-between gap-2 min-w-0"/);
 assert.match(orders,/Sort mobile orders/);
 assert.match(orders,/Sort orders/);
 assert.match(board,/data-testid="mobile-kitchen-stages"/);
 assert.match(board,/grid grid-cols-4 md:hidden/);
 assert.match(board,/aria-label={`${lane.label} stage`}/);
 assert.match(board,/lane.key==="preparing"\?"Prep"/);
 assert.match(board,/lane.key==="fulfilled"\?"Done"/);
 assert.match(board,/min-h-11 rounded-full/);
});

test("Preview mobile Help and POPIA actions remain reachable without obscuring order cards",()=>{
 assert.match(app,/onOpenHelp={\(\) => setShowHelp\(true\)}/);
 assert.match(app,/onOpenLegal={\(\) => setShowLegal\(true\)}/);
 assert.match(management,/onOpenHelp\?: \(\) => void/);
 assert.match(management,/onOpenLegal\?: \(\) => void/);
 assert.match(orders,/Help & Tips/);
 assert.match(orders,/Legal & Privacy/);
 assert.match(app,/isolatedPitch && activeTab === "orders" && "max-md:hidden"/);
 assert.equal((app.match(/isolatedPitch && activeTab === "orders" && "max-md:hidden"/g)||[]).length,2);
 assert.match(app,/title="Help & Tips"/);
 assert.match(app,/LegalDocsModal isOpen={showLegal}/);
});
