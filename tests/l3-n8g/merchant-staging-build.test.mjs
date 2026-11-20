import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  MERCHANT_STAGING_API_ORIGIN,
  inspectMerchantStagingBuild,
  assertMerchantStagingBuild,
} from "../../scripts/merchant-staging-guard.mjs";

const valid=()=>({
  LOCALEATS_STAGING_ONLY:"true",
  VITE_MERCHANT_STAGING_ONLY:"true",
  VITE_FIREBASE_CONFIG_SOURCE:"environment",
  VITE_FIREBASE_PROJECT_ID:"localeats-staging",
  VITE_FIREBASE_FIRESTORE_DATABASE_ID:"(default)",
  VITE_LOCALEATS_API_URL:MERCHANT_STAGING_API_ORIGIN,
  VITE_FIREBASE_API_KEY:"synthetic-not-real",
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
});
const preview={VERCEL_ENV:"preview"};

test("N8G dedicated preview build accepts only explicit isolated Firebase and API",()=>{
  const r=assertMerchantStagingBuild("merchant-staging",valid(),preview);
  assert.equal(r.applies,true);
  assert.equal(r.ready,true);
  assert.deepEqual(r.blockers,[]);
});

test("N8G original default production build is not changed by staging gate",()=>{
  const r=inspectMerchantStagingBuild("production",{},preview);
  assert.equal(r.applies,false);
  assert.equal(r.ready,false);
  assert.throws(()=>assertMerchantStagingBuild("production",valid(),preview));
});

test("N8G refuses ordinary Vercel Production and missing Vercel context",()=>{
  for(const system of [{VERCEL_ENV:"production"}, {},{VERCEL_ENV:"development"}]){
    const report=inspectMerchantStagingBuild("merchant-staging",valid(),system);
    assert.equal(report.ready,false);
    assert.match(report.blockers.join(" "),/Vercel Preview/);
  }
});

test("N8G copied Production Firebase project or bundled config fails closed",()=>{
  for(const [key,value] of [
    ["VITE_FIREBASE_PROJECT_ID","gen-lang-client-0863469023"],
    ["VITE_FIREBASE_CONFIG_SOURCE","bundle"],
    ["VITE_FIREBASE_FIRESTORE_DATABASE_ID","ai-studio-production-named"],
    ["VITE_FIREBASE_FIRESTORE_DATABASE_ID",""],
    ["VITE_FIREBASE_PROJECT_ID",undefined],
    ["LOCALEATS_STAGING_ONLY",undefined],
    ["VITE_MERCHANT_STAGING_ONLY",undefined],
  ]){
    const env=valid();env[key]=value;
    assert.equal(inspectMerchantStagingBuild("merchant-staging",env,preview).ready,false,key);
  }
});

test("N8G no implied Firebase default and no partial staging web configuration",()=>{
  for(const key of ["VITE_FIREBASE_API_KEY","VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_APP_ID","VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_STORAGE_BUCKET"]){
    const env=valid();delete env[key];
    assert.equal(inspectMerchantStagingBuild("merchant-staging",env,preview).ready,false,key);
  }
});

test("N8G rejects production, wildcard, or arbitrary API target",()=>{
  for(const url of ["https://localeats-api.vercel.app",
    "https://localeats-api-staging-r52d-evil.vercel.app",
    "https://localhost:3000",
    "http://localhost:3000",
    "https://example.invalid"]){
    const env=valid();env.VITE_LOCALEATS_API_URL=url;
    assert.equal(inspectMerchantStagingBuild("merchant-staging",env,preview).ready,false,url);
  }
});

test("N8G all sensitive merchant ordering/finance/rewards demo toggles explicitly disabled",()=>{
  const flags=[
    "VITE_PICKUP_ORDERING_ENABLED","VITE_PICKUP_PAYMENT_SETTINGS_ENABLED",
    "VITE_PAYMENTS_PLAN_DEMO_ENABLED","VITE_MERCHANT_FAKE_ORDERS_ENABLED",
    "VITE_REWARDS_ENABLED","VITE_LOCALPAY_ENABLED",
  ];
  for(const key of flags){
    for(const value of [undefined,"true","1"]){
      const env=valid();env[key]=value;
      assert.equal(inspectMerchantStagingBuild("merchant-staging",env,preview).ready,false,key);
    }
  }
  const env=valid();env.VITE_MERCHANT_PREVIEW_READ_ONLY="false";
  assert.equal(inspectMerchantStagingBuild("merchant-staging",env,preview).ready,false);
});

test("N8G never allows Production Supabase origin or VITE_ credentials",()=>{
  const env=valid();
  env.VITE_SUPABASE_URL="https://phdjumtqkooyppxozqsi.supabase.co";
  assert.equal(inspectMerchantStagingBuild("merchant-staging",env,preview).ready,false);
  for(const key of ["VITE_SUPABASE_SERVICE_ROLE_KEY","VITE_FIREBASE_PRIVATE_KEY",
    "VITE_DATABASE_URL","VITE_SECRET_KEY"]){
    const e=valid();e[key]="synthetic-placeholder";
    assert.equal(inspectMerchantStagingBuild("merchant-staging",e,preview).ready,false,key);
  }
});

test("N8G no staging-only feature silently writes to Firestore or API",()=>{
  const env=valid();
  assert.equal(inspectMerchantStagingBuild("merchant-staging",env,preview).ready,true);
  const vite=readFileSync(new URL("../../vite.config.ts",import.meta.url),"utf8");
  const manifest=readFileSync(new URL("../../package.json",import.meta.url),"utf8");
  const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
  const firebase=readFileSync(new URL("../../src/lib/firebase.ts",import.meta.url),"utf8");
  assert.match(vite,/mode === 'merchant-staging'/);
  assert.match(vite,/env.LOCALEATS_STAGING_ONLY === 'true'/);
  assert.match(vite,/assertMerchantStagingBuild\(mode, env, process.env\)/);
  assert.match(manifest,/"build:merchant-staging": "vite build --mode merchant-staging"/);
  assert.match(app,/VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(firebase,/VITE_FIREBASE_CONFIG_SOURCE === "environment"/);
});

test("N8T Merchant stage pins exact reviewed Customer N8O API and rejects old stage alias",()=>{
  const n8o="https://localeats-api-n8o-r52d-mehey9184-makers-projects.vercel.app";
  const old="https://localeats-merchant-api-stage-r52d-mehey9184-makers-projects.vercel.app";
  assert.equal(MERCHANT_STAGING_API_ORIGIN,n8o);
  assert.notEqual(MERCHANT_STAGING_API_ORIGIN,old);
  assert.equal(inspectMerchantStagingBuild("merchant-staging",valid(),preview).ready,true);
  for(const forbidden of [
    old,
    "https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app",
    "https://localeats-api.vercel.app",
    "https://localeats-api-n8o-r52d-mehey9184-makers-projects.vercel.app.evil.example",
    "http://localeats-api-n8o-r52d-mehey9184-makers-projects.vercel.app",
    n8o+"/health",
  ]){
    const env=valid();env.VITE_LOCALEATS_API_URL=forbidden;
    assert.equal(inspectMerchantStagingBuild("merchant-staging",env,preview).ready,false,forbidden);
  }
});
