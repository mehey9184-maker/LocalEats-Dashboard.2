import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantPickupReadCurrent} from "../src/services/merchantDashboardFreshness.ts";
import {merchantJohannesburgClock} from "../src/services/merchantDashboardLayout.ts";

const pickup=readFileSync(new URL("../src/components/PickupOrderActions.tsx",import.meta.url),"utf8");
const orders=readFileSync(new URL("../src/components/OrdersManagement.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const workflow=readFileSync(new URL("../src/hooks/useOrderWorkflow.ts",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/services/MerchantApi.ts",import.meta.url),"utf8");

test("payment and handover are gated on recent API verification, including at click time",()=>{
  const now=1780000000000;
  assert.equal(merchantPickupReadCurrent("confirmed",now,now),true);
  assert.equal(merchantPickupReadCurrent("confirmed",now-90000,now),true);
  assert.equal(merchantPickupReadCurrent("confirmed",now-90001,now),false);
  assert.equal(merchantPickupReadCurrent("checking",now,now),false);
  assert.equal(merchantPickupReadCurrent("unavailable",now,now),false);
  assert.equal(merchantPickupReadCurrent("confirmed",null,now),false);
  assert.equal(merchantPickupReadCurrent("confirmed",NaN,now),false);
  assert.equal(merchantPickupReadCurrent("confirmed",now+1,now),false);
  assert.match(pickup,/readState = "checking", verifiedAt = null/);
  assert.match(pickup,/readCurrent && !hasUnconfirmedCommand && !awaitingRefresh/);
  assert.match(pickup,/if \(!merchantPickupReadCurrent\(readState, verifiedAt\)\)/);
  assert.match(pickup,/Refresh Orders before changing payment or handover/);
  assert.match(orders,/ordersReadState=\{ordersReadState\}/g);
  assert.match(orders,/readState=\{ordersReadState\} verifiedAt=\{ordersVerifiedAt\}/);
  assert.equal((orders.match(/readState=\{ordersReadState\} verifiedAt=\{ordersVerifiedAt\}/g)||[]).length,3);
  assert.match(orders,/Orders are not recently verified by the API/);
  assert.match(app,/ordersReadState=\{ordersReadState\}/);
  assert.match(app,/ordersVerifiedAt=\{ordersVerifiedAt\}/);
});

test("legacy generic status changes cannot bypass dedicated pickup payment/handover",()=>{
  assert.match(orders,/toast\.error\("Use the dedicated customer-collection actions for pickup orders\."\)/);
  assert.match(workflow,/if \(isPickupOrder\(current\)\) \{/);
  assert.match(workflow,/Use the dedicated customer-collection controls for pickup orders/);
  assert.doesNotMatch(workflow,/MerchantApi\.transitionPickupOrder\(current/);
  assert.match(orders,/disabled=\{isPickupOrder\(orderToAccept\) \|\| updatingOrderId!==null\}/);
  assert.match(pickup,/await MerchantApi\.transitionPickupOrder\(order, action, extra\)/);
  assert.match(pickup,/await MerchantApi\.retryPendingPickupOrder\(order\)/);
  assert.match(api,/cache: "no-store"/);
});

test("old unscoped browser cache of customer phone, addresses and payment data is purged",()=>{
  assert.doesNotMatch(app,/localStorage\.setItem\("localeats_cached_orders"/);
  assert.match(app,/localStorage\.removeItem\("localeats_cached_orders"\)/);
  assert.match(app,/"localeats_cached_orders",/);
  assert.match(app,/Customer names, phone numbers, addresses and pickup\/payment details/);
});

test("unpaid pickup does not get a paid-green badge, and exports warn about private data",()=>{
  assert.match(orders,/isPickupOrder\(order\)\s*\?\s*order\.payment_status === "paid"/);
  assert.match(orders,/bg-amber-100 dark:bg-amber-900/);
  assert.match(orders,/This is not a database backup/);
  assert.match(orders,/not a recoverable backup/);
  assert.match(orders,/Export filtered order data including customer contact details/);
  assert.match(orders,/Export JSON/);
  assert.doesNotMatch(orders,/Backup Data/);
});

test("all visible kitchen order times use SAST, not the browser timezone",()=>{
  assert.equal(merchantJohannesburgClock("2026-11-03T22:30:00Z"),"00:30");
  assert.equal(merchantJohannesburgClock("2026-06-15T08:05:00Z"),"10:05");
  assert.equal(merchantJohannesburgClock("bad"),"Time unavailable");
  assert.equal(merchantJohannesburgClock(null),"Time unavailable");
  assert.equal((orders.match(/merchantJohannesburgClock\(order\.created_at\)/g)||[]).length,4);
  assert.doesNotMatch(orders,/new Date\(order\.created_at\)\.toLocaleTimeString\(\[\]/);
  assert.doesNotMatch(orders,/format\(new Date\(order\.created_at\), "HH:mm"\)/);
});
