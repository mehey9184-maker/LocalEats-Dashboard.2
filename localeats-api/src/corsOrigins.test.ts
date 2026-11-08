import test from "node:test";
import assert from "node:assert/strict";
import {isAllowedOrigin} from "./corsOrigins.js";
test("canonical production Customer and explicit Preview origins pass, lookalikes fail",()=>{
 const env={MERCHANT_DASHBOARD_ORIGIN:"https://dashboard.localeatssa.co.za",CUSTOMER_APP_ORIGIN:"https://customer-preview.example.test"};
 for(const origin of ["https://www.localeatssa.co.za",env.MERCHANT_DASHBOARD_ORIGIN,env.CUSTOMER_APP_ORIGIN])assert.equal(isAllowedOrigin(origin,env),true);
 for(const origin of ["http://www.localeatssa.co.za","https://www.localeatssa.co.za.evil.test","https://www.localeatssa.co.za/path","null"])assert.equal(isAllowedOrigin(origin,env),false);
 assert.equal(isAllowedOrigin(undefined,{}),true);
 assert.equal(isAllowedOrigin("https://rider.example.test",{RIDER_APP_ORIGIN:"https://rider.example.test"}),true);
});


test("R5.2E staging API never accepts Production, Merchant or unknown browser origins",()=>{
 const env={
  LOCALEATS_STAGING_ONLY:"true",
  CUSTOMER_APP_ORIGIN:"https://localeats-customer-staging-example.vercel.app",
  MERCHANT_DASHBOARD_ORIGIN:"https://dashboard.localeatssa.co.za",
  RIDER_APP_ORIGIN:"https://rider.example.test"
 };
 assert.equal(isAllowedOrigin(env.CUSTOMER_APP_ORIGIN,env),true);
 for(const origin of ["https://www.localeatssa.co.za",env.MERCHANT_DASHBOARD_ORIGIN,
    env.RIDER_APP_ORIGIN,"https://some-other-staging.vercel.app",
    "http://localeats-customer-staging-example.vercel.app",
    env.CUSTOMER_APP_ORIGIN+"/path","null"]){
  assert.equal(isAllowedOrigin(origin,env),false,origin);
 }
 assert.equal(isAllowedOrigin(undefined,env),true);
 assert.equal(isAllowedOrigin(env.CUSTOMER_APP_ORIGIN,{
   ...env,CUSTOMER_APP_ORIGIN:"http://localeats-customer-staging-example.vercel.app"
 }),false);
});
