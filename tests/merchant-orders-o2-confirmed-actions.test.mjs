import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const orders = readFileSync(new URL("../src/components/OrdersManagement.tsx", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../src/hooks/useOrderWorkflow.ts", import.meta.url), "utf8");

test("status actions wait for API confirmation and keep the form open after failure", () => {
  const action = orders.slice(orders.indexOf("const confirmOrderStatus = async"), orders.indexOf("const [chatOrderId"));
  assert.ok(action.length > 200);
  assert.match(action, /if \(inFlightStatusRef\.current !== null\) return false/);
  assert.match(action, /await Promise\.resolve\(onUpdateStatus\(orderId, status\)\)/);
  assert.match(action, /onConfirmed\?\.\(\)/);
  assert.match(action, /catch \{/);
  assert.match(action, /return false/);
  assert.match(action, /finally \{/);
  assert.match(workflow, /throw error/);
  assert.doesNotMatch(orders, /onUpdateStatus\(order\.id, "preparing", undefined/);
  assert.doesNotMatch(orders, /onUpdateStatus\(order\.id, "ready", undefined/);
});

test("Orders does not offer customer messages or ETA inputs that the API ignores", () => {
  assert.doesNotMatch(orders, /setCustomMessage|value=\{customMessage\}|setEstimatedTime|value=\{estimatedTime\}/);
  assert.doesNotMatch(orders, /title="Adjust ETA"|Send & Accept|Set Time & Start/);
  assert.match(orders, /no ETA or custom customer message is sent/);
  assert.match(orders, /No custom customer message or ETA is sent/);
  assert.match(workflow, /MerchantApi\.transitionOrder\(id, "accept"\)/);
  assert.match(workflow, /MerchantApi\.transitionOrder\(id, "ready"\)/);
});

test("unsupported completion and local rider assignment controls are not clickable", () => {
  assert.doesNotMatch(orders, /onUpdateStatus\(order\.id, "completed"\)/);
  assert.doesNotMatch(orders, /Send Rider \(Dispatch\)/);
  assert.match(orders, /Delivery completion is confirmed by the authorized rider workflow/);
  assert.match(orders, /Rider assignment is handled by the authorized rider workflow/);
  assert.doesNotMatch(orders, /Order accepted & dispatched to rider/);
  assert.doesNotMatch(orders, /connectedRiders\.length === 0 && !currentShop\?\.linked_rider_id\) \{\s*setUnlinkedModalOrder\(order\)/);
});

test("browser-only kitchen notes are marked as local and partitioned per shop", () => {
  assert.match(orders, /Private note \(on this device only\)/);
  assert.match(orders, /le_kitchen_notes_shop_/);
  assert.doesNotMatch(orders, /localStorage\.getItem\("le_kitchen_notes"\)/);
  assert.doesNotMatch(orders, /localStorage\.setItem\("le_kitchen_notes"/);
  assert.match(orders, /scopedKitchenNotes\.shopId === kitchenNotesShopId/);
  assert.match(orders, /if \(orderNotes\.trim\(\)\)saveDeviceKitchenNote|if \(orderNotes\.trim\(\)\) saveDeviceKitchenNote/);
});

test("missing prices in kitchen item cards are never presented as zero", () => {
  const total = (orders.match(/merchantOrderTotal\(fields\.price\)/g) ?? []).length;
  assert.equal(total, 4);
  assert.doesNotMatch(orders, /Number\(fields\.price \?\? 0\)/);
  assert.match(orders, /price === null \? "Price unavailable" : merchantOrderMoney\(price\)/);
});
