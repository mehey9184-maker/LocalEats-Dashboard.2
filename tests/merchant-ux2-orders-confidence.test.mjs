import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { merchantOrdersConfidence, merchantOrdersEmptyMessage } from "../src/services/merchantOrdersUXTrust.ts";

const now = 2_000_000;
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const orders = read("src/components/OrdersManagement.tsx");
const app = read("src/App.tsx");

test("UX2: unverified reads never become an apparently empty verified queue", () => {
  assert.equal(merchantOrdersConfidence("checking", null, now), "checking");
  assert.equal(merchantOrdersConfidence("unavailable", null, now), "unavailable");
  assert.equal(merchantOrdersConfidence("unavailable", now - 500, now), "stale");
  assert.equal(merchantOrdersConfidence("confirmed", null, now), "unavailable");
  assert.equal(merchantOrdersConfidence("confirmed", now + 5_000, now), "unavailable");
  assert.equal(merchantOrdersConfidence("confirmed", now - 90_000, now), "verified");
  assert.equal(merchantOrdersConfidence("confirmed", now - 90_001, now), "stale");
});

test("UX2: filtered empty results are distinct from verified absence and failures", () => {
  assert.equal(merchantOrdersEmptyMessage("verified", "active", true).title, "No matching orders");
  assert.equal(merchantOrdersEmptyMessage("verified", "history", true).title, "No matching orders");
  assert.equal(merchantOrdersEmptyMessage("verified", "active", false).title, "No current orders");
  assert.equal(merchantOrdersEmptyMessage("verified", "history", false).title, "No order history in this list");
  assert.equal(merchantOrdersEmptyMessage("checking", "active", false).title, "Checking orders…");
  assert.equal(merchantOrdersEmptyMessage("unavailable", "active", false).title, "Orders unavailable");
  assert.equal(merchantOrdersEmptyMessage("stale", "active", false).title, "Latest orders not verified");
});

test("UX2: rendered queue has a visible reset even when advanced filters are collapsed", () => {
  assert.match(orders, /const filtersApplied = filterStatus !== "All"/);
  assert.match(orders, /const clearAllOrderFilters = \(\) => \{/);
  assert.match(orders, /aria-label="Search orders"/);
  assert.match(orders, /Filters &amp; sort/);
  assert.match(orders, /onClick=\{clearAllOrderFilters\}/);
  assert.match(orders, /Clear filters/);
  assert.match(orders, /<OperationFeedback/);
});

test("UX2: status overview and empty screen never report false current zeros", () => {
  assert.match(orders, /merchantOrdersConfidence\(ordersReadState, ordersVerifiedAt\)/);
  assert.match(orders, /merchantOrdersEmptyMessage\(ordersConfidence, viewMode, filtersApplied\)/);
  assert.match(orders, /unverifiedWithoutPreviousOrders \? "—" : stat.count/);
  assert.match(orders, /unverifiedWithoutPreviousOrders \? "—" : displayedOrders.length/);
  assert.match(orders, /emptyOrderMessage.title/);
  assert.match(orders, /emptyOrderMessage.description/);
  assert.doesNotMatch(orders, /All caught up!/);
  assert.doesNotMatch(orders, /No history yet/);
  assert.match(orders, /Last checked \{lastVerifiedOrdersTime\} SAST/);
});

test("UX2: owner safety boundaries remain intact", () => {
  assert.match(orders, /ordersReadState = "checking"/);
  assert.match(orders, /ordersVerifiedAt = null/);
  assert.match(orders, /readState=\{ordersReadState\} verifiedAt=\{ordersVerifiedAt\}/);
  assert.match(app, /id="riders-coming-soon-title"/);
  assert.doesNotMatch(app, /<RiderManagement\b/);
});
