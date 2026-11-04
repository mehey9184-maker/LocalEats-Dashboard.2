import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  MERCHANT_FREE_MONTHS,PROPOSED_MERCHANT_PLANS,
  merchantSubscriptionsActivationEnabled,merchantSubscriptionsTrialNotice,
  merchantSubscriptionPaymentNotice,
} from "../src/services/merchantSubscriptionsPreview.ts";
import {merchantPaymentWritesUnavailable} from "../src/services/merchantPaymentsTrust.ts";
const page=readFileSync(new URL("../src/components/PaymentHistory.tsx",import.meta.url),"utf8");
const source=readFileSync(new URL("../src/services/merchantSubscriptionsPreview.ts",import.meta.url),"utf8");

test("three proposed monthly shop plans show correct ZAR figures and no live activation",()=>{
 assert.equal(MERCHANT_FREE_MONTHS,3);
 assert.deepEqual(PROPOSED_MERCHANT_PLANS.map(p=>[p.id,p.label,p.monthlyPriceZar]),[
   ["plus","Plus",199],["pro","Pro",399],["premium","Premium",499]
 ]);
 assert.equal(merchantSubscriptionsActivationEnabled(),false);
 assert.equal(merchantPaymentWritesUnavailable(),true);
 assert.match(page,/Proposed shop subscriptions — Preview only/);
 assert.match(page,/R\{plan.monthlyPriceZar\}/);
 assert.match(page,/\/month per shop/);
 assert.match(page,/Proposed — not available to select/);
 assert.match(page,/\{PROPOSED_MERCHANT_PLANS\.map\(\(plan\) => \(/);
 assert.match(page,/!merchantSubscriptionsActivationEnabled\(\)/);
 assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|\.insert\(|\.update\(|\.delete\(|navigator|billing\/subscribe/);
});

test("three free months require verified individual shop launch; no invented dates or charges",()=>{
 const trial=merchantSubscriptionsTrialNotice();
 const payment=merchantSubscriptionPaymentNotice();
 assert.match(trial,/first 3 calendar months are free for each shop/);
 assert.match(trial,/starting only from its verified trading launch/);
 assert.match(trial,/No verified launch date or payment due date/);
 assert.match(payment,/No plan is selected, billed or activated/);
 assert.match(payment,/tax treatment require final approval/);
 assert.match(payment,/agree before paid billing can begin/);
 assert.doesNotMatch(source,/new Date|Date\.now|created_at|subscription_start_at/);
 assert.match(page,/\{merchantSubscriptionsTrialNotice\(\)\}/);
 assert.match(page,/\{merchantSubscriptionPaymentNotice\(\)\}/);
});

test("all shop tiers retain essential pickup and pay-at-shop flow",()=>{
 const [plus,pro,premium]=PROPOSED_MERCHANT_PLANS;
 assert.match(plus.proposedBenefits.join(" "),/Pickup order and menu management/);
 assert.match(plus.proposedBenefits.join(" "),/Cash or physical card payment at the shop/);
 assert.match(plus.proposedBenefits.join(" "),/Basic order history/);
 assert.ok(pro.proposedBenefits.includes("Everything in Plus"));
 assert.ok(premium.proposedBenefits.includes("Everything in Pro"));
 assert.match(pro.proposedBenefits.join(" "),/planned/);
 assert.match(premium.proposedBenefits.join(" "),/planned/);
});

test("Payments P1 honest billing and pickup record sections remain unchanged",()=>{
 assert.match(page,/Subscription & Billing History/);
 assert.match(page,/Collection Payment Records/);
 assert.match(page,/verifiedShopPickupPaymentRecords\(orders, shopId, ordersReadState\)/);
 assert.match(page,/No verified billing records are available in this Preview/);
 assert.match(page,/Financial exports require an authoritative billing and settlement API/);
 assert.match(page,/disabled=\{merchantPaymentWritesUnavailable\(\)\}/);
 assert.match(page,/pickupOrders === null \?/);
 assert.match(page,/Order total \(not settlement\)/);
 assert.doesNotMatch(page,/localStorage|Mark Settled|Settled & Cleared|doc\.save|jsPDF/);
});
