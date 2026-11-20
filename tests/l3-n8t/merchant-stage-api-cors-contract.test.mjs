import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  MERCHANT_STAGING_ORIGIN,
  isVerifiedMerchantStagingOrigin,
} from "../../localeats-api/src/middleware/merchantStageCors.ts";
import {
  MERCHANT_STAGING_API_ORIGIN,
  inspectMerchantStagingBuild,
} from "../../scripts/merchant-staging-guard.mjs";

const N8O_API="https://localeats-api-n8o-r52d-mehey9184-makers-projects.vercel.app";
const expectedEnv=()=>({
  VERCEL_ENV:"preview",
  LOCALEATS_STAGING_ONLY:"true",
  FIREBASE_PROJECT_ID:"localeats-staging",
  SUPABASE_URL:"https://rgpbdajhlrwfmhopzgzk.supabase.co",
  PICKUP_WRITES_ENABLED:"false",
  PROFILE_WRITES_ENABLED:"false",
  MERCHANT_AVAILABILITY_WRITES_ENABLED:"false",
  MERCHANT_ACCOUNT_WRITES_ENABLED:"false",
  MERCHANT_STAGING_ORIGIN,
});

test("deployed API-source staging CORS gate admits only exact Merchant origin with isolated read-only context",()=>{
  assert.equal(MERCHANT_STAGING_API_ORIGIN,N8O_API);
  assert.equal(isVerifiedMerchantStagingOrigin(MERCHANT_STAGING_ORIGIN,expectedEnv()),true);
  for(const origin of [
    undefined,
    MERCHANT_STAGING_ORIGIN+".malicious.example",
    "http://localeats-merchant-staging-r52d-mehey9184-makers-projects.vercel.app",
    MERCHANT_STAGING_ORIGIN+"/x",
    "https://dashboard.localeatssa.co.za",
  ]) assert.equal(isVerifiedMerchantStagingOrigin(origin,expectedEnv()),false,String(origin));
});

test("server-side stage identity cannot be copied to Production, unknown DB or writable Preview",()=>{
  for(const [name,value] of [
    ["VERCEL_ENV","production"],
    ["LOCALEATS_STAGING_ONLY","false"],
    ["FIREBASE_PROJECT_ID","localeats-5e26e"],
    ["SUPABASE_URL","https://phdjumtqkooyppxozqsi.supabase.co"],
    ["PICKUP_WRITES_ENABLED","true"],
    ["PROFILE_WRITES_ENABLED","true"],
    ["MERCHANT_ACCOUNT_WRITES_ENABLED","true"],
    ["MERCHANT_AVAILABILITY_WRITES_ENABLED","true"],
    ["MERCHANT_STAGING_ORIGIN","https://evil.example"],
  ]){
    const env=expectedEnv();env[name]=value;
    assert.equal(isVerifiedMerchantStagingOrigin(MERCHANT_STAGING_ORIGIN,env),false,name);
  }
});

test("read-only API Preview gate and Firebase revocation checks still present",()=>{
  const gate=readFileSync(new URL("../../localeats-api/src/middleware/previewReadOnlyGate.ts",import.meta.url),"utf8");
  const auth=readFileSync(new URL("../../localeats-api/src/middleware/authenticateFirebase.ts",import.meta.url),"utf8");
  assert.match(gate,/PREVIEW_READ_ONLY/);
  assert.match(gate,/\["POST","PUT","PATCH","DELETE"\]/);
  assert.match(auth,/verify\(token, true\)/);
  assert.match(auth,/res\.status\(401\)/);
});

test("stage build guard fails closed on arbitrary API URL even if all other fields are plausible",()=>{
  const good={
    LOCALEATS_STAGING_ONLY:"true",
    VITE_MERCHANT_STAGING_ONLY:"true",
    VITE_FIREBASE_CONFIG_SOURCE:"environment",
    VITE_FIREBASE_PROJECT_ID:"localeats-staging",
    VITE_FIREBASE_FIRESTORE_DATABASE_ID:"(default)",
    VITE_LOCALEATS_API_URL:N8O_API,
    VITE_FIREBASE_API_KEY:"synthetic-only",
    VITE_FIREBASE_AUTH_DOMAIN:"localeats-staging.firebaseapp.com",
    VITE_FIREBASE_APP_ID:"1:123456789:web:synthetic",
    VITE_FIREBASE_MESSAGING_SENDER_ID:"123456789",
    VITE_FIREBASE_STORAGE_BUCKET:"localeats-staging.firebasestorage.app",
    VITE_PICKUP_ORDERING_ENABLED:"false",
    VITE_PICKUP_PAYMENT_SETTINGS_ENABLED:"false",
    VITE_PAYMENTS_PLAN_DEMO_ENABLED:"false",
    VITE_MERCHANT_FAKE_ORDERS_ENABLED:"false",
    VITE_REWARDS_ENABLED:"false",
    VITE_LOCALPAY_ENABLED:"false",
    VITE_MERCHANT_PREVIEW_READ_ONLY:"true",
  };
  assert.equal(inspectMerchantStagingBuild("merchant-staging",good,{VERCEL_ENV:"preview"}).ready,true);
  for(const target of ["https://localeats-api.vercel.app","https://localeats-merchant-api-stage-r52d-mehey9184-makers-projects.vercel.app"]){
    assert.equal(inspectMerchantStagingBuild("merchant-staging",{...good,VITE_LOCALEATS_API_URL:target},{VERCEL_ENV:"preview"}).ready,false);
  }
});
