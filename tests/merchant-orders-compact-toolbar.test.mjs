import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/OrdersManagement.tsx", import.meta.url), "utf8");

test("Orders starts with a compact workspace toolbar and a visible queue heading", () => {
  assert.match(source, /aria-label="Orders workspace"/);
  assert.match(source, /aria-label="Orders view"/);
  assert.match(source, /Current Orders/);
  assert.match(source, /onClick=\{\(\) => \{ void handleRefreshOrders\(\); \}\}/);
  assert.match(source, /await Promise\.resolve\(onRefresh\(\)\)/);
  assert.match(source, /Active Queue/);
  assert.ok(source.indexOf("Active Queue", source.indexOf('aria-label="Orders workspace"')) <
    source.indexOf('aria-label="Order fulfillment filter"'), "queue heading must come before advanced filters");
  assert.doesNotMatch(source, /MOBILE COMPACT ACTIONS CONSOLE/);
});

test("Filters are collapsed by default but still preserve order controls", () => {
  assert.match(source, /const \[showOrderFilters, setShowOrderFilters\] = useState\(false\)/);
  assert.match(source, /aria-expanded=\{showOrderFilters\}/);
  assert.match(source, /showOrderFilters && \(/);
  assert.match(source, /id="orders-filter-panel"/);
  assert.match(source, /aria-label="Order fulfillment filter"/);
  assert.match(source, /setFilterStatus\(status\)/);
  assert.match(source, /Filter by Order Placed Date/);
  assert.match(source, /handleSort\(field\.id/);
  assert.match(source, /setSearchTerm\(e\.target\.value\)/);
});

test("Extra actions are deferred visually without changing underlying merchant protections", () => {
  assert.match(source, /const \[showMobileActions, setShowMobileActions\] = useState\(false\)/);
  assert.match(source, /aria-controls="orders-extra-tools"/);
  assert.match(source, /showMobileActions && \(/);
  assert.match(source, /setKitchenMode\(!kitchenMode\)/);
  assert.match(source, /onClick=\{exportToCSV\}/);
  assert.match(source, /onClick=\{exportToJSON\}/);
  assert.match(source, /Orders are not recently verified by the API/);
  assert.match(source, /readState=\{ordersReadState\} verifiedAt=\{ordersVerifiedAt\}/);
});
