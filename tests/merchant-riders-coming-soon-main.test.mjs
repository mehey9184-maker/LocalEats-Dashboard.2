import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("Riders remains in the original sidebar and is a static Coming Soon page", () => {
  assert.match(app, /\{ id: "riders", label: "Riders", icon: Bike \}/);
  assert.match(app, /id="riders-coming-soon-title"/);
  assert.match(app, />Coming Soon<\/h1>/);
  assert.match(app, /Rider management is not available yet/);
  assert.doesNotMatch(app, /import \{ RiderManagement \}/);
});

test("Riders route cannot open pairing, dispatch or any interactive rider controls", () => {
  const start = app.indexOf('{activeTab === "riders" && (');
  const end = app.indexOf('{activeTab === "payments" && (', start);
  assert.ok(start >= 0 && end > start, "Riders must remain before Payments");
  const route = app.slice(start, end);
  assert.match(route, /<section aria-labelledby="riders-coming-soon-title"/);
  assert.doesNotMatch(route, /<RiderManagement\b|onClick=|onChange=|onSubmit=|<button\b|supabase|fetchConnections|requestRider|sendRiderNudge/);
});

test("Only the Riders route is locked; existing Orders page remains wired", () => {
  assert.match(app, /onRequestRider=\{requestRider\}/);
  assert.match(app, /onDispatchToRider=\{dispatchOrderToRider\}/);
});

