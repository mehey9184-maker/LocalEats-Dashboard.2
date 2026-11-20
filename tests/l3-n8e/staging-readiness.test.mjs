import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  assessMerchantStagingIsolation,
  auditHostedEnvironmentMetadata,
} from "./staging-readiness.mjs";

const production={firebaseProjectId:"production-firebase",supabaseUrl:"https://production.supabase.invalid"};
const staging={
  api:{
    firebaseProjectId:"isolated-staging-firebase",
    serviceAccountProjectId:"isolated-staging-firebase",
    firestoreDatabaseId:"staging-merchant-named-db",
    supabaseUrl:"https://staging.supabase.invalid",
    previewReadOnly:true,
    profileWritesEnabled:false,pickupWritesEnabled:false,
    availabilityWritesEnabled:false,
  },
  merchant:{
    firebaseConfigSource:"environment",
    firebaseProjectId:"isolated-staging-firebase",
    firestoreDatabaseId:"staging-merchant-named-db",
    pickupOrderingEnabled:false,
  },
  accounts:{createdInVerifiedStaging:true,uids:["synthetic-A","synthetic-B"]},
};
const eligible=(s,p=production)=>assessMerchantStagingIsolation(s,p);
const clone=()=>structuredClone(staging);

test("N8E safe synthetic configuration is only eligible, not Firebase-auth verified",()=>{
  const result=eligible(clone());
  assert.equal(result.eligibleForReadOnlyAuthTest,true);
  assert.deepEqual(result.blockers,[]);
  assert.equal(result.evidence,"configuration-only");
  assert.equal(result.realFirebaseAuthenticationVerified,false);
});

test("N8E shared production Firebase project fails even if Preview says read-only",()=>{
  const shared=clone();
  shared.api.firebaseProjectId=production.firebaseProjectId;
  shared.api.serviceAccountProjectId=production.firebaseProjectId;
  shared.merchant.firebaseProjectId=production.firebaseProjectId;
  const result=eligible(shared);
  assert.equal(result.eligibleForReadOnlyAuthTest,false);
  assert.match(result.blockers.join(" "),/Production Firebase project/);
});

test("N8E shared production Supabase service target fails even with separate Firebase",()=>{
  const shared=clone();
  shared.api.supabaseUrl=production.supabaseUrl;
  assert.equal(eligible(shared).eligibleForReadOnlyAuthTest,false);
  assert.match(eligible(shared).blockers.join(" "),/Production Supabase/);
});

test("N8E explicit Firebase Admin service-account project must match client and API",()=>{
  for(const modified of [
    {serviceAccountProjectId:"different-firebase"},
    {serviceAccountProjectId:undefined},
    {firebaseProjectId:"different-firebase"},
  ]){
    const s=clone();Object.assign(s.api,modified);
    assert.equal(eligible(s).eligibleForReadOnlyAuthTest,false);
  }
  const s=clone();s.merchant.firebaseProjectId="different-firebase";
  assert.equal(eligible(s).eligibleForReadOnlyAuthTest,false);
});

test("N8F explicit staging (default) Firestore is safe only with distinct matched Firebase project",()=>{
  // A separate Firebase staging project's default DB is not Production's DB.
  const dedicated=clone();
  dedicated.api.firestoreDatabaseId="(default)";
  dedicated.merchant.firestoreDatabaseId="(default)";
  assert.equal(eligible(dedicated).eligibleForReadOnlyAuthTest,true);
  const shared=clone();
  shared.api.firestoreDatabaseId="(default)";
  shared.merchant.firestoreDatabaseId="(default)";
  shared.api.firebaseProjectId=production.firebaseProjectId;
  shared.api.serviceAccountProjectId=production.firebaseProjectId;
  shared.merchant.firebaseProjectId=production.firebaseProjectId;
  assert.equal(eligible(shared).eligibleForReadOnlyAuthTest,false);
  for(const value of ["wrong-firestore",undefined]){
    const s=clone();s.api.firestoreDatabaseId=value;
    assert.equal(eligible(s).eligibleForReadOnlyAuthTest,false);
  }
  const mismatch=clone();mismatch.merchant.firestoreDatabaseId="(default)";
  assert.equal(eligible(mismatch).eligibleForReadOnlyAuthTest,false);
});

