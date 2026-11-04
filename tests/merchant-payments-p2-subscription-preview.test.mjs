import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MERCHANT_SUBSCRIPTION_FREE_MONTHS,MERCHANT_SUBSCRIPTION_PLANS,MERCHANT_SUBSCRIPTION_START_POLICY,merchantSubscriptionsNotActivated,merchantSubscriptionPriceLabel} from "../src/services/merchantSubscriptionPreview.ts";
import {merchantPaymentWritesUnavailable,verifiedShopPickupPaymentRecords} from "../src/services/merchantPaymentsTrust.ts";
const page=readFileSync(new URL("../src/components/PaymentHistory.tsx",import.meta.url),"utf8");

test("owner proposed tiers and prices are not active subscriptions",()=>{
 assert.deepEqual(MERCHANT_SUBSCRIPTION_PLANS.map(p=>[p.id,p.name,p.monthlyRand]),[["plus","Plus",199],["pro","Pro",399],["premium","Premium",499]]);
 for(const amount of [199,399,499])assert.equal(merchantSubscriptionPriceLabel(amount),"R"+amount);
 for(const value of [NaN,-1,199.99])assert.equal(merchantSubscriptionPriceLabel(value),"Price unavailable");
 assert.equal(merchantSubscriptionsNotActivated(),true);
 assert.equal(merchantPaymentWritesUnavailable(),true);
});
test("three free calendar months start after each shop is verified live, not during testing",()=>{
 assert.equal(MERCHANT_SUBSCRIPTION_FREE_MONTHS,3);
 assert.match(MERCHANT_SUBSCRIPTION_START_POLICY,/Three free calendar months per shop after verified trading activation/);
 assert.match(MERCHANT_SUBSCRIPTION_START_POLICY,/no billing while in testing/);
 assert.match(page,/free calendar months per shop after its verified launch/);
 assert.match(page,/No plan is selected, no trial countdown has started/);
 assert.match(page,/no subscription charges, invoices or automatic renewals are enabled/);
 assert.match(page,/verified launch date and explicit merchant agreement/);
});
test("existing billing tab shows prices as unselectable drafts with no billing writes",()=>{
 assert.match(page,/paymentsSubTab === "billing" \? \(/);
 assert.match(page,/Proposed shop subscriptions — not active/);
 assert.match(page,/MERCHANT_SUBSCRIPTION_PLANS\.map\(\(plan\) => \(/);
 assert.match(page,/Benefits under discussion/);
 assert.match(page,/Proposed monthly price per shop/);
 assert.match(page,/merchantSubscriptionsNotActivated\(\)/);
 assert.match(page,/Subscription & Billing History/);
 assert.match(page,/No verified billing records are available/);
 assert.doesNotMatch(page,/localStorage|setItem\(|\.from\("payments"\)|subscribe\(|startTrial\(|activatePlan\(|checkout\(|jsPDF|autoTable/);
});
test("confirmed Orders read is still the only source for collection records",()=>{
 assert.match(page,/Collection Payment Records \(\{pickupOrders\?\.length \?\? "—"\}\)/);
 assert.match(page,/verifiedShopPickupPaymentRecords\(orders, shopId, ordersReadState\)/);
 assert.match(page,/disabled=\{merchantPaymentWritesUnavailable\(\)\}/);
 assert.match(page,/Order total \(not settlement\)/);
 assert.match(page,/No collection orders were found in the current verified Orders response/);
 const records=[{id:"a",shop_id:1,delivery_type:"collection",total_price:25},{id:"b",shop_id:2,delivery_type:"collection",total_price:45}];
 assert.equal(verifiedShopPickupPaymentRecords(records,1,"confirmed")?.length,1);
 assert.equal(verifiedShopPickupPaymentRecords(records,1,"unavailable"),null);
});
test("original card/ledger shell, mobile tabs and table still rendered",()=>{
 assert.match(page,/w-full space-y-6 bg-surface-container-lowest p-6 rounded-3xl border/);
 assert.match(page,/grid grid-cols-1 sm:grid-cols-3 gap-3/);
 assert.match(page,/flex items-center gap-2 flex-wrap/);
 assert.match(page,/overflow-x-auto/);
 assert.match(page,/<table className="w-full text-left text-xs text-on-surface">/);
 assert.match(page,/aria-pressed=\{paymentsSubTab === "billing"\}/);
 assert.match(page,/aria-pressed=\{paymentsSubTab === "cod"\}/);
});