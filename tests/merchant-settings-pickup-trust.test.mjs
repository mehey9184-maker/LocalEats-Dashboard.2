import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const between=(from,to)=>{
  const a=app.indexOf(from),b=app.indexOf(to,a+from.length);
  assert.ok(a>=0 && b>a,"Missing distinct Settings boundaries");
  return app.slice(a,b);
};

test("Settings navigation and owned-shop Storefront entry remain intact",()=>{
  assert.match(app,/Manage your account and storefront preferences/);
  for(const id of ["account","storefront","operations","delivery","hardware","billing","preferences","diagnostics"]){
    assert.match(app,new RegExp('id: "'+id+'"'));
  }
  assert.match(app,/settingsCategory === "storefront"/);
  assert.match(app,/setActiveTab\("storefront"\)/);
  assert.match(app,/<ShopProfile[\s\S]*?shop=\{currentShop\}/);
  assert.match(app,/acceptAuthoritativeMerchantShop/);
});

test("Billing is future-only; never requests or saves raw payment cards or pretends invoices exist",()=>{
  const panel=between('{settingsCategory === "billing" && (','{settingsCategory === "preferences" && (');
  assert.match(panel,/no subscription billing is active/);
  assert.match(panel,/no card details, online payments, invoices or automatic payouts/);
  assert.doesNotMatch(panel,/<input\b|<form\b|onClick=\{async|setItem\(/i);
  for(const token of ["cardNumber","expiryDate","cvv","isCardSaved","setBillingDetails",
                      "selectedInvoice","PCI-DSS Secure","Securely Link Card","INV-2026-001"]){
    assert.doesNotMatch(app,new RegExp(token));
  }
  assert.match(app,/localStorage\.removeItem\("localeats_billing_details"\)/);
  assert.doesNotMatch(app,/localStorage\.(getItem|setItem)\("localeats_billing_details"/);
});

test("Delivery settings and Rider Marketplace are inert with future-only explanatory text",()=>{
  const delivery=between('{settingsCategory === "delivery" && (','{settingsCategory === "hardware" && (');
  assert.match(delivery,/Delivery — Coming soon/);
  assert.match(delivery,/Customers collect and pay at your shop/);
  assert.match(delivery,/setSettingsCategory\("storefront"\)/);
  assert.doesNotMatch(delivery,/deliverySettings|updateFirestoreShop|supabase|<input|onSave=/);
  assert.doesNotMatch(app,/Save Delivery Settings|setDeliverySettings|rider\.localeatssa\.co\.za/);
  assert.match(app,/Rider Marketplace[\s\S]{0,180}Coming soon/);
});

test("Account has truthful pay-at-shop info, not invented bank or staff verification",()=>{
  assert.match(app,/Payment at your shop/);
  assert.match(app,/LocalEats bank payouts are not active/);
  assert.doesNotMatch(app,/Payouts & Banking|1 Active|Manage your bank account for weekly payouts/);
  assert.match(app,/Staff Accounts coming soon/);
  assert.match(app,/Edit Profile/);
});
