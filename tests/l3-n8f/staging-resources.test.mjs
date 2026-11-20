import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessExistingLocalEatsStaging} from "./staging-resources.mjs";

const seed=()=>({
  production:{firebaseProject:"live-firebase"},
  supabase:{
    productionRef:"live-supabase",stagingRef:"stage-supabase",
    shopAvailability:{
      exists:true,columns:["id","owner_id","approval_status","archived_at"],
      securityInvoker:true,anonSelect:false,authenticatedSelect:false,
    },
  },
  api:{
    firebaseProject:"stage-firebase",
    supabaseProjectRef:"stage-supabase",
    previewOnly:true,stagingOnly:true,readOnlyMiddleware:true,
    pickupWrites:false,profileWrites:false,
    hasAdminCredentialEntries:true,hasStagingServiceRoleEntry:true,
    revocationAwareDeployed:false,adminServiceAccountVerified:false,
  },
  customer:{
    firebaseProject:"stage-firebase",configSource:"environment",
    previewOnly:true,stagingOnly:true,profileWrites:false,
    apiOriginBelongsToStageApi:true,
    firestoreDatabaseId:"(default)",
  },
  merchant:{
    separateStagingTarget:false,
    pickupOrdering:false,
    twoStageOnlyOwnersVerified:false,
  },
});

test("N8F existing Customer/API stage backend verified but Merchant stage not",()=>{
  const result=assessExistingLocalEatsStaging(seed());
  assert.equal(result.existingBackendReady,true);
  assert.deepEqual(result.existingBackendBlockers,[]);
  assert.equal(result.merchantReadOnlyAcceptanceReady,false);
  assert.match(result.merchantBlockers.join(" "),/Merchant staging app/);
  assert.match(result.merchantBlockers.join(" "),/revoked-token checking/);
  assert.equal(result.realFirebaseAuthenticatedTwoMerchantTest,false);
  assert.equal(result.merchantProfileWritesActivated,false);
});

test("N8F explicitly selected (default) database is allowed only in distinct staging Firebase",()=>{
  const match=seed();
  assert.equal(assessExistingLocalEatsStaging(match).existingBackendReady,true);
  const sameProduction=seed();
  sameProduction.production.firebaseProject=sameProduction.api.firebaseProject;
  assert.equal(assessExistingLocalEatsStaging(sameProduction).existingBackendReady,false);
  const missing=seed();
  missing.customer.firestoreDatabaseId=undefined;
  assert.equal(assessExistingLocalEatsStaging(missing).existingBackendReady,false);
});

test("N8F any production Supabase alias or Firebase mismatch blocks staging",()=>{
  const badSupabase=seed();badSupabase.api.supabaseProjectRef=badSupabase.supabase.productionRef;
  assert.equal(assessExistingLocalEatsStaging(badSupabase).existingBackendReady,false);
  const sameSupabase=seed();sameSupabase.supabase.stagingRef=sameSupabase.supabase.productionRef;
  assert.equal(assessExistingLocalEatsStaging(sameSupabase).existingBackendReady,false);
  const mismatch=seed();mismatch.customer.firebaseProject="another-firebase";
  assert.equal(assessExistingLocalEatsStaging(mismatch).existingBackendReady,false);
});

test("N8F staging-only and write-off gates prevent accidental hosted writes",()=>{
  const variants=[
    s=>s.api.previewOnly=false,
    s=>s.api.stagingOnly=false,
    s=>s.api.readOnlyMiddleware=false,
    s=>s.api.pickupWrites=true,
    s=>s.api.profileWrites=true,
    s=>s.customer.previewOnly=false,
    s=>s.customer.stagingOnly=false,
    s=>s.customer.profileWrites=true,
    s=>s.customer.apiOriginBelongsToStageApi=false,
    s=>s.customer.configSource="bundle",
  ];
  for(const change of variants){
    const s=seed();change(s);
    assert.equal(assessExistingLocalEatsStaging(s).existingBackendReady,false);
  }
});

test("N8F strict owner view guards prevent anonymous and accidental direct reads",()=>{
  const variants=[
    s=>s.supabase.shopAvailability.exists=false,
    s=>s.supabase.shopAvailability.columns=["id","owner_id"],
    s=>s.supabase.shopAvailability.securityInvoker=false,
    s=>s.supabase.shopAvailability.anonSelect=true,
    s=>s.supabase.shopAvailability.authenticatedSelect=true,
  ];
  for(const change of variants){
    const s=seed();change(s);
    assert.equal(assessExistingLocalEatsStaging(s).existingBackendReady,false);
  }
});

test("N8F real A/B auth cannot be claimed just by complete synthetic stage metadata",()=>{
  const s=seed();
  Object.assign(s.api,{
    merchantFirestoreDatabaseId:"(default)",revocationAwareDeployed:true,
    adminServiceAccountVerified:true,
  });
  Object.assign(s.merchant,{
    separateStagingTarget:true,firebaseProject:"stage-firebase",
    firebaseConfigSource:"environment",firestoreDatabaseId:"(default)",
    pickupOrdering:false,twoStageOnlyOwnersVerified:true,
  });
  const result=assessExistingLocalEatsStaging(s);
  assert.equal(result.existingBackendReady,true);
  assert.equal(result.merchantReadOnlyAcceptanceReady,true);
  assert.equal(result.realFirebaseAuthenticatedTwoMerchantTest,false);
  assert.equal(result.merchantProfileWritesActivated,false);
});

test("N8F Merchant cannot inherit Production bundled Firebase or skip revocation check",()=>{
  const s=seed();
  Object.assign(s.api,{
    merchantFirestoreDatabaseId:"(default)",
    adminServiceAccountVerified:true,
  });
  Object.assign(s.merchant,{
    separateStagingTarget:true,firebaseProject:s.production.firebaseProject,
    firebaseConfigSource:"bundle",firestoreDatabaseId:"(default)",
    pickupOrdering:false,twoStageOnlyOwnersVerified:true,
  });
  const result=assessExistingLocalEatsStaging(s);
  assert.equal(result.merchantReadOnlyAcceptanceReady,false);
  assert.match(result.merchantBlockers.join(" "),/revoked-token/);
  assert.match(result.merchantBlockers.join(" "),/Firebase project/);
});

test("N8F keep previously prepared profile API unmounted in active server",()=>{
  const active=readFileSync(new URL("../../localeats-api/src/server.ts",import.meta.url),"utf8");
  assert.ok(!active.includes("merchantAccountDormantApi"));
  assert.ok(!active.includes("merchantAccountContract"));
  assert.ok(!active.includes('app.use("/api/v1/merchant/account"'));
});