test("Merchant Orders cannot send a rider nudge or show a nudge success message", () => {
  const orders = readFileSync(new URL("../src/components/OrdersManagement.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /nudge_rider|sendRiderNudge|LocalEats Courier Nudge/);
  assert.doesNotMatch(orders, /sendRiderNudge|Wake to Tip|Rider nudged successfully/);
  assert.match(orders, /<PickupOrderActions\s+order=/);
});

test("L1C-3: Orders queue comes first and secondary settings are collapsed", () => {
  const orders = readFileSync(new URL("../src/components/OrdersManagement.tsx", import.meta.url), "utf8");
  assert.match(orders, /More tools/);
  assert.match(orders, /showDesktopActions &&/);
  assert.match(orders, /<details className="bg-surface-container-lowest/);
  assert.match(orders, /Notification settings & order limit/);
  assert.doesNotMatch(orders, /Status Dropdown:/);
  assert.doesNotMatch(orders, /across all delivery channels/);
  assert.match(orders, /<PreviewFakeOrderTrigger/);
  assert.equal((orders.match(/<PreviewFakeOrderCard key=\{order\.id\}/g) ?? []).length, 4);
  assert.match(orders, /disabled=\{isReadOnlyPreview\}/);
});

test("L1C-3: incoming fake order enters the four Kanban columns without changing real counts", () => {
  const orders = readFileSync(new URL("../src/components/OrdersManagement.tsx", import.meta.url), "utf8");
  assert.match(orders, /SimulateIncoming\(soundAlerts\)/i);
  assert.match(orders, /usePreviewFakeOrders\(\)/);
  assert.match(orders, /<PreviewFakeOrderTrigger/);
  assert.equal((orders.match(/<PreviewFakeOrderCard key=\{order\.id\}/g) ?? []).length, 4);
  assert.match(orders, /displayedOrders\.length === 0 && \(viewMode !== "active" \|\| fakeOrders\.length===0\)/);
  assert.match(orders, /\{displayedOrders\.length\} Real/);
  assert.match(orders, /\+\{fakeOrders\.length\} FAKE/);
  assert.doesNotMatch(orders, /\[\.\.\.orders,\.\.\.fakeOrders\]|\[\.\.\.fakeOrders,\.\.\.orders\]/);
});

test("L1C-3: simulator and fake card never persist or notify real services", () => {
  const fixture = readFileSync(new URL("../src/components/PreviewFakeOrders.tsx", import.meta.url), "utf8");
  const guard = readFileSync(new URL("../src/services/merchantPreviewSimulator.ts", import.meta.url), "utf8");
  assert.match(guard, /VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(guard, /VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true"/);
  assert.match(guard, /VITE_PICKUP_ORDERING_ENABLED !== "true"/);
  assert.match(guard, /location\.hostname/);
  assert.match(guard, /\.vercel/);
  assert.match(fixture, /FAKE-L1C3-/);
  assert.match(fixture, /TEST ONLY/);
  assert.match(fixture, /setFakeOrders\(/);
  assert.match(fixture, /600\)/);
  assert.match(fixture, /pickupCommand\(order,action,extra\)/);
  assert.match(fixture, /pickup_status:"ready_for_pickup"/);
  assert.match(fixture, /onSimulate=\{\(action,extra\)=>onDemoAction/);
  for (const unsafe of [/\bfetch\s*\(/, /\bMerchantApi\b/, /\bsupabase\b/, /\bgetApiAuthHeaders\b/, /\bonUpdateStatus\b/, /\bonDeleteAllOrders\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bsendPushNotification\b/]) {
    assert.doesNotMatch(fixture, unsafe);
  }
});

test("L1C-3: actual pickup buttons are shared; simulated actions cannot invoke MerchantApi", () => {
  const actions = readFileSync(new URL("../src/components/PickupOrderActions.tsx", import.meta.url), "utf8");
  assert.match(actions, /const simulated=!!onSimulate && isMerchantPreviewSimulatorEnabled\(\)/);
  assert.match(actions, /FAKE-L1C3-/);
  assert.match(actions, /const canAct=simulated \|\| pickupOrderingEnabled\(\)/);
  assert.match(actions, /const pending=simulated \? false : MerchantApi\.hasPendingPickupCommand\(order\)/);
  assert.match(actions, /if\(simulated\) \{/);
  assert.match(actions, /await onSimulate!\(action,extra\)/);
  assert.match(actions, /\} else \{\s*await MerchantApi\.transitionPickupOrder\(order,action,extra\)/);
  assert.match(actions, /TEST ONLY: Simulate a cash\/card payment/);
  assert.match(actions, /TEST ONLY: Simulate food handover/);
});

test("L1C-3 review: queue-first layout is gated to isolated no-write Preview", () => {
  const orders = readFileSync(new URL("../src/components/OrdersManagement.tsx",import.meta.url),"utf8");
  const focused = readFileSync(new URL("../src/components/OrdersFocusedWorkspace.tsx",import.meta.url),"utf8");
  assert.match(orders,/VITE_MERCHANT_ORDERS_FOCUSED_UI === "true"/);
  assert.match(orders,/isMerchantPreviewSimulatorEnabled\(\)/);
  assert.match(orders,/<OrdersFocusedWorkspace/);
  assert.match(focused,/data-testid="orders-focused-workspace"/);
  assert.match(focused,/Pickup-first kitchen queue/);
  assert.match(focused,/Current/);
  assert.match(focused,/History/);
  assert.match(focused,/MoreHorizontal/);
  assert.match(focused,/Real/);
  assert.match(focused,/PickupOrderActions order=\{order\}/);
});

test("L1C-3 review: high-volume Orders have bounded pagination and no fixed-width Kanban columns", () => {
  const focused = readFileSync(new URL("../src/components/OrdersFocusedWorkspace.tsx",import.meta.url),"utf8");
  const fake = readFileSync(new URL("../src/components/PreviewFakeOrders.tsx",import.meta.url),"utf8");
  assert.match(focused,/const PAGE_SIZE=12/);
  assert.match(focused,/\.slice\(\(safePage-1\)\*PAGE_SIZE,safePage\*PAGE_SIZE\)/);
  assert.match(focused,/grid-cols-1 xl:grid-cols-2/);
  assert.match(focused,/min-w-0 max-w-full/);
  assert.doesNotMatch(focused,/xl:grid-cols-4|w-\[400px\]|min-h-\[500px\]/);
  assert.match(focused,/data-testid="focused-order-grid"/);
  assert.match(focused,/Page \{safePage\} of \{pages\}/);
  assert.match(focused,/viewMode==="history"&&/);
  assert.match(fake,/const simulateBatch=\(\)=>/);
  assert.match(fake,/Array\.from\(\{length:24\}/);
  assert.match(fake,/\.slice\(0,60\)/);
  assert.match(focused,/Test busy queue · \+24 FAKE orders/);
});

test("L1C-3 review: fake orders remain distinct from real order data and operational writes", () => {
  const focused = readFileSync(new URL("../src/components/OrdersFocusedWorkspace.tsx",import.meta.url),"utf8");
  assert.match(focused,/\{kind:"real";order:Order\} \| \{kind:"fake";order:PreviewTestPickupOrder\}/);
  assert.match(focused,/entry.kind==="fake"/);
  assert.match(focused,/PreviewFakeOrderCard/);
  assert.match(focused,/onDemoAction=\{onDemoAction\}/);
  assert.match(focused,/renderRealOrder\(order,index\)/);
  assert.match(focused,/disabled=\{readOnly\}/);
  assert.match(focused,/realOrders\.map\(order=>\(\{kind:"real"/);
  assert.match(focused,/activeFake\.map\(order=>\(\{kind:"fake"/);
  for (const unsafe of [/\bfetch\s*\(/, /\bsupabase\b/, /\bMerchantApi\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bwindow\.dispatchEvent\b/]) {
    assert.doesNotMatch(focused,unsafe);
  }
});
