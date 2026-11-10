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
  assert.match(orders, /<PreviewFakeOrders \/>/);
  assert.match(orders, /disabled=\{isReadOnlyPreview\}/);
});

test("L1C-3: fake test orders are isolated from real Orders, payment and notifications", () => {
  const fixture = readFileSync(new URL("../src/components/PreviewFakeOrders.tsx", import.meta.url), "utf8");
  assert.match(fixture, /VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(fixture, /VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true"/);
  assert.match(fixture, /location\.hostname/);
  assert.match(fixture, /TEST ONLY/);
  assert.match(fixture, /setDemoOrders\(/);
  assert.match(fixture, /Remove fake orders/);
  assert.match(fixture, /nextStatus/);
  for (const unsafe of [/\bfetch\s*\(/, /\bMerchantApi\b/, /\bsupabase\b/, /\bgetApiAuthHeaders\b/, /\bonUpdateStatus\b/, /\bonDeleteAllOrders\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bsendPushNotification\b/]) {
    assert.doesNotMatch(fixture, unsafe);
  }
});