test("N8E bundled Firebase settings cannot impersonate a staging environment",()=>{
  for(const value of [undefined,"bundle",""]){
    const s=clone();s.merchant.firebaseConfigSource=value;
    assert.equal(eligible(s).eligibleForReadOnlyAuthTest,false);
  }
});

test("N8E no production mutation or pickup activation allowed during read-only rehearsal",()=>{
  const cases=[
    ["profileWritesEnabled",true],
    ["pickupWritesEnabled",true],
    ["availabilityWritesEnabled",true],
    ["previewReadOnly",false],
  ];
  for(const [key,value] of cases){
    const s=clone();s.api[key]=value;
    assert.equal(eligible(s).eligibleForReadOnlyAuthTest,false,String(key));
  }
  const m=clone();m.merchant.pickupOrderingEnabled=true;
  assert.equal(eligible(m).eligibleForReadOnlyAuthTest,false);
});

test("N8E two distinct accounts must be explicitly attested as isolated",()=>{
  for(const value of [
    undefined,
    {createdInVerifiedStaging:false,uids:["A","B"]},
    {createdInVerifiedStaging:true,uids:["A","A"]},
    {createdInVerifiedStaging:true,uids:["A"]},
  ]){
    const s=clone();s.accounts=value;
    assert.equal(eligible(s).eligibleForReadOnlyAuthTest,false);
  }
});

test("N8E absent target inventory never passes",()=>{
  for(const [s,p] of [[null,null],[null,production],[staging,null]]){
    assert.equal(eligible(s,p).eligibleForReadOnlyAuthTest,false);
  }
});

test("N8E actual Vercel metadata shape reveals shared credentials and missing staging IDs",()=>{
  // Only keys/targets from read-only Vercel inspection, no env values or secrets.
  const apiEnv=[
    {key:"FIREBASE_PROJECT_ID",target:["production","preview"]},
    {key:"FIREBASE_CLIENT_EMAIL",target:["production","preview"]},
    {key:"FIREBASE_PRIVATE_KEY",target:["production","preview"]},
    {key:"SUPABASE_URL",target:["production","preview"]},
    {key:"SUPABASE_SERVICE_ROLE_KEY",target:["production","preview"]},
  ];
  const merchantEnv=[
    {key:"VITE_FIREBASE_PROJECT_ID",target:["production","preview"]},
    {key:"VITE_FIREBASE_API_KEY",target:["production","preview"]},
  ];
  const report=auditHostedEnvironmentMetadata(apiEnv,merchantEnv,[]);
  assert.equal(report.apiHasFirebaseProject,true);
  assert.equal(report.apiHasAdminServiceAccount,true);
  assert.equal(report.apiHasExplicitFirestoreDatabase,false);
  assert.equal(report.merchantHasExplicitFirestoreDatabase,false);
  assert.equal(report.merchantHasEnvironmentConfigOptIn,false);
  assert.equal(report.apiSharesFirebaseCredentialsAcrossProductionPreview,true);
  assert.equal(report.apiSharesSupabaseCredentialsAcrossProductionPreview,true);
  assert.equal(report.hasCustomStagingEnvironment,false);
  assert.equal(report.isolatedStagingVerified,false);
});

test("N8E source-level release guard preserves bundled default and unmouted profile API",()=>{
  const firebase=readFileSync(new URL("../../src/lib/firebase.ts",import.meta.url),"utf8");
  const server=readFileSync(new URL("../../localeats-api/src/server.ts",import.meta.url),"utf8");
  assert.match(firebase,/VITE_FIREBASE_CONFIG_SOURCE === "environment"/);
  assert.match(firebase,/firebaseConfigData\.firestoreDatabaseId/);
  assert.ok(server.includes("app.use(previewReadOnlyGate)"));
  assert.ok(!server.includes("merchantAccountDormantApi"));
  assert.ok(!server.includes("merchantAccountContract"));
  assert.ok(!server.includes('app.use("/api/v1/merchant/account"'));
});
