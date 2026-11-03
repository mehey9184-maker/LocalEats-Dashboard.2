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

test("Customer P5 exact isolated Preview origins do not broaden CORS or change existing integration access",()=>{
 const p5="https://project-x7cvt-qfmsq5x6d-mehey9184-makers-projects.vercel.app";
 const p5Alias="https://project-x7cvt-git-repair-custo-0a45c9-mehey9184-makers-projects.vercel.app";
 const p6Clean="https://project-x7cvt-d341fimk3-mehey9184-makers-projects.vercel.app";
 const integration="https://project-x7cvt-git-integration-c17400-mehey9184-makers-projects.vercel.app";
 const env={
   VERCEL_ENV:"preview",
   CUSTOMER_APP_ORIGIN:integration,
   CUSTOMER_PROFILE_STAGING_ORIGINS:p5+","+p5Alias+","+p6Clean,
 };
 for(const origin of [p5,p5Alias,p6Clean,integration])assert.equal(isAllowedOrigin(origin,env),true);
 for(const origin of [
   "http://project-x7cvt-qfmsq5x6d-mehey9184-makers-projects.vercel.app",
   p5+"/",p5+"/api/v1/catalog/shops",p5+".evil.invalid",
   "https://project-x7cvt-random-other-team.vercel.app",
   "https://project-x7cvt-qfmsq5x6d-mehey9184-makers-projects.vercel.app.evil.invalid",
   "https://project-x7cvt-not-approved-mehey9184-makers-projects.vercel.app",
   "null",
 ])assert.equal(isAllowedOrigin(origin,env),false,origin);
 assert.equal(isAllowedOrigin(p5,{...env,VERCEL_ENV:"production"}),false);
 assert.equal(isAllowedOrigin(p6Clean,{...env,VERCEL_ENV:"production"}),false);
 assert.equal(isAllowedOrigin(integration,{...env,VERCEL_ENV:"production"}),true);
 assert.equal(isAllowedOrigin(p5,{...env,CUSTOMER_PROFILE_STAGING_ORIGINS:p5+"/"}),false);
 assert.equal(isAllowedOrigin(p5,{...env,CUSTOMER_PROFILE_STAGING_ORIGINS:"*"}),false);
 assert.equal(isAllowedOrigin(p5,{...env,CUSTOMER_PROFILE_STAGING_ORIGINS:p5+","+p5Alias+","+p6Clean+","+p5}),false);
 assert.equal(isAllowedOrigin(p5,{...env,CUSTOMER_PROFILE_STAGING_ORIGINS:""}),false);
});
