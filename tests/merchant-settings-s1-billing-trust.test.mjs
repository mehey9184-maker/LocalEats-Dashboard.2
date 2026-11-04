import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MERCHANT_FREE_MONTHS,PROPOSED_MERCHANT_PLANS,merchantSubscriptionsActivationEnabled} from "../src/services/merchantSubscriptionsPreview.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/App.tsx"),billing=read("src/components/SettingsBillingPreview.tsx");
test("shared proposed price and feature matrix stays inactive",()=>{
 assert.equal(MERCHANT_FREE_MONTHS,3);
 assert.deepEqual(PROPOSED_MERCHANT_PLANS.map(p=>[p.id,p.monthlyPriceZar]),[["plus",199],["pro",399],["premium",499]]);
 assert.equal(merchantSubscriptionsActivationEnabled(),false);
 assert.match(billing,/PROPOSED_MERCHANT_PLANS.map/);
 assert.match(app,/settingsCategory === "billing" && <SettingsBillingPreview \/>/);
 const [plus,pro,premium]=PROPOSED_MERCHANT_PLANS;
 assert.match(plus.proposedBenefits.join(" "),/Pickup order and menu management/);
 assert.match(plus.proposedBenefits.join(" "),/no order cap proposed/);
 assert.match(pro.proposedBenefits.join(" "),/Everything in Plus/);
 assert.match(premium.proposedBenefits.join(" "),/Everything in Pro/);
});
test("Settings has no browser card/CVV storage or unverified invoices",()=>{
 assert.doesNotMatch(app,/localeats_billing_details|billingDetails|selectedInvoice|100% Lifetime Discount|permanent 50% discount|Unlimited Features Included/);
 assert.doesNotMatch(billing,/localStorage|sessionStorage|<input|cardNumber|cardholderName/);
 assert.match(billing,/Do not enter card numbers, expiry dates or CVV/);
 assert.match(billing,/No verified invoices are available in this Preview/);
 assert.match(billing,/Save Billing Info — Unavailable/);
 assert.match(app,/const trialInfo = null;/);
 for(const fake of ["INV-2026-001","INV-2026-002","INV-2026-003","Paid in full. Your card ending in"]){
  assert.ok(!app.includes(fake));
 }
});
test("Settings content is inert but tab navigation remains usable",()=>{
 assert.match(app,/const settingsPreviewPanelRef = useRef<HTMLDivElement>\(null\)/);
 assert.match(app,/element\.inert = true/);
 assert.match(app,/ref=\{settingsPreviewPanelRef\}/);
 assert.match(app,/onClickCapture=\{\(event\) => \{ event\.preventDefault\(\); event\.stopPropagation\(\); \}\}/);
 assert.match(app,/onKeyDownCapture=\{\(event\) => \{ event\.preventDefault\(\); event\.stopPropagation\(\); \}\}/);
 assert.match(app,/onSubmitCapture=\{\(event\) => \{ event\.preventDefault\(\); event\.stopPropagation\(\); \}\}/);
 assert.match(app,/onClick=\{\(\) => setSettingsCategory\(category.id\)\}/);
 assert.match(app,/Settings Preview is read-only/);
 assert.match(app,/Bank payouts are not part of the current collection-only pilot/);
 assert.match(app,/Access Not Verified/);
});
