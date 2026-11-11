import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("src/App.tsx");
const css=read("src/index.css");
const notification=read("src/components/NotificationCenterSidePanel.tsx");
const tour=read("src/components/OnboardingTour.tsx");
const orders=read("src/components/OrdersFocusedWorkspace.tsx");
const ux1=read("src/components/ui/ConfirmModal.tsx");

test("UX4 notification drawer: verified scope, keyboard trap, focus restore, low-motion exit",()=>{
  assert.match(app,/ordersVerified=\{merchantShopGate\.status === "ready"/);
  assert.match(app,/orderReadStatus\.state === "fresh"/);
  assert.match(app,/orderReadScope === \x60\$\{user\?\.id\}:\$\{currentShop\?\.id\}\x60/);
  assert.match(app,/menuVerified=\{merchantShopGate\.status === "ready"/);
  assert.match(app,/menuReadStatus\.state === "ready"/);
  assert.match(notification,/const pendingOrdersCount = ordersVerified && Array\.isArray\(orders\)/);
  assert.match(notification,/const lowStockItems = menuVerified && Array\.isArray\(menuItems\)/);
  assert.match(notification,/Updates not fully verified/);
  assert.match(notification,/role="dialog"\s+aria-modal="true"/);
  assert.match(notification,/aria-labelledby="merchant-notification-center-title"/);
  assert.match(notification,/aria-label="Close notification center"/);
  assert.match(notification,/if \(e\.key === "Escape"\)/);
  assert.match(notification,/if \(e\.key === "Tab"\)/);
  assert.match(notification,/closeRef\.current\?\.focus\(\)/);
  assert.match(notification,/previousFocus\?\.focus\(\)/);
  assert.match(notification,/document\.body\.style\.overflow = "hidden"/);
  assert.match(notification,/useReducedMotion\(\)/);
  assert.match(notification,/reduceMotion \? \{ duration: 0 \}/);
  assert.match(notification,/min-h-11 rounded-lg/);
});

test("UX4 tour: honest pilot wording, readable steps, keyboard modal and 44px actions",()=>{
  assert.match(tour,/Riders — Coming Later/);
  assert.match(tour,/Live rider actions and tracking are not enabled/);
  assert.match(tour,/Real acceptance, payment and collection changes remain disabled/);
  assert.match(tour,/live ordering and delivery remain off/i);
  assert.doesNotMatch(tour,/Toggle 'Online' in the header to receive live customer requests/);
  assert.doesNotMatch(tour,/See couriers live on the active operations map/);
  assert.match(tour,/role="dialog"\s+aria-modal="true"/);
  assert.match(tour,/aria-labelledby="merchant-tour-title"/);
  assert.match(tour,/aria-live="polite"/);
  assert.match(tour,/if \(e\.key === "Escape"\)/);
  assert.match(tour,/if \(e\.key === "Tab"\)/);
  assert.match(tour,/skipRef\.current\?\.focus\(\)/);
  assert.match(tour,/previousFocus\?\.focus\(\)/);
  assert.match(tour,/max-h-\[min\(85dvh,680px\)\] overflow-y-auto/);
  assert.match(tour,/le-press-feedback min-h-11 px-5 py-2\.5/);
  assert.match(tour,/setActiveTab\(TOUR_STEPS\[nextStep\]\.tab\)/);
});

test("UX4 Orders: 44px tap zones without changing order action semantics",()=>{
  assert.doesNotMatch(orders,/min-h-9/);
  assert.doesNotMatch(orders,/h-10 w-10/);
  assert.match(orders,/min-h-11/);
  assert.match(orders,/h-11 w-11/);
  assert.match(orders,/le-press-feedback min-h-11 w-full rounded-lg/);
  assert.match(orders,/aria-pressed=\{viewMode==="active"\}/);
  assert.match(orders,/pickupOrderingEnabled\(\)/);
  assert.match(orders,/Preview test only · real pickup actions disabled/);
  assert.match(orders,/onExportCSV/);
  assert.match(orders,/onExportJSON/);
});

test("UX4 Settings: real labelled switches with larger invisible hit areas and no pretend printing",()=>{
  for (const [label,checked] of [["Sound alerts","soundAlerts"],["Push notifications","pushEnabled"],["Dark mode","darkMode"]]) {
    assert.ok(app.includes('aria-label="'+label+'"'),"Missing switch label: "+label);
    assert.ok(app.includes("aria-checked={"+checked+"}"),"Missing checked state: "+checked);
  }
  assert.equal((app.match(/role="switch"/g)||[]).length,3);
  assert.equal((app.match(/le-settings-switch w-12 h-6/g)||[]).length,3);
  assert.match(css,/\.le-settings-switch::before/);
  assert.match(css,/inset: -10px 0/);
  assert.match(app,/Test Print \(Unavailable\)/);
  assert.doesNotMatch(app,/toast\.success\("Attempting test print to network printer/);
  assert.match(app,/VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
});

test("UX4 preserves existing source-level reduced-motion, privacy and preview policies",()=>{
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/\.le-press-feedback:active/);
  assert.match(ux1,/aria-modal="true"/);
  assert.match(app,/orderReadCoordinator\.current\.refresh\(orderReadScope/);
  assert.match(app,/merchantShopGate\.status === "ready"/);
  assert.match(app,/pickupOrderingEnabled\(\)/);
  assert.doesNotMatch(app,/VITE_PICKUP_ORDERING_ENABLED\s*=\s*true/);
});
