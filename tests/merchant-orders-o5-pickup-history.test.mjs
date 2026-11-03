import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  merchantJohannesburgDayKey,
  merchantOrderHistoryInSastRange,
  merchantOrderCompletedOnSastDay
} from "../src/services/merchantDashboardLayout.ts";
import {pickupCommand,pickupAmountLabel,pickupState} from "../src/services/merchantPickupPolicy.ts";

const actions=readFileSync(new URL("../src/components/PickupOrderActions.tsx",import.meta.url),"utf8");
const orders=readFileSync(new URL("../src/components/OrdersManagement.tsx",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/services/MerchantApi.ts",import.meta.url),"utf8");

const today="2026-11-03";

test("Order History filters by placed date in Johannesburg, not viewer timezone or completed_at",()=>{
  assert.equal(merchantJohannesburgDayKey("2026-11-02T22:30:00Z"),today);
  assert.equal(merchantOrderHistoryInSastRange({created_at:"2026-11-02T22:30:00Z"},today,today),true);
  assert.equal(merchantOrderHistoryInSastRange({created_at:"2026-11-03T21:30:00Z"},today,today),true);
  assert.equal(merchantOrderHistoryInSastRange({created_at:"2026-11-03T22:30:00Z"},today,today),false);
  assert.equal(merchantOrderHistoryInSastRange({created_at:"2026-11-03T22:30:00Z"},"2026-11-04","2026-11-04"),true);
  assert.equal(merchantOrderHistoryInSastRange({created_at:"invalid"},today,today),false);
  assert.equal(merchantOrderHistoryInSastRange({created_at:"invalid"},"",""),true);
  assert.match(orders,/merchantOrderHistoryInSastRange\(o,startDate,endDate\)/);
  assert.match(orders,/Filter by Order Placed Date/);
  assert.doesNotMatch(orders,/new Date\(startDate \+ "T00:00:00"\)/);
  assert.doesNotMatch(orders,/new Date\(endDate \+ "T23:59:59\.999"\)/);
});

test("Completed Today excludes cancelled orders, orders merely placed today, and missing completion timestamps",()=>{
  assert.equal(merchantOrderCompletedOnSastDay({status:"completed",completed_at:"2026-11-02T22:30:00Z"},today),true);
  assert.equal(merchantOrderCompletedOnSastDay({status:"cancelled",completed_at:"2026-11-02T22:30:00Z"},today),false);
  assert.equal(merchantOrderCompletedOnSastDay({status:"completed",completed_at:undefined},today),false);
  assert.equal(merchantOrderCompletedOnSastDay({status:"completed",completed_at:"2026-11-03T22:30:00Z"},today),false);
  assert.equal(merchantOrderCompletedOnSastDay({status:"preparing",completed_at:"2026-11-02T22:30:00Z"},today),false);
  assert.match(orders,/Completed Today/);
  assert.match(orders,/merchantOrderCompletedOnSastDay\(o,today\)/);
  assert.match(orders,/No time-confirmed completions today/);
  assert.match(orders,/isPickupOrder\(order\) && order\.status === "completed" \? "Collected"/);
});

test("Payment at collection never implies physical handover and paid total differs from amount due",()=>{
  const ready={id:"pickup-1",shop_id:17,delivery_type:"collection",status:"ready_for_pickup",revision:4,payment_status:"unpaid",total_price:27.50,service_fee:2.50};
  assert.equal(pickupState(ready),"ready_for_pickup");
  assert.equal(pickupAmountLabel(ready),"Total due at shop: R 27.50 · Service fee included: R 2.50");
  assert.equal(pickupCommand(ready,"confirm_payment",{payment_method:"cash"}).path,"payment-confirmation");
  assert.throws(()=>pickupCommand(ready,"collect",{handover_confirmed:true}));
  const paid={...ready,payment_status:"paid",payment_method:"cash",revision:5};
  assert.equal(pickupAmountLabel(paid),"Recorded paid total: R 27.50 · Service fee included: R 2.50");
  assert.throws(()=>pickupCommand(paid,"confirm_payment",{payment_method:"cash"}));
  assert.throws(()=>pickupCommand(paid,"collect"));
  assert.equal(pickupCommand(paid,"collect",{handover_confirmed:true}).path,"collect");
  assert.match(actions,/payment of R \$\{order\.total_price\.toFixed\(2\)\} at the shop/);
  assert.match(actions,/PAYMENT only, not food collection/);
  assert.match(actions,/Mark Collected only after physical handover/);
});

test("confirmed pickup writes disable stale cards and unresolved writes permit only exact retry",()=>{
  assert.match(actions,/const \[confirmedPrevious, setConfirmedPrevious\]/);
  assert.match(actions,/confirmedPrevious\.revision === order\.revision/);
  assert.match(actions,/!hasUnconfirmedCommand && !awaitingRefresh/);
  assert.match(actions,/MerchantApi\.hasPendingPickupCommand\(order\)/);
  assert.match(actions,/await MerchantApi\.transitionPickupOrder\(order, action, extra\)/);
  assert.match(actions,/await MerchantApi\.retryPendingPickupOrder\(order\)/);
  assert.match(actions,/markConfirmed\(\)/);
  assert.match(actions,/Retry unresolved command/);
  assert.match(actions,/do not start another payment or handover action/);
  assert.match(actions,/Waiting for refreshed order details/);
  assert.match(api,/pickupMutationsDisabled\(\);/);
  assert.match(api,/sessionStorage\.setItem\(key,JSON\.stringify\(command\)\)/);
  assert.match(api,/if\(sessionStorage\.getItem\(key\)\)throw new MerchantApiError/);
  assert.equal((actions.match(/window\.dispatchEvent\(new Event\("merchant-pickup-order-confirmed"\)\)/g)||[]).length,1);
  // Dispatch is in the single verified helper, never on an unconfirmed error.
  assert.match(actions,/const markConfirmed = \(\) =>/);
});
