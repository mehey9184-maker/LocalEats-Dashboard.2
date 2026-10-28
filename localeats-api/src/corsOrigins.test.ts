import test from "node:test";
import assert from "node:assert/strict";
import {isAllowedOrigin} from "./corsOrigins.js";

test("Preview clients need explicit exact origins; Customer is separate from Merchant",()=>{
 const merchant="https://merchant.example.test", customer="https://customer.example.test";
 assert.equal(isAllowedOrigin(customer,{MERCHANT_DASHBOARD_ORIGIN:merchant}),false);
 const environment={MERCHANT_DASHBOARD_ORIGIN:merchant,CUSTOMER_APP_ORIGIN:customer};
 for(const allowed of [merchant,customer]) assert.equal(isAllowedOrigin(allowed,environment),true);
 for(const denied of [customer+".attacker.test",customer+"/path", "null", "http://customer.example.test"])
  assert.equal(isAllowedOrigin(denied,environment),false);
 for(const invalid of ["https://*.example.test",customer+"/",customer+"?key=value", "https://user:pass@customer.example.test"]){
  assert.equal(isAllowedOrigin(customer,{CUSTOMER_APP_ORIGIN:invalid}),false);
  assert.equal(isAllowedOrigin(invalid,{MERCHANT_DASHBOARD_ORIGIN:invalid}),false);
 }
 // Existing non-browser callers and authorized Rider origins remain supported.
 assert.equal(isAllowedOrigin(undefined,{}),true);
 assert.equal(isAllowedOrigin("https://rider.example.test",{RIDER_APP_ORIGIN:"https://rider.example.test"}),true);
});

test("existing Merchant Preview matching remains HTTPS and origin-only",()=>{
 const environment={MERCHANT_DASHBOARD_PREVIEW_HOST_PREFIX:"merchant-",MERCHANT_DASHBOARD_PREVIEW_HOST_SUFFIX:"-team.vercel.app"};
 assert.equal(isAllowedOrigin("https://merchant-branch-team.vercel.app",environment),true);
 for(const denied of ["http://merchant-branch-team.vercel.app", "https://merchant-branch-team.vercel.app.attacker.test",
  "https://merchant-branch-team.vercel.app/path", "https://customer-branch-team.vercel.app"])
  assert.equal(isAllowedOrigin(denied,environment),false);
});
