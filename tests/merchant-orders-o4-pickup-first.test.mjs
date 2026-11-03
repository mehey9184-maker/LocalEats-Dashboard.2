import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantJohannesburgDayKey} from "../src/services/merchantDashboardLayout.ts";
import {isPickupOrder,pickupState,pickupCommand,pickupMutationsDisabled} from "../src/services/merchantPickupPolicy.ts";

const orders=readFileSync(new URL("../src/components/OrdersManagement.tsx",import.meta.url),"utf8");
const actions=readFileSync(new URL("../src/components/PickupOrderActions.tsx",import.meta.url),"utf8");

test("pickup-first order cards show one summary and retain state-specific safe actions",()=>{
  assert.match(orders,/\{isPickupOrder\(order\) && <PickupOrderActions order=\{order\} mode="summary" \/>/);
  assert.doesNotMatch(orders,/\{isPickupOrder\(order\) && <PickupOrderActions order=\{order\}\/>\}/);
  assert.equal((orders.match(/<PickupOrderActions order=\{order\} mode="actions" \/>/g)||[]).length,3);
  assert.match(actions,/pickupOrderingEnabled\(\) && !busy && !disabled/);
  assert.match(actions,/await MerchantApi\.transitionPickupOrder\(order, action, extra\)/);
  assert.match(actions,/Have you actually received/);
  assert.match(actions,/Confirm the food has actually been handed to the customer/);
  assert.throws(()=>pickupMutationsDisabled());
});

test("collection uses only persisted fulfillment type, never rider assignment",()=>{
  const order={id:"o",shop_id:1,delivery_type:"collection",status:"ready_for_pickup",payment_status:"unpaid",revision:2,total_price:25};
  assert.equal(isPickupOrder(order),true);
  assert.equal(isPickupOrder({...order,delivery_type:"delivery"}),false);
  assert.equal(pickupState(order),"ready_for_pickup");
  assert.throws(()=>pickupCommand(order,"collect",{handover_confirmed:true}));
  assert.match(orders,/const hasDeliveryOrders = orders\.some\(\(order\) => isOrderDelivery\(order\)\)/);
  assert.match(orders,/if \(currentShopId && hasDeliveryOrders\)/);
  assert.match(orders,/\[currentShopId, currentShopPhone, hasDeliveryOrders, subscribeWithAuthGuard\]/);
  assert.match(orders,/isPickupOrder\(order\) \? "customer_status"/);
  assert.doesNotMatch(orders,/Cash on Delivery/);
});

test("pickup orders do not expose irrelevant customer GPS, delivery address or ETA",()=>{
  assert.match(orders,/Customer collects at the shop/);
  assert.match(orders,/No delivery address required/);
  assert.match(orders,/Collect at shop/);
  assert.match(orders,/isOrderDelivery\(order\) && calculateDynamicETA\(order\)/);
  assert.match(orders,/\{isOrderDelivery\(order\) && order\.lat && order\.lng && \(/);
  assert.match(orders,/isOrderDelivery\(order\) && order\.delivery_status === "picked_up"/);
});

test("detail receipt shows unavailable unit/line price, never invents an R0",()=>{
  assert.match(orders,/const rawUnitPrice = isPickupOrder\(order\) \? fields\.unit_price : fields\.price/);
  assert.match(orders,/const lineTotal = isPickupOrder\(order\)/);
  assert.match(orders,/\? pickupItemLineTotal\(item\)/);
  assert.match(orders,/unitPrice === null \? "Price unavailable" : merchantOrderMoney\(unitPrice\)/);
  assert.match(orders,/lineTotal === null \? "Amount unavailable" : merchantOrderMoney\(lineTotal\)/);
  assert.doesNotMatch(orders,/Number\(order\.total_price \|\| 0\)/);
});

test("collection filter is visible but All remains the safe default and history uses SAST",()=>{
  assert.match(orders,/useState<"All" \| "delivery" \| "collection">\("All"\)/);
  assert.match(orders,/aria-label="Order fulfillment filter"/);
  assert.match(orders,/Customer collection/);
  assert.match(orders,/Delivery \(later phase\)/);
  assert.match(orders,/orderTypeFilter === "collection" \? isPickupOrder\(o\) : isOrderDelivery\(o\)/);
  assert.doesNotMatch(orders,/toISOString\(\)\.split\("T"\)\[0\]/);
  assert.match(orders,/merchantJohannesburgDayKey\(new Date\(\)\)/);
  assert.equal(merchantJohannesburgDayKey("2026-11-03T22:30:00Z"),"2026-11-04");
});
